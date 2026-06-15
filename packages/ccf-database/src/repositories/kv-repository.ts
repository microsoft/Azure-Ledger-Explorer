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
 * Map names that are guaranteed append-only by CCF protocol design.
 *
 * These maps never receive deletes and never overwrite an existing key, so the
 * `(no kv_deletes) AND (no duplicate key_names)` detection query would always
 * return true. Hardcoding them lets us skip that ~1-2s EXISTS check on every
 * `getTableLatestState` / `getTableLatestStateCount` call.
 *
 * Only add a map here if you can guarantee it by protocol — runtime detection
 * remains the safety net for anything not on this list.
 *
 * SAFETY RULES for adding to this set:
 *   - The map must be a CCF `kv::Map<K, V>` (NOT a single-slot `kv::Value<T>`)
 *     where each entry has a unique key by protocol — typically the transaction
 *     sequence number or another monotonically-increasing identifier.
 *   - Entries must never be deleted (no `kv_deletes` rows for this map).
 *   - Entries must never be overwritten (no second write with the same key).
 *
 * If unsure, leave it off the list. The runtime EXISTS-pair check is correct;
 * the allowlist is purely an optimisation. Marking a non-append-only map as
 * append-only causes the UI to render duplicate stale rows because the fast
 * path skips dedup.
 *
 * Maps known to look append-only but are NOT (do not add these):
 *   - `public:scitt.operations` — `ccf::kv::Value<OperationLog>`, a single-slot
 *     value with a fixed unit key. Every operation write overwrites the same
 *     slot, so on a SCITT ledger this map has N writes to one key, not N keys.
 *     See microsoft/scitt-ccf-ledger app/src/kv_types.h for the schema.
 *
 * Currently allowlisted:
 *   - `public:scitt.entry` — SCITT append-only transparency log; each receipt
 *     is a new sequence_no with a fresh key, never replaced or deleted.
 */
const KNOWN_APPEND_ONLY_MAPS = new Set<string>([
  'public:scitt.entry',
]);

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
   * For maps listed in `KNOWN_APPEND_ONLY_MAPS`, returns true without hitting
   * the database — these are append-only by CCF protocol design and the
   * detection query (~1-2s on large ledgers) would always return true anyway.
   *
   * For all other maps, runs the EXISTS-pair detection on every call so we
   * stay correct across additional ledger imports during the session.
   */
  async isAppendOnlyMap(mapName: string): Promise<boolean> {
    if (KNOWN_APPEND_ONLY_MAPS.has(mapName)) {
      return true;
    }
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
    // Fast path requires (a) no search filter (no value_text scan), (b) sort
    // that the page CTE alone can evaluate. Sort by 'value' needs value_text
    // which the page CTE doesn't project; sort by 'transactionId' needs the
    // transactions table which the page CTE doesn't join. Both fall through
    // to the heavy path.
    const fastPathEligible = !hasSearch && sortColumn !== 'value' && sortColumn !== 'transactionId';

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
