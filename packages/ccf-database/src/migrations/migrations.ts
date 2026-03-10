/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { Database as SQLiteDB } from '@sqlite.org/sqlite-wasm';
import { migration as migration001 } from './001_initial';
import type { Migration } from '../types/migration-types';

/**
 * All migrations in order. Add new migrations to this array.
 */
const migrations: Migration[] = [
  { ...migration001, version: 1 },
  // Add future migrations here:
  // { ...migration002, version: 2 },
];

/**
 * Performance optimization PRAGMAs for OPFS database.
 * Applied before running migrations.
 */
export const PERFORMANCE_PRAGMAS = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA synchronous = NORMAL',
  'PRAGMA cache_size = -10000',
  'PRAGMA temp_store = MEMORY',
  'PRAGMA mmap_size = 67108864',
  'PRAGMA page_size = 8192',
  'PRAGMA locking_mode = EXCLUSIVE',
  'PRAGMA auto_vacuum = INCREMENTAL',
];

/**
 * Tables to drop in correct order (child tables first to avoid FK violations)
 */
export const DROP_TABLES_ORDER = [
  'kv_deletes',
  'kv_writes',
  'transactions',
  'ledger_files',
  'schema_meta',
];

/**
 * Get the current schema version from the database.
 * Returns 0 if schema_meta table doesn't exist.
 */
function getSchemaVersion(db: SQLiteDB): number {
  try {
    const stmt = db.prepare(`SELECT version FROM schema_meta ORDER BY version DESC LIMIT 1`);
    if (stmt.step()) {
      const row = stmt.get({}) as { version: number };
      stmt.finalize();
      return row.version;
    }
    stmt.finalize();
    return 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Run all pending migrations on the database.
 * This is idempotent - safe to call multiple times.
 */
export function runMigrations(db: SQLiteDB, logger?: { log: (msg: string) => void }): void {
  logger?.log('Starting migration check...');

  // Apply performance PRAGMAs first
  logger?.log('Applying performance optimizations...');
  for (const pragma of PERFORMANCE_PRAGMAS) {
    try {
      db.exec(pragma);
    } catch (err) {
      logger?.log(`Warning: Could not apply ${pragma}: ${err}`);
    }
  }

  // Ensure schema_meta table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const currentVersion = getSchemaVersion(db);
  logger?.log(`Current schema version: ${currentVersion}`);

  // Find and run pending migrations
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    logger?.log('No pending migrations');
    return;
  }

  logger?.log(`Running ${pendingMigrations.length} pending migration(s)...`);

  for (const migration of pendingMigrations) {
    logger?.log(`Applying migration ${migration.version}: ${migration.name}`);

    // Run all statements for this migration
    for (const sql of migration.statements) {
      try {
        db.exec(sql);
      } catch (err) {
        logger?.log(`Error in migration ${migration.version}: ${err}`);
        throw err;
      }
    }

    // Record the migration
    db.exec({
      sql: `INSERT INTO schema_meta (version, name) VALUES (?, ?)`,
      bind: [migration.version, migration.name],
    });

    logger?.log(`Migration ${migration.version} applied successfully`);
  }

  logger?.log('All migrations completed');
}

/**
 * Drop all database tables in correct order.
 * Used for complete database reset.
 */
export function dropAllTables(db: SQLiteDB, logger?: { log: (msg: string) => void }): void {
  logger?.log('Dropping all tables...');

  for (const tableName of DROP_TABLES_ORDER) {
    try {
      db.exec(`DROP TABLE IF EXISTS ${tableName}`);
    } catch (err) {
      logger?.log(`Warning: Could not drop ${tableName}: ${err}`);
    }
  }

  logger?.log('All tables dropped');
}

/**
 * Clear all data from tables (preserves schema).
 * Dynamically discovers all user tables, so no updates needed when migrations add new tables.
 */
export function clearAllTables(db: SQLiteDB, logger?: { log: (msg: string) => void }): void {
  logger?.log('Clearing all table data...');

  // Get all user-created tables (excluding sqlite internals and schema_meta)
  const stmt = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      AND name != 'schema_meta'
    ORDER BY name
  `);

  const tables: string[] = [];
  while (stmt.step()) {
    const row = stmt.get({}) as { name: string };
    tables.push(row.name);
  }
  stmt.finalize();

  if (tables.length === 0) {
    logger?.log('No tables to clear');
    return;
  }

  // Disable foreign keys temporarily to allow deletion in any order
  db.exec('PRAGMA foreign_keys = OFF');

  try {
    for (const table of tables) {
      db.exec(`DELETE FROM "${table}"`);
      logger?.log(`Cleared table: ${table}`);
    }

    // Reset autoincrement counters
    db.exec('DELETE FROM sqlite_sequence');
  } finally {
    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');
  }

  logger?.log('All table data cleared');
}

/**
 * Verify that all required tables exist.
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
    return requiredTables.every(table => tables.includes(table));
  } catch {
    return false;
  }
}
