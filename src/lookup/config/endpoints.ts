/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Shared by the browser bundle and the Vite dev proxy (Node), so this module
// must not use `import.meta.env` or browser globals.

/** The canary (centraluseuap) control plane, which proxies ledger reads. */
export const CONTROL_PLANE_HOST = 'https://centraluseuap.controlplane.confidential-ledger.core.azure.com';

/** The canary identity service, which serves ledger certificates and the index. */
export const IDENTITY_HOST = 'https://centraluseuap.identity.confidential-ledger.core.azure.com';
