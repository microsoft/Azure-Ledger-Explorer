/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, expect, it } from 'vitest';
import { deriveVerdict, isIndexSearch, parseEntry, parseLedgerName, parseTxId, registrationTxId } from '../../lookup/utils/lookup-verdict';
import type { InspectionJson, ReceiptFactsJson, VerificationJson } from '../../lookup/types/lookup-types';

describe('parseLedgerName', () => {
  it.each([
    ['my-ledger', 'my-ledger'],
    ['  My-Ledger ', 'my-ledger'],
    ['my-ledger.confidential-ledger.azure.com', 'my-ledger'],
    ['https://my-ledger.confidential-ledger.azure.com/entries/2.1/statement', 'my-ledger'],
  ])('accepts %s', (input, expected) => {
    expect(parseLedgerName(input)).toBe(expected);
  });

  it.each(['', '-bad', 'bad-', 'a b', 'evil.example.com', 'a'.repeat(64), '../x'])('rejects %s', (input) => {
    expect(parseLedgerName(input)).toBeNull();
  });
});

describe('parseTxId', () => {
  it('accepts view.seqno', () => {
    expect(parseTxId(' 2.1234 ')).toBe('2.1234');
  });

  it('drops leading zeros', () => {
    expect(parseTxId('02.0100')).toBe('2.100');
  });

  it.each(['', '2', '2.', '.2', '2.3.4', 'a.b', '2-3'])('rejects %s', (input) => {
    expect(parseTxId(input)).toBeNull();
  });
});

describe('parseEntry', () => {
  it('validates by the selected search type', () => {
    expect(parseEntry('txId', '2.1234')).toBe('2.1234');
    expect(parseEntry('txId', '1234')).toBeNull();
  });

  it('lowercases a payload hash and rejects anything but 64 hex characters', () => {
    const hash = 'AB'.repeat(32);
    expect(parseEntry('payloadHash', ` ${hash} `)).toBe(hash.toLowerCase());
    expect(parseEntry('payloadHash', 'ab'.repeat(31))).toBeNull();
    expect(parseEntry('payloadHash', 'zz'.repeat(32))).toBeNull();
  });

  it('accepts any non-empty issuer or subject text', () => {
    expect(parseEntry('subject', '  potomac ')).toBe('potomac');
    expect(parseEntry('issuer', 'did:x509:0')).toBe('did:x509:0');
    expect(parseEntry('subject', '   ')).toBeNull();
    expect(parseEntry('subject', 'x'.repeat(1025))).toBeNull();
  });

  it('knows which search types use the indexer', () => {
    expect(isIndexSearch('issuer')).toBe(true);
    expect(isIndexSearch('subject')).toBe(true);
    expect(isIndexSearch('payloadHash')).toBe(true);
    expect(isIndexSearch('txId')).toBe(false);
  });
});

const receipt = (over: Partial<ReceiptFactsJson> = {}): ReceiptFactsJson => ({
  issuer: 'ledger.example',
  kid: 'k',
  registeredAt: 1,
  rootSignatureValid: true,
  boundToStatement: true,
  keyLookup: 'found',
  fullyVerified: true,
  problems: [],
  ...over,
});

const verification = (over: Partial<VerificationJson> = {}): VerificationJson => ({
  serviceKey: { kid: 'k', certificateSha256: 'c', bound: true, mismatch: null },
  keySet: { keyCount: 1, skipped: [], unvouchedKeyCount: 0 },
  signatureValid: true,
  chainValidation: { status: 'evaluated', outcome: 'valid' },
  receipts: [receipt()],
  anyReceiptVerified: true,
  ...over,
});

/** An inspection whose receipts name these registration transactions (`null`: no commit evidence). */
const inspection = (...regTxIds: (string | null)[]): InspectionJson => {
  const ids = regTxIds.length > 0 ? regTxIds : ['2.15'];
  return {
    contentType: null,
    isHashEnvelope: false,
    payloadLength: 0,
    cwt: { iss: null, sub: null, iat: null, nbf: null, exp: null, svn: null },
    receiptsPresent: ids.length,
    receipts: ids.map((id) => ({
      kid: 'k',
      issuer: 'ledger.example',
      registeredAt: 1,
      ccfTxId: '2.16',
      commitEvidence: id === null ? null : `ce:${id}:abcd`,
      problems: [],
    })),
  };
};

describe('registrationTxId', () => {
  it('reads the entry transaction from commit evidence', () => {
    expect(registrationTxId('ce:593.9904:7f3a')).toBe('593.9904');
  });

  it.each([null, undefined, '', '593.9904', 'ce:abc:1', 'xce:1.2:3'])('returns null for %s', (input) => {
    expect(registrationTxId(input)).toBeNull();
  });
});

describe('deriveVerdict', () => {
  it('verifies when the signature and a receipt verify', () => {
    expect(deriveVerdict(verification(), inspection(), '2.15').kind).toBe('verified');
  });

  it('does not compare against the signature transaction', () => {
    // inspection() sets ccfTxId to 2.16, the signature transaction after the entry.
    expect(deriveVerdict(verification(), inspection('2.15'), '2.15').kind).toBe('verified');
  });

  it('stops at an unbound key set', () => {
    const v = verification({
      serviceKey: { kid: 'k', certificateSha256: 'c', bound: false, mismatch: 'absent' },
      signatureValid: undefined,
      receipts: undefined,
      anyReceiptVerified: undefined,
    });
    expect(deriveVerdict(v, inspection(), '2.15').kind).toBe('keySetMismatch');
  });

  it('fails a receipt for another transaction', () => {
    expect(deriveVerdict(verification(), inspection('2.16'), '2.15').kind).toBe('failed');
  });

  it('does not let an extra receipt for the requested transaction relabel another statement', () => {
    // A proxy serves the genuine statement from 2.200 and appends a receipt naming 2.100.
    const verdict = deriveVerdict(verification(), inspection('2.200', '2.100'), '2.100');
    expect(verdict.kind).toBe('cannotEvaluate');
    expect(verdict.title).toMatch(/more than one transaction/);
  });

  it('does not verify when a receipt carries no commit evidence', () => {
    expect(deriveVerdict(verification(), inspection('2.15', null), '2.15').kind).toBe('cannotEvaluate');
    expect(deriveVerdict(verification(), inspection(null), '2.15').kind).toBe('cannotEvaluate');
  });

  it('does not verify when the inspection lists fewer receipts than are present', () => {
    const i = { ...inspection('2.15'), receiptsPresent: 2 };
    expect(deriveVerdict(verification(), i, '2.15').kind).toBe('cannotEvaluate');
  });

  it('verifies several receipts that all name the requested transaction', () => {
    expect(deriveVerdict(verification(), inspection('2.15', '2.15'), '2.15').kind).toBe('verified');
  });

  it.each(['signatureValid', 'anyReceiptVerified', 'receipts', 'chainValidation'] as const)(
    'cannot evaluate when the verifier output has no %s',
    (field) => {
      const v = verification();
      delete v[field];
      const verdict = deriveVerdict(v, inspection(), '2.15');
      expect(verdict.kind).toBe('cannotEvaluate');
      expect(verdict.detail).toContain(field);
    },
  );

  it('cannot evaluate, rather than throw, when the verifier output has no service key', () => {
    const v = { ...verification(), serviceKey: undefined } as unknown as VerificationJson;
    expect(deriveVerdict(v, inspection(), '2.15').kind).toBe('cannotEvaluate');
  });

  it('fails a bad issuer signature even with a good receipt', () => {
    expect(deriveVerdict(verification({ signatureValid: false }), inspection(), '2.15').kind).toBe('failed');
  });

  it('fails an invalid signing chain, as the CLI does', () => {
    const v = verification({ chainValidation: { status: 'evaluated', outcome: 'invalid', reason: 'expired' } });
    expect(deriveVerdict(v, inspection(), '2.15')).toMatchObject({ kind: 'failed', detail: 'expired' });
  });

  it.each(['insufficient', 'unsupported'] as const)(
    'treats an %s chain as a gap, not a failure, when no trusted roots were asked for',
    (outcome) => {
      const v = verification({ chainValidation: { status: 'evaluated', outcome, reason: 'r' } });
      expect(deriveVerdict(v, inspection(), '2.15').kind).toBe('verified');
    },
  );

  it('fails a broken receipt', () => {
    const v = verification({
      receipts: [receipt({ rootSignatureValid: false, fullyVerified: false, problems: ['bad root'] })],
      anyReceiptVerified: false,
    });
    expect(deriveVerdict(v, inspection(), '2.15')).toMatchObject({ kind: 'failed', detail: 'bad root' });
  });

  it('never treats an unrun check as a pass', () => {
    const v = verification({ signatureValid: null });
    expect(deriveVerdict(v, inspection(), '2.15').kind).toBe('cannotEvaluate');
  });

  it('explains a receipt signed by an unvouched key', () => {
    const v = verification({
      receipts: [receipt({ keyLookup: 'unknown-kid', rootSignatureValid: null, fullyVerified: false })],
      anyReceiptVerified: false,
    });
    const verdict = deriveVerdict(v, inspection(), '2.15');
    expect(verdict.kind).toBe('cannotEvaluate');
    expect(verdict.detail).toMatch(/key rotation/);
  });
});
