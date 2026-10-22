/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { IndexSearchBy, InspectionJson, SearchBy, Verdict, VerificationJson } from '../types/lookup-types';

const LEDGER_HOST_SUFFIX = '.confidential-ledger.azure.com';
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TX_ID = /^\d+\.\d+$/;

/**
 * Normalise a ledger name. Accepts a bare name (`my-ledger`), the full host
 * name, or a URL on that host, so a value copied from anywhere works.
 *
 * @returns the bare ledger name, or `null` if the input cannot be one.
 */
export function parseLedgerName(input: string): string | null {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.split(/[/?#]/)[0];
  if (value.endsWith(LEDGER_HOST_SUFFIX)) {
    value = value.slice(0, -LEDGER_HOST_SUFFIX.length);
  }
  return DNS_LABEL.test(value) ? value : null;
}

/** Drop leading zeros, so `0100` and `100` name the same entry. */
const canonicalNumber = (digits: string) => BigInt(digits).toString();

/**
 * Validate a CCF transaction ID (`<view>.<seqno>`).
 *
 * @returns the canonical value (no leading zeros), or `null` if it is not one.
 */
export function parseTxId(input: string): string | null {
  const value = input.trim();
  if (!TX_ID.test(value)) return null;
  const [view, seqno] = value.split('.');
  return `${canonicalNumber(view)}.${canonicalNumber(seqno)}`;
}

const PAYLOAD_HASH = /^[0-9a-f]{64}$/i;
const MAX_TEXT_SEARCH = 1024;

/** Validate a value for the given search type. Payload hashes are lowercased to match the index. */
export function parseEntry(by: SearchBy, input: string): string | null {
  switch (by) {
    case 'txId':
      return parseTxId(input);
    case 'payloadHash': {
      const value = input.trim();
      return PAYLOAD_HASH.test(value) ? value.toLowerCase() : null;
    }
    case 'issuer':
    case 'subject': {
      const value = input.trim();
      return value.length > 0 && value.length <= MAX_TEXT_SEARCH ? value : null;
    }
  }
}

/** Whether a search type is answered by the mst-indexer rather than the ledger. */
export function isIndexSearch(by: SearchBy): by is IndexSearchBy {
  return by === 'issuer' || by === 'subject' || by === 'payloadHash';
}

/**
 * The entry's own transaction ID, from a receipt's CCF commit evidence
 * (`ce:<view>.<seqno>:<nonce>`). The receipt's Merkle leaf commits to this
 * string, so it is authenticated whenever the receipt verifies.
 *
 * @returns the transaction ID, or `null` if the evidence is absent or malformed.
 */
export function registrationTxId(commitEvidence: string | null | undefined): string | null {
  const match = /^ce:(\d+\.\d+):/.exec(commitEvidence ?? '');
  return match ? match[1] : null;
}

/**
 * Fields {@link deriveVerdict} relies on that the verifier's output lacks.
 * A renamed field must stop the verdict rather than read as "no problem".
 */
function missingFacts(v: VerificationJson): string[] {
  const missing: string[] = [];
  if (typeof v.serviceKey?.bound !== 'boolean') return ['serviceKey.bound'];
  if (!v.serviceKey.bound) return missing;
  if (!(typeof v.signatureValid === 'boolean' || v.signatureValid === null)) missing.push('signatureValid');
  if (typeof v.anyReceiptVerified !== 'boolean') missing.push('anyReceiptVerified');
  if (!Array.isArray(v.receipts)) missing.push('receipts');
  if (typeof v.chainValidation?.status !== 'string') missing.push('chainValidation');
  return missing;
}

/**
 * Turn scitt-wasm's facts into the one-line result the page shows.
 *
 * scitt-wasm deliberately returns facts, not a verdict; this is the page's own
 * reading of them. A check that did not run is never treated as a pass.
 */
export function deriveVerdict(
  verification: VerificationJson,
  inspection: InspectionJson,
  txId: string,
): Verdict {
  const missing = missingFacts(verification);
  if (missing.length > 0) {
    return {
      kind: 'cannotEvaluate',
      title: 'Cannot evaluate',
      detail:
        `The verifier's output has no ${missing.join(', ')}, so this page cannot read it. ` +
        'The bundled scitt-wasm may not match the page. Nothing was verified.',
    };
  }

  if (!verification.serviceKey.bound) {
    return {
      kind: 'keySetMismatch',
      title: 'Signing keys do not match the ledger identity',
      detail:
        `The key set served for this ledger does not contain the key from the service certificate ` +
        `published by the identity service (${verification.serviceKey.mismatch ?? 'unknown reason'}). ` +
        'Nothing was verified.',
    };
  }

  // A receipt's commit evidence names the entry it covers. (Its `ccfTxId` is
  // the later signature transaction, so it is not compared.) The evidence is
  // authenticated only for a receipt that verifies, and the verifier does not
  // say which receipt that was. Receipts sit outside the issuer's signature,
  // so anyone on the path can add one. The requested transaction is therefore
  // taken as proven only when every receipt names it.
  const named = inspection.receipts.map((r) => registrationTxId(r.commitEvidence));
  const others = [...new Set(named.filter((id): id is string => id !== null && id !== txId))];
  if (others.length > 0 && !named.includes(txId)) {
    return {
      kind: 'failed',
      title: 'Receipt is for a different transaction',
      detail: `Requested ${txId}, but the receipt names ${others.join(', ')}.`,
    };
  }

  const receipts = verification.receipts ?? [];

  if (verification.signatureValid === false) {
    return {
      kind: 'failed',
      title: 'Issuer signature does not verify',
      detail: "The statement's signature does not match the certificate it carries.",
    };
  }

  // As in the CLI: certificates in the signed x5chain that do not chain are an
  // identity claim the statement cannot support. An unsupported or incomplete
  // chain is a gap, not a failure, because no trusted roots were asked for.
  const chain = verification.chainValidation;
  if (chain?.outcome === 'invalid') {
    return {
      kind: 'failed',
      title: 'Signing certificate chain is invalid',
      detail: chain.reason ?? 'The certificates the statement carries do not form a valid chain.',
    };
  }

  const broken = receipts.find(
    (r) => r.rootSignatureValid === false || r.boundToStatement === false || r.keyLookup === 'revoked',
  );
  if (!verification.anyReceiptVerified && broken) {
    return {
      kind: 'failed',
      title: 'Receipt does not verify',
      detail: broken.problems[0] ?? 'The receipt signature or its binding to this statement failed.',
    };
  }

  if (verification.anyReceiptVerified && verification.signatureValid === true) {
    if (others.length > 0) {
      return {
        kind: 'cannotEvaluate',
        title: 'Receipts name more than one transaction',
        detail:
          `The statement carries receipts for ${txId} and for ${others.join(', ')}. A receipt verifies, ` +
          `but this page cannot tell which one, so it does not take this as proof that the statement is at ${txId}.`,
      };
    }
    if (named.length === 0 || named.length !== inspection.receiptsPresent || named.includes(null)) {
      return {
        kind: 'cannotEvaluate',
        title: 'Receipt does not name the transaction',
        detail:
          'A receipt verifies, but not every receipt carries commit evidence naming the transaction it ' +
          `covers, so this page cannot confirm the statement is at ${txId}.`,
      };
    }
    return {
      kind: 'verified',
      title: 'Verified',
      detail:
        'The issuer signature verifies, and a receipt signed by the key bound to the ' +
        "ledger's current service certificate proves the statement is registered.",
    };
  }

  const unknownKid = receipts.some((r) => r.keyLookup === 'unknown-kid');
  return {
    kind: 'cannotEvaluate',
    title: 'Cannot evaluate',
    detail: unknownKid
      ? "The receipt is signed by a key the ledger's current service certificate does not vouch " +
        'for, for example one in use before a key rotation or disaster recovery. Verify it offline ' +
        'with scitt-verifier and trusted keys.'
      : 'Some checks could not run, so this statement is neither verified nor rejected.',
  };
}
