/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ProxyOptions } from 'vite'
import { CONTROL_PLANE_HOST, IDENTITY_HOST } from './src/lookup/config/endpoints'

/**
 * The MST lookup page reads from services that send no CORS headers for
 * localhost, so in development it reaches them through the dev server.
 * The `Connection: close` http-proxy adds is dropped: the control-plane proxy
 * forwards it to the ledger, which can then reject the request.
 */
export const mstLookupDevProxy: Record<string, ProxyOptions> = {
  '/mst-dev/proxy': {
    target: CONTROL_PLANE_HOST,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/mst-dev\/proxy/, '/api/Proxy'),
    configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('connection')),
  },
  '/mst-dev/identity': {
    target: IDENTITY_HOST,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/mst-dev\/identity/, '/ledgerIdentity'),
  },
  '/mst-dev/indexer': {
    target: IDENTITY_HOST,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/mst-dev\/indexer/, '/odata/ledgers'),
  },
}
