/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import type { Database as SQLiteDB } from '@sqlite.org/sqlite-wasm';

// Schema version for future migrations
export const SCHEMA_VERSION = 1;

// Performance optimization PRAGMAs for OPFS database
export const PERFORMANCE_PRAGMAS = [
  // Use WAL mode for better concurrent access and performance
  'PRAGMA journal_mode = WAL',
  
  // Normal synchronous mode is safe with WAL and much faster
  'PRAGMA synchronous = NORMAL',
  
  // Increase cache size to 10MB (negative value = KB)
  'PRAGMA cache_size = -10000',
  
  // Use memory for temp tables
  'PRAGMA temp_store = MEMORY',
  
  // Enable memory-mapped I/O (64MB)
  'PRAGMA mmap_size = 67108864',
  
  // Larger page size for better performance with larger databases
  'PRAGMA page_size = 8192',
  
  // Optimize locking mode for single connection
  'PRAGMA locking_mode = EXCLUSIVE',
  
  // Auto-vacuum to prevent fragmentation
  'PRAGMA auto_vacuum = INCREMENTAL',
];

// Table creation SQL statements
export const SCHEMA_STATEMENTS = [
  // Ledger files table
  `CREATE TABLE IF NOT EXISTS ledger_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // Transactions table - using sequence_no as PRIMARY KEY (unique from ledger)
  `CREATE TABLE IF NOT EXISTS transactions (
    sequence_no INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    flags INTEGER NOT NULL,
    size INTEGER NOT NULL,
    entry_type INTEGER NOT NULL,
    tx_view INTEGER NOT NULL,
    tx_version INTEGER NOT NULL,
    max_conflict_version INTEGER,
    tx_digest BLOB,
    transaction_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES ledger_files(id) ON DELETE CASCADE
  )`,

  // Key-value pairs table for writes
  `CREATE TABLE IF NOT EXISTS kv_writes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_no INTEGER NOT NULL,
    map_name TEXT NOT NULL,
    key_name TEXT NOT NULL,
    value_text TEXT,
    value_bytes BLOB,
    version INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sequence_no) REFERENCES transactions(sequence_no) ON DELETE CASCADE
  )`,

  // Key-value pairs table for deletes
  `CREATE TABLE IF NOT EXISTS kv_deletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_no INTEGER NOT NULL,
    map_name TEXT NOT NULL,
    key_name TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sequence_no) REFERENCES transactions(sequence_no) ON DELETE CASCADE
  )`,

  // Indexes for better query performance
  `CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON transactions(file_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_tx_id ON transactions(transaction_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_entry_type ON transactions(entry_type)`,
  `CREATE INDEX IF NOT EXISTS idx_kv_writes_sequence_no ON kv_writes(sequence_no)`,
  `CREATE INDEX IF NOT EXISTS idx_kv_writes_map_key ON kv_writes(map_name, key_name)`,
  `CREATE INDEX IF NOT EXISTS idx_kv_writes_map_name ON kv_writes(map_name)`,
  `CREATE INDEX IF NOT EXISTS idx_kv_deletes_sequence_no ON kv_deletes(sequence_no)`,
  `CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_key ON kv_deletes(map_name, key_name)`,
  `CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_name ON kv_deletes(map_name)`
];

// Tables to drop in correct order (child tables first to avoid FK violations)
export const DROP_TABLES_ORDER = [
  'kv_deletes',
  'kv_writes',
  'transactions',
  'ledger_files'
];

/**
 * Create all database tables and indexes
 */
export function createTables(db: SQLiteDB, logger?: { log: (msg: string) => void }): void {
  logger?.log('Creating database tables...');
  
  try {
    // Apply performance PRAGMAs first (before creating tables)
    logger?.log('Applying performance optimizations...');
    for (const pragma of PERFORMANCE_PRAGMAS) {
      try {
        db.exec(pragma);
        logger?.log(`Applied: ${pragma}`);
      } catch (err) {
        // Some PRAGMAs might not be available or fail, log but continue
        logger?.log(`Warning: Could not apply ${pragma}: ${err}`);
      }
    }
    
    // Create tables
    for (const stmt of SCHEMA_STATEMENTS) {
      db.exec(stmt);
    }

    // Lightweight migrations for existing OPFS DBs created with older schema.
    // CREATE TABLE IF NOT EXISTS will not add new columns.
    try {
      const infoStmt = db.prepare(`PRAGMA table_info(kv_writes)`);
      let hasValueBytes = false;
      while (infoStmt.step()) {
        const row = infoStmt.get({}) as { name?: string };
        if (row.name === 'value_bytes') {
          hasValueBytes = true;
          break;
        }
      }
      infoStmt.finalize();

      if (!hasValueBytes) {
        logger?.log('Migrating schema: adding kv_writes.value_bytes BLOB');
        db.exec('ALTER TABLE kv_writes ADD COLUMN value_bytes BLOB');
      }
    } catch (err) {
      // If migration fails, keep going – reads will fall back to value_text.
      logger?.log(`Warning: schema migration check failed: ${err}`);
    }

    logger?.log('Database tables created successfully');
  } catch (err) {
    console.error('Failed to create tables:', err);
    throw err;
  }
}

/**
 * Drop all database tables in correct order
 */
export function dropAllTables(db: SQLiteDB, logger?: { log: (msg: string) => void }): void {
  logger?.log('Dropping all tables...');
  
  try {
    for (const tableName of DROP_TABLES_ORDER) {
      db.exec(`DROP TABLE IF EXISTS ${tableName}`);
    }
    logger?.log('All tables dropped successfully');
  } catch (err) {
    console.error('Failed to drop tables:', err);
    throw err;
  }
}

/**
 * Verify that all required tables exist
 */
export function verifyTables(db: SQLiteDB): boolean {
  try {
    const stmt = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name IN ('ledger_files', 'transactions', 'kv_writes', 'kv_deletes')
    `);
    
    const tables: string[] = [];
    while (stmt.step()) {
      const row = stmt.get({}) as { name: string };
      tables.push(row.name);
    }
    stmt.finalize();

    const requiredTables = ['ledger_files', 'transactions', 'kv_writes', 'kv_deletes'];
    const allTablesExist = requiredTables.every(table => tables.includes(table));
    
    return allTablesExist;
  } catch (err) {
    console.error('Failed to verify tables:', err);
    return false;
  }
}
