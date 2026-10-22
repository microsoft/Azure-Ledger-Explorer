/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Shapes of the JSON documents the vendored scitt-wasm returns.
 *
 * Only the fields this page reads are declared. Every verification field is
 * tri-state: `null` means the check did not run, and must never be rendered as
 * a pass.
 */

export interface AlgorithmJson {
  value: number;
  name: string | null;
}

export interface CwtJson {
  iss: string | null;
  sub: string | null;
  iat: number | null;
  nbf: number | null;
  exp: number | null;
  svn: number | null;
}

export interface CertificateJson {
  index: number;
  subject: string | null;
  issuer: string | null;
  sha256: string | null;
  problem: string | null;
}

export interface ReceiptFactsJson {
  issuer: string | null;
  kid: string | null;
  registeredAt: number | null;
  rootSignatureValid: boolean | null;
  boundToStatement: boolean | null;
  keyLookup: 'found' | 'unknown-kid' | 'revoked' | null;
  fullyVerified: boolean;
  problems: string[];
}

export interface ServiceKeyJson {
  kid: string;
  certificateSha256: string;
  bound: boolean;
  mismatch: 'absent' | 'ambiguous' | 'unbound' | null;
}

export interface KeySetJson {
  keyCount: number;
  skipped: string[];
  unvouchedKeyCount?: number;
}

/**
 * The signing chain, validated up to the root the statement carries (no
 * trusted roots are supplied). `valid` therefore means internally consistent,
 * not anchored to anything the reader trusts; `anchoredExternally` says which.
 */
export interface ChainValidationJson {
  status: 'evaluated' | 'notEvaluated';
  outcome?: 'valid' | 'invalid' | 'insufficient' | 'unsupported';
  reason?: string;
  rootSha256?: string;
  anchoredExternally?: boolean;
  pathLength?: number;
}

/** Output of `decodeClaim`: one encoded claim from a JSON payload, decoded. */
export interface DecodedClaimJson {
  path: string;
  encoding: 'base64' | 'base64url';
  length: number;
  /** SHA-256 of the exact decoded bytes, not of the encoded text. */
  sha256: string;
  utf8: boolean;
  text: string | null;
  hex: string | null;
}

/** Output of `verifyStatementWithServiceCert`. Statement facts are absent when the key set is not bound. */
export interface VerificationJson {
  serviceKey: ServiceKeyJson;
  keySet: KeySetJson;
  algorithm?: AlgorithmJson | null;
  cwt?: CwtJson;
  claimDigest?: string | null;
  signatureValid?: boolean | null;
  certificateChain?: CertificateJson[];
  chainValidation?: ChainValidationJson;
  receiptsPresent?: number;
  receipts?: ReceiptFactsJson[];
  anyReceiptVerified?: boolean;
  problems?: string[];
}

export interface ReceiptSummaryJson {
  kid: string | null;
  issuer: string | null;
  registeredAt: number | null;
  /** The signature transaction that covers the entry, not the entry itself. */
  ccfTxId: string | null;
  /** `ce:<view>.<seqno>:<nonce>`; carries the entry's own (registration) transaction ID. */
  commitEvidence: string | null;
  problems: string[];
}

/** Output of `inspectStatement`. */
export interface InspectionJson {
  contentType: string | null;
  isHashEnvelope: boolean;
  payloadLength: number | null;
  cwt: CwtJson;
  receiptsPresent: number;
  receipts: ReceiptSummaryJson[];
}

/** Output of `statementPayload`. */
export interface PayloadJson {
  detached: boolean;
  length?: number;
  contentType?: string | null;
  sha256?: string;
  text?: string | null;
  hex?: string | null;
  hashEnvelope?: {
    hashAlg: string | null;
    digest: string;
    preimageContentType: string | null;
    preimageLocation: string | null;
  } | null;
}

export type VerdictKind =
  | 'verified'
  | 'failed'
  | 'cannotEvaluate'
  | 'keySetMismatch';

export interface Verdict {
  kind: VerdictKind;
  title: string;
  detail: string;
}

export interface LookupResult {
  ledger: string;
  txId: string;
  statement: Uint8Array;
  keySet: Uint8Array;
  serviceCertPem: string;
  verification: VerificationJson;
  inspection: InspectionJson;
  payload: PayloadJson;
  verdict: Verdict;
}

/** Search types the ledger answers directly, for any ledger. */
export type DirectSearchBy = 'txId';

/** Search types answered by the mst-indexer, only for ledgers onboarded to it. */
export type IndexSearchBy = 'issuer' | 'subject' | 'payloadHash';

/** What the user searched by. */
export type SearchBy = DirectSearchBy | IndexSearchBy;

/** What the user searched for: a type and a validated value. */
export interface EntryRef<B extends SearchBy = SearchBy> {
  by: B;
  value: string;
}

/**
 * One row from the mst-indexer. It is a pointer into the ledger, not
 * evidence: nothing here is verified until the entry is opened.
 */
export interface IndexedEntry {
  sequenceNo: number;
  transactionId: string;
  issuer?: string | null;
  subject?: string | null;
  signedAt?: string | null;
  payloadHash?: string | null;
}

/** One page of indexer results, newest first. */
export interface IndexSearchPage {
  entries: IndexedEntry[];
  /**
   * Sequence number the next page starts below, or `null` if this is the
   * last page.
   */
  nextBefore: number | null;
}

export type LookupStep = 'search' | 'identity' | 'keys' | 'statement' | 'verify';

export type LookupErrorKind =
  | 'notFound'
  | 'notIndexed'
  | 'accessDenied'
  | 'proxyDisabled'
  | 'unavailable'
  | 'network'
  | 'http'
  | 'malformed';
