/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: "./src/__tests__/setup.ts",
    environment: "jsdom",
    include: ['src/__tests__/**/*.{spec,test}.{js,ts,tsx,jsx}'],
    exclude: [...configDefaults.exclude, 'src/__tests__/setup.ts'],
  },
})