import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import licenseHeader from "./eslint-rules/license-header.js";

export default tseslint.config([
  globalIgnores(['dist', 'node_modules', 'coverage', '*.config.js', 'packages/*/dist']),

  // Main TypeScript/React configuration
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: {
      local: {
        rules: {
          "license-header": licenseHeader,
        },
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
    rules: {
      // Copyright header enforcement
      'local/license-header': 'error',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': [
        'error',
        {
          allowArgumentsExplicitlyTypedAsAny: true,
          allowOverloadFunctions: true,
        },
      ],

      // General rules
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // Disable new strict react-hooks v7 rules (can be enabled after code refactoring)
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },

  // Relaxed rules for parser files dealing with dynamic CBOR data
  {
    files: ['src/parser/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Relaxed rules for hooks using TanStack Query (return types inferred from generics)
  {
    files: ['src/hooks/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // Relaxed rules for worker files
  {
    files: ['src/workers/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Relaxed rules for test files
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
])
