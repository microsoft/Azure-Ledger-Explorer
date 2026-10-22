/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { IndexedEntry, IndexSearchBy, IndexSearchPage } from '../types/lookup-types';
import {
  defaultEndpoints,
  fetchWithRetry,
  LookupError,
  type FetchOptions,
  type LookupEndpoints,
} from './mst-lookup-service';

/** Rows shown per page. */
export const INDEX_PAGE_SIZE = 20;

/**
 * The OData `$filter` for a search. Issuer and subject match substrings (the
 * indexer allows `contains` only on those two columns); a payload hash must
 * match exactly.
 */
export function indexFilter(by: IndexSearchBy, value: string): string {
  const literal = `'${value.replace(/'/g, "''")}'`;
  switch (by) {
    case 'issuer':
      return `contains(Issuer,${literal})`;
    case 'subject':
      return `contains(Subject,${literal})`;
    case 'payloadHash':
      return `PayloadHash eq ${literal}`;
  }
}

/**
 * The indexer URL for one page of a search, newest entries first.
 *
 * Pages are keyed on sequence number rather than `$skip`: the indexer caps
 * `$skip` at 10000, and offsets shift when new entries are indexed between
 * pages, repeating rows.
 *
 * @param before - Return only entries with a lower sequence number, or `null`
 *   for the first page.
 */
export function indexSearchUrl(
  ledger: string,
  by: IndexSearchBy,
  value: string,
  before: number | null,
  endpoints: LookupEndpoints = defaultEndpoints,
): string {
  const filter = before === null ? indexFilter(by, value) : `${indexFilter(by, value)} and SequenceNo lt ${before}`;
  // One extra row tells whether another page exists: the indexer returns a
  // bare array, without `@odata.nextLink` or a count.
  return entriesUrl(ledger, filter, INDEX_PAGE_SIZE + 1, endpoints);
}

/**
 * Most rows fetched for a single sequence number when they alone fill a page.
 * One ledger entry rarely has more than a handful.
 */
export const SAME_SEQNO_LIMIT = 500;

function entriesUrl(ledger: string, filter: string, top: number, endpoints: LookupEndpoints): string {
  const query = [
    `$filter=${encodeURIComponent(filter)}`,
    `$orderby=${encodeURIComponent('SequenceNo desc')}`,
    `$top=${top}`,
  ].join('&');
  return `${endpoints.indexerBase}/${encodeURIComponent(ledger)}/entries?${query}`;
}

async function fetchRows(url: string, options?: FetchOptions): Promise<unknown[]> {
  const response = await fetchWithRetry(url, 'search', options);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LookupError('malformed', 'search', 'The ledger index did not return JSON.');
  }
  // Accept the OData envelope too, in case the service starts sending one.
  const rows = Array.isArray(body) ? body : (body as { value?: unknown } | null)?.value;
  if (!Array.isArray(rows)) {
    throw new LookupError('malformed', 'search', 'The ledger index returned an unexpected response.');
  }
  return rows;
}

/**
 * Search one ledger's index. The results are pointers into the ledger, not
 * evidence; an entry is verified only when it is opened.
 *
 * A ledger that is not onboarded to the indexer answers 404, reported as a
 * `notFound` {@link LookupError} with step `search`.
 */
export async function searchIndex(
  ledger: string,
  by: IndexSearchBy,
  value: string,
  before: number | null = null,
  endpoints: LookupEndpoints = defaultEndpoints,
  options?: FetchOptions,
): Promise<IndexSearchPage> {
  const rows = await fetchRows(indexSearchUrl(ledger, by, value, before, endpoints), options);
  // Decide paging from the raw rows: a row dropped as invalid still occupies
  // a slot in the indexer's page.
  if (rows.length <= INDEX_PAGE_SIZE) {
    return { entries: rows.filter(isIndexedEntry), nextBefore: null };
  }
  // Several rows can share a sequence number. Hold back those at the lowest
  // sequence number fetched so the next page, which starts below a sequence
  // number, gets them all.
  const seqNos = rows.map(sequenceNoOf).filter((n): n is number => n !== null);
  if (seqNos.length === 0) {
    throw new LookupError('malformed', 'search', 'The ledger index returned entries without sequence numbers.');
  }
  const boundary = Math.min(...seqNos);
  const complete = rows.filter((r) => sequenceNoOf(r) !== boundary).filter(isIndexedEntry);
  if (rows.some((r) => sequenceNoOf(r) !== boundary)) {
    return { entries: complete, nextBefore: boundary + 1 };
  }
  // Every row fetched shares one sequence number: fetch all of them, then
  // continue below it.
  const filter = `${indexFilter(by, value)} and SequenceNo eq ${boundary}`;
  const all = await fetchRows(entriesUrl(ledger, filter, SAME_SEQNO_LIMIT, endpoints), options);
  return { entries: all.filter(isIndexedEntry), nextBefore: boundary };
}

function sequenceNoOf(row: unknown): number | null {
  const n = (row as { sequenceNo?: unknown } | null)?.sequenceNo;
  return typeof n === 'number' && Number.isSafeInteger(n) ? n : null;
}

function isIndexedEntry(row: unknown): row is IndexedEntry {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return typeof r.transactionId === 'string' && /^\d+\.\d+$/.test(r.transactionId) && typeof r.sequenceNo === 'number';
}
