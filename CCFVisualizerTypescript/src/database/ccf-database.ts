// Database layer using sql.js with OPFS VFS
// Handles persistent storage of parsed CCF ledger data

import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
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
  private db: Database | null = null;
  private sql: SqlJsStatic | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize the database with sql.js and OPFS VFS
   */
  async initialize(): Promise<void> {
    try {
      // Initialize sql.js with OPFS VFS support
      this.sql = await initSqlJs({
        locateFile: (file) => `https://sql.js.org/dist/${file}`,
      });

      // Create or open database
      if (this.config.useOpfs && navigator.storage && navigator.storage.getDirectory) {
        // Use OPFS for persistent storage
        const opfsRoot = await navigator.storage.getDirectory();
        try {
          const fileHandle = await opfsRoot.getFileHandle(this.config.filename);
          const file = await fileHandle.getFile();
          const buffer = await file.arrayBuffer();
          this.db = new this.sql.Database(new Uint8Array(buffer));
        } catch {
          // File doesn't exist, create new database
          this.db = new this.sql.Database();
        }
      } else {
        // Use in-memory database
        this.db = new this.sql.Database();
      }

      // Create tables if they don't exist
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create database tables for CCF ledger data
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createTablesSQL = `
      -- Ledger files table
      CREATE TABLE IF NOT EXISTS ledger_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        file_size INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        flags INTEGER NOT NULL,
        size INTEGER NOT NULL,
        entry_type INTEGER NOT NULL,
        tx_version INTEGER NOT NULL,
        max_conflict_version INTEGER,
        tx_digest BLOB,
        transaction_id STRING,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES ledger_files(id) ON DELETE CASCADE
      );

      -- Key-value pairs table for writes
      CREATE TABLE IF NOT EXISTS kv_writes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        map_name TEXT NOT NULL,
        key_name TEXT NOT NULL,
        value_text TEXT, -- UTF-8 decoded value (removed BLOB value field)
        version INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );

      -- Key-value pairs table for deletes
      CREATE TABLE IF NOT EXISTS kv_deletes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        map_name TEXT NOT NULL,
        key_name TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );

      -- Indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON transactions(file_id);
      CREATE INDEX IF NOT EXISTS idx_kv_writes_transaction_id ON kv_writes(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_kv_writes_map_key ON kv_writes(map_name, key_name);
      -- CREATE INDEX IF NOT EXISTS idx_kv_writes_value_text ON kv_writes(value_text);
      CREATE INDEX IF NOT EXISTS idx_kv_deletes_transaction_id ON kv_deletes(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_kv_deletes_map_key ON kv_deletes(map_name, key_name);
    `;

    this.db.exec(createTablesSQL);
    
    // Optimize database for extreme memory conservation
    // this.db.exec(`
    //   PRAGMA journal_mode = DELETE;     -- Use DELETE mode instead of WAL to reduce memory
    //   PRAGMA synchronous = OFF;         -- Faster but less safe, ok for our use case
    //   PRAGMA cache_size = -1000;        -- Only 1MB cache to minimize memory usage
    //   PRAGMA temp_store = FILE;         -- Use disk for temp storage instead of memory
    //   PRAGMA mmap_size = 0;             -- Disable mmap to prevent large memory allocations
    //   PRAGMA page_size = 1024;          -- Smaller pages to reduce memory pressure
    //   PRAGMA locking_mode = EXCLUSIVE;  -- Faster since we're single-threaded
    //   PRAGMA auto_vacuum = INCREMENTAL; -- Help reclaim space
    //   PRAGMA max_page_count = 1000000;  -- Limit total database size
    //   PRAGMA default_cache_size = 1000; -- Default small cache
    // `);
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

  /**
   * Insert a ledger file record
   */
  async insertLedgerFile(filename: string, fileSize: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ledger_files (filename, file_size, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run([filename, fileSize]);
    stmt.free();

    // Get the file ID
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  /**
   * Insert a transaction with its key-value pairs (optimized for single transactions)
   */
  async insertTransaction(
    fileId: number,
    transaction: Transaction
  ): Promise<number> {
    // For single transactions, use the batch method for consistency
    const result = await this.insertTransactionBatch(fileId, [transaction]);
    //const result = await this.insertTransactionSafe(fileId, transaction);
    return result[0];
  }

  /**
   * Insert multiple transactions in a single database transaction (memory-optimized)
   */
  async insertTransactionBatch(fileId: number, transactions: Transaction[]): Promise<number[]> {
    if (!this.db) throw new Error('Database not initialized');
    if (transactions.length === 0) return [];

    const txIds: number[] = [];

    try {
      // Begin large transaction
      this.db.exec('BEGIN IMMEDIATE TRANSACTION');

      // Prepare statements once for the batch
      const txStmt = this.db.prepare(`
        INSERT INTO transactions (
          file_id, version, flags, size,
          entry_type, tx_version, max_conflict_version,
          tx_digest, transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const writeStmt = this.db.prepare(`
        INSERT INTO kv_writes (transaction_id, map_name, key_name, value_text, version)
        VALUES (?, ?, ?, ?, ?)
      `);

      const deleteStmt = this.db.prepare(`
        INSERT INTO kv_deletes (transaction_id, map_name, key_name, version)
        VALUES (?, ?, ?, ?)
      `);

      // Process transactions one by one to avoid large memory allocations
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];

        // Insert transaction immediately
        txStmt.run([
          fileId,
          transaction.header.version,
          transaction.header.flags,
          transaction.header.size,
          transaction.publicDomain.entryType,
          transaction.publicDomain.txVersion,
          transaction.publicDomain.maxConflictVersion,
          transaction.txDigest,
          transaction.gcmHeader.view + '.' + transaction.gcmHeader.seqNo,
        ]);

        const txId = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
        txIds.push(txId);

        // Insert writes immediately
        for (const write of transaction.publicDomain.writes) {
          const valueText = this.decodeWriteTransactionValue(write.value, write.mapName);
          writeStmt.run([
            txId,
            write.mapName || '', // Use mapName from individual write
            write.key,
            valueText,
            write.version,
          ]);
        }

        // Insert deletes immediately
        for (const del of transaction.publicDomain.deletes) {
          deleteStmt.run([
            txId,
            del.mapName || '', // Use mapName from individual delete
            del.key,
            del.version,
          ]);
        }
      }

      // Clean up statements
      txStmt.free();
      writeStmt.free();
      deleteStmt.free();

      // Commit the large transaction
      this.db.exec('COMMIT');
      return txIds;
    } catch (error) {
      // Rollback on error
      try {
        this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.warn('Failed to rollback batch transaction:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Insert a single transaction without batching (maximum memory safety)
   */
  async insertTransactionSafe(
    fileId: number,
    transaction: Transaction
  ): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    let txId: number;

    try {
      // Insert transaction
      const txStmt = this.db.prepare(`
        INSERT INTO transactions (
          file_id, version, flags, size,
          entry_type, tx_version, max_conflict_version,
          tx_digest, transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      txStmt.run([
        fileId,
        transaction.header.version,
        transaction.header.flags,
        transaction.header.size,
        transaction.publicDomain.entryType,
        transaction.publicDomain.txVersion,
        transaction.publicDomain.maxConflictVersion,
        transaction.txDigest,
        transaction.gcmHeader.view + '.' + transaction.gcmHeader.seqNo,
      ]);
      txStmt.free();

      txId = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;

      // Insert writes one by one
      const writeStmt = this.db.prepare(`
        INSERT INTO kv_writes (transaction_id, map_name, key_name, value_text, version)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const write of transaction.publicDomain.writes) {
        const valueText = this.decodeWriteTransactionValue(write.value, write.mapName);
        writeStmt.run([
          txId,
          write.mapName || '', // Use mapName from individual write
          write.key,
          valueText,
          write.version,
        ]);
      }
      writeStmt.free();

      // Insert deletes one by one
      const deleteStmt = this.db.prepare(`
        INSERT INTO kv_deletes (transaction_id, map_name, key_name, version)
        VALUES (?, ?, ?, ?)
      `);

      for (const del of transaction.publicDomain.deletes) {
        deleteStmt.run([
          txId,
          del.mapName || '', // Use mapName from individual delete
          del.key,
          del.version,
        ]);
      }
      deleteStmt.free();

      return txId;
    } catch (error) {
      console.error('Failed to insert transaction safely:', error);
      throw error;
    }
  }

  /**
   * Get all ledger files sorted by ledger sequence
   */
  async getLedgerFiles(): Promise<Array<{
    id: number;
    filename: string;
    fileSize: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
      SELECT id, filename, file_size, created_at, updated_at
      FROM ledger_files
      ORDER BY filename ASC
    `);

    if (result.length === 0) return [];

    const files = result[0].values.map((row: unknown[]) => ({
      id: row[0] as number,
      filename: row[1] as string,
      fileSize: row[2] as number,
      createdAt: row[3] as string,
      updatedAt: row[4] as string,
    }));

    // Sort by ledger sequence using the parseLedgerFilename function
    return files.sort((a, b) => {
      const parseFilename = (filename: string) => {
        const regex = /^ledger_(\d+)-(\d+)\.committed$/;
        const match = filename.match(regex);
        return match ? parseInt(match[1], 10) : 999999; // Invalid files go to end
      };
      
      const aStart = parseFilename(a.filename);
      const bStart = parseFilename(b.filename);
      return aStart - bStart;
    });
  }

  /**
   * Get transactions for a specific file
   */
  async getTransactions(fileId: number, limit = 100, offset = 0): Promise<Array<{
    id: number;
    version: number;
    flags: number;
    size: number;
    entryType: number;
    txVersion: number;
    maxConflictVersion: number;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
      SELECT 
  id, version, flags, size,
  entry_type, tx_version, max_conflict_version, transaction_id as tx_id
      FROM transactions
      WHERE file_id = ?
      ORDER BY id
      LIMIT ? OFFSET ?
    `, [fileId, limit, offset]);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      id: row[0] as number,
      version: row[1] as number,
      flags: row[2] as number,
      size: row[3] as number,
      entryType: row[4] as number,
      txVersion: row[5] as number,
      maxConflictVersion: row[6] as number,
      txId: row[7] as string,
    }));
  }

  /**
   * Get transactions for a specific file with full structure
   */
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
    if (!this.db) throw new Error('Database not initialized');

    let sql = `
      SELECT DISTINCT
  t.id, t.file_id, f.filename, t.version, t.flags, t.size,
  t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id,
        (SELECT COUNT(*) FROM kv_writes WHERE transaction_id = t.id) as write_count,
        (SELECT COUNT(*) FROM kv_deletes WHERE transaction_id = t.id) as delete_count,
        (SELECT map_name FROM kv_writes WHERE transaction_id = t.id LIMIT 1) as map_name
      FROM transactions t
      JOIN ledger_files f ON t.file_id = f.id
      WHERE t.file_id = ?
    `;

    const params: (string | number)[] = [fileId];

    // Add search filtering if provided
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

    const result = this.db.exec(sql, params);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      id: row[0] as number,
      fileId: row[1] as number,
      fileName: row[2] as string,
      version: row[3] as number,
      flags: row[4] as number,
      size: row[5] as number,
      entryType: row[6] as number,
      txVersion: row[7] as number,
      maxConflictVersion: row[8] as number,
      txId: row[9] as string,
      writeCount: row[10] as number,
      deleteCount: row[11] as number,
      mapName: row[12] as string || undefined,
    }));
  }

  /**
   * Get total count of transactions for a specific file
   */
  async getFileTransactionsCount(fileId: number, searchQuery?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = `
      SELECT COUNT(*) as count 
      FROM transactions t
      JOIN ledger_files f ON t.file_id = f.id
      WHERE t.file_id = ?
    `;

    const params: (string | number)[] = [fileId];

    // Add search filtering if provided
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

    const result = this.db.exec(sql, params);

    if (result.length === 0 || result[0].values.length === 0) return 0;

    return result[0].values[0][0] as number;
  }

  /**
   * Get key-value writes for a transaction
   */
  async getTransactionWrites(transactionId: number): Promise<LedgerKeyValue[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
      SELECT key_name, value_text, version, map_name
      FROM kv_writes
      WHERE transaction_id = ?
      ORDER BY map_name, key_name
    `, [transactionId]);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      key: row[0] as string,
      value: row[1] ? new TextEncoder().encode(row[1] as string) : new Uint8Array(0),
      version: row[2] as number,
      mapName: row[3] as string,
    }));
  }

  /**
   * Get key-value deletes for a transaction
   */
  async getTransactionDeletes(transactionId: number): Promise<LedgerKeyValue[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
      SELECT key_name, version, map_name
      FROM kv_deletes
      WHERE transaction_id = ?
      ORDER BY map_name, key_name
    `, [transactionId]);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      key: row[0] as string,
      value: new Uint8Array(0),
      version: row[1] as number,
      mapName: row[2] as string,
    }));
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(transactionId: number): Promise<DatabaseTransaction | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
      SELECT t.id, t.file_id, lf.filename, t.version, t.flags,
        t.size, t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id,
             (SELECT COUNT(*) FROM kv_writes WHERE transaction_id = t.id) as write_count,
             (SELECT COUNT(*) FROM kv_deletes WHERE transaction_id = t.id) as delete_count,
             lf.file_size
      FROM transactions t
      LEFT JOIN ledger_files lf ON t.file_id = lf.id
      WHERE t.id = ?
    `, [transactionId]);

    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: row[0] as number,
      fileId: row[1] as number,
      fileName: row[2] as string,
      sequenceNumber: 0, // No longer stored, use 0 as placeholder
      version: row[3] as number,
      flags: row[4] as number,
      size: row[5] as number,
      entryType: row[6] as number,
      txVersion: row[7] as number,
      maxConflictVersion: row[8] as number,
      txId: row[9] as string,
      writeCount: row[10] as number,
      deleteCount: row[11] as number,
      fileSize: row[12] as number,
    };
  }

  /**
   * Search for transactions by key name
   */
  async searchByKey(keyName: string, limit = 50): Promise<Array<{
    transactionId: number;
    mapName: string;
    keyName: string;
    hasValue: boolean;
    version: number;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
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
      
      ORDER BY transactionId
      LIMIT ?
    `, [`%${keyName}%`, `%${keyName}%`, limit]);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      transactionId: row[0] as number,
      mapName: row[1] as string,
      keyName: row[2] as string,
      hasValue: row[3] === 1,
      version: row[4] as number,
    }));
  }

  /**
   * Search for transactions by key name or value content
   */
  async searchByKeyOrValue(query: string, limit = 50): Promise<Array<{
    transactionId: number;
    mapName: string;
    keyName: string;
    hasValue: boolean;
    version: number;
    matchType: 'key' | 'value';
    matchedText?: string;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const searchPattern = `%${query}%`;

    const result = this.db.exec(`
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
      
      ORDER BY transactionId
      LIMIT ?
    `, [searchPattern, searchPattern, searchPattern, searchPattern, limit]);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      transactionId: row[0] as number,
      mapName: row[1] as string,
      keyName: row[2] as string,
      hasValue: row[3] === 1,
      version: row[4] as number,
      matchType: row[5] as 'key' | 'value',
      matchedText: row[6] as string,
    }));
  }

  /**
   * Save database to OPFS
   */
  async save(): Promise<void> {
    if (!this.db || !this.config.useOpfs) return;

    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const fileHandle = await opfsRoot.getFileHandle(this.config.filename, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      
      const data = this.db.export();
  // Cast to ArrayBuffer for FS writer to avoid TS mismatch with SharedArrayBuffer union
  await writable.write(data.buffer as ArrayBuffer);
      await writable.close();
    } catch (error) {
      console.error('Failed to save database to OPFS:', error);
      throw error;
    }
  }

  /**
   * Close the database
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.save();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    fileCount: number;
    transactionCount: number;
    writeCount: number;
    deleteCount: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
      SELECT 
        (SELECT COUNT(*) FROM ledger_files) as file_count,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COUNT(*) FROM kv_writes) as write_count,
        (SELECT COUNT(*) FROM kv_deletes) as delete_count
    `);

    if (result.length === 0) {
      return { fileCount: 0, transactionCount: 0, writeCount: 0, deleteCount: 0 };
    }

    const row = result[0].values[0];
    return {
      fileCount: row[0] as number,
      transactionCount: row[1] as number,
      writeCount: row[2] as number,
      deleteCount: row[3] as number,
    };
  }

  /**
   * Get enhanced database statistics including user writes and other metrics
   */
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
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`
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

    const row = result[0].values[0];
    return {
      fileCount: row[0] as number,
      transactionCount: row[1] as number,
      writeCount: row[2] as number,
      deleteCount: row[3] as number,
      userWriteCount: row[4] as number,
      tableCount: row[5] as number,
      uniqueKeyCount: row[6] as number,
      averageTransactionSize: Math.round((row[7] as number) || 0),
      largestTransactionSize: row[8] as number,
      smallestTransactionSize: row[9] as number,
      totalDataSize: row[10] as number,
      oldestTransaction: row[11] ? new Date(row[11] as string) : null,
      newestTransaction: row[12] ? new Date(row[12] as string) : null,
    };
  }

  /**
   * Delete a ledger file and all its associated data
   */
  async deleteLedgerFile(fileId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Delete the file and all associated data (cascade deletes will handle transactions, writes, deletes)
    const stmt = this.db.prepare('DELETE FROM ledger_files WHERE id = ?');
    stmt.run([fileId]);
    stmt.free();

    // Save changes to OPFS
    await this.save();
  }

  /**
   * Clear all data from the database (all files, transactions, writes, deletes)
   */
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Delete all data from all tables (in correct order to respect foreign keys)
    this.db.exec('DELETE FROM kv_deletes');
    this.db.exec('DELETE FROM kv_writes');
    this.db.exec('DELETE FROM transactions');
    this.db.exec('DELETE FROM ledger_files');

    // Reset auto-increment counters
    this.db.exec('DELETE FROM sqlite_sequence WHERE name IN ("ledger_files", "transactions")');

    // Save changes to OPFS
    await this.save();
  }

  /**
   * Get all transactions across all files with file information
   */
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
    if (!this.db) throw new Error('Database not initialized');

    let sql = `
      SELECT DISTINCT
  t.id, t.file_id, f.filename, t.version, t.flags, t.size,
  t.entry_type, t.tx_version, t.max_conflict_version, t.transaction_id as tx_id,
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

    const result = this.db.exec(sql, params);

    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      id: row[0] as number,
      fileId: row[1] as number,
      fileName: row[2] as string,
      version: row[3] as number,
      flags: row[4] as number,
      size: row[5] as number,
      entryType: row[6] as number,
      txVersion: row[7] as number,
      maxConflictVersion: row[8] as number,
      txId: row[9] as string,
      writeCount: row[10] as number,
      deleteCount: row[11] as number,
      mapName: row[12] as string,
    }));
  }

  /**
   * Get total count of transactions (for pagination)
   */
  async getAllTransactionsCount(searchQuery?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

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

    const result = this.db.exec(sql, params);
    return result.length > 0 ? (result[0].values[0][0] as number) : 0;
  }

  /**
   * Get all unique CCF tables (maps) from the database
   */
  async getCCFTables(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = `
      SELECT DISTINCT map_name
      FROM (
        SELECT map_name FROM kv_writes
        UNION
        SELECT map_name FROM kv_deletes
      ) AS all_maps
      ORDER BY map_name
    `;

    const result = this.db.exec(sql);
    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => row[0] as string);
  }

  /**
   * Get key-value pairs for a specific CCF table/map with optional search
   */
  async getTableKeyValues(mapName: string, limit = 100, offset = 0, searchQuery?: string): Promise<Array<{
    keyName: string;
    value: Uint8Array | null;
    version: number;
    transactionId: number;
    isDeleted: boolean;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

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

    const result = this.db.exec(sql, params);
    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      keyName: row[0] as string,
      value: row[1] ? new TextEncoder().encode(row[1] as string) : null,
      version: row[2] as number,
      transactionId: row[3] as number,
      isDeleted: (row[4] as number) === 1,
    }));
  }

  /**
   * Get the latest state of all keys in a CCF table/map with optional search
   */
  async getTableLatestState(mapName: string, limit = 100, offset = 0, searchQuery?: string): Promise<Array<{
    keyName: string;
    value: Uint8Array | null;
    version: number;
    transactionId: number;
    isDeleted: boolean;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

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

    const result = this.db.exec(sql, params);
    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      keyName: row[0] as string,
      value: row[1] ? new TextEncoder().encode(row[1] as string) : null,
      version: row[2] as number,
      transactionId: row[3] as number,
      isDeleted: (row[4] as number) === 1,
    }));
  }

  /**
   * Get the total count of keys in the latest state of a CCF table/map with optional search
   */
  async getTableLatestStateCount(mapName: string, searchQuery?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

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

    const result = this.db.exec(sql, params);
    return result.length > 0 ? (result[0].values[0][0] as number) : 0;
  }

  /**
   * Get transactions that affected a specific key in a CCF table/map
   */
  async getKeyTransactions(mapName: string, keyName: string, limit = 50, offset = 0): Promise<Array<{
    transactionId: number;
    version: number;
    operationType: 'write' | 'delete';
    value: Uint8Array | null;
    fileName: string;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = `
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
    `;

    const result = this.db.exec(sql, [mapName, keyName, mapName, keyName, limit, offset]);
    if (result.length === 0) return [];

    return result[0].values.map((row: unknown[]) => ({
      transactionId: row[0] as number,
      version: row[1] as number,
      operationType: row[2] as 'write' | 'delete',
      value: row[3] ? new TextEncoder().encode(row[3] as string) : null,
      fileName: row[4] as string,
    }));
  }

  /**
   * Drop all tables and recreate the database schema (complete reset)
   */
  async dropDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Drop all tables in reverse dependency order
    this.db.exec('DROP TABLE IF EXISTS kv_deletes');
    this.db.exec('DROP TABLE IF EXISTS kv_writes');
    this.db.exec('DROP TABLE IF EXISTS transactions');
    this.db.exec('DROP TABLE IF EXISTS ledger_files');

    // Drop all indexes
    this.db.exec('DROP INDEX IF EXISTS idx_transactions_file_id');
    this.db.exec('DROP INDEX IF EXISTS idx_kv_writes_transaction_id');
    this.db.exec('DROP INDEX IF EXISTS idx_kv_writes_map_key');
    this.db.exec('DROP INDEX IF EXISTS idx_kv_writes_value_text');
    this.db.exec('DROP INDEX IF EXISTS idx_kv_deletes_transaction_id');
    this.db.exec('DROP INDEX IF EXISTS idx_kv_deletes_map_key');

    // Reset auto-increment counters
    this.db.exec('DELETE FROM sqlite_sequence');

    // Recreate all tables and indexes
    await this.createTables();

    // Save changes to OPFS
    await this.save();
  }

  /**
   * Check database integrity and attempt to recover if corrupted
   */
  async checkIntegrity(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.exec('PRAGMA integrity_check');
      if (result.length === 0) return true;
      
      const integrityResult = result[0].values[0][0] as string;
      
      if (integrityResult === 'ok') {
        return true;
      } else {
        console.warn('Database integrity check failed:', integrityResult);
        
        // Attempt to repair the database
        try {
          this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
          this.db.exec('VACUUM');
          
          // Check again after repair attempt
          const recheck = this.db.exec('PRAGMA integrity_check');
          const recheckResult = recheck[0].values[0][0] as string;
          
          if (recheckResult === 'ok') {
            console.log('Database successfully repaired');
            return true;
          } else {
            console.error('Database repair failed, corruption persists');
            return false;
          }
        } catch (repairError) {
          console.error('Database repair attempt failed:', repairError);
          return false;
        }
      }
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }

  /**
   * Reset the database by clearing all data (use when corruption is detected)
   */
  async resetDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      // Drop all tables
      this.db.exec(`
        DROP TABLE IF EXISTS kv_deletes;
        DROP TABLE IF EXISTS kv_writes;
        DROP TABLE IF EXISTS transactions;
        DROP TABLE IF EXISTS ledger_files;
      `);
      
      // Recreate tables
      await this.createTables();
      
      console.log('Database successfully reset');
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * Check current database memory settings
   */
  async getDatabaseSettings(): Promise<{
    journalMode: string;
    cacheSize: number;
    tempStore: string;
    mmapSize: number;
    pageSize: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const settings = {
      journalMode: '',
      cacheSize: 0,
      tempStore: '',
      mmapSize: 0,
      pageSize: 0,
    };

    try {
      const journalResult = this.db.exec('PRAGMA journal_mode');
      settings.journalMode = journalResult[0]?.values[0]?.[0] as string || 'unknown';

      const cacheResult = this.db.exec('PRAGMA cache_size');
      settings.cacheSize = cacheResult[0]?.values[0]?.[0] as number || 0;

      const tempResult = this.db.exec('PRAGMA temp_store');
      settings.tempStore = tempResult[0]?.values[0]?.[0] as string || 'unknown';

      const mmapResult = this.db.exec('PRAGMA mmap_size');
      settings.mmapSize = mmapResult[0]?.values[0]?.[0] as number || 0;

      const pageResult = this.db.exec('PRAGMA page_size');
      settings.pageSize = pageResult[0]?.values[0]?.[0] as number || 0;
    } catch (error) {
      console.warn('Failed to read database settings:', error);
    }

    return settings;
  }

  /**
   * Get transactions with their related data for verification
   * Similar to C# GetTransactionsWithRelatedAsync
   */
  async getTransactionsWithRelated(start: number, limit: number): Promise<Array<{
    txId: number;
    txHash: Uint8Array;
    tables: Array<{
      storeName: string;
      value: string;
    }>;
  }>> {
    if (!this.db) throw new Error('Database not initialized');

    // Get transactions with their tx_digest (hash)
    const transactionResult = this.db.exec(`
      SELECT id, tx_digest
      FROM transactions
      ORDER BY id
      LIMIT ? OFFSET ?
    `, [limit, start]);

    if (transactionResult.length === 0) return [];

    const transactions = transactionResult[0].values.map((row: unknown[]) => ({
      txId: row[0] as number,
      txHash: new Uint8Array(row[1] as ArrayBuffer),
    }));

    // For each transaction, get its writes that might contain signature information
    const result: Array<{
      txId: number;
      txHash: Uint8Array;
      tables: Array<{
        storeName: string;
        value: string;
      }>;
    }> = [];

    for (const tx of transactions) {
      const writesResult = this.db.exec(`
        SELECT map_name, value_text
        FROM kv_writes
        WHERE transaction_id = ? AND value_text IS NOT NULL
      `, [tx.txId]);

      const tables: Array<{ storeName: string; value: string }> = [];
      
      if (writesResult.length > 0) {
        for (const writeRow of writesResult[0].values) {
          tables.push({
            storeName: writeRow[0] as string,
            value: writeRow[1] as string,
          });
        }
      }

      result.push({
        txId: tx.txId,
        txHash: tx.txHash,
        tables,
      });
    }

    return result;
  }

  /**
   * Get total count of all transactions
   */
  async getTotalTransactionsCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(`SELECT COUNT(*) as count FROM transactions`);

    if (result.length === 0 || result[0].values.length === 0) return 0;

    return result[0].values[0][0] as number;
  }

  /**
   * Execute a raw SQL query (SELECT only for security)
   */
  async executeQuery(sqlQuery: string): Promise<unknown[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Validate the query is a SELECT statement only
    const trimmedQuery = sqlQuery.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed for security reasons');
    }

    try {
      const result = this.db.exec(sqlQuery);
      
      if (!result || result.length === 0) {
        return [];
      }

      // Convert the result to a more readable format
      const columns = result[0].columns;
      const values = result[0].values;
      
      return values.map(row => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      });
    } catch (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
  }
}
