/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Schema introspection queries for the SQLite database.
 * These queries use sqlite_master for broad compatibility across SQLite versions.
 */

// ============================================================================
// SQL QUERY STRINGS
// ============================================================================

/**
 * Query to get all user-defined tables (excluding SQLite internal tables)
 */
export const GET_ALL_TABLES_SQL = `
  SELECT name 
  FROM sqlite_master 
  WHERE type='table' AND name NOT LIKE 'sqlite_%' 
  ORDER BY name
`;

/**
 * Query to get column information for a specific table.
 * Returns: cid, name, type, notnull, dflt_value, pk
 */
export const getTableInfoSQL = (tableName: string): string => 
  `PRAGMA table_info("${tableName}")`;

/**
 * Query to get all indexes for a specific table (excluding SQLite auto-indexes)
 */
export const getTableIndexesSQL = (tableName: string): string => `
  SELECT name 
  FROM sqlite_master 
  WHERE type='index' AND tbl_name='${tableName}' AND name NOT LIKE 'sqlite_%'
`;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

type ExecuteQueryFn = (sql: string) => Promise<unknown[]>;

/**
 * Get the complete database schema including all tables, columns, and indexes
 */
export async function getDatabaseSchema(
  executeQuery: ExecuteQueryFn
): Promise<DatabaseSchema> {
  // Get list of tables
  const tablesResult = await executeQuery(GET_ALL_TABLES_SQL) as Array<{ name: string }>;
  
  if (!tablesResult || tablesResult.length === 0) {
    return { tables: [] };
  }
  
  // Get details for each table in parallel
  const tableDetails = await Promise.all(
    tablesResult.map(async (t) => {
      // Get column info
      const columnsResult = await executeQuery(
        getTableInfoSQL(t.name)
      ) as Array<{ name: string; type: string; notnull: number; pk: number; dflt_value: string | null }>;
      
      // Get indexes
      const indexesResult = await executeQuery(
        getTableIndexesSQL(t.name)
      ) as Array<{ name: string }>;
      
      return {
        name: t.name,
        columns: (columnsResult || []).map(col => ({
          name: col.name,
          type: col.type,
          notnull: col.notnull === 1,
          pk: col.pk === 1,
          dflt_value: col.dflt_value,
        })),
        indexes: (indexesResult || []).map(idx => idx.name),
      };
    })
  );
  
  return { tables: tableDetails };
}
