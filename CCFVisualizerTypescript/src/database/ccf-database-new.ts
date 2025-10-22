// Database layer using @sqlite.org/sqlite-wasm with OPFS via Web Worker
// Handles persistent storage of parsed CCF ledger data

import { DatabaseWorkerClient } from './database-worker-client';
import type { Transaction, LedgerKeyValue, DatabaseTransaction } from '../types/ccf-types';
import { cborArrayToText } from '../parser/cose-cbor-to-text';

export interface DatabaseConfig {
  filename: string;
  useOpfs?: boolean;
}

const DecodeCborTables = [
  "public:scitt.entry",
];

export class CCFDatabase {
  private client: DatabaseWorkerClient | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.client = new DatabaseWorkerClient();
      await this.client.waitForReady();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  decodeWriteTransactionValue(value: Uint8Array, table?: string): string {
    let valueText = '';
    if (value && value.length > 0) {
      try {
        if (DecodeCborTables.includes(table || '')) {
          valueText = cborArrayToText(value);
        } else {
          valueText = new TextDecoder('utf-8', { fatal: false }).decode(value);
        }
      } catch {
        console.warn("Error decoding value for table:", table, value);
        valueText = '';
      }
    }
    return valueText;
  }

  private async exec(sql: string, bind?: unknown[]): Promise<Record<string, unknown>[]> {
    if (!this.client) throw new Error('Database not initialized');
    const results = await this.client.exec(sql, bind);
    return results as Record<string, unknown>[];
  }

  private async execBatch(statements: Array<{ sql: string; bind?: unknown[] }>): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');
    await this.client.execBatch(statements);
  }

  async insertLedgerFile(filename: string, fileSize: number): Promise<number> {
    if (!this.client) throw new Error('Database not initialized');
    await this.exec(`
      INSERT OR REPLACE INTO ledger_files (filename, file_size, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [filename, fileSize]);
    const result = await this.exec('SELECT last_insert_rowid() as id');
    return result[0].id as number;
  }

  async insertTransaction(fileId: number, transaction: Transaction): Promise<number> {
    const result = await this.insertTransactionBatch(fileId, [transaction]);
    return result[0];
  }

  async insertTransactionBatch(fileId: number, transactions: Transaction[]): Promise<number[]> {
    if (!this.client) throw new Error('Database not initialized');
    if (transactions.length === 0) return [];

    const txIds: number[] = [];

    // Process each transaction individually to get proper IDs
    for (const transaction of transactions) {
      const statements: Array<{ sql: string; bind?: unknown[] }> = [];

      // Insert transaction
      statements.push({
        sql: `
          INSERT INTO transactions (
            file_id, version, flags, size,
            entry_type, tx_version, max_conflict_version,
            tx_digest, transaction_id, tx_view
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        bind: [
          fileId,
          transaction.header.version,
          transaction.header.flags,
          transaction.header.size,
          transaction.publicDomain.entryType,
          transaction.publicDomain.txVersion,
          transaction.publicDomain.maxConflictVersion,
          transaction.txDigest,
          transaction.gcmHeader.view + '.' + transaction.publicDomain.txVersion,
          transaction.gcmHeader.view,
        ],
      });

      await this.execBatch(statements);

      // Get the inserted transaction ID
      const result = await this.exec('SELECT last_insert_rowid() as id');
      const txId = result[0].id as number;
      txIds.push(txId);

      // Now insert writes and deletes for this transaction
      const writeDeleteStatements: Array<{ sql: string; bind?: unknown[] }> = [];

      // Insert writes
      for (const write of transaction.publicDomain.writes) {
        const valueText = this.decodeWriteTransactionValue(write.value, write.mapName);
        writeDeleteStatements.push({
          sql: `
            INSERT INTO kv_writes (transaction_id, map_name, key_name, value_text, version)
            VALUES (?, ?, ?, ?, ?)
          `,
          bind: [txId, write.mapName || '', write.key, valueText, write.version],
        });
      }

      // Insert deletes
      for (const del of transaction.publicDomain.deletes) {
        writeDeleteStatements.push({
          sql: `
            INSERT INTO kv_deletes (transaction_id, map_name, key_name, version)
            VALUES (?, ?, ?, ?)
          `,
          bind: [txId, del.mapName || '', del.key, del.version],
        });
      }

      if (writeDeleteStatements.length > 0) {
        await this.execBatch(writeDeleteStatements);
      }
    }

    return txIds;
  }

  async getLedgerFiles(): Promise<Array<{
    id: number;
    filename: string;
    fileSize: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
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

    // Sort by ledger sequence
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

  async getTransactions(fileId: number, limit = 100, offset = 0): Promise<Array<{
    id: number;
    version: number;
    flags: number;
    size: number;
    entryType: number;
    txVersion: number;
    maxConflictVersion: number;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT 
        id, version, flags, 
        size, entry_type, tx_version, 
        max_conflict_version, 
        transaction_id as tx_id, 
        tx_view
      FROM transactions
      WHERE file_id = ?
      ORDER BY id
      LIMIT ? OFFSET ?
    `, [fileId, limit, offset]);

    return result.map((row) => ({
      id: row.id as number,
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

  async getFileTransactions(fileId: number, limit = 100, offset = 0, searchQuery?: string): Promise<Array<{
    id: number;
    fileId: number;
    fileName: string;
    version: number;
    flags: number;
    size: number;
    entryType: number;
    txVersion: number;
    maxConflictVersion: number;
    writeCount: number;
    deleteCount: number;
    mapName?: string;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    let sql = `
      SELECT DISTINCT
        t.id, t.file_id, f.filename, t.version, t.flags, t.size,
        t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id, tx_view,
        (SELECT COUNT(*) FROM kv_writes WHERE transaction_id = t.id) as write_count,
        (SELECT COUNT(*) FROM kv_deletes WHERE transaction_id = t.id) as delete_count,
        (SELECT map_name FROM kv_writes WHERE transaction_id = t.id LIMIT 1) as map_name
      FROM transactions t
      JOIN ledger_files f ON t.file_id = f.id
      WHERE t.file_id = ?
    `;

    const params: (string | number)[] = [fileId];

    if (searchQuery && searchQuery.trim()) {
      sql += ` AND (
        f.filename LIKE ? OR
        CAST(t.id AS TEXT) LIKE ? OR
        CAST(t.version AS TEXT) LIKE ? OR
        EXISTS (
          SELECT 1 FROM kv_writes kw 
          WHERE kw.transaction_id = t.id AND (kw.map_name LIKE ? OR kw.value_text LIKE ?)
        )
      )`;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY t.id LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await this.exec(sql, params);

    return result.map((row) => ({
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
      mapName: row.map_name as string || undefined,
    }));
  }

  async getFileTransactionsCount(fileId: number, searchQuery?: string): Promise<number> {
    if (!this.client) throw new Error('Database not initialized');

    let sql = `
      SELECT COUNT(*) as count 
      FROM transactions t
      JOIN ledger_files f ON t.file_id = f.id
      WHERE t.file_id = ?
    `;

    const params: (string | number)[] = [fileId];

    if (searchQuery && searchQuery.trim()) {
      sql += ` AND (
        f.filename LIKE ? OR
        CAST(t.id AS TEXT) LIKE ? OR
        CAST(t.version AS TEXT) LIKE ? OR
        EXISTS (
          SELECT 1 FROM kv_writes kw 
          WHERE kw.transaction_id = t.id AND (kw.map_name LIKE ? OR kw.value_text LIKE ?)
        )
      )`;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const result = await this.exec(sql, params);
    return result[0]?.count as number || 0;
  }

  async getTransactionWrites(transactionId: number): Promise<LedgerKeyValue[]> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT key_name, value_text, version, map_name
      FROM kv_writes
      WHERE transaction_id = ?
      ORDER BY map_name, key_name
    `, [transactionId]);

    return result.map((row) => ({
      key: row.key_name as string,
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : new Uint8Array(0),
      version: row.version as number,
      mapName: row.map_name as string,
    }));
  }

  async getTransactionDeletes(transactionId: number): Promise<LedgerKeyValue[]> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT key_name, version, map_name
      FROM kv_deletes
      WHERE transaction_id = ?
      ORDER BY map_name, key_name
    `, [transactionId]);

    return result.map((row) => ({
      key: row.key_name as string,
      value: new Uint8Array(0),
      version: row.version as number,
      mapName: row.map_name as string,
    }));
  }

  async getTransactionById(transactionId: number): Promise<DatabaseTransaction | null> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT t.id, t.file_id, lf.filename, t.version, t.flags,
        t.size, t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id, tx_view,
        (SELECT COUNT(*) FROM kv_writes WHERE transaction_id = t.id) as write_count,
        (SELECT COUNT(*) FROM kv_deletes WHERE transaction_id = t.id) as delete_count,
        lf.file_size
      FROM transactions t
      LEFT JOIN ledger_files lf ON t.file_id = lf.id
      WHERE t.id = ?
    `, [transactionId]);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as number,
      fileId: row.file_id as number,
      fileName: row.filename as string,
      sequenceNumber: 0,
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

  async searchByKey(keyName: string, limit = 50): Promise<Array<{
    transactionId: number;
    mapName: string;
    keyName: string;
    hasValue: boolean;
    version: number;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT 
        t.id, w.map_name, w.key_name, 1 as has_value, w.version
      FROM transactions t
      JOIN kv_writes w ON t.id = w.transaction_id
      WHERE w.key_name LIKE ?
      
      UNION ALL
      
      SELECT 
        t.id, d.map_name, d.key_name, 0 as has_value, d.version
      FROM transactions t
      JOIN kv_deletes d ON t.id = d.transaction_id
      WHERE d.key_name LIKE ?
      
      ORDER BY id
      LIMIT ?
    `, [`%${keyName}%`, `%${keyName}%`, limit]);

    return result.map((row) => ({
      transactionId: row.id as number,
      mapName: row.map_name as string,
      keyName: row.key_name as string,
      hasValue: row.has_value === 1,
      version: row.version as number,
    }));
  }

  async searchByKeyOrValue(query: string, limit = 50): Promise<Array<{
    transactionId: number;
    mapName: string;
    keyName: string;
    hasValue: boolean;
    version: number;
    matchType: 'key' | 'value';
    matchedText?: string;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    const searchPattern = `%${query}%`;

    const result = await this.exec(`
      SELECT 
        t.id, w.map_name, w.key_name, 1 as has_value, w.version, 'key' as match_type, w.key_name as matched_text
      FROM transactions t
      JOIN kv_writes w ON t.id = w.transaction_id
      WHERE w.key_name LIKE ?
      
      UNION ALL
      
      SELECT 
        t.id, w.map_name, w.key_name, 1 as has_value, w.version, 'value' as match_type, w.value_text as matched_text
      FROM transactions t
      JOIN kv_writes w ON t.id = w.transaction_id
      WHERE w.value_text IS NOT NULL AND w.value_text LIKE ? AND w.key_name NOT LIKE ?
      
      UNION ALL
      
      SELECT 
        t.id, d.map_name, d.key_name, 0 as has_value, d.version, 'key' as match_type, d.key_name as matched_text
      FROM transactions t
      JOIN kv_deletes d ON t.id = d.transaction_id
      WHERE d.key_name LIKE ?
      
      ORDER BY id
      LIMIT ?
    `, [searchPattern, searchPattern, searchPattern, searchPattern, limit]);

    return result.map((row) => ({
      transactionId: row.id as number,
      mapName: row.map_name as string,
      keyName: row.key_name as string,
      hasValue: row.has_value === 1,
      version: row.version as number,
      matchType: row.match_type as 'key' | 'value',
      matchedText: row.matched_text as string,
    }));
  }

  async save(): Promise<void> {
    // OPFS persistence is automatic with sqlite-wasm
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async getStats(): Promise<{
    fileCount: number;
    transactionCount: number;
    writeCount: number;
    deleteCount: number;
  }> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT 
        (SELECT COUNT(*) FROM ledger_files) as file_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COUNT(*) FROM kv_writes) as write_count,
        (SELECT COUNT(*) FROM kv_deletes) as delete_count
    `);

    if (result.length === 0) {
      return { fileCount: 0, transactionCount: 0, writeCount: 0, deleteCount: 0 };
    }

    const row = result[0];
    return {
      fileCount: row.file_count as number,
      transactionCount: row.transaction_count as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
    };
  }

  async getEnhancedStats(): Promise<{
    fileCount: number;
    transactionCount: number;
    writeCount: number;
    deleteCount: number;
    userWriteCount: number;
    tableCount: number;
    uniqueKeyCount: number;
    averageTransactionSize: number;
    largestTransactionSize: number;
    smallestTransactionSize: number;
    totalDataSize: number;
    oldestTransaction: Date | null;
    newestTransaction: Date | null;
  }> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT 
        (SELECT COUNT(*) FROM ledger_files) as file_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COUNT(*) FROM kv_writes) as write_count,
        (SELECT COUNT(*) FROM kv_deletes) as delete_count,
        (SELECT COUNT(*) FROM kv_writes WHERE map_name LIKE '%confidentialledger.logs%') as user_write_count,
        (SELECT COUNT(DISTINCT map_name) FROM (
          SELECT map_name FROM kv_writes
          UNION
          SELECT map_name FROM kv_deletes
        )) as table_count,
        (SELECT COUNT(DISTINCT key_name || map_name) FROM (
          SELECT key_name, map_name FROM kv_writes
          UNION
          SELECT key_name, map_name FROM kv_deletes
        )) as unique_key_count,
        (SELECT AVG(size) FROM transactions) as avg_transaction_size,
        (SELECT MAX(size) FROM transactions) as largest_transaction_size,
        (SELECT MIN(size) FROM transactions) as smallest_transaction_size,
        (SELECT SUM(file_size) FROM ledger_files) as total_data_size,
        (SELECT MIN(created_at) FROM transactions) as oldest_transaction,
        (SELECT MAX(created_at) FROM transactions) as newest_transaction
    `);

    if (result.length === 0) {
      return { 
        fileCount: 0, 
        transactionCount: 0, 
        writeCount: 0, 
        deleteCount: 0,
        userWriteCount: 0,
        tableCount: 0,
        uniqueKeyCount: 0,
        averageTransactionSize: 0,
        largestTransactionSize: 0,
        smallestTransactionSize: 0,
        totalDataSize: 0,
        oldestTransaction: null,
        newestTransaction: null,
      };
    }

    const row = result[0];
    return {
      fileCount: row.file_count as number,
      transactionCount: row.transaction_count as number,
      writeCount: row.write_count as number,
      deleteCount: row.delete_count as number,
      userWriteCount: row.user_write_count as number,
      tableCount: row.table_count as number,
      uniqueKeyCount: row.unique_key_count as number,
      averageTransactionSize: Math.round((row.avg_transaction_size as number) || 0),
      largestTransactionSize: row.largest_transaction_size as number,
      smallestTransactionSize: row.smallest_transaction_size as number,
      totalDataSize: row.total_data_size as number,
      oldestTransaction: row.oldest_transaction ? new Date(row.oldest_transaction as string) : null,
      newestTransaction: row.newest_transaction ? new Date(row.newest_transaction as string) : null,
    };
  }

  async deleteLedgerFile(fileId: number): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');
    await this.exec('DELETE FROM ledger_files WHERE id = ?', [fileId]);
  }

  async clearAllData(): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');

    await this.execBatch([
      { sql: 'DELETE FROM kv_deletes' },
      { sql: 'DELETE FROM kv_writes' },
      { sql: 'DELETE FROM transactions' },
      { sql: 'DELETE FROM ledger_files' },
      { sql: 'DELETE FROM sqlite_sequence WHERE name IN ("ledger_files", "transactions")' },
    ]);
  }

  async getAllTransactions(limit = 1000, offset = 0, searchQuery?: string): Promise<Array<{
    id: number;
    fileId: number;
    fileName: string;
    version: number;
    flags: number;
    size: number;
    entryType: number;
    txVersion: number;
    maxConflictVersion: number;
    writeCount: number;
    deleteCount: number;
    mapName?: string;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    let sql = `
      SELECT DISTINCT
        t.id, t.file_id, f.filename, t.version, t.flags, t.size,
        t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id, tx_view,
        (SELECT COUNT(*) FROM kv_writes WHERE transaction_id = t.id) as write_count,
        (SELECT COUNT(*) FROM kv_deletes WHERE transaction_id = t.id) as delete_count,
        (SELECT map_name FROM kv_writes WHERE transaction_id = t.id LIMIT 1) as map_name
      FROM transactions t
      JOIN ledger_files f ON t.file_id = f.id
    `;

    const params: unknown[] = [];

    if (searchQuery && searchQuery.trim()) {
      sql += `
        WHERE (
          f.filename LIKE ? OR
          EXISTS (
            SELECT 1 FROM kv_writes w WHERE w.transaction_id = t.id AND (w.key_name LIKE ? OR w.map_name LIKE ?)
          ) OR
          EXISTS (
            SELECT 1 FROM kv_deletes d WHERE d.transaction_id = t.id AND (d.key_name LIKE ? OR d.map_name LIKE ?)
          )
        )
      `;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += `
      ORDER BY t.file_id, t.id
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const result = await this.exec(sql, params);

    return result.map((row) => ({
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

  async getAllTransactionsCount(searchQuery?: string): Promise<number> {
    if (!this.client) throw new Error('Database not initialized');

    let sql = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM transactions t
      JOIN ledger_files f ON t.file_id = f.id
    `;

    const params: unknown[] = [];

    if (searchQuery && searchQuery.trim()) {
      sql += `
        WHERE (
          f.filename LIKE ? OR
          EXISTS (
            SELECT 1 FROM kv_writes w WHERE w.transaction_id = t.id AND (w.key_name LIKE ? OR w.map_name LIKE ?)
          ) OR
          EXISTS (
            SELECT 1 FROM kv_deletes d WHERE d.transaction_id = t.id AND (d.key_name LIKE ? OR d.map_name LIKE ?)
          )
        )
      `;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const result = await this.exec(sql, params);
    return result[0]?.total as number || 0;
  }

  async getCCFTables(): Promise<string[]> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT DISTINCT map_name
      FROM (
        SELECT map_name FROM kv_writes
        UNION
        SELECT map_name FROM kv_deletes
      ) AS all_maps
      ORDER BY map_name
    `);

    return result.map((row) => row.map_name as string);
  }

  async getTableKeyValues(mapName: string, limit = 100, offset = 0, searchQuery?: string): Promise<Array<{
    keyName: string;
    value: Uint8Array | null;
    version: number;
    transactionId: number;
    isDeleted: boolean;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    let sql = `
      SELECT 
        kv.key_name,
        kv.value_text,
        kv.version,
        kv.transaction_id,
        kv.is_deleted
      FROM (
        SELECT 
          key_name,
          value_text,
          version,
          transaction_id,
          0 as is_deleted
        FROM kv_writes
        WHERE map_name = ?
        UNION ALL
        SELECT 
          key_name,
          NULL as value_text,
          version,
          transaction_id,
          1 as is_deleted
        FROM kv_deletes
        WHERE map_name = ?
      ) AS kv
    `;

    const params: unknown[] = [mapName, mapName];

    if (searchQuery && searchQuery.trim()) {
      sql += `
        WHERE (
          kv.key_name LIKE ? OR
          (kv.value_text IS NOT NULL AND kv.value_text LIKE ?)
        )
      `;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += `
      ORDER BY kv.key_name, kv.version DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const result = await this.exec(sql, params);

    return result.map((row) => ({
      keyName: row.key_name as string,
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : null,
      version: row.version as number,
      transactionId: row.transaction_id as number,
      isDeleted: (row.is_deleted as number) === 1,
    }));
  }

  async getTableLatestState(mapName: string, limit = 100, offset = 0, searchQuery?: string): Promise<Array<{
    keyName: string;
    value: Uint8Array | null;
    version: number;
    transactionId: number;
    isDeleted: boolean;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

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
          COALESCE(w.transaction_id, d.transaction_id) as transaction_id,
          CASE WHEN d.transaction_id IS NOT NULL THEN 1 ELSE 0 END as is_deleted
        FROM latest_versions lv
        LEFT JOIN kv_writes w ON lv.key_name = w.key_name 
          AND lv.max_version = w.version 
          AND w.map_name = ?
        LEFT JOIN kv_deletes d ON lv.key_name = d.key_name 
          AND lv.max_version = d.version 
          AND d.map_name = ?
      )
      SELECT 
        lo.key_name,
        lo.value_text,
        lo.version,
        lo.transaction_id,
        lo.is_deleted
      FROM latest_operations lo
    `;

    const params: unknown[] = [mapName, mapName, mapName, mapName];

    if (searchQuery && searchQuery.trim()) {
      sql += `
        WHERE (
          lo.key_name LIKE ? OR
          (lo.value_text IS NOT NULL AND lo.value_text LIKE ?)
        )
      `;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += `
      ORDER BY lo.key_name
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const result = await this.exec(sql, params);

    return result.map((row) => ({
      keyName: row.key_name as string,
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : null,
      version: row.version as number,
      transactionId: row.transaction_id as number,
      isDeleted: (row.is_deleted as number) === 1,
    }));
  }

  async getTableLatestStateCount(mapName: string, searchQuery?: string): Promise<number> {
    if (!this.client) throw new Error('Database not initialized');

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
          COALESCE(w.transaction_id, d.transaction_id) as transaction_id,
          CASE WHEN d.transaction_id IS NOT NULL THEN 1 ELSE 0 END as is_deleted
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

    const params: unknown[] = [mapName, mapName, mapName, mapName];

    if (searchQuery && searchQuery.trim()) {
      sql += `
        WHERE (
          lo.key_name LIKE ? OR
          (lo.value_text IS NOT NULL AND lo.value_text LIKE ?)
        )
      `;
      const searchPattern = `%${searchQuery.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    const result = await this.exec(sql, params);
    return result[0]?.count as number || 0;
  }

  async getKeyTransactions(mapName: string, keyName: string, limit = 50, offset = 0): Promise<Array<{
    transactionId: number;
    version: number;
    operationType: 'write' | 'delete';
    value: Uint8Array | null;
    fileName: string;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`
      SELECT 
        ops.transaction_id,
        ops.version,
        ops.operation_type,
        ops.value_text,
        f.filename
      FROM (
        SELECT 
          transaction_id,
          version,
          'write' as operation_type,
          value_text
        FROM kv_writes
        WHERE map_name = ? AND key_name = ?
        UNION ALL
        SELECT 
          transaction_id,
          version,
          'delete' as operation_type,
          NULL as value_text
        FROM kv_deletes
        WHERE map_name = ? AND key_name = ?
      ) AS ops
      JOIN transactions t ON ops.transaction_id = t.id
      JOIN ledger_files f ON t.file_id = f.id
      ORDER BY ops.version DESC
      LIMIT ? OFFSET ?
    `, [mapName, keyName, mapName, keyName, limit, offset]);

    return result.map((row) => ({
      transactionId: row.transaction_id as number,
      version: row.version as number,
      operationType: row.operation_type as 'write' | 'delete',
      value: row.value_text ? new TextEncoder().encode(row.value_text as string) : null,
      fileName: row.filename as string,
    }));
  }

  async dropDatabase(): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');

    await this.execBatch([
      { sql: 'DROP TABLE IF EXISTS kv_deletes' },
      { sql: 'DROP TABLE IF EXISTS kv_writes' },
      { sql: 'DROP TABLE IF EXISTS transactions' },
      { sql: 'DROP TABLE IF EXISTS ledger_files' },
      { sql: 'DROP INDEX IF EXISTS idx_transactions_file_id' },
      { sql: 'DROP INDEX IF EXISTS idx_kv_writes_transaction_id' },
      { sql: 'DROP INDEX IF EXISTS idx_kv_writes_map_key' },
      { sql: 'DROP INDEX IF EXISTS idx_kv_writes_value_text' },
      { sql: 'DROP INDEX IF EXISTS idx_kv_deletes_transaction_id' },
      { sql: 'DROP INDEX IF EXISTS idx_kv_deletes_map_key' },
      { sql: 'DELETE FROM sqlite_sequence' },
    ]);
  }

  async checkIntegrity(): Promise<boolean> {
    if (!this.client) throw new Error('Database not initialized');

    try {
      const result = await this.exec('PRAGMA integrity_check');
      
      if (result.length === 0) return true;
      
      const firstRow = result[0];
      const integrityResult = Object.values(firstRow)[0] as string;
      
      return integrityResult === 'ok';
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }

  async resetDatabase(): Promise<void> {
    await this.clearAllData();
  }

  async getDatabaseSettings(): Promise<{
    journalMode: string;
    cacheSize: number;
    tempStore: string;
    mmapSize: number;
    pageSize: number;
  }> {
    if (!this.client) throw new Error('Database not initialized');

    const settings = {
      journalMode: 'unknown',
      cacheSize: 0,
      tempStore: 'unknown',
      mmapSize: 0,
      pageSize: 0,
    };

    try {
      const journalResult = await this.exec('PRAGMA journal_mode');
      settings.journalMode = Object.values(journalResult[0] || {})[0] as string || 'unknown';

      const cacheResult = await this.exec('PRAGMA cache_size');
      settings.cacheSize = Object.values(cacheResult[0] || {})[0] as number || 0;

      const tempResult = await this.exec('PRAGMA temp_store');
      settings.tempStore = Object.values(tempResult[0] || {})[0] as string || 'unknown';

      const mmapResult = await this.exec('PRAGMA mmap_size');
      settings.mmapSize = Object.values(mmapResult[0] || {})[0] as number || 0;

      const pageResult = await this.exec('PRAGMA page_size');
      settings.pageSize = Object.values(pageResult[0] || {})[0] as number || 0;
    } catch (error) {
      console.warn('Failed to read database settings:', error);
    }

    return settings;
  }

  async getTransactionsWithRelated(start: number, limit: number): Promise<Array<{
    txId: number;
    txHash: Uint8Array;
    tables: Array<{
      storeName: string;
      value: string;
    }>;
  }>> {
    if (!this.client) throw new Error('Database not initialized');

    const transactionResult = await this.exec(`
      SELECT id, tx_digest
      FROM transactions
      ORDER BY id
      LIMIT ? OFFSET ?
    `, [limit, start]);

    const result: Array<{
      txId: number;
      txHash: Uint8Array;
      tables: Array<{
        storeName: string;
        value: string;
      }>;
    }> = [];

    for (const tx of transactionResult) {
      const txId = tx.id as number;
      const txHash = new Uint8Array(tx.tx_digest as ArrayBuffer);

      const writesResult = await this.exec(`
        SELECT map_name, value_text
        FROM kv_writes
        WHERE transaction_id = ? AND value_text IS NOT NULL
      `, [txId]);

      const tables: Array<{ storeName: string; value: string }> = writesResult.map(row => ({
        storeName: row.map_name as string,
        value: row.value_text as string,
      }));

      result.push({
        txId,
        txHash,
        tables,
      });
    }

    return result;
  }

  async getTotalTransactionsCount(): Promise<number> {
    if (!this.client) throw new Error('Database not initialized');

    const result = await this.exec(`SELECT COUNT(*) as count FROM transactions`);
    return result[0]?.count as number || 0;
  }

  async executeQuery(sqlQuery: string): Promise<unknown[]> {
    if (!this.client) throw new Error('Database not initialized');

    const trimmedQuery = sqlQuery.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed for security reasons');
    }

    try {
      return await this.exec(sqlQuery);
    } catch (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
  }
}
