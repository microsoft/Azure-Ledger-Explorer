import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import header from 'eslint-plugin-header'
import { globalIgnores } from 'eslint/config'

// Required for eslint-plugin-header to work with flat config
header.rules.header.meta.schema = false

export default tseslint.config([
  globalIgnores(['dist', 'node_modules', 'coverage', '*.config.js']),

  // Main TypeScript/React configuration
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: {
      header,
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
      'header/header': [
        'error',
        'block',
        [
          '',
          ' * Copyright (c) Microsoft Corporation.',
          ' * Licensed under the Apache License, Version 2.0.',
          ' ',
        ],
      ],

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

      // General rules
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // Relaxed rules for parser files dealing with dynamic CBOR data
  {
    files: ['src/parser/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
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
