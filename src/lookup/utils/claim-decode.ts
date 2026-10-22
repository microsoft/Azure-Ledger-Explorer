/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { decodeClaim } from '../services/scitt-wasm-loader';
import type { DecodedClaimJson, PayloadJson } from '../types/lookup-types';

export type ClaimEncoding = 'base64' | 'base64url';

export type DecodeOutcome =
  | { ok: true; claim: DecodedClaimJson }
  | { ok: false; message: string };

const ENCODED_KEY = /^(.+)-(base64url|base64)$/;

function topLevelObject(payloadText: string | null): Record<string, unknown> | null {
  if (!payloadText) return null;
  try {
    const parsed: unknown = JSON.parse(payloadText);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Prefill for the decode form: a top-level key whose name says it is encoded,
 * such as `security-policy-base64`. Only the form is prefilled; nothing is
 * decoded until the user asks, and the encoding comes from the key's name,
 * never from its value.
 */
export function suggestClaim(payloadText: string | null): { path: string; encoding: ClaimEncoding } | null {
  const doc = topLevelObject(payloadText);
  if (!doc) return null;
  const keys = Object.keys(doc).filter((k) => ENCODED_KEY.test(k) && typeof doc[k] === 'string');
  const key = keys.find((k) => k.startsWith('security-policy-')) ?? keys[0];
  if (!key || key.includes("'") || key.includes('\\')) return null;
  const encoding = ENCODED_KEY.exec(key)![2] as ClaimEncoding;
  return { path: `['${key}']`, encoding };
}

/**
 * The digest the statement publishes beside a top-level encoded claim: for
 * `['x-base64']`, the value of `x-sha256`. Comparing the two shows the claim
 * is self-consistent; it is evidence from the same statement, not an
 * independent check.
 */
export function publishedDigest(payloadText: string | null, decodedPath: string): string | null {
  const match = /^\['([^'\\]+)'\]$/.exec(decodedPath);
  const stem = match && ENCODED_KEY.exec(match[1])?.[1];
  if (!stem) return null;
  const value = topLevelObject(payloadText)?.[`${stem}-sha256`];
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

/** Decode one claim with scitt-wasm; a claim that cannot be read is a message, not an exception. */
export function runDecode(statement: Uint8Array, path: string, encoding: ClaimEncoding): DecodeOutcome {
  try {
    return { ok: true, claim: JSON.parse(decodeClaim(statement, path, encoding)) as DecodedClaimJson };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Whether claims can be decoded from this payload: only JSON payloads have claims to address. */
export function isJsonPayload(payloadText: string | null | undefined): boolean {
  if (payloadText == null) return false;
  try {
    JSON.parse(payloadText);
    return true;
  } catch {
    return false;
  }
}

function textOrHexBytes(text: string | null | undefined, hex: string | null | undefined): Uint8Array {
  if (text != null) return new TextEncoder().encode(text);
  const digits = hex ?? '';
  const out = new Uint8Array(digits.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** The exact decoded bytes, rebuilt from the text or hex scitt-wasm returned. */
export function claimBytes(claim: DecodedClaimJson): Uint8Array {
  return textOrHexBytes(claim.text, claim.hex);
}

/** The exact embedded payload bytes, rebuilt from the text or hex scitt-wasm returned. */
export function payloadBytes(payload: PayloadJson): Uint8Array {
  return textOrHexBytes(payload.text, payload.hex);
}
