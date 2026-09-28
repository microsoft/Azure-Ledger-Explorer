/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import '@testing-library/jest-dom';

/**
 * Re-registers the `@testing-library/jest-dom` matcher types with Vitest.
 *
 * Vitest 5 replaced the single-parameter `Assertion<T>` custom-matcher
 * extension point with `Matchers<R, T>`. `@testing-library/jest-dom` still
 * ships an augmentation written against the old shape, so the type-parameter
 * lists no longer line up and TypeScript silently drops the declaration merge.
 * The matchers are still registered at runtime through `expect.extend`, so only
 * type checking breaks -- `tsc -b` reports `TS2339: Property
 * 'toBeInTheDocument' does not exist ...` while the tests themselves pass.
 *
 * `Assertion` and `AsymmetricMatchersContaining` both extend `Matchers`, so
 * augmenting it here is enough and they must not be extended separately.
 *
 * Remove this block once jest-dom ships Vitest 5 support.
 * Upstream issue: https://github.com/testing-library/jest-dom/issues/738
 */
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R, T> extends TestingLibraryMatchers<T, R> {}
}

// Mock localStorage for jsdom environment
beforeAll(() => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
  })();
  
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // Mock window.scrollTo for jsdom environment
  window.scrollTo = () => {};
});

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
  localStorage.clear();
  cleanup();
});
