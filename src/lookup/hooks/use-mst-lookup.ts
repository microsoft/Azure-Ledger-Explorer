/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useCallback, useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { searchIndex } from '../services/indexer-search-service';
import { defaultEndpoints, lookupStatement } from '../services/mst-lookup-service';
import type { DirectSearchBy, EntryRef, IndexSearchBy, SearchBy } from '../types/lookup-types';
import { parseEntry, parseLedgerName } from '../utils/lookup-verdict';

/** The URL query parameter that carries each search type. */
export const SEARCH_PARAM: Record<SearchBy, string> = {
  txId: 'tx',
  issuer: 'issuer',
  subject: 'subject',
  payloadHash: 'hash',
};

export const lookupQueryKeys = {
  statement: (ledger: string, entry: EntryRef) => ['mstLookup', 'statement', ledger, entry.by, entry.value] as const,
  search: (ledger: string, entry: EntryRef) => ['mstLookup', 'search', ledger, entry.by, entry.value] as const,
} as const;

/**
 * Fetch and verify one MST entry.
 *
 * A registered entry never changes, so a result is kept for the session
 * rather than refetched. Failures are not retried here: the service layer
 * already retries the transient responses MST returns.
 *
 * @param ledger - Bare ledger name, or `null` to stay idle.
 * @param entry - The entry to look up, or `null` to stay idle.
 */
export const useMstLookup = (ledger: string | null, entry: EntryRef<DirectSearchBy> | null) =>
  useQuery({
    queryKey: lookupQueryKeys.statement(ledger ?? '', entry ?? { by: 'txId', value: '' }),
    queryFn: ({ signal }) => {
      if (!ledger || !entry) throw new Error('A ledger name and an entry reference are required.');
      return lookupStatement(ledger, entry, defaultEndpoints, { signal });
    },
    enabled: Boolean(ledger && entry),
    retry: false,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });

/**
 * Search a ledger's index by issuer, subject or payload hash, a page at a
 * time. Works only for ledgers onboarded to the mst-indexer; others fail with
 * a `notIndexed` error explaining that.
 *
 * @param ledger - Bare ledger name, or `null` to stay idle.
 * @param entry - The search, or `null` to stay idle.
 */
export const useIndexSearch = (ledger: string | null, entry: EntryRef<IndexSearchBy> | null) =>
  useInfiniteQuery({
    queryKey: lookupQueryKeys.search(ledger ?? '', entry ?? { by: 'subject', value: '' }),
    queryFn: ({ pageParam, signal }) => {
      if (!ledger || !entry) throw new Error('A ledger name and a search are required.');
      return searchIndex(ledger, entry.by, entry.value, pageParam, defaultEndpoints, { signal });
    },
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: Boolean(ledger && entry),
    retry: false,
    // The index grows as entries are registered, so unlike a statement a
    // search can go stale; keep it for a few minutes only.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export interface LookupParams {
  /** The validated ledger name, or `null` if absent or invalid. */
  ledger: string | null;
  /** The validated entry, or `null` if absent or invalid. */
  entry: EntryRef | null;
  /** The values as they appear in the URL, to prefill the form. */
  draft: { ledger: string; entry: EntryRef | null };
  /** Whether the URL carries a value that does not validate. */
  invalid: boolean;
}

/** Exported for tests. */
export function readParams(search: string = window.location.search): LookupParams {
  const params = new URLSearchParams(search);
  const rawLedger = params.get('ledger') ?? '';
  const ledger = parseLedgerName(rawLedger);
  let entry: EntryRef | null = null;
  let rawEntry: EntryRef | null = null;
  for (const by of Object.keys(SEARCH_PARAM) as SearchBy[]) {
    const raw = params.get(SEARCH_PARAM[by]);
    if (raw !== null) {
      rawEntry = { by, value: raw };
      const value = parseEntry(by, raw);
      entry = value ? { by, value } : null;
      break;
    }
  }
  const invalid = (rawLedger.trim() !== '' && !ledger) || (rawEntry !== null && !entry);
  return { ledger, entry, draft: { ledger: rawLedger, entry: rawEntry }, invalid };
}

/**
 * The lookup the page is showing, kept in the URL (`?ledger=` plus one of
 * `tx`, `issuer`, `subject` or `hash`) so a result can be shared as a
 * link and the back button moves between lookups.
 */
export const useLookupParams = () => {
  const [params, setParams] = useState<LookupParams>(readParams);

  useEffect(() => {
    const onPopState = () => setParams(readParams());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((ledger: string, entry: EntryRef) => {
    window.history.pushState(null, '', lookupHref(ledger, entry));
    setParams({ ledger, entry, draft: { ledger, entry }, invalid: false });
  }, []);

  return { ...params, navigate };
};

/** The page URL for a lookup, for links that can also be opened in a new tab. */
export function lookupHref(ledger: string, entry: EntryRef): string {
  const url = new URL(window.location.href);
  url.searchParams.set('ledger', ledger);
  for (const name of Object.values(SEARCH_PARAM)) url.searchParams.delete(name);
  url.searchParams.set(SEARCH_PARAM[entry.by], entry.value);
  return url.href;
}