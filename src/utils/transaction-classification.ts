/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { TransactionRecord } from '@microsoft/ccf-database';

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

/**
 * Classify a single map name into a transaction type
 */
function classifyMapName(mapName: string): TransactionType {
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
    return 'governance';
  }
  
  // User public tables (anything else that's public but not internal/gov)
  if (mapName.startsWith('public:')) {
    return 'userPublic';
  }

  return 'unknown';
}

/**
 * Get all transaction types for a transaction based on all map names touched
 * (writes and deletes combined)
 */
export function getTransactionTypes(transaction: TransactionRecord): TransactionType[] {
  // Parse comma-separated map names
  const mapNamesStr = transaction.mapNames || transaction.mapName || '';
  const mapNames = mapNamesStr ? mapNamesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  
  // No public-domain writes/deletes recorded: likely private-domain only.
  if (mapNames.length === 0) {
    if ((transaction.writeCount ?? 0) === 0 && (transaction.deleteCount ?? 0) === 0) {
      return ['userPrivate'];
    }
    return ['unknown'];
  }
  
  // Get unique types from all map names
  const typesSet = new Set<TransactionType>();
  for (const mapName of mapNames) {
    typesSet.add(classifyMapName(mapName));
  }
  
  // Convert to array and sort for consistent ordering
  const types = Array.from(typesSet);
  // Sort by a priority order for display (most important first)
  const priorityOrder: TransactionType[] = [
    'signature', 'governance', 'newService', 'recoveringService', 
    'serviceOpen', 'internal', 'userPublic', 'userPrivate', 'unknown'
  ];
  types.sort((a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b));
  
  return types;
}

/**
 * Classify a transaction based on its properties and key-value data
 * Returns the primary (first) type when a single type is needed
 */
export function classifyTransaction(transaction: TransactionRecord): TransactionType {
  const types = getTransactionTypes(transaction);
  return types[0];
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
    const types = getTransactionTypes(tx);
    // Include transaction if ANY of its types match the selected types
    return types.some(type => selectedTypes.has(type));
  });
}
