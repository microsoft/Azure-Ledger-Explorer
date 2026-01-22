/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { BaseRepository } from './base-repository';
import type { LedgerKeyValue } from '@ccf/ledger-parser';
import type { TransactionRecord, SearchResult } from '../types/repository-types';
import {
  buildAllTransactionsCountQuery,
  buildAllTransactionsListQuery,
  buildFileTransactionsCountQuery,
  buildFileTransactionsListQuery,
} from '../queries/transaction-list-queries';

/**
 * Repository for transaction operations
 */
export class TransactionRepository extends BaseRepository {
  /**
   * Get transactions for a specific file (basic view)
   */
  async getByFileId(fileId: number, limit = 100, offset = 0): Promise<TransactionRecord[]> {
    const result = await this.exec(
      `SELECT 
         sequence_no, version, flags, 
         size, entry_type, tx_version, 
         max_conflict_version, 
         transaction_id as tx_id, 
         tx_view
       FROM transactions
       WHERE file_id = ?
       ORDER BY sequence_no
       LIMIT ? OFFSET ?`,
      [fileId, limit, offset]
    );

    return result.map(row => ({
      id: row.sequence_no as number,
      fileId,
      fileName: '',
      version: row.version as number,
      flags: row.flags as number,
      size: row.size as number,
      entryType: row.entry_type as number,
      txVersion: row.tx_version as number,
      maxConflictVersion: row.max_conflict_version as number,
      txId: row.tx_id as string,
      txView: row.tx_view as number,
    }));
  }

  /**
   * Get transactions for a file with full details (joins with file info)
   */
  async getByFileIdWithDetails(
    fileId: number,
    limit = 100,
    offset = 0,
    searchQuery?: string
  ): Promise<TransactionRecord[]> {
    const { sql, params } = buildFileTransactionsListQuery({
      fileId,
      limit,
      offset,
      searchQuery,
    });

    const result = await this.exec(sql, params);

    return result.map(row => ({
      id: row.id as number,
      fileId: row.file_id as number,
      fileName: row.filename as string,
      version: row.version as number,
      flags: row.flags as number,
      size: row.size as number,
      entryType: row.entry_type as number,
      txVersion: row.tx_version as number,
      maxConflictVersion: row.max_conflict_version as number,
      txId: row.tx_id as string,
      txView: row.tx_view as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
      mapName: (row.map_name as string) || undefined,
    }));
  }

  /**
   * Get count of transactions for a file
   */
  async getCountByFileId(fileId: number, searchQuery?: string): Promise<number> {
    const { sql, params } = buildFileTransactionsCountQuery({ fileId, searchQuery });
    const result = await this.exec(sql, params);
    return (result[0]?.count as number) || 0;
  }

  /**
   * Get all transactions across all files
   */
  async getAll(limit = 1000, offset = 0, searchQuery?: string): Promise<TransactionRecord[]> {
    const { sql, params } = buildAllTransactionsListQuery({ limit, offset, searchQuery });
    const result = await this.exec(sql, params);

    return result.map(row => ({
      id: row.id as number,
      fileId: row.file_id as number,
      fileName: row.filename as string,
      version: row.version as number,
      flags: row.flags as number,
      size: row.size as number,
      entryType: row.entry_type as number,
      txVersion: row.tx_version as number,
      maxConflictVersion: row.max_conflict_version as number,
      txId: row.tx_id as string,
      txView: row.tx_view as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
      mapName: row.map_name as string,
    }));
  }

  /**
   * Get total count of all transactions
   */
  async getAllCount(searchQuery?: string): Promise<number> {
    const { sql, params } = buildAllTransactionsCountQuery({ searchQuery });
    const result = await this.exec(sql, params);
    return (result[0]?.total as number) || 0;
  }

  /**
   * Get total transaction count (simple count)
   */
  async getTotalCount(): Promise<number> {
    const result = await this.exec('SELECT COUNT(*) as count FROM transactions');
    return (result[0]?.count as number) || 0;
  }

  /**
   * Get a transaction by its sequence number (ID)
   */
  async getById(transactionId: number): Promise<TransactionRecord | null> {
    const result = await this.exec(
      `SELECT t.sequence_no as id, t.file_id, lf.filename, t.version, t.flags,
         t.size, t.entry_type, t.tx_version, t.max_conflict_version, 
         t.transaction_id as tx_id, tx_view,
         (SELECT COUNT(*) FROM kv_writes WHERE sequence_no = t.sequence_no) as write_count,
         (SELECT COUNT(*) FROM kv_deletes WHERE sequence_no = t.sequence_no) as delete_count,
         lf.file_size
       FROM transactions t
       LEFT JOIN ledger_files lf ON t.file_id = lf.id
       WHERE t.sequence_no = ?`,
      [transactionId]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as number,
      fileId: row.file_id as number,
      fileName: row.filename as string,
      version: row.version as number,
      flags: row.flags as number,
      size: row.size as number,
      entryType: row.entry_type as number,
      txVersion: row.tx_version as number,
      maxConflictVersion: row.max_conflict_version as number,
      txId: row.tx_id as string,
      txView: row.tx_view as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
      fileSize: row.file_size as number,
    };
  }

  /**
   * Find a transaction by its digest (hash)
   */
  async getByDigest(digestBytes: Uint8Array): Promise<{ transactionId: number; txDigest: Uint8Array } | null> {
    const result = await this.exec(
      `SELECT sequence_no, tx_digest 
       FROM transactions 
       WHERE tx_digest = ?
       LIMIT 1`,
      [digestBytes]
    );

    if (result.length === 0) return null;

    const row = result[0];
    return {
      transactionId: row.sequence_no as number,
      txDigest: new Uint8Array(row.tx_digest as ArrayBuffer),
    };
  }

  /**
   * Get writes for a transaction
   */
  async getWrites(transactionId: number): Promise<LedgerKeyValue[]> {
    const result = await this.exec(
      `SELECT key_name, value_text, value_bytes, version, map_name
       FROM kv_writes
       WHERE sequence_no = ?
       ORDER BY map_name, key_name`,
      [transactionId]
    );

    return result.map(row => {
      const valueBytes = this.toUint8Array(row.value_bytes);
      const valueText = row.value_text as string | null;

      return {
        key: row.key_name as string,
        value: valueBytes ?? (valueText ? new TextEncoder().encode(valueText) : new Uint8Array(0)),
        version: row.version as number,
        mapName: row.map_name as string,
      };
    });
  }

  /**
   * Get deletes for a transaction
   */
  async getDeletes(transactionId: number): Promise<LedgerKeyValue[]> {
    const result = await this.exec(
      `SELECT key_name, version, map_name
       FROM kv_deletes
       WHERE sequence_no = ?
       ORDER BY map_name, key_name`,
      [transactionId]
    );

    return result.map(row => ({
      key: row.key_name as string,
      value: new Uint8Array(0),
      version: row.version as number,
      mapName: row.map_name as string,
    }));
  }

  /**
   * Get transactions with related data for verification
   */
  async getWithRelated(start: number, limit: number): Promise<Array<{
    txId: number;
    txHash: Uint8Array;
    tables: Array<{ storeName: string; value: string }>;
  }>> {
    const transactionResult = await this.exec(
      `SELECT sequence_no, tx_digest
       FROM transactions
       ORDER BY sequence_no
       LIMIT ? OFFSET ?`,
      [limit, start]
    );

    const results: Array<{
      txId: number;
      txHash: Uint8Array;
      tables: Array<{ storeName: string; value: string }>;
    }> = [];

    for (const tx of transactionResult) {
      const txId = tx.sequence_no as number;
      const txHash = new Uint8Array(tx.tx_digest as ArrayBuffer);

      const writesResult = await this.exec(
        `SELECT map_name, value_text
         FROM kv_writes
         WHERE sequence_no = ? AND value_text IS NOT NULL`,
        [txId]
      );

      const tables = writesResult.map(row => ({
        storeName: row.map_name as string,
        value: row.value_text as string,
      }));

      results.push({ txId, txHash, tables });
    }

    return results;
  }

  /**
   * Get transactions for a specific file with hash data for per-chunk verification
   * This is optimized for chunk-based verification where we verify once per chunk
   */
  async getByFileIdForVerification(fileId: number): Promise<{
    transactions: Array<{ txId: number; txHash: Uint8Array }>;
    lastSignature: { txId: number; signatureData: string } | null;
  }> {
    // Fetch all transactions with their hashes
    const transactionResult = await this.exec(
      `SELECT sequence_no, tx_digest
       FROM transactions
       WHERE file_id = ?
       ORDER BY sequence_no`,
      [fileId]
    );

    const transactions = transactionResult.map(tx => ({
      txId: tx.sequence_no as number,
      txHash: new Uint8Array(tx.tx_digest as ArrayBuffer),
    }));

    // Fetch the last signature transaction for this file in a single query
    const lastSignatureResult = await this.exec(
      `SELECT w.sequence_no, w.value_text
       FROM kv_writes w
       JOIN transactions t ON w.sequence_no = t.sequence_no
       WHERE t.file_id = ?
         AND w.map_name LIKE '%public:ccf.internal.signatures%'
         AND w.value_text IS NOT NULL
       ORDER BY w.sequence_no DESC
       LIMIT 1`,
      [fileId]
    );

    const lastSignature = lastSignatureResult.length > 0
      ? {
          txId: lastSignatureResult[0].sequence_no as number,
          signatureData: lastSignatureResult[0].value_text as string,
        }
      : null;

    return { transactions, lastSignature };
  }

  /**
   * Search transactions by key name
   */
  async searchByKey(keyName: string, limit = 50): Promise<SearchResult[]> {
    const pattern = this.likePattern(keyName);

    const result = await this.exec(
      `SELECT 
         t.sequence_no as id, w.map_name, w.key_name, 1 as has_value, w.version
       FROM transactions t
       JOIN kv_writes w ON t.sequence_no = w.sequence_no
       WHERE w.key_name LIKE ?
       
       UNION ALL
       
       SELECT 
         t.sequence_no as id, d.map_name, d.key_name, 0 as has_value, d.version
       FROM transactions t
       JOIN kv_deletes d ON t.sequence_no = d.sequence_no
       WHERE d.key_name LIKE ?
       
       ORDER BY id
       LIMIT ?`,
      [pattern, pattern, limit]
    );

    return result.map(row => ({
      transactionId: row.id as number,
      mapName: row.map_name as string,
      keyName: row.key_name as string,
      hasValue: row.has_value === 1,
      version: row.version as number,
    }));
  }

  /**
   * Search transactions by key name or value content
   */
  async searchByKeyOrValue(query: string, limit = 50): Promise<SearchResult[]> {
    const pattern = this.likePattern(query);

    const result = await this.exec(
      `SELECT 
         t.sequence_no as id, w.map_name, w.key_name, 1 as has_value, w.version, 
         'key' as match_type, w.key_name as matched_text
       FROM transactions t
       JOIN kv_writes w ON t.sequence_no = w.sequence_no
       WHERE w.key_name LIKE ?
       
       UNION ALL
       
       SELECT 
         t.sequence_no as id, w.map_name, w.key_name, 1 as has_value, w.version, 
         'value' as match_type, w.value_text as matched_text
       FROM transactions t
       JOIN kv_writes w ON t.sequence_no = w.sequence_no
       WHERE w.value_text IS NOT NULL AND w.value_text LIKE ? AND w.key_name NOT LIKE ?
       
       UNION ALL
       
       SELECT 
         t.sequence_no as id, d.map_name, d.key_name, 0 as has_value, d.version, 
         'key' as match_type, d.key_name as matched_text
       FROM transactions t
       JOIN kv_deletes d ON t.sequence_no = d.sequence_no
       WHERE d.key_name LIKE ?
       
       ORDER BY id
       LIMIT ?`,
      [pattern, pattern, pattern, pattern, limit]
    );

    return result.map(row => ({
      transactionId: row.id as number,
      mapName: row.map_name as string,
      keyName: row.key_name as string,
      hasValue: row.has_value === 1,
      version: row.version as number,
      matchType: row.match_type as 'key' | 'value',
      matchedText: row.matched_text as string,
    }));
  }

  /**
   * Helper to convert database value to Uint8Array
   */
  private toUint8Array(value: unknown): Uint8Array | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (typeof value === 'object' && 'buffer' in value) {
      const maybeBuffer = (value as { buffer?: unknown }).buffer;
      if (maybeBuffer instanceof ArrayBuffer) {
        return new Uint8Array(maybeBuffer);
      }
    }
    return null;
  }
}
