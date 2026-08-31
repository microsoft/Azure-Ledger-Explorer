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
        // Fluent UI v9 now ships its web packages ESM-first, so Node loads them
        // as real ESM and @fluentui/react-tabster's
        // `import { createTabster } from 'tabster'` goes through ESM resolution
        // for the first time. tabster declares `"type": "module"` with a
        // CommonJS `main` and no `exports` map, so Node falls back to the CJS
        // build, whose SWC-generated dynamic exports cjs-module-lexer cannot
        // statically read. Named imports are validated at link time, so the
        // module graph dies with:
        //   SyntaxError: The requested module 'tabster' does not provide an
        //   export named 'createTabster'
        //
        // Inlining makes Vite resolve these packages instead of Node, and Vite
        // honours the `module` field, so it loads tabster's real ESM build.
        //
        // Two things this has to get right:
        //  1. It must cover the whole chain from the package our source
        //     actually imports (@fluentui/react-components) down to tabster.
        //     Inlining only the direct importer of tabster does nothing: while
        //     @fluentui/react-components is externalized, Node -- not Vite --
        //     resolves everything beneath it, so Vitest's externalization hook
        //     is never consulted for the transitive packages.
        //  2. These patterns are matched against absolute file paths, so they
        //     must not be anchored with ^ against the bare package name.
        //
        // Remove once tabster ships an `exports` map.
        // Upstream: https://github.com/microsoft/tabster/issues/532
        //           https://github.com/microsoft/fluentui/discussions/36614
        inline: [
          /[\\/]node_modules[\\/]@fluentui[\\/]/,
          /[\\/]node_modules[\\/]tabster[\\/]/,
          /[\\/]node_modules[\\/]keyborg[\\/]/,
        ],
      },
    },
  },
})