/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */


import React, { useCallback, useState } from 'react';
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuButton,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Button,
  Spinner,
} from '@fluentui/react-components';
import { ArrowDownload24Regular } from '@fluentui/react-icons';
import {
  buildExportFilename,
  mimeFor,
  toCsvAsync,
  toJson,
  toNdjsonAsync,
  type ExportColumn,
  type ExportFormat,
  type ExportRow,
} from '../../utils/export';
import { download } from '../../utils/download';
import { trackEvent, trackException, TelemetryEvents } from '../../services/telemetry/telemetry-service';

const SOFT_CAP_ROWS = 250_000;

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV (.csv)',
  json: 'JSON (.json)',
  ndjson: 'NDJSON (.ndjson)',
};

export type ExportScope = 'all-filtered' | 'page' | 'report';

export interface ExportMenuProps {
  /** Stable surface identifier for telemetry & filenames (e.g. "tables", "transactions"). */
  surface: string;
  /** Per-instance slug (e.g. table name). Optional. */
  slug?: string | null;
  /**
   * Called once when an export format is confirmed. Should return the rows
   * (and optional column ordering) to be exported.
   *
   * The surface is responsible for re-running its own query at full breadth
   * (i.e. without the visible page limit) when `scope === 'all-filtered'`.
   */
  fetchRows: () => Promise<{ rows: ExportRow[]; columns?: ExportColumn[] }>;
  /**
   * Best-effort upper bound on the number of rows that {@link fetchRows} may
   * return, used to gate the >250 000-row confirmation dialog. If omitted,
   * the soft cap is enforced after the fetch instead.
   */
  rowCountHint?: number;
  /** Telemetry-friendly description of what's being exported. */
  scope?: ExportScope;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Fluent UI Button appearance. */
  appearance?: 'primary' | 'secondary' | 'subtle' | 'transparent' | 'outline';
  /** Fluent UI Button size. */
  size?: 'small' | 'medium' | 'large';
  /** Optional: customise the filename slug independent of `slug`. */
  filenameSlug?: string;
  /** Notified after a successful download. */
  onComplete?: (result: { format: ExportFormat; rowCount: number; byteCount: number }) => void;
  /** Notified when fetchRows or formatting throws. Defaults to console.error. */
  onError?: (error: unknown) => void;
}

/**
 * Format any of {csv, json, ndjson} via the shared utilities.
 *
 * Local helper — not exported because react-refresh requires component-only modules.
 */
async function formatRows(
  format: ExportFormat,
  rows: readonly ExportRow[],
  columns?: readonly ExportColumn[]
): Promise<string> {
  switch (format) {
    case 'csv':
      return toCsvAsync(rows, columns);
    case 'ndjson':
      return toNdjsonAsync(rows);
    case 'json':
      return toJson(rows);
  }
}

/** Fluent UI v9 export menu. */
export const ExportMenu: React.FC<ExportMenuProps> = (props) => {
  const {
    surface,
    slug,
    fetchRows,
    rowCountHint,
    scope = 'all-filtered',
    disabled,
    appearance = 'subtle',
    size = 'medium',
    filenameSlug,
    onComplete,
    onError,
  } = props;

  const [isWorking, setIsWorking] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const performExport = useCallback(
    async (format: ExportFormat) => {
      const startedAt = performance.now();
      let rowCount = 0;
      let byteCount = 0;
      let success = false;
      try {
        setIsWorking(true);
        const fetched = await fetchRows();
        rowCount = fetched.rows.length;
        const text = await formatRows(format, fetched.rows, fetched.columns);
        const filename = buildExportFilename(surface, filenameSlug ?? slug ?? null, format);
        byteCount = download(filename, text, mimeFor(format));
        success = true;
        onComplete?.({ format, rowCount, byteCount });
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
           
          console.error('[ExportMenu] export failed', err);
        }
        if (err instanceof Error) {
          trackException(err, { surface, format });
        }
      } finally {
        const durationMs = Math.round(performance.now() - startedAt);
        trackEvent(TelemetryEvents.EXPORT_PERFORMED, {
          format,
          surface,
          scope,
          rowCount,
          byteCount,
          durationMs,
          success,
        });
        setIsWorking(false);
        setPendingFormat(null);
      }
    },
    [fetchRows, filenameSlug, onComplete, onError, scope, slug, surface]
  );

  const handleSelect = useCallback(
    (format: ExportFormat) => {
      if (rowCountHint != null && rowCountHint > SOFT_CAP_ROWS) {
        setPendingFormat(format);
        setConfirmOpen(true);
        return;
      }
      void performExport(format);
    },
    [performExport, rowCountHint]
  );

  const handleConfirmContinue = useCallback(() => {
    setConfirmOpen(false);
    if (pendingFormat) {
      void performExport(pendingFormat);
    }
  }, [pendingFormat, performExport]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmOpen(false);
    setPendingFormat(null);
  }, []);

  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <MenuButton
            appearance={appearance}
            size={size}
            icon={isWorking ? <Spinner size="tiny" /> : <ArrowDownload24Regular />}
            disabled={disabled || isWorking}
            aria-label="Export"
            data-testid={`export-menu-${surface}`}
          >
            Export
          </MenuButton>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {(['csv', 'json', 'ndjson'] as const).map((fmt) => (
              <MenuItem
                key={fmt}
                onClick={() => handleSelect(fmt)}
                data-testid={`export-menu-${surface}-${fmt}`}
              >
                {FORMAT_LABELS[fmt]}
              </MenuItem>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>

      <Dialog open={confirmOpen} onOpenChange={(_, data) => !data.open && handleConfirmCancel()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Export a large result set?</DialogTitle>
            <DialogContent>
              This export contains approximately{' '}
              <strong>{rowCountHint?.toLocaleString('en-US')}</strong> rows. Large exports
              are assembled in the browser and may briefly slow the tab. Continue?
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={handleConfirmCancel}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleConfirmContinue}>
                Export anyway
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};

export default ExportMenu;
