/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from "react-router-dom";
import {
  makeStyles,
  Body1,
  Caption1,
  Tooltip,
  Button,
  MessageBar,
  Spinner,
  InteractionTag,
  InteractionTagPrimary,
  tokens,
} from '@fluentui/react-components';
import { ChevronRight24Regular } from '@fluentui/react-icons';
import type { 
  TransactionType, 
} from '../utils/transaction-classification';
import type { TransactionRecord } from '@microsoft/ccf-database';
import { getTransactionTypes } from '../utils/transaction-classification';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  visualization: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    maxHeight: '300px',
    overflowY: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
  },
  viewLine: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minHeight: '24px',
  },
  viewLabel: {
    minWidth: '80px',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  transactionStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
    flexWrap: 'wrap',
  },
  transactionTile: {
    width: '10px',
    height: '16px',
    borderRadius: '1px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'scale(1.2)',
      zIndex: 1,
    },
  },
  stats: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
  },
});

interface TransactionTypeInfo {
  name: string;
  color: string;
  description: string;
}

const TRANSACTION_TYPES: Record<TransactionType, TransactionTypeInfo> = {
  signature: {
    name: 'Signature',
    color: tokens.colorPaletteGreenBackground2,
    description: 'Cryptographic signature transactions',
  },
  governance: {
    name: 'Governance',
    color: tokens.colorPaletteRedBackground2,
    description: 'Network governance transactions',
  },
  newService: {
    name: 'New Service',
    color: tokens.colorNeutralBackground1,
    description: 'Service initialization transactions',
  },
  recoveringService: {
    name: 'Recovering Service',
    color: tokens.colorNeutralBackground4,
    description: 'Service recovery transactions',
  },
  serviceOpen: {
    name: 'Service Open',
    color: tokens.colorPalettePurpleBackground2,
    description: 'Service operational transactions',
  },
  internal: {
    name: 'Internal',
    color: tokens.colorPaletteDarkOrangeBackground2,
    description: 'Internal system transactions',
  },
  userPublic: {
    name: 'User Public',
    color: tokens.colorPaletteBlueBackground2,
    description: 'Public user transactions',
  },
  userPrivate: {
    name: 'User Private',
    color: tokens.colorPaletteNavyBackground2,
    description: 'Private user transactions',
  },
  unknown: {
    name: 'Unknown',
    color: tokens.colorNeutralBackground3,
    description: 'Unclassified transactions',
  },
};

interface ClassifiedTransaction {
  transaction: TransactionRecord;
  type: TransactionType;
  types: TransactionType[];
  view: number;
  seqno: number;
}

interface LedgerVisualizationProps {
  transactions: TransactionRecord[];
  isLoading?: boolean;
  onRefresh?: () => void;
  maxTransactions?: number;
  selectedTypeFilters?: Set<TransactionType>;
  onFilterChange?: (selectedTypes: Set<TransactionType>) => void;
  /** Pre-calculated stats from parent - stable counts that don't change with filtering */
  stats?: Map<TransactionType, number>;
}

/**
 * Group transactions by view for visualization
 */
function groupTransactionsByView(transactions: ClassifiedTransaction[]): Map<number, ClassifiedTransaction[]> {
  const viewMap = new Map<number, ClassifiedTransaction[]>();
  
  for (const tx of transactions) {
    const view = tx.view;
    if (!viewMap.has(view)) {
      viewMap.set(view, []);
    }
    viewMap.get(view)!.push(tx);
  }
  
  return viewMap;
}

export const LedgerVisualization: React.FC<LedgerVisualizationProps> = ({
  transactions,
  isLoading = false,
  onRefresh,
  maxTransactions = 1000,
  selectedTypeFilters,
  onFilterChange,
  stats: externalStats,
}) => {
  const styles = useStyles();
  
  // Use external filter state if provided, otherwise use internal state
  const [internalSelectedTypes, setInternalSelectedTypes] = useState<Set<TransactionType>>(new Set());
  const selectedTypes = selectedTypeFilters || internalSelectedTypes;

  const navigate = useNavigate();

  // Toggle filter for a transaction type
  const toggleTypeFilter = (type: TransactionType) => {
    const newSelectedTypes = new Set(selectedTypes);
    if (newSelectedTypes.has(type)) {
      newSelectedTypes.delete(type);
    } else {
      newSelectedTypes.add(type);
    }
    
    // Use external handler if provided, otherwise update internal state
    if (onFilterChange) {
      onFilterChange(newSelectedTypes);
    } else {
      setInternalSelectedTypes(newSelectedTypes);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    const emptySet = new Set<TransactionType>();
    if (onFilterChange) {
      onFilterChange(emptySet);
    } else {
      setInternalSelectedTypes(emptySet);
    }
  };

  // Classify and process transactions
  const classifiedTransactions = useMemo(() => {
    const classified: ClassifiedTransaction[] = transactions
      .slice(0, maxTransactions)
      .map(tx => {
        const types = getTransactionTypes(tx);
        return {
          transaction: tx,
          type: types[0], // Primary type for backward compatibility
          types, // All types for display
          view: tx.txView ?? 1,
          seqno: tx.id, // Using transaction ID as sequence number
        };
      });
    
    return classified;
  }, [transactions, maxTransactions]);

  // Filter transactions based on selected types
  const filteredTransactions = useMemo(() => {
    if (selectedTypes.size === 0) {
      return classifiedTransactions; // Show all if no filters selected
    }
    // Include transaction if ANY of its types match the selected types
    return classifiedTransactions.filter(tx => tx.types.some(t => selectedTypes.has(t)));
  }, [classifiedTransactions, selectedTypes]);

  // Group by view
  const transactionsByView = useMemo(() => {
    return groupTransactionsByView(filteredTransactions);
  }, [filteredTransactions]);

  // Use external stats if provided, otherwise calculate from current transactions (fallback)
  const stats = useMemo(() => {
    if (externalStats) return externalStats;
    
    // Fallback: calculate from classified transactions
    const typeCounts = new Map<TransactionType, number>();
    for (const tx of classifiedTransactions) {
      const current = typeCounts.get(tx.type) || 0;
      typeCounts.set(tx.type, current + 1);
    }
    return typeCounts;
  }, [externalStats, classifiedTransactions]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <MessageBar intent="info">
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
            <Spinner size="tiny" />
            <span>Loading ledger visualization...</span>
          </div>
        </MessageBar>
      </div>
    );
  }

  const sortedViews = Array.from(transactionsByView.keys()).sort((a, b) => a - b);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Body1>Ledger Transaction Visualization</Body1>
        <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' }}>
          {selectedTypes.size > 0 && (
            <Button
              appearance="subtle"
              size="small"
              onClick={clearFilters}
            >
              Clear Filters ({selectedTypes.size})
            </Button>
          )}
          {onRefresh && (
            <Button
              appearance="subtle"
              icon={<ChevronRight24Regular />}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Legend with Filtering */}
      <div className={styles.legend}>
        {Object.entries(TRANSACTION_TYPES).map(([type, info]) => {
          const isSelected = selectedTypes.has(type as TransactionType);
          const typeKey = type as TransactionType;
          const count = stats.get(typeKey) || 0;
          
          return (
            <Tooltip
              key={type}
              content={`${info.description} (Click to ${isSelected ? 'remove filter' : 'filter'})`}
              relationship="description"
            >
              <InteractionTag
                appearance={isSelected ? 'filled' : 'outline'}
                style={{ 
                  backgroundColor: isSelected ? info.color : 'transparent',
                  borderColor: info.color,
                  color: isSelected ? '#ffffff' : 'inherit'
                }}
                onClick={() => toggleTypeFilter(typeKey)}
              >
                <InteractionTagPrimary>
                  {info.name} ({count})
                </InteractionTagPrimary>
              </InteractionTag>
            </Tooltip>
          );
        })}
      </div>

      {/* Visualization */}
      <div className={styles.visualization}>
        {sortedViews.map(view => {
          const viewTransactions = transactionsByView.get(view) || [];
          const sortedTransactions = viewTransactions.sort((a, b) => a.seqno - b.seqno);
          
          return (
            <div key={view} className={styles.viewLine}>
              <Caption1 className={styles.viewLabel}>
                View {view}:
              </Caption1>
              <div className={styles.transactionStrip}>
                {sortedTransactions.map((tx, index) => {
                  // Generate background: single color for one type, gradient for multiple
                  const bgStyle = tx.types.length === 1
                    ? { backgroundColor: TRANSACTION_TYPES[tx.types[0]].color }
                    : {
                        background: `linear-gradient(to right, ${tx.types.map((t, i) => 
                          `${TRANSACTION_TYPES[t].color} ${(i / tx.types.length) * 100}%, ${TRANSACTION_TYPES[t].color} ${((i + 1) / tx.types.length) * 100}%`
                        ).join(', ')})`
                      };
                  
                  return (
                  <Tooltip
                    key={`${view}-${tx.seqno}-${index}`}
                    content={
                      <div>
                        <div><strong>Type{tx.types.length > 1 ? 's' : ''}:</strong> {tx.types.map(t => TRANSACTION_TYPES[t].name).join(', ')}</div>
                        <div><strong>Sequence:</strong> {tx.seqno}</div>
                        <div><strong>View:</strong> {tx.view}</div>
                        <div><strong>Size:</strong> {tx.transaction.size} bytes</div>
                        <div><strong>Entry Type:</strong> {tx.transaction.entryType}</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>Click to view details</div>
                      </div>
                    }
                    relationship="description"
                  >
                    <div
                      className={styles.transactionTile}
                      style={bgStyle}
                      onClick={() => navigate(`/transaction/${tx.seqno}`)}
                    />
                  </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistics */}
      <div className={styles.stats}>
        <Caption1><strong>Statistics:</strong></Caption1>
        {selectedTypes.size > 0 ? (
          <>
            <Caption1>Showing: {filteredTransactions.length} of {classifiedTransactions.length} transactions</Caption1>
            <Caption1>Filtered by: {Array.from(selectedTypes).map(type => TRANSACTION_TYPES[type].name).join(', ')}</Caption1>
          </>
        ) : (
          <Caption1>Total: {classifiedTransactions.length} transactions</Caption1>
        )}
      </div>
    </div>
  );
};
