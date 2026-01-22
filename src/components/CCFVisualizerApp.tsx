/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  makeStyles,
  Body1,
  Caption1,
  Spinner,
  MessageBar,
  SearchBox,
  Tree,
  TreeItem,
  TreeItemLayout,
  Badge,
  Button,
  tokens,
} from '@fluentui/react-components';
import {
  Document24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  DocumentAdd24Regular,
  DocumentRegular,
} from '@fluentui/react-icons';
import {
  useStats,
  useFileDrop,
  useLedgerFiles,
  useFileTransactions,
  useFileTransactionsCount,
  useStorageQuota
} from '../hooks/use-ccf-data';
import { AddFilesWizard } from './AddFilesWizard';
import { LedgerVisualization } from './LedgerVisualization';
import { TransactionDataGrid } from './TransactionDataGrid';
import type { TransactionType } from '../utils/transaction-classification';
import { filterTransactionsByTypes } from '../utils/transaction-classification';
import { Sidebar } from './Sidebar';


const useStyles = makeStyles({
  // Main container - full height flex column
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  // Middle section with sidebar + content
  mainContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  // Main canvas area (right of sidebar)
  canvas: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  canvasHeader: {
    padding: '16px 24px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  canvasTitle: {
    fontWeight: 600,
    margin: 0,
  },
  searchContainer: {
    maxWidth: '400px',
    flex: 1,
  },
  visualizationContainer: {
    padding: '16px 24px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  tableContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    margin: '16px 24px',
    borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    flexShrink: 0,
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  paginationInfo: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
  },
  // Footer status bar - minimal height
  statusBar: {
    padding: '6px 24px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    flexShrink: 0,
  },
  // Utility styles
  uploadProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  emptyState: {
    padding: '48px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
  },
  centerContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
  },
  // File tree styles
  treeItem: {
    cursor: 'pointer',
  },
  fileTreeItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  fileNameContainer: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '150px',
  },
  badge: {
    marginLeft: '8px',
  },
});

export const CCFVisualizerApp: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');

  const [transactionPage, setTransactionPage] = useState(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(p) && p > 0 ? p - 1 : 0;
  });

  const [selectedTypeFilters, setSelectedTypeFilters] = useState<Set<TransactionType>>(() => {
    const raw = searchParams.get('types') || '';
    const values = raw
      .split(',')
      .map(v => v.trim())
      .filter(Boolean) as TransactionType[];
    return new Set(values);
  });

  const pageSize = 10;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { data: stats } = useStats();
  const { data: ledgerFiles } = useLedgerFiles();
  const { isUploading, uploadError } = useFileDrop();
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);
  const { data: storageInfo } = useStorageQuota();

  // Auto-select the first file when files are loaded
  React.useEffect(() => {
    if (ledgerFiles && ledgerFiles.length > 0 && selectedFileId === null) {
      setSelectedFileId(ledgerFiles[0].id);
    }
  }, [ledgerFiles, selectedFileId]);

  // Get file-specific transactions with server-side search
  const { data: fileTransactions, isLoading: fileTransactionsLoading } = useFileTransactions(
    selectedFileId || 0,
    pageSize,
    transactionPage * pageSize,
    searchQuery || undefined
  );

  // Get transaction count for the selected file with search
  const { data: fileTransactionsCount } = useFileTransactionsCount(
    selectedFileId || 0,
    searchQuery || undefined
  );

  // Apply only type filtering to transactions (search is now server-side)
  const transactions = fileTransactions ? filterTransactionsByTypes(fileTransactions, selectedTypeFilters) : fileTransactions;
  const transactionsLoading = fileTransactionsLoading;
  const totalTransactions = fileTransactionsCount;

  const filteredTotalTransactions = React.useMemo(() => {
    if (selectedTypeFilters.size > 0) {
      return transactions?.length ?? 0;
    }
    return totalTransactions ?? 0;
  }, [selectedTypeFilters, totalTransactions, transactions]);

  const hasData = stats && (stats.fileCount > 0 || stats.transactionCount > 0);

  const handleFileSelect = (fileId: number) => {
    setSelectedFileId(fileId);
    setTransactionPage(0);

    // Preserve query params but reset page when switching files
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleTransactionClick = (transactionId: number) => {
    // keep current query params so Back returns to same filtered/paged view
    const qs = searchParams.toString();
    navigate(`/transaction/${transactionId}${qs ? `?${qs}` : ''}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setTransactionPage(0);

    const next = new URLSearchParams(searchParams);
    const normalized = query.trim();
    if (normalized) {
      next.set('q', normalized);
    } else {
      next.delete('q');
    }
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handlePreviousPage = () => {
    if (transactionPage > 0) {
      const nextPage = transactionPage - 1;
      setTransactionPage(nextPage);

      const next = new URLSearchParams(searchParams);
      next.set('page', String(nextPage + 1));
      setSearchParams(next, { replace: true });
    }
  };

  const handleNextPage = () => {
    const maxPage = Math.ceil((totalTransactions || 0) / pageSize) - 1;
    if (transactionPage < maxPage) {
      const nextPage = transactionPage + 1;
      setTransactionPage(nextPage);

      const next = new URLSearchParams(searchParams);
      next.set('page', String(nextPage + 1));
      setSearchParams(next, { replace: true });
    }
  };

  // Calculate pagination info
  const totalPages = Math.ceil((filteredTotalTransactions || 0) / pageSize);
  const currentPage = transactionPage + 1;
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  // Keep local state in sync with URL
  React.useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== searchQuery) {
      setSearchQuery(urlQ);
    }

    const urlPage = parseInt(searchParams.get('page') || '1', 10);
    const normalizedPage = Number.isFinite(urlPage) && urlPage > 0 ? urlPage - 1 : 0;
    if (normalizedPage !== transactionPage) {
      setTransactionPage(normalizedPage);
    }

    const rawTypes = searchParams.get('types') || '';
    const urlTypes = new Set(
      rawTypes
        .split(',')
        .map(v => v.trim())
        .filter(Boolean) as TransactionType[],
    );

    const sameTypes =
      urlTypes.size === selectedTypeFilters.size &&
      Array.from(urlTypes).every(t => selectedTypeFilters.has(t));

    if (!sameTypes) {
      setSelectedTypeFilters(urlTypes);
    }
  }, [searchParams]);

  const handleTypeFiltersChange = (nextTypes: Set<TransactionType>) => {
    setSelectedTypeFilters(nextTypes);
    setTransactionPage(0);

    const next = new URLSearchParams(searchParams);
    const encoded = Array.from(nextTypes).sort().join(',');

    if (encoded) {
      next.set('types', encoded);
    } else {
      next.delete('types');
    }

    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  // Show upload screen if no data
  if (!hasData) {
    return (
      <div className={styles.container}>
        {/* Upload Error Message */}
        {uploadError && (
          <MessageBar intent="error">
            Failed to upload file: {uploadError.message}
          </MessageBar>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <MessageBar intent="info">
            <div className={styles.uploadProgress}>
              <Spinner size="tiny" />
              <span>Processing ledger file...</span>
            </div>
          </MessageBar>
        )}

        <div className={styles.centerContent}>
          {/* Upload Files Button */}
          <Button
            size='large'
            appearance="primary"
            icon={<DocumentAdd24Regular />}
            onClick={() => setShowUploadDialog(true)}
          >
            Add Files
          </Button>

          <AddFilesWizard
            open={showUploadDialog}
            onOpenChange={setShowUploadDialog}
          />
        </div>
      </div>
    );
  }

  const renderSideBar = () => (
    <Sidebar icon={<DocumentRegular />} title="Ledger Files" resizable collapsible>
      {ledgerFiles && ledgerFiles.length > 0 ? (
        <Tree aria-label="Ledger Files">
          {ledgerFiles.map((file) => (
            <TreeItem
              key={file.id}
              itemType="leaf"
              className={styles.treeItem}
              style={{
                backgroundColor: selectedFileId === file.id ? tokens.colorNeutralBackground3 : 'transparent'
              }}
            >
              <TreeItemLayout
                iconBefore={<Document24Regular />}
                onClick={() => handleFileSelect(file.id)}
              >
                <div className={styles.fileTreeItem}>
                  <div className={styles.fileNameContainer}>{file.filename}</div>
                  <Badge appearance="outline" size="small" className={styles.badge}>
                    {formatBytes(file.fileSize)}
                  </Badge>
                </div>
              </TreeItemLayout>
            </TreeItem>
          ))}
        </Tree>
      ) : (
        <div className={styles.emptyState}>
          <Body1>No files uploaded</Body1>
        </div>
      )}
    </Sidebar>
  );

  const renderTransactionContent = () => {
    if (transactionsLoading) {
      return (
        <div className={styles.loadingContainer}>
          <Spinner label="Loading transactions..." />
        </div>
      );
    }

    return (
      <TransactionDataGrid
        transactions={transactions ?? []}
        onTransactionClick={handleTransactionClick}
      />
    );
  };

  const selectedFileName = ledgerFiles?.find(f => f.id === selectedFileId)?.filename;
  const showPagination = transactions && transactions.length > 0 && filteredTotalTransactions > pageSize;

  // Main layout: container (column) -> messages, mainContent (row: sidebar + canvas), footer
  return (
    <div className={styles.container}>
      {/* Status Messages */}
      {isUploading && (
        <MessageBar intent="info">
          <div className={styles.uploadProgress}>
            <Spinner size="tiny" />
            <span>Processing ledger file...</span>
          </div>
        </MessageBar>
      )}
      {uploadError && (
        <MessageBar intent="error">
          Failed to upload file: {uploadError.message}
        </MessageBar>
      )}

      {/* Main Content: Sidebar + Canvas */}
      <div className={styles.mainContent}>
        {renderSideBar()}

        <div className={styles.canvas}>
          {/* Header */}
          <div className={styles.canvasHeader}>
            <Body1 className={styles.canvasTitle}>
              {selectedFileId && !searchQuery
                ? `Transactions in ${selectedFileName}`
                : `All Transactions${searchQuery ? ` (filtered: "${searchQuery}")` : ''}`}
            </Body1>
            <div className={styles.searchContainer}>
              <SearchBox
                placeholder="Search transactions, files, or keys..."
                value={searchQuery}
                onChange={(_, data) => handleSearch(data.value)}
              />
            </div>
          </div>

          {/* Visualization */}
          {fileTransactions && fileTransactions.length > 0 && (
            <div className={styles.visualizationContainer}>
              <LedgerVisualization
                transactions={fileTransactions}
                isLoading={transactionsLoading}
                maxTransactions={500}
                selectedTypeFilters={selectedTypeFilters}
                onFilterChange={handleTypeFiltersChange}
              />
            </div>
          )}

          {/* Transaction Table */}
          <div className={styles.tableContainer}>
            {renderTransactionContent()}
          </div>

          {/* Pagination */}
          {showPagination && (
            <div className={styles.paginationContainer}>
              <div className={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({filteredTotalTransactions} total)
              </div>
              <div className={styles.paginationControls}>
                <Button
                  appearance="subtle"
                  icon={<ChevronLeft24Regular />}
                  disabled={!hasPreviousPage}
                  onClick={handlePreviousPage}
                >
                  Previous
                </Button>
                <Button
                  appearance="subtle"
                  icon={<ChevronRight24Regular />}
                  disabled={!hasNextPage}
                  onClick={handleNextPage}
                  iconPosition="after"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.statusBar}>
        <Caption1>
          {transactions?.length || 0}{filteredTotalTransactions && filteredTotalTransactions > pageSize ? ` of ${filteredTotalTransactions}` : ''} transactions
          {selectedFileName && ` • ${selectedFileName}`}
          {storageInfo?.quota && ` • Storage: ${formatBytes(storageInfo.quota.usage)} / ${formatBytes(storageInfo.quota.quota)} (${storageInfo.quota.usagePercentage.toFixed(1)}%)`}
        </Caption1>
      </footer>
    </div>
  );
};
