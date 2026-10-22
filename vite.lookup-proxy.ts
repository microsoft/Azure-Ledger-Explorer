/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import type { ProxyOptions } from 'vite'
import { CONTROL_PLANE_HOST, IDENTITY_HOST } from './src/lookup/config/endpoints'

/**
 * The MST lookup page reads from services that send no CORS headers for
 * localhost, so in development it reaches them through the dev server.
 * The `Connection: close` http-proxy adds is dropped: the control-plane proxy
 * forwards it to the ledger, which can then reject the request.
 *
 * Optional overrides, read from the dev server's environment (not exposed to
 * the page), for a ledger outside the canary region, such as a test ledger:
 * - `MST_DEV_IDENTITY_HOST`: identity service host for `/mst-dev/identity`.
 * - `MST_DEV_LEDGER_URL` and `MST_DEV_LEDGER_CA`: send `/mst-dev/proxy/{ledger}/...`
 *   straight to this one ledger instead of the control-plane proxy, trusting
 *   only the PEM service certificate in `MST_DEV_LEDGER_CA`.
 * - `MST_DEV_PARQUET_URL`: blob container (or any HTTP base) for
 *   `/mst-dev/parquet`. With `MST_DEV_PARQUET_AUTH=azcli`, requests carry an
 *   Entra ID token from `az account get-access-token`, for storage accounts
 *   that allow no anonymous reads.
 */
export function mstLookupDevProxy(env: Record<string, string | undefined> = process.env): Record<string, ProxyOptions> {
  const identityHost = env.MST_DEV_IDENTITY_HOST || IDENTITY_HOST
  const proxy: Record<string, ProxyOptions> = {
    '/mst-dev/proxy': env.MST_DEV_LEDGER_URL ? directLedgerProxy(env.MST_DEV_LEDGER_URL, env.MST_DEV_LEDGER_CA) : {
      target: CONTROL_PLANE_HOST,
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/mst-dev\/proxy/, '/api/Proxy'),
      configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('connection')),
    },
    '/mst-dev/identity': {
      target: identityHost,
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/mst-dev\/identity/, '/ledgerIdentity'),
    },
    '/mst-dev/indexer': {
      target: identityHost,
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/mst-dev\/indexer/, '/odata/ledgers'),
    },
  }
  if (env.MST_DEV_PARQUET_URL) proxy['/mst-dev/parquet'] = parquetProxy(env.MST_DEV_PARQUET_URL, env.MST_DEV_PARQUET_AUTH)
  return proxy
}

function directLedgerProxy(ledgerUrl: string, caPath: string | undefined): ProxyOptions {
  if (!caPath) throw new Error('MST_DEV_LEDGER_URL needs MST_DEV_LEDGER_CA, the ledger service certificate (PEM).')
  const url = new URL(ledgerUrl)
  return {
    // `ca` is read from the target object, not the top-level options.
    target: { protocol: url.protocol, host: url.hostname, port: Number(url.port || 443), ca: readFileSync(caPath, 'utf8') },
    changeOrigin: true,
    secure: true,
    // Drop the ledger name: the target is that one ledger.
    rewrite: (p) => p.replace(/^\/mst-dev\/proxy\/[^/]+/, ''),
  }
}

function parquetProxy(baseUrl: string, auth: string | undefined): ProxyOptions {
  const url = new URL(baseUrl)
  const basePath = url.pathname.replace(/\/+$/, '')
  return {
    target: url.origin,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/mst-dev\/parquet/, basePath),
    configure: (proxy) => {
      if (auth !== 'azcli') return
      proxy.on('proxyReq', (req) => {
        req.setHeader('Authorization', `Bearer ${storageToken()}`)
        req.setHeader('x-ms-version', '2023-11-03')
      })
    },
  }
}

let cachedToken: { token: string; expiresOn: number } | null = null

/** An Entra ID token for Azure Storage from the signed-in az CLI, refreshed before it expires. */
function storageToken(): string {
  if (cachedToken && cachedToken.expiresOn - Date.now() > 5 * 60 * 1000) return cachedToken.token
  const out = execFileSync(
    'az',
    ['account', 'get-access-token', '--resource', 'https://storage.azure.com/', '--query', '{t:accessToken,e:expires_on}', '-o', 'json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  )
  const { t, e } = JSON.parse(out) as { t: string; e: number }
  cachedToken = { token: t, expiresOn: e * 1000 }
  return t
}
