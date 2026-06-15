/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { TableLatestStateSortColumn, TableLatestStateSortDirection } from '../types/query-types';

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

interface OrderArgs {
  sortColumn: TableLatestStateSortColumn;
  sortDirection: TableLatestStateSortDirection;
  /** Column alias for key_name in the surrounding query (e.g. `lo` or `w`). */
  keyAlias: string;
  /** Column alias for value_text. May be omitted if value sort is not requested here. */
  valueAlias?: string;
  /** Column alias for sequence_no. */
  sequenceAlias: string;
  /** Column alias for transaction_id (joined from transactions). */
  transactionAlias?: string;
}

/**
 * Build the ORDER BY clause shared by all query shapes.
 *
 * The same column-priority rules apply regardless of whether value_text is
 * projected by the CTE or joined back after LIMIT.
 */
function buildOrderBy(args: OrderArgs): string {
  const dir = args.sortDirection === 'desc' ? 'DESC' : 'ASC';
  const parts: string[] = [];

  switch (args.sortColumn) {
    case 'sequence':
      parts.push(`${args.sequenceAlias}.sequence_no ${dir}`);
      break;
    case 'transactionId': {
      const t = args.transactionAlias ?? 't';
      parts.push(`CASE WHEN ${t}.transaction_id IS NULL THEN 1 ELSE 0 END ASC`);
      parts.push(`${t}.transaction_id COLLATE NOCASE ${dir}`);
      break;
    }
    case 'value': {
      // Only callable when value_text is available in the same scope.
      const v = args.valueAlias ?? 'lo';
      parts.push(`CASE WHEN ${v}.value_text IS NULL THEN 1 ELSE 0 END ASC`);
      parts.push(`${v}.value_text COLLATE NOCASE ${dir}`);
      break;
    }
    case 'keyName':
    default:
      parts.push(`${args.keyAlias}.key_name COLLATE NOCASE ${dir}`);
      break;
  }

  if (args.sortColumn !== 'sequence') {
    parts.push(`${args.sequenceAlias}.sequence_no ASC`);
  }
  if (args.sortColumn !== 'keyName' || args.sortDirection === 'desc') {
    parts.push(`${args.keyAlias}.key_name COLLATE NOCASE ASC`);
  }

  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// "Heavy" CTE — used when we must project value_text into the window pipeline
// (i.e. searchQuery is present OR sort-by-value).
// Identical in shape to the pre-Tier-A query.
// ---------------------------------------------------------------------------

const HEAVY_BASE_CTE = `
  WITH all_operations AS (
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
  ),
  latest_operations AS (
    SELECT
      ao.key_name,
      ao.value_text,
      ao.version,
      ao.sequence_no,
      ao.is_deleted
    FROM (
      SELECT
        *,
        MAX(version) OVER (PARTITION BY key_name) as max_version
      FROM all_operations
    ) ao
    WHERE ao.version = ao.max_version
  )
`;

function buildHeavyLatestStateQuery(args: {
  mapName: string;
  limit: number;
  offset: number;
  searchQuery?: string;
  sortColumn: TableLatestStateSortColumn;
  sortDirection: TableLatestStateSortDirection;
}): { sql: string; params: unknown[] } {
  let sql = `${HEAVY_BASE_CTE}
    SELECT
      lo.key_name,
      lo.value_text,
      lo.version,
      lo.sequence_no,
      lo.is_deleted,
      t.transaction_id
    FROM latest_operations lo
    LEFT JOIN transactions t ON t.sequence_no = lo.sequence_no
  `;

  const params: unknown[] = [args.mapName, args.mapName];

  if (args.searchQuery && args.searchQuery.trim()) {
    sql += `
      WHERE (
        lo.key_name LIKE ? OR
        (lo.value_text IS NOT NULL AND lo.value_text LIKE ?)
      )
    `;
    const p = likePattern(args.searchQuery);
    params.push(p, p);
  }

  sql += `
    ORDER BY ${buildOrderBy({
      sortColumn: args.sortColumn,
      sortDirection: args.sortDirection,
      keyAlias: 'lo',
      valueAlias: 'lo',
      sequenceAlias: 'lo',
      transactionAlias: 't',
    })}
    LIMIT ? OFFSET ?
  `;
  params.push(args.limit, args.offset);

  return { sql, params };
}

// ---------------------------------------------------------------------------
// "Deferred" CTE — used when we can defer value_text past LIMIT/OFFSET.
//
// The inner CTE only projects (key_name, version, sequence_no, is_deleted),
// so the materialised tuples are small (~32B vs ~5KB per row). The window
// function and ORDER BY operate on those small tuples. value_text is joined
// back from kv_writes for only the 100 rows that survive LIMIT.
//
// Eligible when: no search query AND not sorting by value.
// ---------------------------------------------------------------------------

const DEFERRED_BASE_CTE = `
  WITH all_operations AS (
    SELECT
      key_name,
      version,
      sequence_no,
      0 as is_deleted
    FROM kv_writes
    WHERE map_name = ?
    UNION ALL
    SELECT
      key_name,
      version,
      sequence_no,
      1 as is_deleted
    FROM kv_deletes
    WHERE map_name = ?
  ),
  latest_operations AS (
    SELECT
      ao.key_name,
      ao.version,
      ao.sequence_no,
      ao.is_deleted
    FROM (
      SELECT
        *,
        MAX(version) OVER (PARTITION BY key_name) as max_version
      FROM all_operations
    ) ao
    WHERE ao.version = ao.max_version
  )
`;

function buildDeferredLatestStateQuery(args: {
  mapName: string;
  limit: number;
  offset: number;
  sortColumn: TableLatestStateSortColumn;
  sortDirection: TableLatestStateSortDirection;
}): { sql: string; params: unknown[] } {
  const sql = `${DEFERRED_BASE_CTE},
    paged AS (
      SELECT
        lo.key_name,
        lo.version,
        lo.sequence_no,
        lo.is_deleted,
        t.transaction_id
      FROM latest_operations lo
      LEFT JOIN transactions t ON t.sequence_no = lo.sequence_no
      ORDER BY ${buildOrderBy({
        sortColumn: args.sortColumn,
        sortDirection: args.sortDirection,
        keyAlias: 'lo',
        sequenceAlias: 'lo',
        transactionAlias: 't',
      })}
      LIMIT ? OFFSET ?
    )
    SELECT
      p.key_name,
      w.value_text,
      p.version,
      p.sequence_no,
      p.is_deleted,
      p.transaction_id
    FROM paged p
    LEFT JOIN kv_writes w
      ON w.map_name = ?
      AND w.key_name = p.key_name
      AND w.version = p.version
      AND w.sequence_no = p.sequence_no
  `;

  return {
    sql,
    params: [args.mapName, args.mapName, args.limit, args.offset, args.mapName],
  };
}

// ---------------------------------------------------------------------------
// Append-only fast path.
//
// When a map has no kv_deletes and every key_name is unique within the map,
// every write IS its own latest. We can bypass the CTE + window entirely
// and just paginate over kv_writes directly using the (map_name, sequence_no)
// index. OFFSET becomes a cheap index skip; there is no sort step for the
// default sequence ordering.
// ---------------------------------------------------------------------------

export function buildAppendOnlyLatestStateQuery(args: {
  mapName: string;
  limit: number;
  offset: number;
  sortColumn: TableLatestStateSortColumn;
  sortDirection: TableLatestStateSortDirection;
}): { sql: string; params: unknown[] } {
  // We still want value_text in the result, but only for the page (LIMIT 100).
  // Two-stage: (1) pick the page using just (sequence_no, key_name, version),
  // (2) join back for value_text. For the sequence sort this is index-only.
  const params: unknown[] = [];

  // Stage 1: pick rows for this page from kv_writes. Use the (map_name,
  // sequence_no) index for the common sequence sort.
  let pageSql = `
    SELECT id, sequence_no, key_name, version
    FROM kv_writes
    WHERE map_name = ?
  `;
  params.push(args.mapName);

  pageSql += `
    ORDER BY ${buildOrderBy({
      sortColumn: args.sortColumn,
      sortDirection: args.sortDirection,
      keyAlias: 'kv_writes',
      sequenceAlias: 'kv_writes',
      // No transaction_id available at this stage; sort-by-transactionId here
      // would fall back; the append-only path does not advertise itself for
      // value sort either (caller decides eligibility).
    })}
    LIMIT ? OFFSET ?
  `;
  params.push(args.limit, args.offset);

  const sql = `
    WITH page AS (${pageSql})
    SELECT
      p.key_name,
      w.value_text,
      p.version,
      p.sequence_no,
      0 AS is_deleted,
      t.transaction_id
    FROM page p
    JOIN kv_writes w ON w.id = p.id
    LEFT JOIN transactions t ON t.sequence_no = p.sequence_no
    ORDER BY ${buildOrderBy({
      sortColumn: args.sortColumn,
      sortDirection: args.sortDirection,
      keyAlias: 'p',
      sequenceAlias: 'p',
      transactionAlias: 't',
    })}
  `;

  return { sql, params };
}

export function buildAppendOnlyLatestStateCountQuery(args: {
  mapName: string;
}): { sql: string; params: unknown[] } {
  return {
    sql: `SELECT COUNT(*) AS count FROM kv_writes WHERE map_name = ?`,
    params: [args.mapName],
  };
}

// ---------------------------------------------------------------------------
// Append-only eligibility detection.
// ---------------------------------------------------------------------------

/**
 * Returns true when `getTableLatestState` can route through the append-only
 * fast path. The fast path is correct iff:
 *   - the map has no rows in kv_deletes, AND
 *   - every row in kv_writes for this map has a distinct key_name
 *     (so MAX(version) per key trivially yields that single row).
 *
 * Both checks are EXISTS short-circuits, so the second check terminates at
 * the first duplicate found and the first check terminates at the first
 * delete found.
 *
 * NOTE: This must NOT be called when sortColumn === 'value' or when a
 * search query is present — those still need value_text in the filter/sort
 * scope and must go through the heavy CTE path.
 */
export function buildAppendOnlyDetectionQuery(mapName: string): { sql: string; params: unknown[] } {
  return {
    sql: `
      SELECT
        (EXISTS(SELECT 1 FROM kv_deletes WHERE map_name = ?)) AS has_deletes,
        (EXISTS(
          SELECT 1 FROM kv_writes WHERE map_name = ?
          GROUP BY key_name HAVING COUNT(*) > 1
        )) AS has_duplicate_keys
    `,
    params: [mapName, mapName],
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export function buildTableLatestStateQuery(args: {
  mapName: string;
  limit: number;
  offset: number;
  searchQuery?: string;
  sortColumn: TableLatestStateSortColumn;
  sortDirection: TableLatestStateSortDirection;
}): { sql: string; params: unknown[] } {
  const hasSearch = !!(args.searchQuery && args.searchQuery.trim());
  const needsValueText = hasSearch || args.sortColumn === 'value';

  if (needsValueText) {
    return buildHeavyLatestStateQuery(args);
  }
  return buildDeferredLatestStateQuery(args);
}

export function buildTableLatestStateCountQuery(args: {
  mapName: string;
  searchQuery?: string;
}): { sql: string; params: unknown[] } {
  const hasSearch = !!(args.searchQuery && args.searchQuery.trim());

  if (hasSearch) {
    // Need value_text for the LIKE filter.
    let sql = `${HEAVY_BASE_CTE}
      SELECT COUNT(*) as count
      FROM latest_operations lo
    `;
    const params: unknown[] = [args.mapName, args.mapName];
    sql += `
      WHERE (
        lo.key_name LIKE ? OR
        (lo.value_text IS NOT NULL AND lo.value_text LIKE ?)
      )
    `;
    const p = likePattern(args.searchQuery!);
    params.push(p, p);
    return { sql, params };
  }

  // No search: count via the deferred (small-tuple) CTE.
  return {
    sql: `${DEFERRED_BASE_CTE}
      SELECT COUNT(*) as count
      FROM latest_operations
    `,
    params: [args.mapName, args.mapName],
  };
}
