/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: "./src/__tests__/setup.ts",
    environment: "jsdom",
    include: ['src/__tests__/**/*.{spec,test}.{js,ts,tsx,jsx}'],
    exclude: [...configDefaults.exclude, 'src/__tests__/setup.ts'],
    server: {
      deps: {
        // Fluent UI v9.74.6+ ships ESM-first; tabster's named exports
        // aren't resolved correctly by vitest's jsdom environment without
        // inlining the module.
        inline: ['tabster'],
      },
    },
  },
})