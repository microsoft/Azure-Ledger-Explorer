/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useMemo } from 'react';
import { makeStyles, tokens, Text, Button, Checkbox, Tooltip, Spinner } from '@fluentui/react-components';
import { ChartMultipleRegular, ArrowClockwiseRegular } from '@fluentui/react-icons';
import { LedgerVisualization } from '../components/LedgerVisualization';
import { useAllTransactions } from '../hooks/use-ccf-data';
import { Sidebar } from '../components/Sidebar';
import type { TransactionType } from '../utils/transaction-classification';
import { classifyTransaction } from '../utils/transaction-classification';

const TRANSACTION_TYPES: Record<TransactionType, { name: string; color: string; description: string }> = {
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

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '16px 24px',
  },
  filterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  filterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  colorSwatch: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  filterLabel: {
    flex: 1,
    fontSize: tokens.fontSizeBase200,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    marginBottom: '8px',
    marginTop: '12px',
  },
  clearButton: {
    marginTop: '12px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '8px',
    color: tokens.colorNeutralForeground2,
  },
});

export const VisualizationPage: React.FC = () => {
  const styles = useStyles();
  const { data: transactions = [], isLoading, refetch } = useAllTransactions(2000);
  const [selectedTypes, setSelectedTypes] = useState<Set<TransactionType>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleTypeFilter = (type: TransactionType) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedTypes(newSet);
  };

  const clearFilters = () => {
    setSelectedTypes(new Set());
  };

  // Calculate stats from full transaction list (not filtered) - stays stable during filtering
  const stats = useMemo(() => {
    const typeCounts = new Map<TransactionType, number>();
    for (const tx of transactions) {
      const type = classifyTransaction(tx);
      const current = typeCounts.get(type) || 0;
      typeCounts.set(type, current + 1);
    }
    return typeCounts;
  }, [transactions]);

  const renderSidebarContent = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingContainer}>
          <Spinner size="small" />
          <Text size={200}>Loading...</Text>
        </div>
      );
    }

    return (
      <>
        <Text className={styles.sectionTitle}>Filter by Type</Text>
        <div className={styles.filterList}>
          {(Object.entries(TRANSACTION_TYPES) as [TransactionType, typeof TRANSACTION_TYPES[TransactionType]][]).map(([type, info]) => (
            <Tooltip key={type} content={info.description} relationship="description" positioning="after">
              <div 
                className={styles.filterItem}
                onClick={() => toggleTypeFilter(type)}
              >
                <Checkbox
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleTypeFilter(type)}
                />
                <div 
                  className={styles.colorSwatch}
                  style={{ backgroundColor: info.color }}
                />
                <Text className={styles.filterLabel}>{info.name}</Text>
              </div>
            </Tooltip>
          ))}
        </div>
        {selectedTypes.size > 0 && (
          <Button
            appearance="subtle"
            size="small"
            className={styles.clearButton}
            onClick={clearFilters}
          >
            Clear Filters ({selectedTypes.size})
          </Button>
        )}
      </>
    );
  };

  return (
    <div className={styles.container}>
      <Sidebar
        title="Visualization"
        icon={<ChartMultipleRegular />}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        collapsible
        headerActions={
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowClockwiseRegular />}
            onClick={() => refetch()}
            title="Refresh"
          />
        }
      >
        {renderSidebarContent()}
      </Sidebar>
      <div className={styles.mainContent}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Spinner size="large" />
            <Text>Loading visualization data...</Text>
          </div>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <ChartMultipleRegular style={{ fontSize: '48px' }} />
            <Text size={500} weight="semibold">No transactions available</Text>
            <Text>Upload a ledger file to visualize transactions.</Text>
          </div>
        ) : (
          <LedgerVisualization
            transactions={transactions}
            isLoading={false}
            maxTransactions={1000}
            selectedTypeFilters={selectedTypes}
            onFilterChange={setSelectedTypes}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
};
