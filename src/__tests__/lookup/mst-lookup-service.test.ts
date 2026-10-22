/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/// <reference types="node" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchKeySet,
  fetchServiceCertificate,
  fetchStatement,
  fetchWithRetry,
  LookupError,
  lookupStatement,
} from '../../lookup/services/mst-lookup-service';

// These tests exercise the network layer only; verification has its own tests.
vi.mock('../../lookup/services/scitt-wasm-loader', () => ({
  loadScittWasm: vi.fn(async () => {}),
  inspectStatement: vi.fn(),
  statementPayload: vi.fn(),
  verifyStatementWithServiceCert: vi.fn(),
}));

const endpoints = {
  proxyBase: 'https://proxy.test/api/Proxy',
  identityBase: 'https://id.test/ledgerIdentity',
  indexerBase: 'https://id.test/odata/ledgers',
};
const noSleep = vi.fn(async () => {});

function respond(status: number, body: BodyInit | null = null, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
  noSleep.mockClear();
});

describe('fetchWithRetry', () => {
  it('retries a 503 and honours Retry-After, capped at 5 seconds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(503, null, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(respond(503, null, { 'Retry-After': '60' }))
      .mockResolvedValueOnce(respond(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithRetry('https://x.test', 'statement', { sleep: noSleep });
    expect(await response.text()).toBe('ok');
    expect(noSleep.mock.calls).toEqual([[2000], [5000]]);
  });

  it('gives up after the retry budget', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respond(503)));
    await expect(fetchWithRetry('https://x.test', 'statement', { sleep: noSleep, retries: 2 })).rejects.toMatchObject({
      kind: 'unavailable',
      status: 503,
    });
    expect(noSleep).toHaveBeenCalledTimes(2);
  });

  it('retries the transient 400s a ledger returns behind the proxy', async () => {
    const notCached = () => respond(400, 'TransactionNotCached: Historical transaction 2.15 is not cached.');
    const parseError = () => respond(400, 'Unable to parse data as a HTTP request. Error message is: HTTP parsing failed');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notCached())
      .mockResolvedValueOnce(parseError())
      .mockResolvedValueOnce(respond(200, 'ok'));
    vi.stubGlobal('fetch', fetchMock);
    const response = await fetchWithRetry('https://x.test', 'statement', { sleep: noSleep });
    expect(await response.text()).toBe('ok');
    expect(noSleep.mock.calls).toEqual([[1000], [1000]]);

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => notCached()));
    await expect(fetchWithRetry('https://x.test', 'statement', { sleep: noSleep, retries: 1 })).rejects.toMatchObject({
      kind: 'unavailable',
      status: 503,
    });
  });

  it('words a 503 by the service that returned it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respond(503)));
    await expect(fetchWithRetry('https://x.test', 'identity', { sleep: noSleep, retries: 0 })).rejects.toThrow(
      /ledger identity service is temporarily unavailable/,
    );
    await expect(fetchWithRetry('https://x.test', 'statement', { sleep: noSleep, retries: 0 })).rejects.toThrow(
      /still loading this entry/,
    );
  });

  it('does not retry any other 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(400, 'InvalidInput')));
    await expect(fetchWithRetry('https://x.test', 'statement', { sleep: noSleep })).rejects.toMatchObject({ kind: 'http' });
    expect(noSleep).not.toHaveBeenCalled();
  });

  it('explains a transaction that holds no statement, such as a receipt signature transaction', async () => {
    // The CBOR problem-details body esrp-cts-cp returned for 1213.315874.
    const body = Buffer.from(
      'a2206c496e76616c6964496e70757421783f5472616e73616374696f6e204944203132' +
        '31332e33313538373420646f6573206e6f7420636f72726573706f6e6420746f2061' +
        '207375626d697373696f6e2e',
      'hex',
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(400, body)));
    const error = await fetchWithRetry('https://x.test', 'statement', { sleep: noSleep }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'notFound', step: 'statement', status: 400 });
    expect((error as Error).message).toContain('signature transaction');
    expect(noSleep).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'notFound'],
    [401, 'accessDenied'],
    [403, 'accessDenied'],
    [410, 'proxyDisabled'],
    [500, 'http'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(status)));
    await expect(fetchWithRetry('https://x.test', 'keys', { sleep: noSleep })).rejects.toMatchObject({
      kind,
      step: 'keys',
      status,
    });
  });

  it('reports a network or CORS failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await fetchWithRetry('https://x.test', 'identity').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LookupError);
    expect(error).toMatchObject({ kind: 'network', step: 'identity' });
    expect((error as Error).message).toMatch(/CORS/);
  });

  it('does not send credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200));
    vi.stubGlobal('fetch', fetchMock);
    await fetchWithRetry('https://x.test', 'keys');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  });
});

describe('endpoint fetchers', () => {
  it('builds the proxy and identity URLs', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      url.startsWith('https://id.test')
        ? respond(200, JSON.stringify({ ledgerTlsCertificate: '-----BEGIN CERTIFICATE-----\nAA==\n-----END CERTIFICATE-----\n' }))
        : respond(200, new Uint8Array([1, 2])),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchServiceCertificate('my-ledger', endpoints);
    await fetchKeySet('my-ledger', endpoints);
    await fetchStatement('my-ledger', '2.15', endpoints);

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://id.test/ledgerIdentity/my-ledger',
      'https://proxy.test/api/Proxy/my-ledger/.well-known/scitt-keys',
      'https://proxy.test/api/Proxy/my-ledger/entries/2.15/statement',
    ]);
  });

  it('rejects an identity response without a certificate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, JSON.stringify({ ledgerId: 'x' }))));
    await expect(fetchServiceCertificate('x', endpoints)).rejects.toMatchObject({ kind: 'malformed', step: 'identity' });
  });

  it('describes a missing statement as not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(404)));
    await expect(fetchStatement('x', '1.1', endpoints)).rejects.toThrow(/No entry with this transaction ID/);
  });
});

describe('lookupStatement', () => {
  const cert = JSON.stringify({ ledgerTlsCertificate: '-----BEGIN CERTIFICATE-----\nAA==\n-----END CERTIFICATE-----\n' });
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('reports the identity service answer for a mistyped ledger, whichever request fails first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.startsWith('https://id.test')) {
          await delay(20);
          return respond(404);
        }
        return respond(404);
      }),
    );
    await expect(lookupStatement('typo', { by: 'txId', value: '2.15' }, endpoints, { sleep: noSleep })).rejects.toMatchObject({
      kind: 'notFound',
      step: 'identity',
    });
  });

  it('stops the other requests once one has failed', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.startsWith('https://id.test')) return respond(200, cert);
      if (url.endsWith('/statement')) return respond(404);
      await delay(50);
      if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return respond(503);
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(lookupStatement('l', { by: 'txId', value: '2.15' }, endpoints, { sleep: noSleep })).rejects.toMatchObject({
      kind: 'notFound',
      step: 'statement',
    });
    const keysCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('scitt-keys'));
    expect((keysCall?.[1] as RequestInit).signal?.aborted).toBe(true);
  });
});
