/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



// Transaction type classification based on the Python script logic
export type TransactionType = 
  | 'signature' 
  | 'governance' 
  | 'newService' 
  | 'recoveringService' 
  | 'serviceOpen' 
  | 'internal' 
  | 'userPublic' 
  | 'userPrivate'
  | 'unknown';

import type { TransactionRecord } from '@ccf/database';

/**
 * Classify a transaction based on its properties and key-value data
 * This is a simplified version of the Python script logic
 */
export function classifyTransaction(transaction: TransactionRecord): TransactionType {
  // Check if we have map_name data to help classify
  const mapName = transaction.mapName || '';
  
  // Signature table detection
  if (mapName.includes('signatures')) {
    return 'signature';
  }
  
  // Internal CCF tables
  if (mapName.startsWith('public:ccf.internal.')) {
    return 'internal';
  }
  
  // Governance tables
  if (mapName.startsWith('public:ccf.gov.')) {
    // Could be governance, new service, recovering service, or service open
    // Without the full service info, we'll classify as governance
    return 'governance';
  }
  
  // User public tables (anything else that's public but not internal/gov)
  if (mapName.startsWith('public:')) {
    return 'userPublic';
  }

  // No public-domain writes/deletes recorded: likely private-domain only.
  // Private-domain contents are encrypted, so we can't decode KV operations here.
  if ((transaction.writeCount ?? 0) === 0 && (transaction.deleteCount ?? 0) === 0) {
    return 'userPrivate';
  }

  // If we can't classify, mark as unknown
  return 'unknown';
}

/**
 * Filter transactions by selected types
 */
export function filterTransactionsByTypes(
  transactions: TransactionRecord[], 
  selectedTypes: Set<TransactionType>
): TransactionRecord[] {
  if (selectedTypes.size === 0) {
    return transactions; // Show all if no filters selected
  }
  
  return transactions.filter(tx => {
    const type = classifyTransaction(tx);
    return selectedTypes.has(type);
  });
}
