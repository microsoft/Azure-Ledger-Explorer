/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { BaseRepository } from './base-repository';

/**
 * Ledger file record returned from the database
 */
export interface LedgerFile {
  id: number;
  filename: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repository for ledger file operations
 */
export class FileRepository extends BaseRepository {
  /**
   * Insert a new ledger file or update if it already exists.
   * Returns the file ID.
   */
  async insert(filename: string, fileSize: number): Promise<number> {
    // Check if file already exists
    const existing = await this.exec(
      'SELECT id FROM ledger_files WHERE filename = ?',
      [filename]
    );

    if (existing.length > 0) {
      const fileId = existing[0].id as number;
      await this.exec(
        `UPDATE ledger_files 
         SET file_size = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [fileSize, fileId]
      );
      return fileId;
    }

    // Insert new file
    await this.exec(
      `INSERT INTO ledger_files (filename, file_size, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [filename, fileSize]
    );

    const result = await this.exec('SELECT last_insert_rowid() as id');
    return result[0].id as number;
  }

  /**
   * Get all ledger files sorted by sequence number extracted from filename.
   */
  async getAll(): Promise<LedgerFile[]> {
    const result = await this.exec(`
      SELECT id, filename, file_size, created_at, updated_at
      FROM ledger_files
      ORDER BY filename ASC
    `);

    const files = result.map(row => ({
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

      return parseFilename(a.filename) - parseFilename(b.filename);
    });
  }

  /**
   * Delete a ledger file by ID.
   * CASCADE deletes will remove associated transactions/writes/deletes.
   */
  async delete(fileId: number): Promise<void> {
    await this.exec('DELETE FROM ledger_files WHERE id = ?', [fileId]);
  }
}
