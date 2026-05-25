/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Lightweight feature-flag helpers driven by the URL query string.
 *
 * MST (Microsoft Signing Transparency) is still a preview service, so any UX
 * surface that exposes MST should be hidden unless the flag is explicitly
 * enabled. The gate is a simple HTTP query parameter:
 *
 *   /files?mst=true  → MST UX shown for the rest of the tab session
 *   /files?mst=false → MST UX hidden, persisted disabled state cleared
 *   (no param)       → fall back to whatever was last persisted in
 *                      sessionStorage (defaults to disabled)
 *
 * The flag is read once at module-init and cached in a module-level constant,
 * so it's stable across re-renders and react-router navigations within the
 * same page load. Persisting to sessionStorage means the user keeps the flag
 * on if they reload the page or follow internal links that drop the query
 * string (e.g. <Link to="/files"> from the sidebar). Closing the tab clears
 * everything — preview features should not bleed across tabs.
 */

const STORAGE_KEY_MST = 'feature-flag.mst';

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

/** Returns the explicit override from the URL, or null if not present. */
function readMstFromUrl(): boolean | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('mst');
  if (raw === null) return null;
  const v = raw.toLowerCase();
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return null;
}

function readMstFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY_MST) === 'true';
  } catch {
    return false;
  }
}

function persistMst(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.sessionStorage.setItem(STORAGE_KEY_MST, 'true');
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY_MST);
    }
  } catch {
    // sessionStorage may be unavailable in some embedded contexts; ignore.
  }
}

/**
 * Compute the effective MST flag once and cache it. URL-supplied values
 * override anything previously persisted; otherwise we fall back to the
 * sessionStorage value.
 */
function computeMstEnabled(): boolean {
  const fromUrl = readMstFromUrl();
  if (fromUrl !== null) {
    persistMst(fromUrl);
    return fromUrl;
  }
  return readMstFromStorage();
}

const mstEnabled: boolean = computeMstEnabled();

/**
 * Returns true when the MST (Microsoft Signing Transparency) UX should be
 * exposed to the user. MST is in preview, so by default everything MST is
 * hidden; pass `?mst=true` once per browser tab to opt in.
 */
export function isMstEnabled(): boolean {
  return mstEnabled;
}

/**
 * Test-only helper. Exported with a discoverable name so consumers don't
 * accidentally use it from product code.
 *
 * NOTE: this does NOT reset the cached `mstEnabled` value — that constant
 * is captured once at module init and is intentionally stable for the
 * lifetime of the module (see header comment). It is impossible to clear
 * from outside the module, so tests that need `isMstEnabled()` to return a
 * different value must `vi.mock('../utils/feature-flags', ...)` instead.
 *
 * What this helper DOES do is clear the persisted `sessionStorage` entry,
 * which lets unit tests exercising the layering helpers (`__internal.*`)
 * start each case from a clean slate.
 *
 * @internal
 */
export function __resetFeatureFlagCacheForTests(): void {
  // The cached `mstEnabled` constant is captured at module init and cannot
  // be reset; see the JSDoc above. We only clear the persisted state here
  // so tests can exercise the URL/storage layering helpers directly.
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY_MST);
  } catch {
    // ignore
  }
}

// Exposed for tests that want to drive the layering logic directly without
// re-importing the module. Product code should call `isMstEnabled()`.
export const __internal = {
  STORAGE_KEY_MST,
  readMstFromUrl,
  readMstFromStorage,
  persistMst,
  computeMstEnabled,
};
