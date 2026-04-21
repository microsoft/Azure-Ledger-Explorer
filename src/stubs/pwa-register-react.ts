/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Stub for `virtual:pwa-register/react` used when VitePWA is disabled
 * (e.g. GitHub Pages builds where coi-serviceworker handles COOP/COEP).
 */

import { useState } from 'react';

type RegisterSWOptions = {
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
};

export function useRegisterSW(_options?: RegisterSWOptions): {
  offlineReady: [boolean, (value: boolean) => void];
  needRefresh: [boolean, (value: boolean) => void];
  updateServiceWorker: () => Promise<void>;
} {
  const offlineReady = useState(false);
  const needRefresh = useState(false);
  return {
    offlineReady,
    needRefresh,
    updateServiceWorker: async () => {},
  };
}
