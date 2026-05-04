/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useCallback, useState } from 'react';
import {
  makeStyles,
  Button,
  Spinner,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import { PlayCircle24Regular } from '@fluentui/react-icons';
import { useFileDrop } from '../../hooks/use-ccf-data';
import { trackEvent, TelemetryEvents } from '../../services/telemetry';

const useStyles = makeStyles({
  button: {
    fontWeight: tokens.fontWeightSemibold,
  },
});

/**
 * Path of the bundled sample ledger, served from `public/samples/`.
 * Resolves against the Vite base URL so the app works under sub-paths.
 */
const SAMPLE_FILENAME = 'ledger_1-14.committed';
const getSampleUrl = (): string => {
  const base = import.meta.env.BASE_URL || '/';
  const trimmed = base.endsWith('/') ? base : `${base}/`;
  return `${trimmed}samples/${SAMPLE_FILENAME}`;
};

export interface LoadSampleButtonProps {
  /** Invoked when an error occurs loading or processing the sample. */
  onError?: (message: string) => void;
  /** Invoked once the sample has been handed off for processing. */
  onLoaded?: () => void;
  /**
   * If true, disable the button regardless of internal state. Useful when the
   * parent wants to gate the CTA on app-wide import busyness (so users can't
   * start a sample-load while another import is already running).
   */
  disabled?: boolean;
  /** Optional className passthrough for layout tweaks at the call-site. */
  className?: string;
}

/**
 * One-click "Load sample ledger" CTA used on the empty state.
 *
 * Fetches the bundled `public/samples/ledger_1-14.committed` asset, wraps it
 * as a `File`, and feeds it through the same `useFileDrop().handleFiles` path
 * as a normal drag-and-drop import — so users see a populated app immediately.
 */
export const LoadSampleButton: React.FC<LoadSampleButtonProps> = ({ onError, onLoaded, disabled, className }) => {
  const styles = useStyles();
  const { handleFiles, isUploading, uploadProgress } = useFileDrop();
  const [isFetching, setIsFetching] = useState(false);

  // `isUploading` is per-hook-instance; `uploadProgress` is the shared store
  // (set/cleared by `handleFiles` itself), so we treat any non-null progress
  // value as "an import is already in flight somewhere in the app" and refuse
  // to start a competing one.
  const hasGlobalImport = uploadProgress !== null;
  // Are we (or anyone) actively running an import? This drives the "Loading…"
  // affordance; the externally-supplied `disabled` prop only blocks clicks, it
  // shouldn't change the label, otherwise the button looks like it's already
  // doing work when the parent is just gating the CTA.
  const isInFlight = isFetching || isUploading || hasGlobalImport;
  const isDisabled = isInFlight || !!disabled;

  const handleClick = useCallback(async () => {
    if (isDisabled) return;
    setIsFetching(true);
    try {
      const response = await fetch(getSampleUrl());
      if (!response.ok) {
        throw new Error(`Failed to fetch sample ledger (${response.status} ${response.statusText})`);
      }
      const blob = await response.blob();
      const file = new File([blob], SAMPLE_FILENAME, { type: 'application/octet-stream' });
      // Hand off to the standard import path. handleFiles drives upload progress
      // and verification just like a normal drag-and-drop.
      await handleFiles([file]);
      trackEvent(TelemetryEvents.ONBOARDING_SAMPLE_LOADED, { success: true });
      onLoaded?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sample ledger';
      trackEvent(TelemetryEvents.ONBOARDING_SAMPLE_LOADED, { success: false, error: message });
      onError?.(message);
    } finally {
      setIsFetching(false);
    }
  }, [handleFiles, isDisabled, onError, onLoaded]);

  return (
    <Tooltip content="Load a small bundled sample ledger so you can try the app instantly" relationship="description">
      <Button
        appearance="secondary"
        size="medium"
        className={`${styles.button} ${className ?? ''}`.trim()}
        icon={isInFlight ? <Spinner size="extra-tiny" /> : <PlayCircle24Regular />}
        onClick={handleClick}
        disabled={isDisabled}
      >
        {isInFlight ? 'Loading sample…' : 'Load sample ledger'}
      </Button>
    </Tooltip>
  );
};
