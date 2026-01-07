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

// Re-export types that consumers might need from ledger-parser
export type { Transaction, LedgerKeyValue } from '@ccf/ledger-parser';
