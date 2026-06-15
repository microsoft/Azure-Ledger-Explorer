/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { BaseRepository } from './base-repository';
import type { TableKeyValue, KeyTransaction } from '../types/repository-types';
import type { TableLatestStateSortColumn, TableLatestStateSortDirection } from '../types/query-types';
import {
  buildTableLatestStateCountQuery,
  buildTableLatestStateQuery,
  buildAppendOnlyLatestStateQuery,
  buildAppendOnlyLatestStateCountQuery,
  buildAppendOnlyDetectionQuery,
} from '../queries/table-latest-state-queries';

/**
 * Repository for key-value (CCF table) operations
 */
export class KVRepository extends BaseRepository {
  /**
   * Get all distinct CCF table names (map names)
   */
  async getTables(): Promise<string[]> {
    const result = await this.exec(`
      SELECT DISTINCT map_name
      FROM (
        SELECT map_name FROM kv_writes
        UNION
        SELECT map_name FROM kv_deletes
      ) AS all_maps
      ORDER BY map_name
    `);

    return result.map(row => row.map_name as string);
  }

  /**
   * Get all key-value pairs for a table (includes all versions)
   */
  async getTableKeyValues(
    mapName: string,
    limit = 100,
    offset = 0,
    searchQuery?: string
  ): Promise<TableKeyValue[]> {
    let sql = `
      SELECT 
        kv.key_name,
        kv.value_text,
        kv.version,
        kv.sequence_no,
        kv.is_deleted
      FROM (
        SELECT 
          key_name,
          value_text,
          version,
          sequence_no,
          0 as is_deleted
        FROM kv_writes
        WHERE map_name = ?
        UNION ALL
        SELECT 
          key_name,
          NULL as value_text,
          version,
          sequence_no,
          1 as is_deleted
        FROM kv_deletes
        WHERE map_name = ?
      ) AS kv
    `;

    const params: unknown[] = [mapName, mapName];

    if (searchQuery?.trim()) {
      sql += `
        WHERE (
          kv.key_name LIKE ? OR
          (kv.value_text IS NOT NULL AND kv.value_text LIKE ?)
        )
      `;
      const pattern = this.likePattern(searchQuery);
      params.push(pattern, pattern);
    }

    sql += `
      ORDER BY kv.key_name, kv.version DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const result = await this.exec(sql, params);

    return result.map(row => ({
      keyName: row.key_name as string,
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : null,
      version: row.version as number,
      transactionId: row.sequence_no as number,
      isDeleted: (row.is_deleted as number) === 1,
    }));
  }

  /**
   * Returns true when getTableLatestState can route through the append-only
   * fast path: the map has no kv_deletes and no duplicate key_names (so every
   * row IS its own latest version).
   *
   * Always run before each query rather than cached so it stays correct across
   * additional ledger imports during the session.
   */
  async isAppendOnlyMap(mapName: string): Promise<boolean> {
    const { sql, params } = buildAppendOnlyDetectionQuery(mapName);
    const result = await this.exec(sql, params);
    const row = result[0] ?? {};
    const hasDeletes = (row.has_deletes as number | undefined) ?? 0;
    const hasDuplicates = (row.has_duplicate_keys as number | undefined) ?? 0;
    return hasDeletes === 0 && hasDuplicates === 0;
  }

  /**
   * Get the latest state of all keys in a table (most recent version only)
   */
  async getTableLatestState(
    mapName: string,
    limit = 100,
    offset = 0,
    searchQuery?: string,
    sortColumn: TableLatestStateSortColumn = 'sequence',
    sortDirection: TableLatestStateSortDirection = 'asc'
  ): Promise<TableKeyValue[]> {
    const hasSearch = !!(searchQuery && searchQuery.trim());
    const fastPathEligible = !hasSearch && sortColumn !== 'value';

    let sql: string;
    let params: unknown[];

    if (fastPathEligible && (await this.isAppendOnlyMap(mapName))) {
      ({ sql, params } = buildAppendOnlyLatestStateQuery({
        mapName,
        limit,
        offset,
        sortColumn,
        sortDirection,
      }));
    } else {
      ({ sql, params } = buildTableLatestStateQuery({
        mapName,
        limit,
        offset,
        searchQuery,
        sortColumn,
        sortDirection,
      }));
    }

    const result = await this.exec(sql, params);

    return result.map(row => ({
      keyName: row.key_name as string,
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : null,
      version: row.version as number,
      transactionId: row.sequence_no as number,
      transactionIdentifier: (row.transaction_id as string) || null,
      isDeleted: (row.is_deleted as number) === 1,
    }));
  }

  /**
   * Get count of keys in a table's latest state
   */
  async getTableLatestStateCount(mapName: string, searchQuery?: string): Promise<number> {
    const hasSearch = !!(searchQuery && searchQuery.trim());

    let sql: string;
    let params: unknown[];

    if (!hasSearch && (await this.isAppendOnlyMap(mapName))) {
      ({ sql, params } = buildAppendOnlyLatestStateCountQuery({ mapName }));
    } else {
      ({ sql, params } = buildTableLatestStateCountQuery({ mapName, searchQuery }));
    }

    const result = await this.exec(sql, params);
    return (result[0]?.count as number) || 0;
  }

  /**
   * Get transaction history for a specific key
   */
  async getKeyTransactions(
    mapName: string,
    keyName: string,
    limit = 50,
    offset = 0
  ): Promise<KeyTransaction[]> {
    const result = await this.exec(
      `SELECT 
         ops.sequence_no,
         ops.version,
         ops.operation_type,
         ops.value_text,
         f.filename
       FROM (
         SELECT 
           sequence_no,
           version,
           'write' as operation_type,
           value_text
         FROM kv_writes
         WHERE map_name = ? AND key_name = ?
         UNION ALL
         SELECT 
           sequence_no,
           version,
           'delete' as operation_type,
           NULL as value_text
         FROM kv_deletes
         WHERE map_name = ? AND key_name = ?
       ) AS ops
       JOIN transactions t ON ops.sequence_no = t.sequence_no
       JOIN ledger_files f ON t.file_id = f.id
       ORDER BY ops.version DESC
       LIMIT ? OFFSET ?`,
      [mapName, keyName, mapName, keyName, limit, offset]
    );

    return result.map(row => ({
      transactionId: row.sequence_no as number,
      version: row.version as number,
      operationType: row.operation_type as 'write' | 'delete',
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : null,
      fileName: row.filename as string,
    }));
  }
}
