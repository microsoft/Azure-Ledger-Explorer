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
} from '@fluentui/react-components';
import type { TableColumnDefinition } from '@fluentui/react-components';
import { EntryType } from '@ccf/ledger-parser';

const useStyles = makeStyles({
  monoFontSmall: {
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  monoFontMedium: {
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  operationsContainer: {
    display: 'flex',
    gap: '4px',
  },
  mapNameContainer: {
    fontFamily: 'monospace',
    fontSize: '13px',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
      renderHeaderCell: () => 'Sequence #',
      renderCell: (item) => (
        <div className={styles.monoFontMedium}>
          #{item.id}
        </div>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'type',
      compare: (a, b) => a.entryType - b.entryType,
      renderHeaderCell: () => 'Type',
      renderCell: (item) => (
        <Badge appearance="outline" size="small">
          {getEntryTypeLabel(item.entryType)}
        </Badge>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'size',
      compare: (a, b) => a.size - b.size,
      renderHeaderCell: () => 'Size',
      renderCell: (item) => (
        <div className={styles.monoFontSmall}>
          {formatBytes(item.size)}
        </div>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'operations',
      compare: (a, b) => (a.writeCount + a.deleteCount) - (b.writeCount + b.deleteCount),
      renderHeaderCell: () => 'Operations',
      renderCell: (item) => (
        <div className={styles.operationsContainer}>
          {item.writeCount > 0 && (
            <Badge appearance="filled" color="success" size="small">
              {item.writeCount}W
            </Badge>
          )}
          {item.deleteCount > 0 && (
            <Badge appearance="filled" color="danger" size="small">
              {item.deleteCount}D
            </Badge>
          )}
        </div>
      ),
    }),
    createTableColumn<TransactionRow>({
      columnId: 'map',
      compare: (a, b) => (a.mapName || '').localeCompare(b.mapName || ''),
      renderHeaderCell: () => 'Map',
      renderCell: (item) => (
        <div className={styles.mapNameContainer}>
          {item.mapName || 'N/A'}
        </div>
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
      style={{ height: '100%' }}
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
          <DataGridRow<TransactionRow> key={rowId}>
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
