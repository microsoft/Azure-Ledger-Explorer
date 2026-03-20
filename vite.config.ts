/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import https from 'node:https'

/**
 * Vite plugin that proxies /api/blob/ and /api/servicebus/ requests
 * to the correct Azure hosts, avoiding browser CORS during development.
 * Unlike Vite's proxy option, this resolves the target host per-request
 * so TLS/SNI works correctly with dynamic account/namespace names.
 */
function azureProxyPlugin(): Plugin {
  return {
    name: 'azure-dev-proxy',
    configureServer(server) {
      // Handle /api/blob/<account>/... → https://<account>.blob.core.windows.net/...
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        let match = req.url.match(/^\/api\/blob\/([^/]+)\/(.*)/);
        if (match) {
          const host = `${match[1]}.blob.core.windows.net`;
          const path = `/${match[2]}`;
          return pipeToAzure(req, res, host, path);
        }

        match = req.url.match(/^\/api\/servicebus\/([^/]+)\/(.*)/);
        if (match) {
          const host = `${match[1]}.servicebus.windows.net`;
          const path = `/${match[2]}`;
          return pipeToAzure(req, res, host, path);
        }

        next();
      });
    },
  };
}

/**
 * Pipe an incoming dev-server request to an Azure HTTPS endpoint,
 * forwarding all headers (except host) and streaming the response back.
 */
function pipeToAzure(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  host: string,
  path: string,
) {
  // Copy original headers, override host
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'origin' && key.toLowerCase() !== 'referer') {
      headers[key] = value;
    }
  }
  headers['host'] = host;

  const options: https.RequestOptions = {
    hostname: host,
    port: 443,
    path,
    method: req.method || 'GET',
    headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Forward status and headers back to the browser
    const responseHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) {
        responseHeaders[key] = value;
      }
    }
    // Add CORS headers so the browser accepts the response
    responseHeaders['access-control-allow-origin'] = '*';
    responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD';
    responseHeaders['access-control-allow-headers'] = '*';

    res.writeHead(proxyRes.statusCode || 502, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[azure-proxy] Error proxying to ${host}${path}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end(`Proxy error: ${err.message}`);
  });

  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'access-control-allow-headers': '*',
      'access-control-max-age': '86400',
    });
    res.end();
    return;
  }

  // Pipe the request body (for POST/PUT)
  req.pipe(proxyReq);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    azureProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['**/*.md', 'src/assets/ccf.svg'],
      manifest: {
        name: 'CCF Ledger Explorer',
        short_name: 'CCF Explorer',
        description: 'A TypeScript/React application for exploring and analyzing CCF (Confidential Consortium Framework) ledger data with AI-powered querying capabilities',
        theme_color: '#0078d4',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB to accommodate large bundles
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'openai-api-cache',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/[^/]+\.blob\.core\.windows\.net\//i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'azure-blob-cache'
            }
          }
        ],
        // Exclude service worker from caching OPFS files
        navigateFallbackDenylist: [/^\/opfs/]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  assetsInclude: ['**/*.md'],
})
