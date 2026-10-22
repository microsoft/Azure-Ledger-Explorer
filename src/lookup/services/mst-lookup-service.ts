/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type {
  DirectSearchBy,
  EntryRef,
  InspectionJson,
  LookupErrorKind,
  LookupResult,
  LookupStep,
  PayloadJson,
  VerificationJson,
} from '../types/lookup-types';
import { CONTROL_PLANE_HOST, IDENTITY_HOST } from '../config/endpoints';
import { deriveVerdict } from '../utils/lookup-verdict';
import {
  inspectStatement,
  loadScittWasm,
  statementPayload,
  verifyStatementWithServiceCert,
} from './scitt-wasm-loader';

/**
 * Where the page reads from.
 *
 * A browser cannot reach a ledger directly: the ledger presents a CCF
 * certificate no public root signs, and sends no CORS headers. Statements and
 * keys therefore go through the ACC control-plane proxy, which is trusted for
 * nothing; the service certificate comes from the identity service over the
 * public web PKI and is the only trust anchor.
 *
 * The page uses the canary (centraluseuap) hosts of both services: they send
 * CORS headers for the hosting origins (microsoft.github.io and
 * vibehub.microsoft.com), and the global hosts do not yet in every region.
 * In development both are reached through the Vite dev-server proxy, because
 * neither service sends CORS headers for a localhost origin.
 */
export interface LookupEndpoints {
  /** Base of the ledger proxy; `/{ledger}/{path}` is appended. */
  proxyBase: string;
  /** Base of the identity service; `/{ledger}` is appended. */
  identityBase: string;
  /** Base of the mst-indexer read API; `/{ledger}/entries` is appended. */
  indexerBase: string;
  /**
   * Base of a Parquet index (`mst.index.parquet.v1`); `/{ledger}/v1/...` is
   * appended. When set, issuer, subject and payload-hash searches read it
   * instead of the mst-indexer.
   */
  parquetIndexBase?: string;
}

export { CONTROL_PLANE_HOST, IDENTITY_HOST };

export const defaultEndpoints: LookupEndpoints = {
  proxyBase:
    import.meta.env.VITE_MST_PROXY_BASE ??
    (import.meta.env.DEV ? '/mst-dev/proxy' : `${CONTROL_PLANE_HOST}/api/Proxy`),
  identityBase:
    import.meta.env.VITE_MST_IDENTITY_BASE ??
    (import.meta.env.DEV ? '/mst-dev/identity' : `${IDENTITY_HOST}/ledgerIdentity`),
  indexerBase:
    import.meta.env.VITE_MST_INDEXER_BASE ??
    (import.meta.env.DEV ? '/mst-dev/indexer' : `${IDENTITY_HOST}/odata/ledgers`),
  parquetIndexBase: import.meta.env.VITE_MST_PARQUET_INDEX_BASE || undefined,
};

/** A lookup that produced nothing to verify, with which request failed and why. */
export class LookupError extends Error {
  readonly kind: LookupErrorKind;
  readonly step: LookupStep;
  readonly status?: number;

  constructor(kind: LookupErrorKind, step: LookupStep, message: string, status?: number) {
    super(message);
    this.name = 'LookupError';
    this.kind = kind;
    this.step = step;
    this.status = status;
  }
}

const STEP_LABEL: Record<LookupStep, string> = {
  search: 'ledger index',
  identity: 'ledger identity',
  keys: 'ledger signing keys',
  statement: 'transparent statement',
  verify: 'verification',
};

export interface FetchOptions {
  signal?: AbortSignal;
  /** How many times to retry an entry the ledger has not yet loaded into its cache. */
  retries?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * GET a resource, retrying the benign 503 MST returns for an entry it has not
 * yet loaded, and mapping failures to a {@link LookupError}.
 */
export async function fetchWithRetry(
  url: string,
  step: LookupStep,
  { signal, retries = 5, sleep = defaultSleep }: FetchOptions = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal, credentials: 'omit' });
    } catch (error) {
      if (signal?.aborted) throw error;
      // A browser reports a CORS refusal exactly like a network failure.
      throw new LookupError(
        'network',
        step,
        `Could not reach the ${STEP_LABEL[step]} endpoint. The service may be unreachable, ` +
          'or it may not allow requests from this site (CORS).',
      );
    }

    if (response.ok) return response;

    const transient = await isNotYetCached(response);
    if (transient && attempt < retries) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) : 1;
      await sleep(seconds * 1000);
      continue;
    }

    const status = transient ? 503 : response.status;
    if (step === 'search' && status === 404) throw await indexerNotFoundError(response);
    if (step === 'statement' && status === 400 && (await isNotASubmission(response))) {
      throw new LookupError(
        'notFound',
        step,
        'This transaction exists but is not a statement registration. The "ccf txid" scitt-verifier ' +
          'inspect prints for a receipt is the later signature transaction, not the entry itself. ' +
          "The entry's ID is in the receipt's commit evidence (ce:<id>:…), usually a few sequence " +
          'numbers earlier.',
        400,
      );
    }
    throw new LookupError(kindForStatus(status), step, messageForStatus(status, step), status);
  }
}

/** The ledger's 400 `InvalidInput` for a transaction that exists but holds no registered statement. */
async function isNotASubmission(response: Response): Promise<boolean> {
  try {
    return (await response.clone().text()).includes('does not correspond to a submission');
  } catch {
    return false;
  }
}

/**
 * The indexer answers 404 for two different reasons, told apart by the error
 * code: `LedgerNotFound` (no such ledger, usually a typo) and
 * `LedgerNotIndexedHere` (a real ledger that is not onboarded to the indexer).
 * Anything else is treated as not indexed.
 */
async function indexerNotFoundError(response: Response): Promise<LookupError> {
  let code: unknown;
  try {
    code = ((await response.json()) as { error?: { code?: unknown } })?.error?.code;
  } catch {
    // Not JSON: fall through to "not indexed".
  }
  if (code === 'LedgerNotFound') {
    return new LookupError(
      'notFound',
      'search',
      'No ledger with this name exists. Check the ledger name.',
      404,
    );
  }
  return new LookupError(
    'notIndexed',
    'search',
    'This ledger is not onboarded to the MST indexer, so it cannot be searched by issuer, ' +
      'subject or payload hash. Look entries up by transaction ID instead.',
    404,
  );
}

/**
 * Responses that mean "ask again shortly":
 * - A ledger loads historical entries into a cache on demand, answering `503`
 *   `TransactionNotCached` until it has.
 * - The control-plane proxy forwards hop-by-hop headers such as `Connection`
 *   to the ledger, which intermittently makes the ledger reject the request
 *   with a `400` HTTP parse error. The request itself is fine.
 */
async function isNotYetCached(response: Response): Promise<boolean> {
  if (response.status === 503) return true;
  if (response.status !== 400) return false;
  try {
    const body = await response.clone().text();
    return body.includes('TransactionNotCached') || body.includes('Unable to parse data as a HTTP request');
  } catch {
    return false;
  }
}

function kindForStatus(status: number): LookupErrorKind {
  if (status === 404) return 'notFound';
  if (status === 401 || status === 403) return 'accessDenied';
  if (status === 410) return 'proxyDisabled';
  if (status === 503) return 'unavailable';
  return 'http';
}

function messageForStatus(status: number, step: LookupStep): string {
  switch (status) {
    case 404:
      return step === 'statement'
        ? 'No entry with this transaction ID exists on the ledger.'
        : `The ledger was not found (${STEP_LABEL[step]} returned 404). Check the ledger name.`;
    case 401:
    case 403:
      return 'This ledger does not allow unauthenticated reads.';
    case 410:
      return 'The ledger proxy is currently disabled.';
    case 503:
      return step === 'statement'
        ? 'The ledger is still loading this entry. Try again in a few seconds.'
        : `The ${STEP_LABEL[step]} service is temporarily unavailable. Try again in a few seconds.`;
    default:
      return `Fetching the ${STEP_LABEL[step]} failed with HTTP ${status}.`;
  }
}

/** The service certificate PEM the identity service publishes for a ledger. */
export async function fetchServiceCertificate(
  ledger: string,
  endpoints: LookupEndpoints = defaultEndpoints,
  options?: FetchOptions,
): Promise<string> {
  const response = await fetchWithRetry(
    `${endpoints.identityBase}/${encodeURIComponent(ledger)}`,
    'identity',
    options,
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LookupError('malformed', 'identity', 'The identity service did not return JSON.');
  }
  const pem = (body as { ledgerTlsCertificate?: unknown }).ledgerTlsCertificate;
  if (typeof pem !== 'string' || !pem.includes('BEGIN CERTIFICATE')) {
    throw new LookupError('malformed', 'identity', 'The identity service returned no service certificate.');
  }
  return pem;
}

async function fetchProxied(
  ledger: string,
  path: string,
  step: LookupStep,
  endpoints: LookupEndpoints,
  options?: FetchOptions,
): Promise<Uint8Array> {
  const response = await fetchWithRetry(
    `${endpoints.proxyBase}/${encodeURIComponent(ledger)}/${path}`,
    step,
    options,
  );
  return new Uint8Array(await response.arrayBuffer());
}

/** Fetch the signing key set (COSE_KeySet) a ledger serves, through the proxy. */
export function fetchKeySet(ledger: string, endpoints = defaultEndpoints, options?: FetchOptions): Promise<Uint8Array> {
  return fetchProxied(ledger, '.well-known/scitt-keys', 'keys', endpoints, options);
}

/** Fetch a transparent statement (COSE_Sign1 with its receipt), through the proxy. */
export function fetchStatement(
  ledger: string,
  txId: string,
  endpoints = defaultEndpoints,
  options?: FetchOptions,
): Promise<Uint8Array> {
  return fetchProxied(ledger, `entries/${encodeURIComponent(txId)}/statement`, 'statement', endpoints, options);
}

/**
 * Verify already-fetched bytes. Kept separate from the network so it can be
 * tested against fixed fixtures.
 */
export function verifyFetched(
  ledger: string,
  txId: string,
  statement: Uint8Array,
  keySet: Uint8Array,
  serviceCertPem: string,
): LookupResult {
  let verification: VerificationJson;
  let inspection: InspectionJson;
  let payload: PayloadJson;
  try {
    verification = JSON.parse(verifyStatementWithServiceCert(statement, keySet, serviceCertPem));
    inspection = JSON.parse(inspectStatement(statement));
    payload = JSON.parse(statementPayload(statement));
  } catch (error) {
    throw new LookupError(
      'malformed',
      'verify',
      `The ledger's responses could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    ledger,
    txId,
    statement,
    keySet,
    serviceCertPem,
    verification,
    inspection,
    payload,
    verdict: deriveVerdict(verification, inspection, txId),
  };
}

/**
 * Fetch everything for one entry and verify it in the browser.
 *
 * @param entry - The entry's transaction ID (`<view>.<seqno>`).
 */
export async function lookupStatement(
  ledger: string,
  entry: EntryRef<DirectSearchBy>,
  endpoints: LookupEndpoints = defaultEndpoints,
  options: FetchOptions = {},
): Promise<LookupResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const inner = { ...options, signal: controller.signal };

  const txId = entry.value;
  const identity = fetchServiceCertificate(ledger, endpoints, inner);
  try {
    const [serviceCertPem, keySet, statement] = await Promise.all([
      identity,
      fetchKeySet(ledger, endpoints, inner),
      fetchStatement(ledger, txId, endpoints, inner),
      loadScittWasm(),
    ]);
    return verifyFetched(ledger, txId, statement, keySet, serviceCertPem);
  } catch (error) {
    // Report the identity service's answer when it also failed: it is the
    // trust anchor, and the one request that tells a mistyped ledger name
    // apart from a missing entry. Then stop whatever is still retrying.
    const identityError = await identity.then(() => null, (e: unknown) => e);
    controller.abort();
    throw identityError ?? error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
}
