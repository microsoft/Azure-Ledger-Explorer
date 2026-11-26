/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, expect, it } from 'vitest';
import type { AdvancedQuery, QueryNode } from '../../lookup/types/lookup-types';
import { parseAdvancedQuery, queryFilter, serializeQuery, validateQuery } from '../../lookup/utils/advanced-query';
import { indexSearchUrl, searchIndex } from '../../lookup/services/indexer-search-service';
import { readParams, lookupHref } from '../../lookup/hooks/use-mst-lookup';
import { vi } from 'vitest';

const condition = (value: string): QueryNode => ({ kind: 'condition', field: 'subject', operator: 'contains', value, negated: false });
const query: AdvancedQuery = {
  version: 1,
  root: {
    kind: 'group', match: 'all', negated: false,
    children: [
      { ...condition('did:x509'), kind: 'condition', field: 'issuer', operator: 'startswith', value: 'did:x509', negated: false },
      { kind: 'group', match: 'any', negated: false, children: [condition("o'brien"), condition('maa')] },
      { ...condition('test'), negated: true },
    ],
  },
};

describe('advanced queries', () => {
  it('compiles nested AND/OR/NOT and escapes literals', () => {
    expect(queryFilter(query)).toBe("((startswith(Issuer,'did:x509') and (contains(Subject,'o''brien') or contains(Subject,'maa')) and not (contains(Subject,'test'))))");
  });

  it('negates an entire group', () => {
    expect(queryFilter({ version: 1, root: { kind: 'group', match: 'any', negated: true, children: [condition('a'), condition('b')] } }))
      .toBe("(not ((contains(Subject,'a') or contains(Subject,'b'))))");
  });

  it('normalizes values and round trips a versioned query', () => {
    const q: AdvancedQuery = { version: 1, root: { kind: 'condition', field: 'payloadHash', operator: 'eq', value: ` ${'AB'.repeat(32)} `, negated: false } };
    expect(parseAdvancedQuery(serializeQuery(q)).root).toMatchObject({ value: 'ab'.repeat(32) });
    const encoded = serializeQuery(query);
    expect(readParams(`?ledger=my-ledger&query=${encodeURIComponent(encoded)}`).entry).toEqual({ by: 'advanced', value: encoded });
  });

  it('preserves oldest-first links and canonicalizes the default order', () => {
    const value = serializeQuery({ ...query, order: 'oldest' });
    const params = readParams(`?ledger=my-ledger&query=${encodeURIComponent(value)}`);
    expect(params.entry).toEqual({ by: 'advanced', value });
    expect(parseAdvancedQuery(value).order).toBe('oldest');
    expect(serializeQuery({ ...query, order: 'newest' })).toBe(serializeQuery(query));
    expect(readParams(`?ledger=my-ledger&query=${encodeURIComponent(JSON.stringify({ ...query, order: 'random' }))}`).invalid).toBe(true);
  });

  it('sorts oldest first and applies the cursor outside the compound expression', () => {
    const value = serializeQuery({ ...query, order: 'oldest' });
    const endpoints = { proxyBase: '', identityBase: '', indexerBase: 'https://example.test' };
    const first = new URL(indexSearchUrl('my-ledger', 'advanced', value, null, endpoints));
    expect(first.searchParams.get('$orderby')).toBe('SequenceNo asc');
    expect(first.searchParams.get('$filter')).toBe(queryFilter(query));
    const next = new URL(indexSearchUrl('my-ledger', 'advanced', value, 20, endpoints));
    expect(next.searchParams.get('$filter')).toBe(`${queryFilter(query)} and SequenceNo gt 20`);
  });

  it('pages oldest first without dropping or repeating rows', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ sequenceNo: i + 1, transactionId: `3.${i + 1}` }));
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const filter = new URL(input, 'https://example.test').searchParams.get('$filter') ?? '';
      const cursor = Number(/SequenceNo gt (\d+)/.exec(filter)?.[1] ?? 0);
      return new Response(JSON.stringify(rows.filter((row) => row.sequenceNo > cursor).slice(0, 21)));
    }));
    try {
      const value = serializeQuery({ ...query, order: 'oldest' });
      const first = await searchIndex('my-ledger', 'advanced', value);
      expect(first.entries.map((row) => row.sequenceNo)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(first.nextBefore).toBe(20);
      const second = await searchIndex('my-ledger', 'advanced', value, first.nextBefore);
      expect(second.entries.map((row) => row.sequenceNo)).toEqual([21, 22, 23, 24, 25]);
      expect(second.nextBefore).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('holds back all rows at the ascending boundary', async () => {
    const rows = Array.from({ length: 19 }, (_, i) => ({ sequenceNo: i + 1, transactionId: `3.${i + 1}` }));
    rows.push({ sequenceNo: 50, transactionId: '3.50' }, { sequenceNo: 50, transactionId: '3.50' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(rows))));
    try {
      const page = await searchIndex('my-ledger', 'advanced', serializeQuery({ ...query, order: 'oldest' }));
      expect(page.entries).toHaveLength(19);
      expect(page.entries.some((row) => row.sequenceNo === 50)).toBe(false);
      expect(page.nextBefore).toBe(49);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('retains ascending order when fetching an entire shared sequence', async () => {
    const row = { sequenceNo: 50, transactionId: '3.50' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 21 }, () => row))))
      .mockResolvedValueOnce(new Response(JSON.stringify([row, row])));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const value = serializeQuery({ ...query, order: 'oldest' });
      const page = await searchIndex('my-ledger', 'advanced', value);
      expect(page.entries).toHaveLength(2);
      expect(page.nextBefore).toBe(50);
      const url = new URL(String(fetchMock.mock.calls[1][0]), 'https://example.test');
      expect(url.searchParams.get('$orderby')).toBe('SequenceNo asc');
      expect(url.searchParams.get('$filter')).toBe(`${queryFilter(query)} and SequenceNo eq 50`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    { ...query, version: 2 },
    { version: 1, root: { ...condition('x'), field: 'SourceFile' } },
    { version: 1, root: { ...condition('x'), field: ['subject'] } },
    { version: 1, root: { ...condition('x'), operator: 'raw' } },
    { version: 1, root: { ...condition('x'), field: 'payloadHash' } },
    { version: 1, root: { ...condition('x'), value: '' } },
    { version: 1, root: { kind: 'group', match: 'all', children: [], negated: false } },
  ])('rejects unsupported or incomplete input', (input) => {
    expect(() => validateQuery(input)).toThrow();
  });

  it('rejects excess depth, complexity and URL length', () => {
    let root = condition('x');
    for (let i = 0; i < 4; i++) root = { kind: 'group', match: 'all', negated: false, children: [root] };
    expect(() => validateQuery({ version: 1, root })).toThrow(/levels deep/);
    expect(() => validateQuery({ version: 1, root: { kind: 'group', match: 'all', negated: false, children: Array.from({ length: 12 }, () => ({ ...condition('x'), negated: true })) } })).toThrow(/complex/);
    expect(() => parseAdvancedQuery(' '.repeat(12_001))).toThrow(/too long/);
  });

  it('does not fall back to a simple search for a malformed compound URL', () => {
    const params = readParams('?ledger=my-ledger&subject=maa&query=invalid');
    expect(params.invalid).toBe(true);
    expect(params.entry).toBeNull();
    expect(params.draft.entry).toEqual({ by: 'advanced', value: 'invalid' });
  });

  it('preserves grouping when adding a pagination constraint', () => {
    const root: QueryNode = { kind: 'group', match: 'any', negated: false, children: [condition('a'), condition('b')] };
    const value = serializeQuery({ version: 1, root });
    const url = new URL(indexSearchUrl('my-ledger', 'advanced', value, 81, { proxyBase: '', identityBase: '', indexerBase: 'https://example.test' }));
    expect(url.searchParams.get('$filter')).toBe("((contains(Subject,'a') or contains(Subject,'b'))) and SequenceNo lt 81");
  });

  it('preserves the complete compound filter for same-sequence paging', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 21 }, () => ({ sequenceNo: 50, transactionId: '3.50' })))))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ sequenceNo: 50, transactionId: '3.50' }])));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await searchIndex('my-ledger', 'advanced', serializeQuery(query));
      expect(new URL(String(fetchMock.mock.calls[1][0]), 'https://example.test').searchParams.get('$filter')).toBe(`${queryFilter(query)} and SequenceNo eq 50`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('removes stale query parameters when navigating between modes', () => {
    vi.stubGlobal('window', { location: { href: `https://example.test/lookup/?ledger=old&query=${encodeURIComponent(serializeQuery(query))}` } });
    try {
      const direct = new URL(lookupHref('new', { by: 'txId', value: '2.15' }));
      expect(direct.searchParams.has('query')).toBe(false);
      expect(direct.searchParams.get('tx')).toBe('2.15');
      const advanced = new URL(lookupHref('new', { by: 'advanced', value: serializeQuery(query) }));
      expect(advanced.searchParams.get('query')).toBe(serializeQuery(query));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
