/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Helpers used by the tests below to drive the URL/storage layering directly,
// without re-importing the module (which is what consumers normally do).
import { __internal, __resetFeatureFlagCacheForTests } from '../utils/feature-flags';

describe('feature-flags (internal layering)', () => {
  beforeEach(() => {
    __resetFeatureFlagCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetFeatureFlagCacheForTests();
  });

  describe('readMstFromUrl', () => {
    function withSearch<T>(search: string, fn: () => T): T {
      // Stub a minimal `window.location` object so URLSearchParams sees the
      // value the test wants. We avoid mutating real history state here.
      const fakeLocation = { ...window.location, search } as Location;
      vi.stubGlobal('window', { ...window, location: fakeLocation });
      try { return fn(); } finally { vi.unstubAllGlobals(); }
    }

    it('returns true for ?mst=true (and friendly synonyms)', () => {
      expect(withSearch('?mst=true', __internal.readMstFromUrl)).toBe(true);
      expect(withSearch('?mst=1', __internal.readMstFromUrl)).toBe(true);
      expect(withSearch('?mst=YES', __internal.readMstFromUrl)).toBe(true);
      expect(withSearch('?mst=on', __internal.readMstFromUrl)).toBe(true);
    });

    it('returns false for ?mst=false (and friendly synonyms)', () => {
      expect(withSearch('?mst=false', __internal.readMstFromUrl)).toBe(false);
      expect(withSearch('?mst=0', __internal.readMstFromUrl)).toBe(false);
      expect(withSearch('?mst=No', __internal.readMstFromUrl)).toBe(false);
      expect(withSearch('?mst=off', __internal.readMstFromUrl)).toBe(false);
    });

    it('returns null when the param is absent or unrecognised', () => {
      expect(withSearch('', __internal.readMstFromUrl)).toBeNull();
      expect(withSearch('?something=else', __internal.readMstFromUrl)).toBeNull();
      expect(withSearch('?mst=maybe', __internal.readMstFromUrl)).toBeNull();
    });
  });

  describe('persistMst / readMstFromStorage', () => {
    it('persists true into sessionStorage', () => {
      __internal.persistMst(true);
      expect(window.sessionStorage.getItem(__internal.STORAGE_KEY_MST)).toBe('true');
      expect(__internal.readMstFromStorage()).toBe(true);
    });

    it('clears storage when persisting false', () => {
      __internal.persistMst(true);
      __internal.persistMst(false);
      expect(window.sessionStorage.getItem(__internal.STORAGE_KEY_MST)).toBeNull();
      expect(__internal.readMstFromStorage()).toBe(false);
    });

    it('returns false when storage is empty', () => {
      expect(__internal.readMstFromStorage()).toBe(false);
    });
  });

  describe('computeMstEnabled (URL overrides storage; storage is fallback)', () => {
    function withSearch<T>(search: string, fn: () => T): T {
      const fakeLocation = { ...window.location, search } as Location;
      vi.stubGlobal('window', { ...window, location: fakeLocation, sessionStorage: window.sessionStorage });
      try { return fn(); } finally { vi.unstubAllGlobals(); }
    }

    it('URL-true wins over empty storage and persists the result', () => {
      const result = withSearch('?mst=true', __internal.computeMstEnabled);
      expect(result).toBe(true);
      // Storage should have been written so subsequent reads (without the
      // query) still return true.
      expect(window.sessionStorage.getItem(__internal.STORAGE_KEY_MST)).toBe('true');
    });

    it('URL-false clears prior storage', () => {
      __internal.persistMst(true);
      const result = withSearch('?mst=false', __internal.computeMstEnabled);
      expect(result).toBe(false);
      expect(window.sessionStorage.getItem(__internal.STORAGE_KEY_MST)).toBeNull();
    });

    it('Falls back to storage when the URL has no override', () => {
      __internal.persistMst(true);
      const result = withSearch('', __internal.computeMstEnabled);
      expect(result).toBe(true);
    });

    it('Defaults to disabled with no URL override and no prior storage', () => {
      const result = withSearch('', __internal.computeMstEnabled);
      expect(result).toBe(false);
    });
  });
});
