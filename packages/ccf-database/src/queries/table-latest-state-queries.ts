/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

export type TableLatestStateSortColumn = 'sequence' | 'transactionId' | 'keyName' | 'value';
export type TableLatestStateSortDirection = 'asc' | 'desc';

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

const BASE_CTE = `
  WITH latest_versions AS (
    SELECT
      key_name,
      MAX(version) as max_version
    FROM (
      SELECT key_name, version FROM kv_writes WHERE map_name = ?
      UNION ALL
      SELECT key_name, version FROM kv_deletes WHERE map_name = ?
    ) AS all_keys
    GROUP BY key_name
  ),
  latest_operations AS (
    SELECT
      lv.key_name,
      COALESCE(w.value_text, NULL) as value_text,
      lv.max_version as version,
      COALESCE(w.sequence_no, d.sequence_no) as sequence_no,
      CASE WHEN d.sequence_no IS NOT NULL THEN 1 ELSE 0 END as is_deleted,
      t.transaction_id as transaction_id
    FROM latest_versions lv
    LEFT JOIN kv_writes w ON lv.key_name = w.key_name
      AND lv.max_version = w.version
      AND w.map_name = ?
    LEFT JOIN kv_deletes d ON lv.key_name = d.key_name
      AND lv.max_version = d.version
      AND d.map_name = ?
    LEFT JOIN transactions t ON t.sequence_no = COALESCE(w.sequence_no, d.sequence_no)
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
      lo.transaction_id
    FROM latest_operations lo
  `;

  const params: unknown[] = [args.mapName, args.mapName, args.mapName, args.mapName];

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
      orderExpressions.push('CASE WHEN lo.transaction_id IS NULL THEN 1 ELSE 0 END ASC');
      orderExpressions.push(`lo.transaction_id COLLATE NOCASE ${directionKeyword}`);
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
  // Same CTE, but without joining to transactions (saves a join for count queries).
  let sql = `
    WITH latest_versions AS (
      SELECT
        key_name,
        MAX(version) as max_version
      FROM (
        SELECT key_name, version FROM kv_writes WHERE map_name = ?
        UNION ALL
        SELECT key_name, version FROM kv_deletes WHERE map_name = ?
      ) AS all_keys
      GROUP BY key_name
    ),
    latest_operations AS (
      SELECT
        lv.key_name,
        COALESCE(w.value_text, NULL) as value_text,
        lv.max_version as version,
        COALESCE(w.sequence_no, d.sequence_no) as sequence_no,
        CASE WHEN d.sequence_no IS NOT NULL THEN 1 ELSE 0 END as is_deleted
      FROM latest_versions lv
      LEFT JOIN kv_writes w ON lv.key_name = w.key_name
        AND lv.max_version = w.version
        AND w.map_name = ?
      LEFT JOIN kv_deletes d ON lv.key_name = d.key_name
        AND lv.max_version = d.version
        AND d.map_name = ?
    )
    SELECT COUNT(*) as count
    FROM latest_operations lo
  `;

  const params: unknown[] = [args.mapName, args.mapName, args.mapName, args.mapName];

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
