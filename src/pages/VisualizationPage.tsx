import React from 'react';
import { LedgerVisualization } from '../components/LedgerVisualization';
import { useAllTransactions } from '../hooks/use-ccf-data';

export const VisualizationPage: React.FC = () => {
  const { data: transactions = [], isLoading, refetch } = useAllTransactions(2000); // Get more transactions for better visualization

  return (
    <LedgerVisualization
      transactions={transactions}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      maxTransactions={1000}
    />
  );
};
