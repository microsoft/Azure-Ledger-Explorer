/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

export { TelemetryProvider } from './TelemetryProvider';
export { useTelemetry } from './use-telemetry';
export type { TelemetryContextValue } from './use-telemetry';
export {
  initializeTelemetry,
  trackPageView,
  trackEvent,
  trackException,
  isTelemetryEnabled,
  setTelemetryEnabled,
  getAppInsights,
  getReactPlugin,
  TelemetryEvents,
} from './telemetry-service';
