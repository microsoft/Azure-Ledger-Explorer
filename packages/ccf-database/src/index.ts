/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

// Main database class
export { CCFDatabase } from './ccf-database';

// Constants
export { DATABASE_FILENAME, DATABASE_PATH } from './constants';

export type { DatabaseConfig, DatabaseTransaction } from './types/database-types';

export type {
  ExecFn, ExecBatchFn,
  LedgerFile,
  TransactionRecord,
  SearchResult,
  TableKeyValue,
  KeyTransaction,
  DatabaseStats,
  EnhancedStats,
  DatabaseSettings
} from './types/repository-types';

export type {
  TableLatestStateSortColumn,
  TableLatestStateSortDirection,
  SchemaColumn,
  TableSchema,
  DatabaseSchema,
} from './types/query-types';

export type {
  Migration
} from './types/migration-types';

export type {
  InsertLedgerFileResult,
  InsertLedgerFileOptions,
} from './worker/database-worker-client';

// Schema query utilities (functions only - types come from ./types)
export {
  getDatabaseSchema,
  GET_ALL_TABLES_SQL,
  getTableInfoSQL,
  getTableIndexesSQL,
} from './queries/schema-queries';
