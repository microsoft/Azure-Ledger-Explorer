/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  initializeTelemetry,
  trackPageView,
  trackEvent,
  trackException,
  isTelemetryEnabled,
  setTelemetryEnabled,
  TelemetryEvents,
} from './telemetry-service';
import { TelemetryContext } from './use-telemetry';
import type { TelemetryContextValue } from './use-telemetry';

interface TelemetryProviderProps {
  children: ReactNode;
}

/**
 * Map route paths to human-readable page names.
 */
function getPageNameFromPath(pathname: string): string {
  // Remove leading slash and handle root
  const path = pathname.replace(/^\//, '') || 'start';
  
  // Handle dynamic routes
  if (path.startsWith('transaction/')) {
    return 'Transaction Details';
  }
  if (path.startsWith('tables/')) {
    return 'Table View';
  }
  
  // Static page names
  const pageNames: Record<string, string> = {
    '': 'Start',
    'start': 'Start',
    'files': 'Files',
    'tables': 'Tables',
    'stats': 'Statistics',
    'chat': 'AI Chat',
    'verification': 'Verification',
    'write-receipt': 'Write Receipt',
    'mst-receipt': 'MST Receipt',
    'cose-viewer': 'COSE Viewer',
    'config': 'Settings',
  };
  
  return pageNames[path] || path;
}

/**
 * TelemetryProvider wraps the app to provide telemetry context
 * and automatic page view tracking on route changes.
 */
export function TelemetryProvider({ children }: TelemetryProviderProps): React.ReactElement {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  
  // Initialize telemetry on mount
  useEffect(() => {
    initializeTelemetry();
  }, []);
  
  // Track page views on route changes
  useEffect(() => {
    // Avoid tracking the same page twice (e.g., on initial mount + first render)
    if (previousPathRef.current === location.pathname) {
      return;
    }
    
    previousPathRef.current = location.pathname;
    const pageName = getPageNameFromPath(location.pathname);
    trackPageView(pageName, location.pathname);
  }, [location.pathname]);
  
  const value: TelemetryContextValue = {
    trackPageView,
    trackEvent,
    trackException,
    isTelemetryEnabled,
    setTelemetryEnabled,
    TelemetryEvents,
  };
  
  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}
