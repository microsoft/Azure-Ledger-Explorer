import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridCell,
  DataGridBody,
  Badge,
  Button,
  createTableColumn,
} from '@fluentui/react-components';
import type { TableColumnDefinition } from '@fluentui/react-components';
import {
  Document24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';
import { 
  useStats, 
  useFileDrop, 
  useLedgerFiles, 
  useFileTransactions,
  useFileTransactionsCount,
  useAllTransactions,
  useAllTransactionsCount,
  useStorageQuota
} from '../hooks/use-ccf-data';
import { FileUploadArea } from './FileUploadArea';
import { LedgerVisualization } from './LedgerVisualization';
import type { TransactionType } from '../utils/transaction-classification';
import { filterTransactionsByTypes } from '../utils/transaction-classification';
import { EntryType } from '../types/ccf-types';


const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '90vh',
    width: '100%'
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    backgroundColor: 'var(--colorNeutralBackground1)',
  },
  sidebar: {
    width: 'var(--sidebar-width, 250px)',
    minWidth: '150px',
    maxWidth: '500px',
    borderRight: '1px solid var(--colorNeutralStroke2)',
    backgroundColor: 'var(--colorNeutralBackground2)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '4px',
    height: '100%',
    cursor: 'col-resize',
    backgroundColor: 'transparent',
    borderRight: '1px solid transparent',
    zIndex: 10,
    '&:hover': {
      borderRight: '1px solid var(--colorBrandBackground)',
    },
  },
  resizeHandleActive: {
    borderRight: '1px solid var(--colorBrandBackground)',
  },
  resizing: {
    cursor: 'col-resize',
  },
  sidebarHeader: {
    padding: '16px',
    borderBottom: '1px solid var(--colorNeutralStroke2)',
    backgroundColor: 'var(--colorNeutralBackground1)',
  },
  sidebarContent: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  canvas: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  canvasHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--colorNeutralStroke2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchContainer: {
    maxWidth: '400px',
    flex: 1,
  },
  tableContainer: {
    flex: 1,
    maxWidth: '100%',
    overflowX: 'hidden',
    overflowY: 'scroll',
    margin: '16px 24px',
    borderRadius: '8px',
    border: '1px solid var(--colorNeutralStroke2)',
  },
  emptyState: {
    padding: '48px',
    textAlign: 'center',
    color: 'var(--colorNeutralForeground2)',
  },
  statusBar: {
    padding: '8px 24px',
    borderTop: '1px solid var(--colorNeutralStroke2)',    
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  uploadProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  treeItem: {
    cursor: 'pointer',
  },
  badge: {
    marginLeft: '8px',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
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
  monoFont: {
    fontFamily: 'monospace',
  },
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
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileNameTooltip: {
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  sidebarTitle: {
    fontWeight: 600,
    margin: 0,
  },
  canvasTitle: {
    fontWeight: 600,
    margin: 0,
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderTop: '1px solid var(--colorNeutralStroke2)',
    backgroundColor: 'var(--colorNeutralBackground2)',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  paginationInfo: {
    fontSize: '13px',
    color: 'var(--colorNeutralForeground2)',
  },
  visualizationContainer: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--colorNeutralStroke2)',
    backgroundColor: 'var(--colorNeutralBackground1)',
  },
});

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

export const CCFVisualizerApp: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionPage, setTransactionPage] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(250); // Default sidebar width
  const [isResizing, setIsResizing] = useState(false);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<Set<TransactionType>>(new Set());
  const pageSize = 50;
  
  const { data: stats } = useStats();
  const { data: ledgerFiles } = useLedgerFiles();
  const { isUploading, uploadError } = useFileDrop();
  const { data: storageInfo } = useStorageQuota();
  
  // Get file-specific transactions if a file is selected
  const { data: fileTransactions, isLoading: fileTransactionsLoading } = useFileTransactions(
    selectedFileId || 0, 
    pageSize, 
    transactionPage * pageSize
  );
  
  // Get all transactions (used when no file is selected or for search)
  const { data: allTransactions, isLoading: allTransactionsLoading } = useAllTransactions(
    pageSize, 
    transactionPage * pageSize, 
    searchQuery
  );
  
  // Use the appropriate data source
  const rawTransactions = selectedFileId && !searchQuery ? fileTransactions : allTransactions;
  const transactionsLoading = selectedFileId && !searchQuery ? fileTransactionsLoading : allTransactionsLoading;
  
  // Apply type filtering to transactions
  const transactions = rawTransactions ? filterTransactionsByTypes(rawTransactions, selectedTypeFilters) : rawTransactions;
  
  // Get total count based on current view
  const { data: fileTransactionsCount } = useFileTransactionsCount(selectedFileId || 0);
  const { data: allTransactionsCount } = useAllTransactionsCount(searchQuery);
  const totalTransactions = selectedFileId && !searchQuery ? fileTransactionsCount : allTransactionsCount;

  const hasData = stats && (stats.fileCount > 0 || stats.transactionCount > 0);

  // Debug logging
  React.useEffect(() => {
    console.log('Transaction data:', {
      selectedFileId,
      searchQuery,
      fileTransactions,
      allTransactions,
      transactions,
      transactionsLoading,
      totalTransactions,
      hasData,
      stats
    });
  }, [selectedFileId, searchQuery, fileTransactions, allTransactions, transactions, transactionsLoading, totalTransactions, hasData, stats]);

  const handleFileSelect = (fileId: number) => {
    setSelectedFileId(fileId);
    // Clear search when selecting a file and reset to first page
    setSearchQuery('');
    setTransactionPage(0);
  };

  const handleTransactionClick = (transactionId: number) => {
    navigate(`/transaction/${transactionId}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setTransactionPage(0); // Reset to first page on new search
    if (query && transactions && transactions.length > 0) {
      // Auto-select the file containing the first matching transaction
      const firstMatch = transactions[0];
      if (firstMatch) {
        setSelectedFileId(firstMatch.fileId);
      }
    }
  };

  const handlePreviousPage = () => {
    if (transactionPage > 0) {
      setTransactionPage(transactionPage - 1);
    }
  };

  const handleNextPage = () => {
    const maxPage = Math.ceil((totalTransactions || 0) / pageSize) - 1;
    if (transactionPage < maxPage) {
      setTransactionPage(transactionPage + 1);
    }
  };

  // Calculate pagination info
  const totalPages = Math.ceil((totalTransactions || 0) / pageSize);
  const currentPage = transactionPage + 1;
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  // Sidebar resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 150 && newWidth <= 500) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add/remove event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Define transaction type for table columns
  type TransactionRow = {
    id: number;
    fileId: number;
    fileName: string;
    sequenceNumber: number;
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

  // Table columns definition
  const columns: TableColumnDefinition<TransactionRow>[] = [
    createTableColumn<TransactionRow>({
      columnId: 'sequence',
      compare: (a, b) => a.sequenceNumber - b.sequenceNumber,
      renderHeaderCell: () => 'Sequence #',
      renderCell: (item) => (
        <div className={styles.monoFontMedium}>
          #{item.id}
        </div>
      ),
    }),
    // createTableColumn<TransactionRow>({
    //   columnId: 'file',
    //   compare: (a, b) => a.fileName.localeCompare(b.fileName),
    //   renderHeaderCell: () => 'File',
    //   renderCell: (item) => (
    //     <Tooltip content={item.fileName} relationship="label">
    //       <div className={styles.fileNameTooltip}>
    //         {item.fileName}
    //       </div>
    //     </Tooltip>
    //   ),
    // }),
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
          <FileUploadArea />
        </div>
      </div>
    );
  }

  // Main explorer view with sidebar and data table
  return (
    <div className={styles.container}>
      {/* Upload Progress */}
      {isUploading && (
        <MessageBar intent="info">
          <div className={styles.uploadProgress}>
            <Spinner size="tiny" />
            <span>Processing ledger file...</span>
          </div>
        </MessageBar>
      )}

      {/* Upload Error Message */}
      {uploadError && (
        <MessageBar intent="error">
          Failed to upload file: {uploadError.message}
        </MessageBar>
      )}

      {/* Main Content */}
      <div 
        className={styles.mainContent}
        // @ts-expect-error CSS custom properties for dynamic sidebar width
        style={{ '--sidebar-width': `${sidebarWidth}px` }}
      >
        {/* Sidebar - File Tree */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Body1 className={styles.sidebarTitle}>Ledger Files</Body1>
          </div>
          <div className={styles.sidebarContent}>
            {ledgerFiles && ledgerFiles.length > 0 ? (
              <Tree aria-label="Ledger Files">
                {ledgerFiles.map((file) => (
                  <TreeItem 
                    key={file.id} 
                    itemType="leaf"
                    className={styles.treeItem}
                    style={{ 
                      backgroundColor: selectedFileId === file.id ? 'var(--colorNeutralBackground3)' : 'transparent'
                    }}
                  >
                    <TreeItemLayout
                      iconBefore={<Document24Regular />}
                      onClick={() => handleFileSelect(file.id)}
                    >
                      <div className={styles.fileTreeItem}>
                          <div className={styles.fileNameContainer}>
                            {file.filename}
                          </div>
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
          </div>
          <div
            className={isResizing ? `${styles.resizeHandle} ${styles.resizeHandleActive}` : styles.resizeHandle}
            onMouseDown={handleMouseDown}
          />
        </div>

        {/* Main Canvas - Transaction Table */}
        <div className={styles.canvas}>
          {/* Canvas Header with Search */}
          <div className={styles.canvasHeader}>
            <Body1 className={styles.canvasTitle}>
              {selectedFileId && !searchQuery ? (
                <>
                  Transactions in {ledgerFiles?.find(f => f.id === selectedFileId)?.filename}
                </>
              ) : (
                <>
                  All Transactions {searchQuery && `(filtered: "${searchQuery}")`}
                </>
              )}
            </Body1>
            <div className={styles.searchContainer}>
              <SearchBox
                placeholder="Search transactions, files, or keys..."
                value={searchQuery}
                onChange={(_, data) => handleSearch(data.value)}
              />
            </div>
          </div>

          {/* Ledger Visualization */}
          {rawTransactions && rawTransactions.length > 0 && (
            <div className={styles.visualizationContainer}>
              <LedgerVisualization
                transactions={rawTransactions}
                isLoading={fileTransactionsLoading || allTransactionsLoading}
                maxTransactions={500}
                selectedTypeFilters={selectedTypeFilters}
                onFilterChange={setSelectedTypeFilters}
              />
            </div>
          )}

          {/* Transaction Table */}
          <div className={styles.tableContainer}>
            {transactions && transactions.length > 0 ? (
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
                      handleTransactionClick(selectedTransaction.id);
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
            ) : transactionsLoading ? (
              <div className={styles.loadingContainer}>
                <Spinner label="Loading transactions..." />
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Body1>
                  {searchQuery ? 'No transactions match your search' : 'No transactions found'}
                </Body1>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {transactions && transactions.length > 0 && totalTransactions && totalTransactions > pageSize && (
            <div className={styles.paginationContainer}>
              <div className={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({totalTransactions} total transactions)
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

      {/* Status Bar */}
      <footer className={styles.statusBar}>
        <Caption1>
          Showing {transactions?.length || 0} 
          {totalTransactions && totalTransactions > pageSize && ` of ${totalTransactions}`} transactions
          {selectedFileId && ledgerFiles && (
            <> • Selected: {ledgerFiles.find(f => f.id === selectedFileId)?.filename}</>
          )}
          {storageInfo?.quota && (
            <> • Storage: {formatBytes(storageInfo.quota.usage)} / {formatBytes(storageInfo.quota.quota)} used ({storageInfo.quota.usagePercentage.toFixed(1)}%)</>
          )}
        </Caption1>
      </footer>
    </div>
  );
};
