/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Types for the SCITT transparent statement verifier.
 *
 * These mirror the JSON emitted by `@microsoft/scitt-wasm`, which wraps the
 * `scitt-receipt` verification core from microsoft/scitt-verifier.
 *
 * Note what is deliberately absent: there is no `isValid` boolean anywhere in
 * this file. The core reports facts and leaves the verdict to its consumer,
 * because "valid" means something different to a deployment gate than it does
 * to someone browsing a ledger. The UI derives its own summary from these.
 *
 * This is a separate concern from Azure Confidential Ledger write receipts
 * (`src/utils/receipt-verification.ts`) and from whole-ledger Merkle
 * verification (`src/workers/verification-worker.ts`). Do not merge them.
 */

/** A COSE algorithm: the number that is in the bytes, and its human name. */
export interface CoseAlgorithm {
  value: number;
  name: string;
}

/**
 * Every check is tri-state.
 *
 * `true` ran and passed, `false` ran and failed, `null` did not run. `null`
 * must never be rendered as a pass — a check that fails to run should degrade
 * the result rather than vanish from it.
 */
export type TriState = boolean | null;

/**
 * Why a `kid` did or did not resolve against the key set.
 *
 * Kept distinct on purpose: a rotated key and a forged receipt are different
 * events. One is an operational chore, the other is an incident, and a UI that
 * renders them identically teaches its users to ignore both.
 */
export type KeyLookup = 'found' | 'unknown-kid' | 'revoked';

export interface CwtClaims {
  iss: string | null;
  sub: string | null;
  /** Reported, never judged. Freshness is a policy question. */
  iat: number | null;
  nbf: number | null;
  exp: number | null;
  svn: number | null;
  other: Record<string, string>;
}

export interface CertificateSummary {
  index: number;
  subject: string | null;
  issuer: string | null;
  sha256: string;
  version: number | null;
  extendedKeyUsage: string[];
  ekuCritical: TriState;
  basicConstraints: {
    critical: boolean;
    ca: boolean;
    pathLenConstraint: number | null;
  } | null;
  keyCertSign: TriState;
  unhandledCriticalExtensions: string[];
  problem: string | null;
}

export interface ReceiptFacts {
  issuer: string | null;
  kid: string | null;
  registeredAt: number | null;
  algorithm: CoseAlgorithm | null;
  vds: number | null;
  leafHash: string | null;
  /** The Merkle root the transparency service signed. */
  root: string | null;
  pathLength: number | null;
  rootSignatureValid: TriState;
  /**
   * Whether this receipt commits to *this* statement.
   *
   * The check that is easy to omit and fatal to omit. A receipt can have a
   * valid inclusion proof and a verifying root signature and still be evidence
   * about a completely different artifact.
   */
  boundToStatement: TriState;
  claimsDigest: string | null;
  keyLookup: KeyLookup | null;
  /** Whether the kid equals the SHA-256 of the key, as CCF derives it. */
  kidBoundToKey: TriState;
  fullyVerified: boolean;
  problems: string[];
}

/**
 * The key set is deliberately not scoped to an issuer. A receipt from another
 * transparency service is signed by that service's key and fails verification
 * on its own merits; which issuer to accept is the caller's judgement, made on
 * `ReceiptFacts.issuer`.
 */
export interface KeySetSummary {
  keyCount: number;
  revokedKids: string[];
  /** Entries that could not be parsed. A rotation must not become an outage. */
  skipped: string[];
}

/**
 * Validation of the signer's certificate chain (the statement's `x5chain`).
 *
 * Always runs. Without trusted roots the chain is validated only up to the
 * root the statement itself carries, and `anchoredExternally` is `false`: a
 * consistent chain, not an identified signer, because anyone can mint a root.
 */
export type ChainValidation =
  | { status: 'notEvaluated' }
  | {
      status: 'evaluated';
      outcome: 'valid';
      rootSha256: string;
      /** True only when the chain leads to a root the caller supplied. */
      anchoredExternally: boolean;
      validatedAt: number;
      pathLength: number;
      pathNotBefore: number;
      pathNotAfter: number;
    }
  | {
      status: 'evaluated';
      /**
       * `invalid` indicts the statement. `insufficient` (too few certificates)
       * and `unsupported` (an algorithm this build cannot validate) mean the
       * question was not answered.
       */
      outcome: 'invalid' | 'insufficient' | 'unsupported';
      reason: string;
    };

export interface StatementFacts {
  algorithm: CoseAlgorithm | null;
  cwt: CwtClaims;
  claimDigest: string;
  signedStatementLength: number;
  payloadLength: number | null;
  /** Whether the Issuer's signature over the statement verified. */
  signatureValid: TriState;
  certificateChainLength: number;
  chainValidation: ChainValidation;
  /**
   * Whether every certificate in the chain was within its validity period at
   * the ledger's countersigned registration time — never the statement's own
   * `iat`, which the signer chooses.
   */
  certificatesValidAtRegistration: TriState;
  leafSubject: string | null;
  leafIssuer: string | null;
  /**
   * How many receipt blobs arrived, evaluable or not.
   *
   * `receipts` holds only those that produced facts, so an unparseable blob is
   * missing from it. Without this count, appending garbage looks identical to
   * appending nothing.
   */
  receiptsPresent: number;
  receipts: ReceiptFacts[];
  verifiedReceiptCount: number;
  anyReceiptVerified: boolean;
  problems: string[];
  certificateChain: CertificateSummary[];
  keySet: KeySetSummary;
}

export interface ProofStep {
  siblingLeft: boolean;
  digest: string;
}

export interface InclusionProof {
  writeSetDigest: string;
  commitEvidence: string;
  claimsDigest: string;
  path: ProofStep[];
}

export interface ReceiptSummary {
  algorithm: CoseAlgorithm | null;
  kid: string | null;
  issuer: string | null;
  subject: string | null;
  registeredAt: number | null;
  vds: number | null;
  ccfTxId: string | null;
  claimsDigest: string | null;
  commitEvidence: string | null;
  registrationTxId: string | null;
  writeSetDigest: string | null;
  pathLength: number | null;
  protectedLabels: string[];
  unprotectedLabels: string[];
  inclusionProof: InclusionProof | null;
  problems: string[];
}

/** What is in the file, with no trust material and therefore no evidence. */
export interface StatementInspection {
  wasTagged: boolean;
  algorithm: CoseAlgorithm | null;
  contentType: string | null;
  isHashEnvelope: boolean;
  payloadHashAlg: CoseAlgorithm | null;
  payloadPreimageContentType: string | null;
  payloadLocation: string | null;
  payloadLength: number | null;
  signedStatementLength: number | null;
  claimDigest: string | null;
  cwt: CwtClaims;
  protectedLabels: string[];
  unprotectedLabels: string[];
  certificateChain: CertificateSummary[];
  receiptsPresent: number;
  receipts: ReceiptSummary[];
}

/**
 * The UI's summary of a result. This is Ledger Explorer's opinion, not the
 * core's, which is why it lives here and not in the wasm package.
 */
export type ScittOutcome =
  | 'transparent'
  | 'not-transparent'
  | 'cannot-evaluate'
  | 'unsigned';

export interface ScittVerificationResult {
  facts: StatementFacts;
  outcome: ScittOutcome;
  /** One sentence explaining the outcome, safe to show a user. */
  summary: string;
}

// --- worker protocol -------------------------------------------------------

export type ScittWorkerInMessage =
  | {
      type: 'verify';
      requestId: number;
      statement: ArrayBuffer;
      keySet: ArrayBuffer;
      /** PEM holding one or more CA certificates to anchor the signer's chain. */
      trustedRoots?: string;
    }
  | { type: 'inspect'; requestId: number; statement: ArrayBuffer };

export type ScittWorkerOutMessage =
  | { type: 'verified'; requestId: number; facts: StatementFacts }
  | { type: 'inspected'; requestId: number; inspection: StatementInspection }
  | { type: 'error'; requestId: number; message: string };
