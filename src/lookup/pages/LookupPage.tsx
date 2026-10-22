/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  Badge,
  Link,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ShieldCheckmark28Regular } from '@fluentui/react-icons';
import { IndexSearchResults } from '../components/IndexSearchResults';
import { LookupForm } from '../components/LookupForm';
import { LookupResultView } from '../components/LookupResultView';
import { useIndexSearch, useLookupParams, useMstLookup } from '../hooks/use-mst-lookup';
import { defaultEndpoints, LookupError } from '../services/mst-lookup-service';
import { CONTROL_PLANE_HOST, IDENTITY_HOST } from '../config/endpoints';
import type { DirectSearchBy, EntryRef, IndexSearchBy } from '../types/lookup-types';
import { isIndexSearch } from '../utils/lookup-verdict';

// The dev-server proxy (`/mst-dev/...`) forwards to the canary hosts too.
const usesCanary = Object.values(defaultEndpoints).every(
  (base) => base.startsWith('/mst-dev/') || base.startsWith(CONTROL_PLANE_HOST) || base.startsWith(IDENTITY_HOST),
);

const useStyles = makeStyles({
  page: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '32px 24px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '4px' },
  titleRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  titleIcon: { color: tokens.colorBrandForeground1, fontSize: '32px', flexShrink: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * Look up one MST entry by transaction ID and verify it in
 * the browser, or search an indexed ledger by issuer, subject or payload hash.
 * Deliberately standalone: it loads none of the explorer's database or parser
 * code.
 */
const LookupPage: React.FC = () => {
  const styles = useStyles();
  const { ledger, entry, navigate } = useLookupParams();
  const directEntry = entry && !isIndexSearch(entry.by) ? (entry as EntryRef<DirectSearchBy>) : null;
  const indexEntry = entry && isIndexSearch(entry.by) ? (entry as EntryRef<IndexSearchBy>) : null;
  const lookup = useMstLookup(ledger, directEntry);
  const search = useIndexSearch(ledger, indexEntry);
  const entryKey = entry ? `${entry.by}:${entry.value}` : '';

  const searchLoading = search.isFetching && !search.isFetchingNextPage;
  const busy = lookup.isFetching || searchLoading;
  const error = indexEntry ? search.error : lookup.error;
  const errorTitle = !(error instanceof LookupError)
    ? 'Lookup failed'
    : error.kind === 'notIndexed'
      ? 'Ledger not indexed'
      : error.kind === 'notFound' && (error.step === 'search' || error.step === 'identity')
        ? 'Ledger not found'
        : error.kind === 'notFound' && error.step === 'statement' && error.status === 400
          ? 'Not a statement registration'
          : error.kind === 'notFound'
            ? 'Not found'
            : indexEntry
              ? 'Search failed'
              : 'Lookup failed';
  const searchEntries = search.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <ShieldCheckmark28Regular className={styles.titleIcon} />
          <Text as="h1" size={700} weight="semibold">MST statement lookup</Text>
          <Tooltip
            content={
              usesCanary
                ? 'Uses the canary (Central US EUAP) control-plane and identity endpoints.'
                : `Uses ${defaultEndpoints.proxyBase}, ${defaultEndpoints.identityBase} and ${defaultEndpoints.indexerBase}.`
            }
            relationship="description"
            withArrow
          >
            <Badge appearance="tint" color="brand">{usesCanary ? 'Preview · canary' : 'Preview · custom endpoints'}</Badge>
          </Tooltip>
        </div>
        <Text className={styles.muted}>
          Fetch a transparent statement from Microsoft&apos;s Signing Transparency service and verify
          its signature and receipt in your browser.
        </Text>
      </header>

      <LookupForm
        key={`${ledger ?? ''}|${entryKey}`}
        initialLedger={ledger ?? ''}
        initialEntry={entry}
        busy={busy}
        onSubmit={(l, e) => {
          if (l === ledger && `${e.by}:${e.value}` === entryKey) {
            void (indexEntry ? search.refetch() : lookup.refetch());
          } else {
            navigate(l, e);
          }
        }}
      />

      {lookup.isFetching && <Spinner label="Fetching and verifying…" />}
      {searchLoading && <Spinner label="Searching the ledger index…" />}

      {error && !busy && (
        <MessageBar intent={errorTitle === 'Ledger not indexed' ? 'warning' : 'error'}>
          <MessageBarBody>
            <MessageBarTitle>{errorTitle}</MessageBarTitle>
            {error.message}
          </MessageBarBody>
        </MessageBar>
      )}

      {lookup.data && !lookup.isFetching && <LookupResultView result={lookup.data} />}

      {ledger && indexEntry && search.data && !searchLoading && (
        <IndexSearchResults
          ledger={ledger}
          entries={searchEntries}
          hasMore={search.hasNextPage}
          loadingMore={search.isFetchingNextPage}
          onLoadMore={() => void search.fetchNextPage()}
          onOpen={(txId) => navigate(ledger, { by: 'txId', value: txId })}
        />
      )}

      {!ledger && !entry && (
        <Text className={styles.muted}>
          Enter the ledger name, then the transaction ID returned when the statement was registered.
          Ledgers onboarded to the MST indexer can also be searched by issuer,
          subject or payload hash. Results are shareable: the page URL carries the search.
        </Text>
      )}

      <Text size={200} className={styles.muted}>
        Part of <Link href={import.meta.env.VITE_EXPLORER_URL ?? '../'}>CCF Ledger Explorer</Link>. Verification runs locally using{' '}
        <Link href="https://github.com/microsoft/scitt-verifier" target="_blank" rel="noreferrer">scitt-verifier</Link>{' '}
        compiled to WebAssembly.
      </Text>
    </main>
  );
};

export default LookupPage;
