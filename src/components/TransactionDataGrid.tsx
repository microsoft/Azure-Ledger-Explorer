/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  makeStyles,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridCell,
  DataGridBody,
  Badge,
  createTableColumn,
  tokens,
} from '@fluentui/react-components';
import type { TableColumnDefinition } from '@fluentui/react-components';
import { EntryType } from '../types/ccf-types';

const useStyles = makeStyles({
  dataGrid: {
    height: '100%',
    '& [role="gridcell"]': {
      padding: tokens.spacingVerticalS + ' ' + tokens.spacingHorizontalM,
    },
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  sequenceCell: {
    fontFamily: 'var(--font-mono)',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightMedium,
    color: tokens.colorBrandForeground1,
  },
  sizeCell: {
    fontFamily: 'var(--font-mono)',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  operationsContainer: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  operationBadge: {
    fontFamily: 'var(--font-mono)',
    fontWeight: tokens.fontWeightMedium,
    fontSize: tokens.fontSizeBase100,
  },
  mapNameCell: {
    fontFamily: 'var(--font-mono)',
    fontSize: tokens.fontSizeBase200,
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground1,
  },
  typeBadge: {
    fontSize: tokens.fontSizeBase100,
    fontFamily: 'var(--font-mono)',
  },
  row: {
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: '100ms',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
});

// Transaction type for table columns - matches database query result
export type TransactionRow = {
  id: number;
  fileId: number;
  fileName: string;
  version: number;
  flags: number;
  size: number;
  entryType: number;
  txVersion: number;
  maxConflictVersion: number;
  writeCount: number;
  deleteCount: number;
  mapName?: string;
};

interface TransactionDataGridProps {
  transactions: TransactionRow[];
  onTransactionClick: (transactionId: number) => void;
}

// Helper function to format entry type
const getEntryTypeLabel = (entryType: number): string => {
  switch (entryType) {
    case EntryType.WriteSet: return 'WriteSet';
    case EntryType.Snapshot: return 'Snapshot';
    case EntryType.WriteSetWithClaims: return 'WithClaims';
    case EntryType.WriteSetWithCommitEvidence: return 'WithEvidence';
    case EntryType.WriteSetWithCommitEvidenceAndClaims: return 'WithBoth';
    default: return 'Unknown';
  }
};

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const TransactionDataGrid: React.FC<TransactionDataGridProps> = ({
  transactions,
  onTransactionClick,
}) => {
  const styles = useStyles();

  // Table columns definition
  const columns: TableColumnDefinition<TransactionRow>[] = [
    createTableColumn<TransactionRow>({
      columnId: 'sequence',
      compare: (a, b) => a.id - b.id,
      renderHeaderCell: () => <span className={styles.headerCell}>Sequence</span>,
      renderCell: (item) => (
        <span className={styles.sequenceCell}>
          #{item.id}
        </span>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'type',
      compare: (a, b) => a.entryType - b.entryType,
      renderHeaderCell: () => <span className={styles.headerCell}>Type</span>,
      renderCell: (item) => (
        <Badge appearance="outline" size="small" className={styles.typeBadge}>
          {getEntryTypeLabel(item.entryType)}
        </Badge>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'size',
      compare: (a, b) => a.size - b.size,
      renderHeaderCell: () => <span className={styles.headerCell}>Size</span>,
      renderCell: (item) => (
        <span className={styles.sizeCell}>
          {formatBytes(item.size)}
        </span>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'operations',
      compare: (a, b) => (a.writeCount + a.deleteCount) - (b.writeCount + b.deleteCount),
      renderHeaderCell: () => <span className={styles.headerCell}>Operations</span>,
      renderCell: (item) => (
        <div className={styles.operationsContainer}>
          {item.writeCount > 0 && (
            <Badge appearance="filled" color="success" size="small" className={styles.operationBadge}>
              {item.writeCount}W
            </Badge>
          )}
          {item.deleteCount > 0 && (
            <Badge appearance="filled" color="danger" size="small" className={styles.operationBadge}>
              {item.deleteCount}D
            </Badge>
          )}
          {item.writeCount === 0 && item.deleteCount === 0 && (
            <Badge appearance="tint" color="subtle" size="small" className={styles.operationBadge}>
              Private
            </Badge>
          )}
        </div>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'map',
      compare: (a, b) => (a.mapName || '').localeCompare(b.mapName || ''),
      renderHeaderCell: () => <span className={styles.headerCell}>Map</span>,
      renderCell: (item) => (
        <span className={styles.mapNameCell}>
          {item.mapName || '—'}
        </span>
      ),
    }),
  ];

  return (
    <DataGrid
      items={transactions}
      columns={columns}
      sortable
      selectionMode="single"
      onSelectionChange={(_, data) => {
        if (data.selectedItems.size > 0) {
          const selectedItems = Array.from(data.selectedItems);
          const rowIndex = parseInt(selectedItems[0] as string);
          const selectedTransaction = transactions[rowIndex];
          if (selectedTransaction) {
            onTransactionClick(selectedTransaction.id);
          }
        }
      }}
      className={styles.dataGrid}
    >
      <DataGridHeader>
        <DataGridRow>
          {({ renderHeaderCell }) => (
            <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
          )}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<TransactionRow>>
        {({ item, rowId }) => (
          <DataGridRow<TransactionRow> key={rowId} className={styles.row}>
            {({ renderCell }) => (
              <DataGridCell>
                {renderCell(item)}
              </DataGridCell>
            )}
          </DataGridRow>
        )}
      </DataGridBody>
    </DataGrid>
  );
};
