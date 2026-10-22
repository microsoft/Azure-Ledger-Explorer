/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_ENABLE_SAGE: string;
  /** MST lookup: override the ledger proxy base URL. */
  readonly VITE_MST_PROXY_BASE?: string;
  /** MST lookup: override the identity service base URL. */
  readonly VITE_MST_IDENTITY_BASE?: string;
  /** MST lookup: override the mst-indexer read API base URL. */
  readonly VITE_MST_INDEXER_BASE?: string;
  /** MST lookup: where the "CCF Ledger Explorer" footer link points (default `../`). */
  readonly VITE_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Asset imports
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

// PWA virtual modules
declare module 'virtual:pwa-register/react' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, (value: boolean) => void];
    offlineReady: [boolean, (value: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
