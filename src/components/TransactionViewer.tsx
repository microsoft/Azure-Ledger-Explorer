/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useEffect, useState } from 'react';
import {
  makeStyles,
  Text,
  Caption1,
  Button,
  Card,
  Badge,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Tab,
  TabList,
  tokens,
} from '@fluentui/react-components';
import type { TabValue } from '@fluentui/react-components';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Info24Regular,
  Code24Regular,
  Database24Regular,
  Delete24Regular,
  Eye24Regular,
} from '@fluentui/react-icons';
import { useTransactions, useTransactionDetails } from '../hooks/use-ccf-data';
import { EntryType } from '../types/ccf-types';
import type { LedgerKeyValue } from '../types/ccf-types';
import { ValueViewer } from './ValueViewer';

// Helper functions for organizing data by table
const extractTableName = (item: LedgerKeyValue): string => {
  // Use the mapName property from the database if available
  if (item.mapName) {
    return item.mapName;
  }
  
  // Fallback: try to extract from key for backward compatibility
  if (item.key.includes('/')) {
    return item.key.split('/')[0];
  }
  return item.key;
};

const groupByTable = (items: LedgerKeyValue[]): Record<string, LedgerKeyValue[]> => {
  return items.reduce((acc, item) => {
    const tableName = extractTableName(item);
    if (!acc[tableName]) {
      acc[tableName] = [];
    }
    acc[tableName].push(item);
    return acc;
  }, {} as Record<string, LedgerKeyValue[]>);
};

const useStyles = makeStyles({
  container: {
    padding: '24px',
    height: '80vh',
    overflowY: 'scroll',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  transactionCard: {
    marginBottom: '16px',
  },
  transactionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  transactionMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metaLabel: {
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  metaValue: {
    color: tokens.colorNeutralForeground2,
    fontFamily: 'monospace',
  },
  kvTable: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  hexValue: {
    fontFamily: 'monospace',
    fontSize: '12px',
    wordBreak: 'break-all',
    maxWidth: '300px',
  },
  entryTypeBadge: {
    textTransform: 'uppercase',
  },
  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: tokens.colorNeutralForeground3,
  },
  dialogContent: {
    maxHeight: '70vh',
    overflow: 'auto',
  },
  accordionContent: {
    padding: '16px',
  },
});

interface TransactionViewerProps {
  fileId: number;
  fileName?: string;
  transactionId?: number; // Optional prop to show specific transaction
}

export const TransactionViewer: React.FC<TransactionViewerProps> = ({ 
  fileId, 
  fileName,
  transactionId 
}) => {
  const styles = useStyles();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(transactionId || null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabValue>('writes');
  const [dialogSelectedTab, setDialogSelectedTab] = useState<TabValue>('writes');

  // Keep internal selection in sync with the route-driven prop.
  // Without this, navigating between /transaction/:id routes (including browser back/forward)
  // can show stale details because the component instance is reused.
  useEffect(() => {
    if (transactionId) {
      setSelectedTransaction(transactionId);
      setIsDetailsDialogOpen(false);
      setSelectedTab('writes');
      setDialogSelectedTab('writes');
    }
  }, [transactionId]);
  
  const handleTransactionClick = (transactionId: number) => {
    setSelectedTransaction(transactionId);
    setIsDetailsDialogOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };
  
  const pageSize = 20;
  const offset = currentPage * pageSize;
  
  const { data: transactions, isLoading, error } = useTransactions(fileId, pageSize, offset);
  const { data: transactionDetails } = useTransactionDetails(selectedTransaction || 0);

  // If a specific transaction is requested, show it directly
  if (transactionId && transactionDetails) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Text size={500} weight="semibold">
            Transaction Details
          </Text>
        </div>
        
        {/* Transaction Details */}
        <div>
          <TabList selectedValue={selectedTab} onTabSelect={(_, data) => setSelectedTab(data.value)}>
            {transactionDetails.writes.length > 0 && (
              <Tab value="writes" icon={<Code24Regular />}>
                {(() => {
                  const writesByTable = groupByTable(transactionDetails.writes);
                  const tableCount = Object.keys(writesByTable).length;
                  const keyCount = transactionDetails.writes.length;
                  return `Writes (${tableCount} table${tableCount !== 1 ? 's' : ''}, ${keyCount} key${keyCount !== 1 ? 's' : ''})`;
                })()}
              </Tab>
            )}
            {transactionDetails.deletes.length > 0 && (
              <Tab value="deletes" icon={<Delete24Regular />}>
                {(() => {
                  const deletesByTable = groupByTable(transactionDetails.deletes);
                  const tableCount = Object.keys(deletesByTable).length;
                  const keyCount = transactionDetails.deletes.length;
                  return `Deletes (${tableCount} table${tableCount !== 1 ? 's' : ''}, ${keyCount} key${keyCount !== 1 ? 's' : ''})`;
                })()}
              </Tab>
            )}
          </TabList>

          {/* Writes Tab Content */}
          {selectedTab === 'writes' && transactionDetails.writes.length > 0 && (
            <div className={styles.accordionContent} style={{ marginTop: '16px' }}>
              {(() => {
                const writesByTable = groupByTable(transactionDetails.writes);
                const tableNames = Object.keys(writesByTable).sort();
                
                return tableNames.map(tableName => (
                  <div key={tableName} style={{ marginBottom: '24px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      marginBottom: '12px',
                      padding: '8px 12px',
                      backgroundColor: tokens.colorNeutralBackground2,
                      borderRadius: '4px',
                      border: `1px solid ${tokens.colorNeutralStroke2}`
                    }}>
                      <Database24Regular style={{ color: tokens.colorNeutralForeground2 }} />
                      <Text weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                        {tableName}
                      </Text>
                      <Badge size="small" color="brand">
                        {writesByTable[tableName].length} key{writesByTable[tableName].length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {writesByTable[tableName].map((write, index) => (
                      <div key={index} style={{ marginBottom: '16px', marginLeft: '16px' }}>
                        <ValueViewer
                          keyName={write.key.includes('/') ? write.key.split('/').slice(1).join('/') : write.key}
                          value={write.value}
                          tableName={write.mapName || tableName}
                        />
                        <Text 
                          style={{ 
                            fontSize: '12px', 
                            color: tokens.colorNeutralForeground3,
                            marginTop: '8px',
                            marginLeft: '8px',
                            fontFamily: 'monospace'
                          }}
                        >
                          Version: {write.version}
                        </Text>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Deletes Tab Content */}
          {selectedTab === 'deletes' && transactionDetails.deletes.length > 0 && (
            <div className={styles.accordionContent} style={{ marginTop: '16px' }}>
              {(() => {
                const deletesByTable = groupByTable(transactionDetails.deletes);
                const tableNames = Object.keys(deletesByTable).sort();
                
                return tableNames.map(tableName => (
                  <div key={tableName} style={{ marginBottom: '24px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      marginBottom: '12px',
                      padding: '8px 12px',
                      backgroundColor: tokens.colorNeutralBackground2,
                      borderRadius: '4px',
                      border: `1px solid ${tokens.colorNeutralStroke2}`
                    }}>
                      <Database24Regular style={{ color: tokens.colorNeutralForeground2 }} />
                      <Text weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                        {tableName}
                      </Text>
                      <Badge size="small" color="danger">
                        {deletesByTable[tableName].length} deletion{deletesByTable[tableName].length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <div style={{ marginLeft: '16px' }}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell>Key</TableHeaderCell>
                            <TableHeaderCell>Version</TableHeaderCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deletesByTable[tableName].map((del, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <TableCellLayout>
                                  <Text className={styles.metaValue}>
                                    {del.key.includes('/') ? del.key.split('/').slice(1).join('/') : del.key}
                                  </Text>
                                </TableCellLayout>
                              </TableCell>
                              <TableCell>
                                <TableCellLayout>
                                  <Text className={styles.metaValue}>{del.version}</Text>
                                </TableCellLayout>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Empty State */}
          {transactionDetails.writes.length === 0 && transactionDetails.deletes.length === 0 && (
            <div className={styles.emptyState}>
              <Text>
                No public key-value operations found in this transaction. This can happen for private-domain
                transactions, where state updates are encrypted and not available without the appropriate secrets.
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  }

  const getEntryTypeName = (entryType: number): string => {
    switch (entryType) {
      case EntryType.WriteSet:
        return 'Write Set';
      case EntryType.WriteSetWithClaims:
        return 'Write Set (with Claims)';
      case EntryType.WriteSetWithCommitEvidence:
        return 'Write Set (with Commit Evidence)';
      case EntryType.WriteSetWithCommitEvidenceAndClaims:
        return 'Write Set (with Claims & Evidence)';
      case EntryType.Snapshot:
        return 'Snapshot';
      default:
        return `Unknown (${entryType})`;
    }
  };

  const getEntryTypeColor = (entryType: number): 'success' | 'danger' | 'important' | 'subtle' => {
    switch (entryType) {
      case EntryType.WriteSet:
      case EntryType.WriteSetWithClaims:
      case EntryType.WriteSetWithCommitEvidence:
      case EntryType.WriteSetWithCommitEvidenceAndClaims:
        return 'success';
      case EntryType.Snapshot:
        return 'important';
      default:
        return 'subtle';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Spinner size="large" label="Loading transactions..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={500}>Error loading transactions: {error.message}</Text>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Database24Regular style={{ fontSize: '48px', marginBottom: '16px' }} />
          <Text size={500} weight="semibold">No transactions found</Text>
          <Caption1 style={{ marginTop: '8px' }}>
            This file doesn't contain any parseable transactions.
          </Caption1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <Text size={600} weight="semibold">
            Transactions {fileName ? `- ${fileName}` : ''}
          </Text>
          <Caption1>
            Showing {offset + 1}-{Math.min(offset + pageSize, offset + transactions.length)} transactions
          </Caption1>
        </div>
        
        <div className={styles.pagination}>
          <Button
            appearance="subtle"
            icon={<ChevronLeft24Regular />}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <Text>Page {currentPage + 1}</Text>
          <Button
            appearance="subtle"
            icon={<ChevronRight24Regular />}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={transactions.length < pageSize}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className={styles.kvTable}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Sequence</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Version</TableHeaderCell>
              <TableHeaderCell>Size</TableHeaderCell>
              <TableHeaderCell>TX Version</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <TableCellLayout>
                    <Text weight="semibold">{tx.id}</Text>
                  </TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>
                    <Badge 
                      appearance="outline" 
                      color={getEntryTypeColor(tx.entryType)}
                      className={styles.entryTypeBadge}
                    >
                      {getEntryTypeName(tx.entryType)}
                    </Badge>
                  </TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>
                    <Text className={styles.metaValue}>{tx.version}</Text>
                  </TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>
                    <Text className={styles.metaValue}>{tx.size} bytes</Text>
                  </TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>
                    <Text className={styles.metaValue}>{tx.txVersion}</Text>
                  </TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Eye24Regular />}
                      onClick={() => handleTransactionClick(tx.id)}
                    >
                      View Details
                    </Button>
                  </TableCellLayout>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={(_event, data) => setIsDetailsDialogOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <DialogBody>
              {selectedTransaction && transactionDetails ? (
                <div>
                  <TabList selectedValue={dialogSelectedTab} onTabSelect={(_, data) => setDialogSelectedTab(data.value)}>
                    {transactionDetails.writes.length > 0 && (
                      <Tab value="writes" icon={<Code24Regular />}>
                        {(() => {
                          const writesByTable = groupByTable(transactionDetails.writes);
                          const tableCount = Object.keys(writesByTable).length;
                          const keyCount = transactionDetails.writes.length;
                          return `Writes (${tableCount} table${tableCount !== 1 ? 's' : ''}, ${keyCount} key${keyCount !== 1 ? 's' : ''})`;
                        })()}
                      </Tab>
                    )}
                    {transactionDetails.deletes.length > 0 && (
                      <Tab value="deletes" icon={<Delete24Regular />}>
                        {(() => {
                          const deletesByTable = groupByTable(transactionDetails.deletes);
                          const tableCount = Object.keys(deletesByTable).length;
                          const keyCount = transactionDetails.deletes.length;
                          return `Deletes (${tableCount} table${tableCount !== 1 ? 's' : ''}, ${keyCount} key${keyCount !== 1 ? 's' : ''})`;
                        })()}
                      </Tab>
                    )}
                  </TabList>

                  {/* Writes Tab Content */}
                  {dialogSelectedTab === 'writes' && transactionDetails.writes.length > 0 && (
                    <div className={styles.accordionContent} style={{ marginTop: '16px' }}>
                      {(() => {
                        const writesByTable = groupByTable(transactionDetails.writes);
                        const tableNames = Object.keys(writesByTable).sort();
                        
                        return tableNames.map(tableName => (
                          <div key={tableName} style={{ marginBottom: '24px' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              marginBottom: '12px',
                              padding: '8px 12px',
                              backgroundColor: tokens.colorNeutralBackground2,
                              borderRadius: '4px',
                              border: `1px solid ${tokens.colorNeutralStroke2}`
                            }}>
                              <Database24Regular style={{ color: tokens.colorNeutralForeground2 }} />
                              <Text weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                                {tableName}
                              </Text>
                              <Badge size="small" color="brand">
                                {writesByTable[tableName].length} key{writesByTable[tableName].length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            
                            {writesByTable[tableName].map((write, index) => (
                              <div key={index} style={{ marginBottom: '16px', marginLeft: '16px' }}>
                                <ValueViewer
                                  keyName={write.key.includes('/') ? write.key.split('/').slice(1).join('/') : write.key}
                                  value={write.value}
                                  tableName={write.mapName || tableName}
                                />
                                <Text 
                                  style={{ 
                                    fontSize: '12px', 
                                    color: tokens.colorNeutralForeground3,
                                    marginTop: '8px',
                                    marginLeft: '8px',
                                    fontFamily: 'monospace'
                                  }}
                                >
                                  Version: {write.version}
                                </Text>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* Deletes Tab Content */}
                  {dialogSelectedTab === 'deletes' && transactionDetails.deletes.length > 0 && (
                    <div className={styles.accordionContent} style={{ marginTop: '16px' }}>
                      {(() => {
                        const deletesByTable = groupByTable(transactionDetails.deletes);
                        const tableNames = Object.keys(deletesByTable).sort();
                        
                        return tableNames.map(tableName => (
                          <div key={tableName} style={{ marginBottom: '24px' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              marginBottom: '12px',
                              padding: '8px 12px',
                              backgroundColor: tokens.colorNeutralBackground2,
                              borderRadius: '4px',
                              border: `1px solid ${tokens.colorNeutralStroke2}`
                            }}>
                              <Database24Regular style={{ color: tokens.colorNeutralForeground2 }} />
                              <Text weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                                {tableName}
                              </Text>
                              <Badge size="small" color="danger">
                                {deletesByTable[tableName].length} deletion{deletesByTable[tableName].length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            
                            <div style={{ marginLeft: '16px' }}>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHeaderCell>Key</TableHeaderCell>
                                    <TableHeaderCell>Version</TableHeaderCell>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {deletesByTable[tableName].map((del, index) => (
                                    <TableRow key={index}>
                                      <TableCell>
                                        <TableCellLayout>
                                          <Text className={styles.metaValue}>
                                            {del.key.includes('/') ? del.key.split('/').slice(1).join('/') : del.key}
                                          </Text>
                                        </TableCellLayout>
                                      </TableCell>
                                      <TableCell>
                                        <TableCellLayout>
                                          <Text className={styles.metaValue}>{del.version}</Text>
                                        </TableCellLayout>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* No Data Message */}
                  {transactionDetails.writes.length === 0 && transactionDetails.deletes.length === 0 && (
                    <div className={styles.emptyState}>
                      <Info24Regular style={{ fontSize: '24px', marginBottom: '8px' }} />
                      <Text>This transaction contains no key-value operations.</Text>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.loadingState}>
                  <Spinner size="medium" label="Loading transaction details..." />
                </div>
              )}
            </DialogBody>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setIsDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
