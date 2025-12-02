/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import type { DatabaseWorkerClient } from '../worker/worker-client';

/**
 * Insert a ledger file record into the database
 * If the file already exists, update its size and timestamp
 */
export async function insertLedgerFile(
  exec: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>,
  filename: string,
  fileSize: number
): Promise<number> {
  // Check if file already exists
  const existing = await exec(
    'SELECT id FROM ledger_files WHERE filename = ?',
    [filename]
  );
  
  if (existing.length > 0) {
    // Update existing file
    const fileId = existing[0].id as number;
    await exec(`
      UPDATE ledger_files 
      SET file_size = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [fileSize, fileId]);
    return fileId;
  }
  
  // Insert new file
  await exec(`
    INSERT INTO ledger_files (filename, file_size, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `, [filename, fileSize]);
  
  const result = await exec('SELECT last_insert_rowid() as id');
  return result[0].id as number;
}

/**
 * Insert a ledger file with its data using transferable ArrayBuffer
 * This is optimized for large files by processing in the worker
 */
export async function insertLedgerFileWithData(
  client: DatabaseWorkerClient,
  filename: string,
  fileSize: number,
  arrayBuffer: ArrayBuffer
): Promise<{ fileId: number; transactionCount: number }> {
  return await client.insertLedgerFile(filename, fileSize, arrayBuffer);
}

/**
 * Get all ledger files sorted by sequence number
 */
export async function getLedgerFiles(
  exec: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>
): Promise<Array<{
  id: number;
  filename: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}>> {
  const result = await exec(`
    SELECT id, filename, file_size, created_at, updated_at
    FROM ledger_files
    ORDER BY filename ASC
  `);

  const files = result.map((row) => ({
    id: row.id as number,
    filename: row.filename as string,
    fileSize: row.file_size as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  // Sort by ledger sequence (extract start number from filename)
  return files.sort((a, b) => {
    const parseFilename = (filename: string) => {
      const regex = /^ledger_(\d+)-(\d+)\.committed$/;
      const match = filename.match(regex);
      return match ? parseInt(match[1], 10) : 999999;
    };
    
    const aStart = parseFilename(a.filename);
    const bStart = parseFilename(b.filename);
    return aStart - bStart;
  });
}

/**
 * Delete a ledger file and all its associated transactions (cascade delete)
 */
export async function deleteLedgerFile(
  exec: (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>,
  fileId: number
): Promise<void> {
  await exec('DELETE FROM ledger_files WHERE id = ?', [fileId]);
}

/**
 * Clear all data from the database (all tables)
 */
export async function clearAllData(
  execBatch: (statements: Array<{ sql: string; bind?: unknown[] }>) => Promise<void>
): Promise<void> {
  await execBatch([
    { sql: 'DELETE FROM kv_deletes' },
    { sql: 'DELETE FROM kv_writes' },
    { sql: 'DELETE FROM transactions' },
    { sql: 'DELETE FROM ledger_files' },
    { sql: 'DELETE FROM sqlite_sequence WHERE name IN ("ledger_files", "transactions")' },
  ]);
}
