/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { TableLatestStateSortColumn, TableLatestStateSortDirection } from '../types/query-types';

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

/**
 * Single-pass CTE using MAX() window function to find the latest version of each key.
 * Returns ALL rows where version equals the maximum version for that key.
 *
 * This preserves the original behavior where tables with multiple entries
 * sharing the same key_name but same max version are all returned (e.g., SCITT entries
 * that all have key_name='' and version=1).
 *
 * With covering indexes (map_name, key_name, version DESC, sequence_no, value_text)
 * SQLite can resolve the query via index-only scans.
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
        MAX(version) OVER (PARTITION BY key_name) as max_version
      FROM all_operations
    ) ao
    WHERE ao.version = ao.max_version
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
