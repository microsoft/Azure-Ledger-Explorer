/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { mstLookupDevProxy } from './vite.lookup-proxy'

/**
 * Builds the MST lookup page on its own, with `index.html` at the root of
 * `dist-lookup/` and relative asset URLs, so it can be served from any
 * sub-path (for example VibeHub's `/app/<projectId>/`).
 */
export default defineConfig({
  root: path.resolve(__dirname, 'lookup'),
  // Read `.env*` from the repository root, as the main build does, not `lookup/`.
  envDir: __dirname,
  base: './',
  publicDir: false,
  plugins: [react()],
  server: {
    proxy: mstLookupDevProxy,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-lookup'),
    emptyOutDir: true,
    sourcemap: true,
  },
})
