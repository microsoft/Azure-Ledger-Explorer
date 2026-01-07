/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { BaseRepository } from './base-repository';

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
   * Get enhanced database statistics with additional metrics
   */
  async getEnhancedStats(): Promise<EnhancedStats> {
    const result = await this.exec(`
      SELECT 
        (SELECT COUNT(*) FROM ledger_files) as file_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COUNT(*) FROM kv_writes) as write_count,
        (SELECT COUNT(*) FROM kv_deletes) as delete_count,
        (SELECT COUNT(*) FROM kv_writes WHERE map_name LIKE '%confidentialledger.logs%') as user_write_count,
        (SELECT COUNT(DISTINCT map_name) FROM (
          SELECT map_name FROM kv_writes
          UNION
          SELECT map_name FROM kv_deletes
        )) as table_count,
        (SELECT COUNT(DISTINCT key_name || map_name) FROM (
          SELECT key_name, map_name FROM kv_writes
          UNION
          SELECT key_name, map_name FROM kv_deletes
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
