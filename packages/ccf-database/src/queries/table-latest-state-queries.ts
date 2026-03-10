/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { TableLatestStateSortColumn, TableLatestStateSortDirection } from '../types/query-types';

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

/**
 * Single-pass CTE using ROW_NUMBER() to find the latest version of each key.
 *
 * Old approach (2-pass):
 *   1. GROUP BY key_name + MAX(version) across UNION ALL
 *   2. Re-JOIN back to kv_writes and kv_deletes to fetch the full row
 *
 * New approach (1-pass):
 *   1. UNION ALL writes + deletes with all needed columns
 *   2. ROW_NUMBER() PARTITION BY key_name ORDER BY version DESC → rn=1 is latest
 *   3. JOIN transactions only for the filtered rows
 *
 * With covering indexes (map_name, key_name, version DESC, sequence_no, value_text)
 * both sides of the UNION ALL are satisfied by index-only scans, and the re-join
 * to the base tables is eliminated entirely.
 *
 * Params: [mapName, mapName] (one per side of UNION ALL).
 */
const BASE_CTE = `
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
        ROW_NUMBER() OVER (PARTITION BY key_name ORDER BY version DESC) as rn
      FROM all_operations
    ) ao
    WHERE ao.rn = 1
  )
`;

export function buildTableLatestStateQuery(args: {
  mapName: string;
  limit: number;
  offset: number;
  searchQuery?: string;
  sortColumn: TableLatestStateSortColumn;
  sortDirection: TableLatestStateSortDirection;
}): { sql: string; params: unknown[] } {
  let sql = `${BASE_CTE}
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

  const directionKeyword = args.sortDirection === 'desc' ? 'DESC' : 'ASC';
  const orderExpressions: string[] = [];

  switch (args.sortColumn) {
    case 'sequence':
      orderExpressions.push(`lo.sequence_no ${directionKeyword}`);
      break;
    case 'transactionId':
      orderExpressions.push('CASE WHEN t.transaction_id IS NULL THEN 1 ELSE 0 END ASC');
      orderExpressions.push(`t.transaction_id COLLATE NOCASE ${directionKeyword}`);
      break;
    case 'value':
      orderExpressions.push('CASE WHEN lo.value_text IS NULL THEN 1 ELSE 0 END ASC');
      orderExpressions.push(`lo.value_text COLLATE NOCASE ${directionKeyword}`);
      break;
    case 'keyName':
    default:
      orderExpressions.push(`lo.key_name COLLATE NOCASE ${directionKeyword}`);
      break;
  }

  if (args.sortColumn !== 'sequence') {
    orderExpressions.push('lo.sequence_no ASC');
  }

  if (args.sortColumn !== 'keyName' || args.sortDirection === 'desc') {
    orderExpressions.push('lo.key_name COLLATE NOCASE ASC');
  }

  sql += `
    ORDER BY ${orderExpressions.join(', ')}
    LIMIT ? OFFSET ?
  `;

  params.push(args.limit, args.offset);

  return { sql, params };
}

export function buildTableLatestStateCountQuery(args: {
  mapName: string;
  searchQuery?: string;
}): { sql: string; params: unknown[] } {
  // Same CTE but skip the transactions JOIN — not needed for counting.
  let sql = `${BASE_CTE}
    SELECT COUNT(*) as count
    FROM latest_operations lo
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

  return { sql, params };
}
