/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { BaseRepository } from './base-repository';
import type { DatabaseStats, EnhancedStats, DatabaseSettings } from '../types/repository-types';

/**
 * Repository for database statistics and management operations
 */
export class StatsRepository extends BaseRepository {
  /**
   * Get basic database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const result = await this.exec(`
      SELECT 
        (SELECT COUNT(*) FROM ledger_files) as file_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COUNT(*) FROM kv_writes) as write_count,
        (SELECT COUNT(*) FROM kv_deletes) as delete_count
    `);

    if (result.length === 0) {
      return { fileCount: 0, transactionCount: 0, writeCount: 0, deleteCount: 0 };
    }

    const row = result[0];
    return {
      fileCount: row.file_count as number,
      transactionCount: row.transaction_count as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
    };
  }

  /**
   * Get enhanced database statistics with additional metrics.
   *
   * Performance notes — the `table_count` and `unique_key_count` subqueries
   * historically dominated this query on large databases. Two changes were
   * made to make them index-friendly:
   *
   * 1. Push `DISTINCT` down to each side of the `UNION` so SQLite can
   *    satisfy each branch with an index-only scan against
   *    `idx_kv_writes_map_key` / `idx_kv_deletes_map_key` (returning O(distinct
   *    maps) rows instead of O(total rows)). The outer `UNION` then merges
   *    two already-small sets.
   * 2. Replace `COUNT(DISTINCT key_name || map_name)` with a `DISTINCT
   *    map_name, key_name` projection. The string concat blocked the planner
   *    from using the `(map_name, key_name)` covering index; the tuple form
   *    matches the index order directly.
   */
  async getEnhancedStats(): Promise<EnhancedStats> {
    const result = await this.exec(`
      SELECT 
        (SELECT COUNT(*) FROM ledger_files) as file_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COUNT(*) FROM kv_writes) as write_count,
        (SELECT COUNT(*) FROM kv_deletes) as delete_count,
        (SELECT COUNT(*) FROM kv_writes WHERE map_name LIKE '%confidentialledger.logs%') as user_write_count,
        (SELECT COUNT(*) FROM (
          SELECT DISTINCT map_name FROM kv_writes
          UNION
          SELECT DISTINCT map_name FROM kv_deletes
        )) as table_count,
        (SELECT COUNT(*) FROM (
          SELECT DISTINCT map_name, key_name FROM kv_writes
          UNION
          SELECT DISTINCT map_name, key_name FROM kv_deletes
        )) as unique_key_count,
        (SELECT AVG(size) FROM transactions) as avg_transaction_size,
        (SELECT MAX(size) FROM transactions) as largest_transaction_size,
        (SELECT MIN(size) FROM transactions) as smallest_transaction_size,
        (SELECT SUM(file_size) FROM ledger_files) as total_data_size,
        (SELECT MIN(created_at) FROM transactions) as oldest_transaction,
        (SELECT MAX(created_at) FROM transactions) as newest_transaction
    `);

    if (result.length === 0) {
      return {
        fileCount: 0,
        transactionCount: 0,
        writeCount: 0,
        deleteCount: 0,
        userWriteCount: 0,
        tableCount: 0,
        uniqueKeyCount: 0,
        averageTransactionSize: 0,
        largestTransactionSize: 0,
        smallestTransactionSize: 0,
        totalDataSize: 0,
        oldestTransaction: null,
        newestTransaction: null,
      };
    }

    const row = result[0];
    return {
      fileCount: row.file_count as number,
      transactionCount: row.transaction_count as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
      userWriteCount: row.user_write_count as number,
      tableCount: row.table_count as number,
      uniqueKeyCount: row.unique_key_count as number,
      averageTransactionSize: Math.round((row.avg_transaction_size as number) || 0),
      largestTransactionSize: row.largest_transaction_size as number,
      smallestTransactionSize: row.smallest_transaction_size as number,
      totalDataSize: row.total_data_size as number,
      oldestTransaction: row.oldest_transaction ? new Date(row.oldest_transaction as string) : null,
      newestTransaction: row.newest_transaction ? new Date(row.newest_transaction as string) : null,
    };
  }

  /**
   * Get database settings (PRAGMAs)
   */
  async getSettings(): Promise<DatabaseSettings> {
    const settings: DatabaseSettings = {
      journalMode: 'unknown',
      cacheSize: 0,
      tempStore: 'unknown',
      mmapSize: 0,
      pageSize: 0,
    };

    try {
      const journalResult = await this.exec('PRAGMA journal_mode');
      settings.journalMode = Object.values(journalResult[0] || {})[0] as string || 'unknown';

      const cacheResult = await this.exec('PRAGMA cache_size');
      settings.cacheSize = Object.values(cacheResult[0] || {})[0] as number || 0;

      const tempResult = await this.exec('PRAGMA temp_store');
      settings.tempStore = Object.values(tempResult[0] || {})[0] as string || 'unknown';

      const mmapResult = await this.exec('PRAGMA mmap_size');
      settings.mmapSize = Object.values(mmapResult[0] || {})[0] as number || 0;

      const pageResult = await this.exec('PRAGMA page_size');
      settings.pageSize = Object.values(pageResult[0] || {})[0] as number || 0;
    } catch (error) {
      console.warn('Failed to read database settings:', error);
    }

    return settings;
  }

  /**
   * Check database integrity
   */
  async checkIntegrity(): Promise<boolean> {
    try {
      const result = await this.exec('PRAGMA integrity_check');

      if (result.length === 0) return true;

      const firstRow = result[0];
      const integrityResult = Object.values(firstRow)[0] as string;

      return integrityResult === 'ok';
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }
}
