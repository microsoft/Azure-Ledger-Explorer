/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Type for the exec function used by repositories
 */
export type ExecFn = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Type for batch execution
 */
export type ExecBatchFn = (statements: Array<{ sql: string; bind?: unknown[] }>) => Promise<void>;

/**
 * Ledger file record returned from the database
 */
export interface LedgerFile {
  id: number;
  filename: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  /** null = not verified, true = verified successfully, false = verification failed */
  verified: boolean | null;
  /** Timestamp when verification was performed */
  verifiedAt: string | null;
  /** Error message if verification failed */
  verificationError: string | null;
}

/**
 * Transaction record from the database
 */
export interface TransactionRecord {
  id: number;
  fileId: number;
  fileName: string;
  version: number;
  flags: number;
  size: number;
  entryType: number;
  txVersion: number;
  maxConflictVersion: number;
  txId?: string;
  txView?: number;
  writeCount?: number;
  deleteCount?: number;
  mapName?: string;
  /** Comma-separated list of all map names touched by writes and deletes */
  mapNames?: string;
  fileSize?: number;
}

/**
 * Search result for key/value searches
 */
export interface SearchResult {
  transactionId: number;
  mapName: string;
  keyName: string;
  hasValue: boolean;
  version: number;
  matchType?: 'key' | 'value';
  matchedText?: string;
}

/**
 * Key-value entry in a CCF table
 */
export interface TableKeyValue {
  keyName: string;
  value: Uint8Array | null;
  version: number;
  transactionId: number;
  transactionIdentifier?: string | null;
  isDeleted: boolean;
}

/**
 * Key transaction history entry
 */
export interface KeyTransaction {
  transactionId: number;
  version: number;
  operationType: 'write' | 'delete';
  value: Uint8Array | null;
  fileName: string;
}

/**
 * Basic database statistics
 */
export interface DatabaseStats {
  fileCount: number;
  transactionCount: number;
  writeCount: number;
  deleteCount: number;
}

/**
 * Enhanced database statistics with additional metrics
 */
export interface EnhancedStats extends DatabaseStats {
  userWriteCount: number;
  tableCount: number;
  uniqueKeyCount: number;
  averageTransactionSize: number;
  largestTransactionSize: number;
  smallestTransactionSize: number;
  totalDataSize: number;
  oldestTransaction: Date | null;
  newestTransaction: Date | null;
}

/**
 * Database settings information
 */
export interface DatabaseSettings {
  journalMode: string;
  cacheSize: number;
  tempStore: string;
  mmapSize: number;
  pageSize: number;
}
