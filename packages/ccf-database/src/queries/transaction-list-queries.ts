/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

export interface TransactionListRow {
  id: number;
  fileId: number;
  fileName: string;
  version: number;
  flags: number;
  size: number;
  entryType: number;
  txVersion: number;
  maxConflictVersion: number;
  txId: string;
  txView: number;
  writeCount: number;
  deleteCount: number;
  mapName?: string;
}

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

/**
 * Shared select list used by both file-scoped and global transaction lists.
 * Kept as a string literal so it stays easy to diff/review.
 */
const BASE_SELECT = `
  SELECT DISTINCT
    t.sequence_no as id, t.file_id, f.filename, t.version, t.flags, t.size,
    t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id, tx_view,
    (SELECT COUNT(*) FROM kv_writes WHERE sequence_no = t.sequence_no) as write_count,
    (SELECT COUNT(*) FROM kv_deletes WHERE sequence_no = t.sequence_no) as delete_count,
    (SELECT GROUP_CONCAT(DISTINCT map_name) FROM (
      SELECT map_name FROM kv_writes WHERE sequence_no = t.sequence_no
      UNION
      SELECT map_name FROM kv_deletes WHERE sequence_no = t.sequence_no
    )) as map_names
  FROM transactions t
  JOIN ledger_files f ON t.file_id = f.id
`;

export function buildFileTransactionsListQuery(args: {
  fileId: number;
  limit: number;
  offset: number;
  searchQuery?: string;
}): { sql: string; params: Array<string | number> } {
  let sql = `${BASE_SELECT}  WHERE t.file_id = ?\n`;
  const params: Array<string | number> = [args.fileId];

  if (args.searchQuery && args.searchQuery.trim()) {
    sql += ` AND (\n`;
    sql += `  f.filename LIKE ? OR\n`;
    sql += `  CAST(t.sequence_no AS TEXT) LIKE ? OR\n`;
    sql += `  CAST(t.version AS TEXT) LIKE ? OR\n`;
    sql += `  EXISTS (\n`;
    sql += `    SELECT 1 FROM kv_writes kw\n`;
    sql += `    WHERE kw.sequence_no = t.sequence_no AND (kw.map_name LIKE ? OR kw.value_text LIKE ?)\n`;
    sql += `  )\n`;
    sql += `)\n`;

    const p = likePattern(args.searchQuery);
    params.push(p, p, p, p, p);
  }

  sql += ` ORDER BY t.sequence_no LIMIT ? OFFSET ?`;
  params.push(args.limit, args.offset);

  return { sql, params };
}

export function buildFileTransactionsCountQuery(args: {
  fileId: number;
  searchQuery?: string;
}): { sql: string; params: Array<string | number> } {
  let sql = `
    SELECT COUNT(*) as count
    FROM transactions t
    JOIN ledger_files f ON t.file_id = f.id
    WHERE t.file_id = ?
  `;

  const params: Array<string | number> = [args.fileId];

  if (args.searchQuery && args.searchQuery.trim()) {
    sql += ` AND (\n`;
    sql += `  f.filename LIKE ? OR\n`;
    sql += `  CAST(t.sequence_no AS TEXT) LIKE ? OR\n`;
    sql += `  CAST(t.version AS TEXT) LIKE ? OR\n`;
    sql += `  EXISTS (\n`;
    sql += `    SELECT 1 FROM kv_writes kw\n`;
    sql += `    WHERE kw.sequence_no = t.sequence_no AND (kw.map_name LIKE ? OR kw.value_text LIKE ?)\n`;
    sql += `  )\n`;
    sql += `)\n`;

    const p = likePattern(args.searchQuery);
    params.push(p, p, p, p, p);
  }

  return { sql, params };
}

export function buildAllTransactionsListQuery(args: {
  limit: number;
  offset: number;
  searchQuery?: string;
}): { sql: string; params: unknown[] } {
  let sql = `${BASE_SELECT}`;
  const params: unknown[] = [];

  if (args.searchQuery && args.searchQuery.trim()) {
    sql += ` WHERE (\n`;
    sql += `  f.filename LIKE ? OR\n`;
    sql += `  EXISTS (\n`;
    sql += `    SELECT 1 FROM kv_writes w WHERE w.sequence_no = t.sequence_no AND (w.key_name LIKE ? OR w.map_name LIKE ?)\n`;
    sql += `  ) OR\n`;
    sql += `  EXISTS (\n`;
    sql += `    SELECT 1 FROM kv_deletes d WHERE d.sequence_no = t.sequence_no AND (d.key_name LIKE ? OR d.map_name LIKE ?)\n`;
    sql += `  )\n`;
    sql += `)\n`;

    const p = likePattern(args.searchQuery);
    params.push(p, p, p, p, p);
  }

  sql += ` ORDER BY t.file_id, t.sequence_no LIMIT ? OFFSET ?`;
  params.push(args.limit, args.offset);

  return { sql, params };
}

export function buildAllTransactionsCountQuery(args: {
  searchQuery?: string;
}): { sql: string; params: unknown[] } {
  let sql = `
    SELECT COUNT(DISTINCT t.sequence_no) as total
    FROM transactions t
    JOIN ledger_files f ON t.file_id = f.id
  `;

  const params: unknown[] = [];

  if (args.searchQuery && args.searchQuery.trim()) {
    sql += ` WHERE (\n`;
    sql += `  f.filename LIKE ? OR\n`;
    sql += `  EXISTS (\n`;
    sql += `    SELECT 1 FROM kv_writes w WHERE w.sequence_no = t.sequence_no AND (w.key_name LIKE ? OR w.map_name LIKE ?)\n`;
    sql += `  ) OR\n`;
    sql += `  EXISTS (\n`;
    sql += `    SELECT 1 FROM kv_deletes d WHERE d.sequence_no = t.sequence_no AND (d.key_name LIKE ? OR d.map_name LIKE ?)\n`;
    sql += `  )\n`;
    sql += `)\n`;

    const p = likePattern(args.searchQuery);
    params.push(p, p, p, p, p);
  }

  return { sql, params };
}
