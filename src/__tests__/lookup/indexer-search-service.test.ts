/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INDEX_PAGE_SIZE,
  indexFilter,
  indexSearchUrl,
  SAME_SEQNO_LIMIT,
  searchIndex,
} from '../../lookup/services/indexer-search-service';

const endpoints = {
  proxyBase: 'https://proxy.test/api/Proxy',
  identityBase: 'https://id.test/ledgerIdentity',
  indexerBase: 'https://id.test/odata/ledgers',
};

const row = (seqno: number) => ({
  ledgerId: 'my-ledger',
  sequenceNo: seqno,
  transactionId: `3.${seqno}`,
  issuer: 'did:x509:0:sha256:abc::eku:1.2.3',
  subject: 'pkg:demo',
  signedAt: '2026-04-06T20:25:54+00:00',
  payloadHash: 'ab'.repeat(32),
});

const respond = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('indexFilter', () => {
  it('uses contains for issuer and subject, and equality for a payload hash', () => {
    expect(indexFilter('issuer', 'did:x509')).toBe("contains(Issuer,'did:x509')");
    expect(indexFilter('subject', 'potomac')).toBe("contains(Subject,'potomac')");
    expect(indexFilter('payloadHash', 'ab')).toBe("PayloadHash eq 'ab'");
  });

  it('escapes single quotes as OData requires', () => {
    expect(indexFilter('subject', "o'brien")).toBe("contains(Subject,'o''brien')");
  });
});

describe('indexSearchUrl', () => {
  it('asks for one extra row, newest first, without a cursor on the first page', () => {
    const url = new URL(indexSearchUrl('my-ledger', 'subject', 'a b', null, endpoints));
    expect(url.origin + url.pathname).toBe('https://id.test/odata/ledgers/my-ledger/entries');
    expect(url.searchParams.get('$filter')).toBe("contains(Subject,'a b')");
    expect(url.searchParams.get('$orderby')).toBe('SequenceNo desc');
    expect(url.searchParams.get('$top')).toBe(String(INDEX_PAGE_SIZE + 1));
    expect(url.searchParams.has('$skip')).toBe(false);
  });

  it('starts later pages below the given sequence number', () => {
    const url = new URL(indexSearchUrl('my-ledger', 'subject', 'a b', 81, endpoints));
    expect(url.searchParams.get('$filter')).toBe("contains(Subject,'a b') and SequenceNo lt 81");
    expect(url.searchParams.has('$skip')).toBe(false);
  });
});

describe('searchIndex', () => {
  it('returns a page and the cursor for the next one when more rows exist', async () => {
    const rows = Array.from({ length: INDEX_PAGE_SIZE + 1 }, (_, i) => row(100 - i));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, rows)));
    const page = await searchIndex('my-ledger', 'subject', 'pkg', null, endpoints);
    expect(page.entries).toHaveLength(INDEX_PAGE_SIZE);
    expect(page.entries[0].transactionId).toBe('3.100');
    expect(page.entries.at(-1)?.sequenceNo).toBe(81);
    // The next page starts below 81, so begins at 80.
    expect(page.nextBefore).toBe(81);
  });

  it('passes the cursor to the indexer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, [row(5)]));
    vi.stubGlobal('fetch', fetchMock);
    await searchIndex('my-ledger', 'subject', 'pkg', 81, endpoints);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('$filter')).toBe("contains(Subject,'pkg') and SequenceNo lt 81");
  });

  it('keeps rows that share a sequence number on the same page', async () => {
    const rows = Array.from({ length: INDEX_PAGE_SIZE - 1 }, (_, i) => row(100 - i));
    rows.push(row(50), row(50));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, rows)));
    const page = await searchIndex('my-ledger', 'subject', 'pkg', null, endpoints);
    expect(page.entries).toHaveLength(INDEX_PAGE_SIZE - 1);
    expect(page.entries.some((e) => e.sequenceNo === 50)).toBe(false);
    expect(page.nextBefore).toBe(51);
  });

  it('fetches every row at a sequence number that alone fills a page', async () => {
    const rows = Array.from({ length: INDEX_PAGE_SIZE + 1 }, () => row(50));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(200, rows))
      .mockResolvedValueOnce(respond(200, Array.from({ length: INDEX_PAGE_SIZE + 5 }, () => row(50))));
    vi.stubGlobal('fetch', fetchMock);
    const page = await searchIndex('my-ledger', 'subject', 'pkg', null, endpoints);
    expect(page.entries).toHaveLength(INDEX_PAGE_SIZE + 5);
    expect(page.nextBefore).toBe(50);
    const url = new URL(String(fetchMock.mock.calls[1][0]));
    expect(url.searchParams.get('$filter')).toBe("contains(Subject,'pkg') and SequenceNo eq 50");
    expect(url.searchParams.get('$top')).toBe(String(SAME_SEQNO_LIMIT));
  });

  it('still offers the next page when the indexer returns rows it cannot show', async () => {
    const rows = Array.from({ length: INDEX_PAGE_SIZE + 1 }, (_, i) => row(100 - i));
    rows[3] = { ...rows[3], transactionId: 'nope' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, rows)));
    const page = await searchIndex('my-ledger', 'subject', 'pkg', null, endpoints);
    expect(page.entries).toHaveLength(INDEX_PAGE_SIZE - 1);
    expect(page.nextBefore).toBe(81);
  });

  it('reports the last page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, [row(5)])));
    const page = await searchIndex('my-ledger', 'issuer', 'did', null, endpoints);
    expect(page.entries).toHaveLength(1);
    expect(page.nextBefore).toBeNull();
  });

  it('accepts an OData envelope and drops rows without a valid transaction ID', async () => {
    const bad = { ...row(6), transactionId: 'nope' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { value: [row(5), bad] })));
    const page = await searchIndex('my-ledger', 'payloadHash', 'ab'.repeat(32), null, endpoints);
    expect(page.entries.map((e) => e.transactionId)).toEqual(['3.5']);
  });

  it('explains a ledger that is not onboarded to the indexer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(404, { error: { code: 'LedgerNotIndexedHere', message: 'not indexed' } })),
    );
    await expect(searchIndex('other', 'subject', 'x', null, endpoints)).rejects.toMatchObject({
      kind: 'notIndexed',
      step: 'search',
      message: expect.stringMatching(/not onboarded to the MST indexer/),
    });
  });

  it('tells an unknown ledger apart from one that is not indexed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(404, { error: { code: 'LedgerNotFound', message: "doesn't exist" } })),
    );
    await expect(searchIndex('typo', 'subject', 'x', null, endpoints)).rejects.toMatchObject({
      kind: 'notFound',
      step: 'search',
      message: expect.stringMatching(/No ledger with this name exists/),
    });
  });

  it('treats a 404 without an error code as not indexed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    await expect(searchIndex('other', 'subject', 'x', null, endpoints)).rejects.toMatchObject({
      kind: 'notIndexed',
    });
  });

  it('rejects a response that is not a list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { rows: [] })));
    await expect(searchIndex('my-ledger', 'subject', 'x', null, endpoints)).rejects.toMatchObject({
      kind: 'malformed',
      step: 'search',
    });
  });
});
