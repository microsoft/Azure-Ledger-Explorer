/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Main database class
export { CCFDatabase } from './ccf-database';
export type { DatabaseConfig } from './ccf-database';

// Re-export repository types for consumer use
export type {
  LedgerFile,
  TransactionRecord,
  SearchResult,
  TableKeyValue,
  KeyTransaction,
  DatabaseStats,
  EnhancedStats,
  DatabaseSettings,
} from './ccf-database';

export type {
  TableLatestStateSortColumn,
  TableLatestStateSortDirection,
} from './queries/table-latest-state-queries';

// Schema query utilities
export {
  getDatabaseSchema,
  GET_ALL_TABLES_SQL,
  getTableInfoSQL,
  getTableIndexesSQL,
  type SchemaColumn,
  type TableSchema,
  type DatabaseSchema,
} from './queries/schema-queries';

/**
 * Database Transaction type (app-specific, different from the parsed Transaction type)
 */
export interface DatabaseTransaction {
  id: number;
  fileId: number;
  fileName: string;
  sequenceNumber: number;
  version: number;
  flags: number;
  size: number;
  entryType: number;
  txVersion: number;
  txView: number;
  maxConflictVersion: number;
  txId: string;
  writeCount: number;
  deleteCount: number;
  fileSize: number;
}
