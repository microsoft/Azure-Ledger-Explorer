/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Sort column options for table latest state queries
 */
export type TableLatestStateSortColumn = 'sequence' | 'transactionId' | 'keyName' | 'value';

/**
 * Sort direction options
 */
export type TableLatestStateSortDirection = 'asc' | 'desc';

/**
 * Column information from PRAGMA table_info
 */
export interface SchemaColumn {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
  dflt_value: string | null;
}

/**
 * Table schema information
 */
export interface TableSchema {
  name: string;
  columns: SchemaColumn[];
  indexes: string[];
}

/**
 * Complete database schema
 */
export interface DatabaseSchema {
  tables: TableSchema[];
}
