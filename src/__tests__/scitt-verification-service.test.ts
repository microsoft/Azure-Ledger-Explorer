/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Tests for `deriveOutcome`.
 *
 * This is the one place where Ledger Explorer converts the verifier's facts
 * into a verdict, so it is the one place where a wrong answer becomes a wrong
 * claim shown to a user. The cases that matter most are not the happy paths but
 * the ones that separate "this failed" from "I could not tell": a stale key set
 * and a forged receipt produce very similar-looking facts and must never
 * produce the same outcome.
 */

import { describe, expect, it } from 'vitest';

import { deriveOutcome } from '../services/scitt-verification-service';
import type { KeyLookup, ReceiptFacts, StatementFacts, TriState } from '../types/scitt-types';

const receipt = (overrides: Partial<ReceiptFacts> = {}): ReceiptFacts => ({
  issuer: 'musa-mst-july.confidential-ledger.azure.com',
  kid: 'abc',
  registeredAt: 1_700_000_000,
  algorithm: { value: -35, name: 'ES384' },
  vds: 2,
  leafHash: 'aa',
  root: 'bb',
  pathLength: 3,
  rootSignatureValid: true,
  boundToStatement: true,
  claimsDigest: 'cc',
  keyLookup: 'found',
  kidBoundToKey: true,
  fullyVerified: true,
  problems: [],
  ...overrides,
});

const facts = (overrides: Partial<StatementFacts> = {}): StatementFacts => {
  const receipts = overrides.receipts ?? [receipt()];
  const verified = receipts.filter((r) => r.fullyVerified).length;

  return {
    algorithm: { value: -37, name: 'PS256' },
    cwt: { iss: 'issuer', sub: 'sub', iat: null, nbf: null, exp: null, svn: null, other: {} },
    claimDigest: '5207494c12c986e33324c602e535717f67f0a6b56235f413e4a07d4d66d59565',
    signedStatementLength: 8462,
    payloadLength: 32,
    signatureValid: true,
    certificateChainLength: 4,
    leafSubject: 'leaf',
    leafIssuer: 'ca',
    receiptsPresent: receipts.length,
    verifiedReceiptCount: verified,
    anyReceiptVerified: verified > 0,
    problems: [],
    certificateChain: [],
    keySet: { issuer: 'musa-mst-july...', keyCount: 7, revokedKids: [], skipped: [], scoped: true },
    ...overrides,
    receipts,
  };
};

/** A receipt that ran every check and failed only at `keyLookup`. */
const unresolvedReceipt = (keyLookup: KeyLookup): ReceiptFacts =>
  receipt({
    keyLookup,
    // Nothing downstream of key resolution can run, so these are `null`, not
    // `false`. Asserting that distinction here is the point of the fixture.
    rootSignatureValid: null as TriState,
    boundToStatement: null as TriState,
    kidBoundToKey: null as TriState,
    fullyVerified: false,
  });

describe('deriveOutcome', () => {
  it('reports a fully verified statement as transparent', () => {
    const { outcome, summary } = deriveOutcome(facts());

    expect(outcome).toBe('transparent');
    expect(summary).toContain('Registered on a transparency service');
  });

  it('flags an unscoped key set as weaker evidence while still passing', () => {
    const result = deriveOutcome(
      facts({
        keySet: { issuer: null, keyCount: 7, revokedKids: [], skipped: [], scoped: false },
      }),
    );

    expect(result.outcome).toBe('transparent');
    expect(result.summary).toContain('not scoped to an issuer');
  });

  it('treats a broken issuer signature as not transparent', () => {
    const { outcome } = deriveOutcome(facts({ signatureValid: false }));

    expect(outcome).toBe('not-transparent');
  });

  it('distinguishes an unsigned statement from a badly signed one', () => {
    // `null` means the check never ran (no usable chain), which is a different
    // event from a signature that ran and failed.
    const { outcome } = deriveOutcome(facts({ signatureValid: null }));

    expect(outcome).toBe('unsigned');
  });

  it('checks the signature before anything else', () => {
    // A statement whose bytes are not what the Issuer signed is not rescued by
    // carrying a verifying receipt, so signature failure must win.
    const { outcome } = deriveOutcome(facts({ signatureValid: false }));

    expect(outcome).toBe('not-transparent');
  });

  it('treats a signed statement with no receipts as not transparent', () => {
    const { outcome, summary } = deriveOutcome(
      facts({ receipts: [], receiptsPresent: 0, verifiedReceiptCount: 0, anyReceiptVerified: false }),
    );

    expect(outcome).toBe('not-transparent');
    expect(summary).toContain('no receipts');
  });

  it('treats a receipt bound to a different statement as not transparent', () => {
    // The receipt is authentic — the ledger really signed that root — but it is
    // evidence about some other artifact, which is a substantive failure rather
    // than a gap in evidence.
    const { outcome, summary } = deriveOutcome(
      facts({
        receipts: [receipt({ boundToStatement: false, fullyVerified: false })],
        anyReceiptVerified: false,
        verifiedReceiptCount: 0,
      }),
    );

    expect(outcome).toBe('not-transparent');
    expect(summary).toContain('different statement');
  });

  it('treats an unknown kid as unevaluable, not as a failure', () => {
    // The regression this guards against: reporting a routine key rotation as
    // if it were tampering.
    const { outcome, summary } = deriveOutcome(
      facts({
        receipts: [unresolvedReceipt('unknown-kid')],
        anyReceiptVerified: false,
        verifiedReceiptCount: 0,
      }),
    );

    expect(outcome).toBe('cannot-evaluate');
    expect(summary).toContain('rotate');
  });

  it('treats an issuer-scoped key set mismatch as unevaluable', () => {
    const { outcome, summary } = deriveOutcome(
      facts({
        receipts: [unresolvedReceipt('issuer-mismatch')],
        anyReceiptVerified: false,
        verifiedReceiptCount: 0,
      }),
    );

    expect(outcome).toBe('cannot-evaluate');
    expect(summary).toContain('different transparency service');
  });

  it('falls back to unevaluable when a receipt simply fails to verify', () => {
    const { outcome, summary } = deriveOutcome(
      facts({
        receipts: [receipt({ rootSignatureValid: false, fullyVerified: false })],
        anyReceiptVerified: false,
        verifiedReceiptCount: 0,
      }),
    );

    expect(outcome).toBe('cannot-evaluate');
    expect(summary).toContain('not proof of tampering');
  });

  it('prefers a binding failure over a key-resolution failure', () => {
    // With one of each, the receipt that proves something wrong outranks the
    // one that proves nothing at all.
    const { outcome } = deriveOutcome(
      facts({
        receipts: [
          unresolvedReceipt('unknown-kid'),
          receipt({ boundToStatement: false, fullyVerified: false }),
        ],
        anyReceiptVerified: false,
        verifiedReceiptCount: 0,
      }),
    );

    expect(outcome).toBe('not-transparent');
  });

  it('passes when one receipt verifies even though another does not', () => {
    // Mirrors the `appended-receipt` corpus fixture: anyone can staple extra
    // receipts to a statement, and doing so must not invalidate a genuine one.
    const { outcome } = deriveOutcome(
      facts({
        receipts: [receipt(), unresolvedReceipt('unknown-kid')],
      }),
    );

    expect(outcome).toBe('transparent');
  });

  it('never reports transparent without a verified receipt', () => {
    const unverifiable: Array<Partial<ReceiptFacts>> = [
      { keyLookup: 'unknown-kid', fullyVerified: false },
      { keyLookup: 'revoked', fullyVerified: false },
      { keyLookup: 'issuer-mismatch', fullyVerified: false },
      { boundToStatement: false, fullyVerified: false },
      { rootSignatureValid: false, fullyVerified: false },
    ];

    for (const overrides of unverifiable) {
      const { outcome } = deriveOutcome(
        facts({
          receipts: [receipt(overrides)],
          anyReceiptVerified: false,
          verifiedReceiptCount: 0,
        }),
      );

      expect(outcome).not.toBe('transparent');
    }
  });
});
