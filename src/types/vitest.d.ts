/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Re-registers the `@testing-library/jest-dom` matcher types with Vitest.
 *
 * Vitest 5 inlined its `expect` implementation and now exposes a two-parameter
 * `Matchers<R, T>` interface as the extension point for custom matchers.
 * `@testing-library/jest-dom` still ships an augmentation written against the
 * Vitest 4 shape (`Assertion<T>`), so the parameter lists no longer match and
 * TypeScript silently drops the merge. The matchers are still registered at
 * runtime via `expect.extend`, so only type checking is affected -- `tsc -b`
 * reports `TS2339: Property 'toBeInTheDocument' does not exist ...` while the
 * tests themselves pass.
 *
 * Augmenting `Matchers` here restores the types. `AsymmetricMatchersContaining`
 * already extends `Matchers`, so it picks this up automatically and must not be
 * extended separately.
 *
 * Remove this file once jest-dom ships Vitest 5 support.
 * Upstream issue: https://github.com/testing-library/jest-dom/issues/738
 */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
