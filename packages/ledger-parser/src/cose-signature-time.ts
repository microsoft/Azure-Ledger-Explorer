/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { decode } from 'cbor2';

const COSE_SIGN1_TAG = 18;
const COSE_HEADER_PARAM_CWT_CLAIMS = 15;
const CWT_CLAIM_IAT = 6;

export type CoseSignatureTimeResult = {
  base64: string;
  iatSeconds: number;
  isoTime: string;
};

function toIsoUtcNoZ(date: Date): string {
  // Match Python's `datetime.utcfromtimestamp(...).isoformat()` shape: no milliseconds, no timezone suffix.
  return date.toISOString().replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
}

function tryParseJsonString(text: string): string | null {
  const trimmed = text.trim();

  // Fast path: looks like a JSON string
  if (trimmed.startsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return typeof parsed === 'string' ? parsed : null;
    } catch {
      // fall through
    }
  }

  // Fallback: treat as raw string (already unquoted)
  return trimmed.length > 0 ? trimmed : null;
}

function coerceToUint8Array(maybe: unknown): Uint8Array | null {
  if (maybe instanceof Uint8Array) return maybe;
  if (ArrayBuffer.isView(maybe)) {
    const view = maybe as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

/**
 * Extract the COSE Sign1 iat timestamp from the CCF internal cose_signatures value.
 *
 * In CCF, the value is a JSON-encoded string containing Base64 of a CBOR COSE_Sign1.
 * The timestamp is stored as protected header param 15 (CWT Claims), claim 6 (iat).
 */
export function extractCoseSignatureTimeFromCcfValue(valueBytes: Uint8Array): CoseSignatureTimeResult | null {
  let valueText: string;
  try {
    valueText = new TextDecoder('utf-8', { fatal: false }).decode(valueBytes);
  } catch {
    return null;
  }

  const base64 = tryParseJsonString(valueText);
  if (!base64) return null;

  let coseBytes: Uint8Array;
  try {
    const binaryStr = atob(base64);
    coseBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      coseBytes[i] = binaryStr.charCodeAt(i);
    }
  } catch {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = decode(coseBytes) as unknown;
  } catch {
    return null;
  }

  const parts = (() => {
    if (decoded && typeof decoded === 'object' && 'tag' in (decoded as Record<string, unknown>)) {
      const tagged = decoded as { tag?: number; contents?: unknown[] };
      if (tagged.tag === COSE_SIGN1_TAG && Array.isArray(tagged.contents)) {
        return tagged.contents;
      }
    }
    if (Array.isArray(decoded) && decoded.length === 4) {
      return decoded;
    }
    return null;
  })();

  if (!parts || parts.length !== 4) return null;

  const protectedBytes = coerceToUint8Array(parts[0]);
  if (!protectedBytes) return null;

  let protectedMap: Map<unknown, unknown>;
  try {
    protectedMap = decode(protectedBytes, { preferMap: true }) as Map<unknown, unknown>;
  } catch {
    return null;
  }

  const cwtClaims = protectedMap.get(COSE_HEADER_PARAM_CWT_CLAIMS);
  if (!(cwtClaims instanceof Map)) return null;

  const iat = cwtClaims.get(CWT_CLAIM_IAT);
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null;

  const iatSeconds = iat;
  const isoTime = toIsoUtcNoZ(new Date(iatSeconds * 1000));

  return { base64, iatSeconds, isoTime };
}
