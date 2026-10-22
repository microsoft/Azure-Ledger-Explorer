/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  Button,
  Link,
  MessageBar,
  MessageBarBody,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { lookupHref } from '../hooks/use-mst-lookup';
import type { IndexedEntry, IndexSnapshot } from '../types/lookup-types';
import { CopyButton } from './CopyButton';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '12px' },
  intro: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  tx: { width: '130px' },
  signed: { width: '190px' },
  mono: { fontFamily: tokens.fontFamilyMonospace, wordBreak: 'break-all' },
  wrap: { wordBreak: 'break-all' },
  muted: { color: tokens.colorNeutralForeground3 },
});

interface IndexSearchResultsProps {
  ledger: string;
  entries: IndexedEntry[];
  /** What a Parquet index search read; absent for the mst-indexer. */
  snapshot?: IndexSnapshot;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (txId: string) => void;
}

function formatSignedAt(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

/** How current the Parquet index is, and what was checked. */
const SnapshotNote: React.FC<{ snapshot: IndexSnapshot }> = ({ snapshot }) => {
  const styles = useStyles();
  return (
    <Text size={200} className={styles.muted}>
      Parquet index up to sequence number {snapshot.canonicalSeqno} ({snapshot.entriesCount} entries in{' '}
      {snapshot.chunkCount} chunks, updated {formatSignedAt(snapshot.updatedAt)}). The manifest and the{' '}
      {snapshot.chunksRead} chunk {snapshot.chunksRead === 1 ? 'file' : 'files'} read matched root{' '}
      <span className={styles.mono}>{snapshot.manifestRoot.slice(0, 19)}…</span>.{' '}
      {snapshot.attested
        ? 'The ledger attests to this root.'
        : 'The ledger does not attest to this root yet, so the index is consistent but not vouched for.'}
    </Text>
  );
};

/**
 * Entries the index says match a search. These are unverified pointers:
 * opening one fetches the statement from the ledger and verifies it.
 */
export const IndexSearchResults: React.FC<IndexSearchResultsProps> = ({
  ledger,
  entries,
  snapshot,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpen,
}) => {
  const styles = useStyles();

  if (entries.length === 0) {
    return (
      <div className={styles.root}>
        <MessageBar intent="info">
          <MessageBarBody>No indexed entries match this search.</MessageBarBody>
        </MessageBar>
        {snapshot && <SnapshotNote snapshot={snapshot} />}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.intro}>
        <Text className={styles.muted}>
          Matches from the ledger index, newest first. They are not verified: open an entry to fetch it
          from the ledger and verify it.
        </Text>
        <CopyButton link value={() => window.location.href} what="link to this search" />
      </div>
      {snapshot && <SnapshotNote snapshot={snapshot} />}
      <Table size="small" aria-label="Indexed entries">
        <TableHeader>
          <TableRow>
            <TableHeaderCell className={styles.tx}>Transaction</TableHeaderCell>
            <TableHeaderCell className={styles.signed}>Signed at</TableHeaderCell>
            <TableHeaderCell>Subject</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => (
            // Several index rows can point at one transaction.
            <TableRow key={`${entry.transactionId}-${index}`}>
              <TableCell>
                <Link
                  className={styles.mono}
                  href={lookupHref(ledger, { by: 'txId', value: entry.transactionId })}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                    event.preventDefault();
                    onOpen(entry.transactionId);
                  }}
                >
                  {entry.transactionId}
                </Link>
              </TableCell>
              <TableCell>{formatSignedAt(entry.signedAt)}</TableCell>
              <TableCell>
                <div className={styles.wrap}>{entry.subject ?? '—'}</div>
                {entry.issuer && (
                  <Text size={200} className={mergeClasses(styles.muted, styles.wrap)}>
                    {entry.issuer}
                  </Text>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasMore && (
        <div>
          <Button onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
};
