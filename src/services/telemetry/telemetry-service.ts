/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const TELEMETRY_STORAGE_KEY = 'ccf-telemetry-enabled';

let appInsights: ApplicationInsights | null = null;
let reactPlugin: ReactPlugin | null = null;
let isInitialized = false;

/**
 * Check if telemetry is enabled by user preference.
 * Default is true (opt-out model).
 */
export function isTelemetryEnabled(): boolean {
  const stored = localStorage.getItem(TELEMETRY_STORAGE_KEY);
  // Default to enabled if not set (opt-out model)
  return stored !== 'false';
}

/**
 * Set telemetry enabled/disabled preference.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  localStorage.setItem(TELEMETRY_STORAGE_KEY, String(enabled));
  
  if (enabled && !isInitialized) {
    initializeTelemetry();
  } else if (!enabled && appInsights) {
    // Disable tracking but keep instance (in case user re-enables)
    appInsights.config.disableTelemetry = true;
  } else if (enabled && appInsights) {
    appInsights.config.disableTelemetry = false;
  }
}

/**
 * Get the React plugin instance for use with the React context.
 */
export function getReactPlugin(): ReactPlugin | null {
  return reactPlugin;
}

/**
 * Get the Application Insights instance.
 */
export function getAppInsights(): ApplicationInsights | null {
  return appInsights;
}

/**
 * Initialize Application Insights telemetry.
 * Only initializes if:
 * - Connection string is configured via VITE_APPINSIGHTS_CONNECTION_STRING
 * - User has not opted out
 * - Not already initialized
 */
export function initializeTelemetry(): boolean {
  // Already initialized
  if (isInitialized) {
    return true;
  }

  // Check user preference
  if (!isTelemetryEnabled()) {
    return false;
  }

  // Get connection string from environment
  const connectionString = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    // No connection string configured - silently skip telemetry
    // This is expected for local development
    return false;
  }

  try {
    reactPlugin = new ReactPlugin();
    
    appInsights = new ApplicationInsights({
      config: {
        connectionString,
        extensions: [reactPlugin],
        enableAutoRouteTracking: false, // We handle this manually via React Router
        disableAjaxTracking: true, // No backend to track
        disableFetchTracking: true, // Minimize noise from external API calls
        disableExceptionTracking: false, // Track JS errors
        autoTrackPageVisitTime: true, // Track time spent on pages
        enableCorsCorrelation: false, // No backend correlation needed
        disableCookiesUsage: false, // Allow cookies for session tracking
        enableSessionStorageBuffer: true, // Buffer events in session storage
        maxBatchInterval: 15000, // Batch events every 15 seconds
        isStorageUseDisabled: false, // Allow localStorage for retry buffer
        isBrowserLinkTrackingEnabled: false, // Disable browser link tracking
        enableRequestHeaderTracking: false, // Don't track request headers
        enableResponseHeaderTracking: false, // Don't track response headers
      },
    });

    // Disable IP address collection by adding a telemetry initializer
    // This removes the client IP before telemetry is sent
    appInsights.addTelemetryInitializer((envelope) => {
      if (envelope.tags) {
        // Remove client IP tag
        delete envelope.tags['ai.location.ip'];
      }
      // Also clear any location data that might contain IP-derived info
      if (envelope.data) {
        const baseData = envelope.data as Record<string, unknown>;
        if (baseData['baseData'] && typeof baseData['baseData'] === 'object') {
          const data = baseData['baseData'] as Record<string, unknown>;
          delete data['clientIP'];
          delete data['ip'];
        }
      }
      return true; // Continue sending the telemetry
    });

    appInsights.loadAppInsights();
    isInitialized = true;
    
    return true;
  } catch (error) {
    console.error('[Telemetry] Failed to initialize Application Insights:', error);
    return false;
  }
}

/**
 * Track a page view.
 */
export function trackPageView(name: string, uri?: string): void {
  if (!appInsights || !isTelemetryEnabled()) return;
  
  appInsights.trackPageView({
    name,
    uri: uri ?? window.location.pathname,
  });
}

/**
 * Track a custom event.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!appInsights || !isTelemetryEnabled()) return;
  
  appInsights.trackEvent({
    name,
    properties: properties as Record<string, string>,
  });
}

/**
 * Track an exception/error.
 */
export function trackException(error: Error, properties?: Record<string, string>): void {
  if (!appInsights || !isTelemetryEnabled()) return;
  
  appInsights.trackException({
    exception: error,
    properties,
  });
}

// Telemetry event names for consistency
export const TelemetryEvents = {
  // File operations
  FILE_UPLOADED: 'FileUploaded',
  FILE_DELETED: 'FileDeleted',
  
  // Table operations
  TABLE_VIEWED: 'TableViewed',
  SQL_QUERY_EXECUTED: 'SqlQueryExecuted',
  
  // Verification
  VERIFICATION_STARTED: 'VerificationStarted',
  VERIFICATION_COMPLETED: 'VerificationCompleted',
  
  // AI Chat
  CHAT_MESSAGE_SENT: 'ChatMessageSent',
  
  // Navigation
  PAGE_VIEWED: 'PageViewed',
  
  // Settings
  TELEMETRY_TOGGLED: 'TelemetryToggled',
  THEME_CHANGED: 'ThemeChanged',
} as const;
