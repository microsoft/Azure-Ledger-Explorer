/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useContext, createContext } from 'react';
import type {
  trackPageView,
  trackEvent,
  trackException,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from './telemetry-service';
import { TelemetryEvents } from './telemetry-service';

export interface TelemetryContextValue {
  trackPageView: typeof trackPageView;
  trackEvent: typeof trackEvent;
  trackException: typeof trackException;
  isTelemetryEnabled: typeof isTelemetryEnabled;
  setTelemetryEnabled: typeof setTelemetryEnabled;
  TelemetryEvents: typeof TelemetryEvents;
}

export const TelemetryContext = createContext<TelemetryContextValue | null>(null);

/**
 * Hook to access telemetry functions from components.
 * 
 * @example
 * const { trackEvent, TelemetryEvents } = useTelemetry();
 * trackEvent(TelemetryEvents.FILE_UPLOADED, { fileCount: 3 });
 */
export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext);
  
  if (!context) {
    // Return no-op functions if used outside provider
    // This allows components to work even if telemetry isn't set up
    return {
      trackPageView: () => {},
      trackEvent: () => {},
      trackException: () => {},
      isTelemetryEnabled: () => false,
      setTelemetryEnabled: () => {},
      TelemetryEvents,
    };
  }
  
  return context;
}
