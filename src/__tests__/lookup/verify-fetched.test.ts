/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { decode, encode, Tag } from 'cbor2';
import { loadScittWasmSync } from '../../lookup/services/scitt-wasm-loader';
import { verifyFetched } from '../../lookup/services/mst-lookup-service';
import { inspectStatement } from '../../lookup/services/scitt-wasm-loader';
import type { InspectionJson } from '../../lookup/types/lookup-types';
import { registrationTxId } from '../../lookup/utils/lookup-verdict';

// Fixtures are copied from microsoft/scitt-verifier corpus/fixtures; see fixtures/README.md.
const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name));
const bytes = (name: string) => new Uint8Array(fixture(name));

const statement = bytes('transparent-statement.cose');
const tampered = bytes('tampered-statement.cose');
const keys = bytes('mst-test-scitt-keys.cbor');
const otherKeys = bytes('other-service-scitt-keys.cbor');
const certPem = fixture('mst-test-service-cert.pem').toString('utf8');

let txId: string;

const COSE_SIGN1_TAG = 18;
const RECEIPTS_HEADER = 394;
const VDP_HEADER = 396;
const INCLUSION_PROOFS = -1;
const PROOF_LEAF = 1;

/**
 * Copy a statement and append a second receipt: the first one with its commit
 * evidence rewritten to name `otherTxId`. Receipts sit in the unprotected
 * header, so this is what anyone on the network path could do.
 */
function withExtraReceipt(stmt: Uint8Array, otherTxId: string): Uint8Array {
  const opts = { preferMap: true } as const;
  const sign1 = decode(stmt, opts) as Tag;
  const [protectedHeader, unprotected, payload, signature] = sign1.contents as [
    Uint8Array,
    Map<number, unknown>,
    Uint8Array,
    Uint8Array,
  ];
  const receipts = unprotected.get(RECEIPTS_HEADER) as Uint8Array[];

  const decoded = decode(receipts[0], opts) as Tag | unknown[];
  const parts = (decoded instanceof Tag ? decoded.contents : decoded) as [
    Uint8Array,
    Map<number, unknown>,
    unknown,
    Uint8Array,
  ];
  const vdp = parts[1].get(VDP_HEADER) as Map<number, Uint8Array[]>;
  const proof = decode(vdp.get(INCLUSION_PROOFS)![0], opts) as Map<number, unknown>;
  const leaf = proof.get(PROOF_LEAF) as [Uint8Array, string, Uint8Array];
  const forgedProof = new Map(proof);
  forgedProof.set(PROOF_LEAF, [leaf[0], leaf[1].replace(/^ce:[^:]+:/, `ce:${otherTxId}:`), leaf[2]]);
  const forgedVdp = new Map(vdp);
  forgedVdp.set(INCLUSION_PROOFS, [encode(forgedProof)]);
  const forgedUnprotected = new Map(parts[1]);
  forgedUnprotected.set(VDP_HEADER, forgedVdp);
  const forgedParts = [parts[0], forgedUnprotected, parts[2], parts[3]];
  const forged = encode(decoded instanceof Tag ? new Tag(decoded.tag, forgedParts) : forgedParts);

  const newUnprotected = new Map(unprotected);
  newUnprotected.set(RECEIPTS_HEADER, [receipts[0], forged]);
  return encode(new Tag(COSE_SIGN1_TAG, [protectedHeader, newUnprotected, payload, signature]));
}

beforeAll(() => {
  loadScittWasmSync(
    readFileSync(resolve(__dirname, '../../lookup/vendor/scitt-wasm/scitt_wasm_bg.wasm')),
  );
  const inspection = JSON.parse(inspectStatement(statement)) as InspectionJson;
  txId = registrationTxId(inspection.receipts[0].commitEvidence)!;
});

describe('verifyFetched with the vendored scitt-wasm', () => {
  it('reads the fixture registration transaction ID', () => {
    expect(txId).toMatch(/^\d+\.\d+$/);
  });

  it('verifies a genuine statement against the bound key set', () => {
    const result = verifyFetched('mst-test', txId, statement, keys, certPem);
    expect(result.verdict.kind).toBe('verified');
    expect(result.verification.serviceKey.bound).toBe(true);
    expect(result.verification.signatureValid).toBe(true);
    expect(result.verification.anyReceiptVerified).toBe(true);
  });

  it('refuses a key set that does not contain the service key', () => {
    const result = verifyFetched('mst-test', txId, statement, otherKeys, certPem);
    expect(result.verdict.kind).toBe('keySetMismatch');
    expect(result.verification.serviceKey.bound).toBe(false);
    expect(result.verification.signatureValid).toBeUndefined();
  });

  it('fails a statement whose receipt was tampered with', () => {
    const result = verifyFetched('mst-test', txId, tampered, keys, certPem);
    expect(result.verdict.kind).toBe('failed');
    expect(result.verdict.title).toBe('Receipt does not verify');
    expect(result.verification.signatureValid).toBe(true);
  });

  it('fails when the receipt is for another transaction', () => {
    const result = verifyFetched('mst-test', '999999.1', statement, keys, certPem);
    expect(result.verdict.kind).toBe('failed');
    expect(result.verdict.title).toMatch(/different transaction/);
  });

  it('does not verify the statement for a transaction named only by an appended receipt', () => {
    const relabelled = withExtraReceipt(statement, '999999.1');
    const inspection = JSON.parse(inspectStatement(relabelled)) as InspectionJson;
    expect(inspection.receipts.map((r) => registrationTxId(r.commitEvidence))).toEqual([txId, '999999.1']);

    const result = verifyFetched('mst-test', '999999.1', relabelled, keys, certPem);
    expect(result.verification.anyReceiptVerified).toBe(true);
    expect(result.verdict.kind).toBe('cannotEvaluate');
  });

  it('reports bytes that are not a statement as malformed', () => {
    expect(() => verifyFetched('mst-test', txId, new Uint8Array([1, 2, 3]), keys, certPem)).toThrow(
      expect.objectContaining({ kind: 'malformed', step: 'verify' }),
    );
  });

  it('reports a payload preview', () => {
    const result = verifyFetched('mst-test', txId, statement, keys, certPem);
    expect(result.payload.detached).toBe(false);
    expect(result.payload.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
