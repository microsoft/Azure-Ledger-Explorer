/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Client for the SCITT verification worker.
 *
 * Components never talk to the worker directly; they go through
 * `use-scitt-verification`, which goes through here.
 */

import type {
  ScittOutcome,
  ScittVerificationResult,
  ScittWorkerInMessage,
  ScittWorkerOutMessage,
  StatementFacts,
  StatementInspection,
} from '../types/scitt-types';

/**
 * Turn facts into an outcome.
 *
 * This function is Ledger Explorer's opinion and lives deliberately outside the
 * WASM package. The core refuses to produce verdicts because the same facts
 * mean different things to different consumers: a deployment gate exits 1 where
 * a ledger explorer renders amber.
 *
 * The distinction that matters most here is between "this is not transparent"
 * and "I could not tell". A statement whose only receipt fails is not proof of
 * forgery — the bytes may be exactly what the Issuer signed, with only the
 * proof of registration missing. An unproven claim is not a disproven one, and
 * collapsing the two would report a rotation as an attack.
 *
 * The certificate chain is handled as the upstream CLI's `decide()` handles it.
 * An `invalid` chain indicts the statement: `x5chain` is a protected header the
 * Issuer signed, so a chain that does not hold is a claim about identity the
 * statement cannot support. A chain that could not be *anchored* only matters
 * when the user supplied trusted roots — they asked a question, and an
 * unanswered question must not read as a pass. Without roots, an unanchored
 * chain is a declared gap that the summary names, not a failure.
 */
export const deriveOutcome = (
  facts: StatementFacts,
  { anchoringRequested = false }: { anchoringRequested?: boolean } = {},
): { outcome: ScittOutcome; summary: string } => {
  if (facts.signatureValid === false) {
    return {
      outcome: 'not-transparent',
      summary:
        "The Issuer's signature over this statement did not verify. The bytes are not what the signer signed.",
    };
  }

  const chain = facts.chainValidation;
  if (chain.status === 'evaluated' && chain.outcome === 'invalid') {
    return {
      outcome: 'not-transparent',
      summary: anchoringRequested
        ? `The signer's certificate chain does not lead to any of the trusted roots supplied: ${chain.reason}.`
        : `The signer's certificate chain did not validate: ${chain.reason}.`,
    };
  }

  if (facts.signatureValid === null) {
    return {
      outcome: 'unsigned',
      summary:
        'The statement carries no usable certificate chain, so its signature could not be checked at all.',
    };
  }

  if (anchoringRequested && !(chain.status === 'evaluated' && chain.outcome === 'valid')) {
    const reason = chain.status === 'evaluated' ? `: ${chain.reason}` : '';
    return {
      outcome: 'cannot-evaluate',
      summary: `Trusted roots were supplied, but the signer's certificate chain could not be anchored to them${reason}. This result cannot say whether the signer is one you trust.`,
    };
  }

  if (facts.receiptsPresent === 0) {
    return {
      outcome: 'not-transparent',
      summary:
        'The statement is signed but carries no receipts, so nothing shows it was ever registered on a transparency service.',
    };
  }

  if (facts.anyReceiptVerified) {
    const anchored = chain.status === 'evaluated' && chain.outcome === 'valid' && chain.anchoredExternally;
    const signer = anchored
      ? " The signer's certificate chain leads to a trusted root you supplied."
      : " The signer's certificate chain is not anchored to a root you trust, so this shows the statement was registered, not who signed it.";
    return {
      outcome: 'transparent',
      summary: `Registered on a transparency service, and the receipt commits to this exact statement.${signer}`,
    };
  }

  const boundFailure = facts.receipts.some((r) => r.boundToStatement === false);
  if (boundFailure) {
    return {
      outcome: 'not-transparent',
      summary:
        'A receipt verified against the ledger but commits to a different statement, so it is evidence about a different artifact.',
    };
  }

  const rotated = facts.receipts.some((r) => r.keyLookup === 'unknown-kid');
  if (rotated) {
    return {
      outcome: 'cannot-evaluate',
      summary:
        'The signing key named by this receipt is not in the key set supplied. Transparency services rotate keys; this usually means the key set is stale rather than that anything is wrong.',
    };
  }

  return {
    outcome: 'cannot-evaluate',
    summary:
      'No receipt could be verified. The statement itself is intact, so what is missing is proof of registration, not proof of tampering.',
  };
};

export class ScittVerificationService {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pending = new Map<
    number,
    { resolve: (value: never) => void; reject: (reason: Error) => void }
  >();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(
      new URL('../workers/scitt-verification-worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<ScittWorkerOutMessage>) => {
      const message = event.data;
      const entry = this.pending.get(message.requestId);
      if (!entry) return;
      this.pending.delete(message.requestId);

      if (message.type === 'error') {
        entry.reject(new Error(message.message));
      } else if (message.type === 'verified') {
        (entry.resolve as (v: StatementFacts) => void)(message.facts);
      } else {
        (entry.resolve as (v: StatementInspection) => void)(message.inspection);
      }
    };

    worker.onerror = () => {
      const failure = new Error('The SCITT verification worker failed to start.');
      this.pending.forEach((entry) => entry.reject(failure));
      this.pending.clear();
      this.terminate();
    };

    this.worker = worker;
    return worker;
  }

  private request<T>(build: (requestId: number) => ScittWorkerInMessage, transfer: ArrayBuffer[]): Promise<T> {
    const worker = this.ensureWorker();
    const requestId = this.nextRequestId++;

    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: resolve as (value: never) => void,
        reject,
      });
      worker.postMessage(build(requestId), transfer);
    });
  }

  /**
   * Verify a transparent statement against a COSE_KeySet.
   *
   * `trustedRoots` is optional PEM holding one or more CA certificates. Without
   * it the signer's chain is still validated, but only to the root the
   * statement carries, and the result says the signer is not anchored. Roots
   * that cannot be read are rejected rather than ignored.
   */
  async verify(
    statement: ArrayBuffer,
    keySet: ArrayBuffer,
    trustedRoots?: string,
  ): Promise<ScittVerificationResult> {
    const facts = await this.request<StatementFacts>(
      (requestId) => ({ type: 'verify', requestId, statement, keySet, trustedRoots }),
      // Transferred, not copied: statements run to tens of kilobytes and the
      // caller has no use for the buffers afterwards.
      [statement, keySet],
    );

    return { facts, ...deriveOutcome(facts, { anchoringRequested: trustedRoots !== undefined }) };
  }

  /** Describe a statement with no trust material. Establishes nothing. */
  inspect(statement: ArrayBuffer): Promise<StatementInspection> {
    return this.request<StatementInspection>(
      (requestId) => ({ type: 'inspect', requestId, statement }),
      [statement],
    );
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

export const scittVerificationService = new ScittVerificationService();
