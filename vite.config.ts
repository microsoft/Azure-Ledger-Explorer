/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const isGitHubPages = process.env.DEPLOY_TARGET === 'github-pages'

// https://vite.dev/config/
export default defineConfig({
  base: isGitHubPages ? (process.env.GITHUB_PAGES_BASE || '/') : '/',
  plugins: [
    react(),
    // VitePWA is disabled for GitHub Pages builds to avoid service worker scope
    // conflicts with coi-serviceworker (which provides COOP/COEP header injection).
    !isGitHubPages && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['**/*.md', 'src/assets/ccf.svg'],
      manifest: {
        name: 'Azure Ledger Explorer',
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
  // When VitePWA is disabled, stub its virtual module so PWAPrompt.tsx compiles.
  ...(isGitHubPages && {
    resolve: {
      alias: {
        'virtual:pwa-register/react': path.resolve(__dirname, 'src/stubs/pwa-register-react.ts'),
      }
    }
  }),
  assetsInclude: ['**/*.md'],
})
