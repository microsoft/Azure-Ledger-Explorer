/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { Migration } from '../types/migration-types';

/**
 * Initial schema migration - creates all core tables and indexes.
 * This represents the schema as of the first stable release.
 */
export const migration: Migration = {
  version: 1,
  name: 'initial_schema',
  statements: [
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
    // Note: Composite indexes on (map_name, key_name) also serve single-column map_name queries
    `CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON transactions(file_id)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_sequence_no ON kv_writes(sequence_no)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_writes_map_key ON kv_writes(map_name, key_name)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_deletes_sequence_no ON kv_deletes(sequence_no)`,
    `CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_key ON kv_deletes(map_name, key_name)`,
  ],
};
