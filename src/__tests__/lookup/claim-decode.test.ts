/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/// <reference types="node" />

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadScittWasmSync, statementPayload } from '../../lookup/services/scitt-wasm-loader';
import { claimBytes, isJsonPayload, payloadBytes, publishedDigest, runDecode, suggestClaim } from '../../lookup/utils/claim-decode';
import type { PayloadJson } from '../../lookup/types/lookup-types';

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));

// A real JSON-payload statement from the scitt-verifier corpus. No corpus
// statement carries an encoded document, so the success case decodes the
// base64 source commit, as scitt-wasm's own corpus test does.
const repro = fixture('image-reproduction-statement.cose');
const genuine = fixture('transparent-statement.cose');
const COMMIT_PATH = "['component', 'provenance', 'source-commit']";

beforeAll(() => {
  loadScittWasmSync(readFileSync(resolve(__dirname, '../../lookup/vendor/scitt-wasm/scitt_wasm_bg.wasm')));
});

describe('runDecode', () => {
  it('hashes the decoded bytes, not the encoded text', () => {
    const doc = JSON.parse((JSON.parse(statementPayload(repro)) as { text: string }).text);
    const encoded: string = doc.component.provenance['source-commit'];
    const expected = Buffer.from(encoded, 'base64');

    const outcome = runDecode(repro, COMMIT_PATH, 'base64');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.claim.path).toBe(COMMIT_PATH);
    expect(outcome.claim.length).toBe(expected.length);
    expect(outcome.claim.sha256).toBe(createHash('sha256').update(expected).digest('hex'));
    expect(outcome.claim.sha256).not.toBe(createHash('sha256').update(encoded).digest('hex'));
    expect(outcome.claim.utf8).toBe(false);
    expect(Buffer.from(claimBytes(outcome.claim)).equals(expected)).toBe(true);
  });

  it.each([
    ['a payload that is not JSON', genuine, "['a']", 'not JSON'],
    ['a claim that is not there', repro, "['component', 'nope']", 'no such claim'],
    ['a value not in the named encoding', repro, "['component', 'image']", 'not valid base64'],
    ['a malformed path', repro, "['component'", "does not close with ']'"],
  ])('refuses %s with a message', (_, statement, path, says) => {
    const outcome = runDecode(statement, path, 'base64');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain(says);
  });
});

describe('suggestClaim', () => {
  it('prefers the security policy and takes the encoding from the key name', () => {
    const payload = JSON.stringify({ 'sbom-base64url': 'x', 'security-policy-base64': 'y' });
    expect(suggestClaim(payload)).toEqual({ path: "['security-policy-base64']", encoding: 'base64' });
    expect(suggestClaim(JSON.stringify({ 'sbom-base64url': 'x' }))).toEqual({
      path: "['sbom-base64url']",
      encoding: 'base64url',
    });
  });

  it('suggests nothing for non-JSON payloads or payloads without an encoded key', () => {
    expect(suggestClaim(null)).toBeNull();
    expect(suggestClaim('not json')).toBeNull();
    expect(suggestClaim(JSON.stringify({ a: 'b' }))).toBeNull();
    expect(suggestClaim(JSON.stringify({ 'x-base64': 42 }))).toBeNull();
  });
});

describe('publishedDigest', () => {
  const payload = JSON.stringify({ 'security-policy-base64': 'eA==', 'security-policy-sha256': ' ABCDEF ' });

  it('finds the digest published beside a top-level claim', () => {
    expect(publishedDigest(payload, "['security-policy-base64']")).toBe('abcdef');
  });

  it('finds nothing for nested paths or keys without a published digest', () => {
    expect(publishedDigest(payload, "['a', 'security-policy-base64']")).toBeNull();
    expect(publishedDigest(JSON.stringify({ 'x-base64': 'eA==' }), "['x-base64']")).toBeNull();
  });
});

describe('isJsonPayload', () => {
  it('accepts JSON and rejects other text or no text', () => {
    expect(isJsonPayload('{"a":1}')).toBe(true);
    expect(isJsonPayload('package policy')).toBe(false);
    expect(isJsonPayload(null)).toBe(false);
    expect(isJsonPayload(undefined)).toBe(false);
  });
});

describe('payloadBytes', () => {
  const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

  it('rebuilds the exact bytes of a text payload', () => {
    const payload = JSON.parse(statementPayload(repro)) as PayloadJson;
    expect(sha256(payloadBytes(payload))).toBe(payload.sha256);
  });

  it('rebuilds the exact bytes of a binary payload', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
    const payload: PayloadJson = { detached: false, text: null, hex: '00ff807f', sha256: sha256(bytes) };
    expect(sha256(payloadBytes(payload))).toBe(payload.sha256);
  });
});
