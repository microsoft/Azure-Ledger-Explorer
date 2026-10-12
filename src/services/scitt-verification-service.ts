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
 */
export const deriveOutcome = (facts: StatementFacts): { outcome: ScittOutcome; summary: string } => {
  if (facts.signatureValid === false) {
    return {
      outcome: 'not-transparent',
      summary:
        "The Issuer's signature over this statement did not verify. The bytes are not what the signer signed.",
    };
  }

  if (facts.signatureValid === null) {
    return {
      outcome: 'unsigned',
      summary:
        'The statement carries no usable certificate chain, so its signature could not be checked at all.',
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
    const scoped = facts.keySet.scoped
      ? ''
      : ' The key set was not scoped to an issuer, which is weaker evidence: an unscoped set will match a receipt from any ledger.';
    return {
      outcome: 'transparent',
      summary: `Registered on a transparency service, and the receipt commits to this exact statement.${scoped}`,
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

  const mismatched = facts.receipts.some((r) => r.keyLookup === 'issuer-mismatch');
  if (mismatched) {
    return {
      outcome: 'cannot-evaluate',
      summary:
        'The key set is scoped to a different transparency service than the one that issued this receipt.',
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
   * `issuer` scopes the key set to one transparency service. Omitting it still
   * verifies, but the result records that the evidence is weaker.
   */
  async verify(
    statement: ArrayBuffer,
    keySet: ArrayBuffer,
    issuer?: string,
  ): Promise<ScittVerificationResult> {
    const facts = await this.request<StatementFacts>(
      (requestId) => ({ type: 'verify', requestId, statement, keySet, issuer }),
      // Transferred, not copied: statements run to tens of kilobytes and the
      // caller has no use for the buffers afterwards.
      [statement, keySet],
    );

    return { facts, ...deriveOutcome(facts) };
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
