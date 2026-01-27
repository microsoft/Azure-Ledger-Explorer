/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { DatabaseWorkerClient } from './worker/database-worker-client';
import type { InsertLedgerFileResult, InsertLedgerFileOptions } from './worker/database-worker-client';
import { FileRepository } from './repositories/file-repository';
import { TransactionRepository } from './repositories/transaction-repository';
import { KVRepository } from './repositories/kv-repository';
import { StatsRepository } from './repositories/stats-repository';
import type { DatabaseConfig } from './types/database-types'
import type { ExecFn, ExecBatchFn } from './types/repository-types';

/**
 * CCFDatabase - Main database facade
 * 
 * Provides access to repositories for different domains:
 * - files: Ledger file operations
 * - transactions: Transaction CRUD and search
 * - kv: Key-value table operations
 * - stats: Statistics and database management
 */
export class CCFDatabase {
  private client: DatabaseWorkerClient | null = null;

  // Repositories - initialized after client is ready
  private _files: FileRepository | null = null;
  private _transactions: TransactionRepository | null = null;
  private _kv: KVRepository | null = null;
  private _stats: StatsRepository | null = null;

  constructor(_config: DatabaseConfig) {
    // Config stored for future use if needed
  }

  async initialize(): Promise<void> {
    try {
      this.client = new DatabaseWorkerClient();
      await this.client.waitForReady();

      // Create bound exec functions
      const exec: ExecFn = (sql, bind) => this.client!.exec(sql, bind) as Promise<Record<string, unknown>[]>;
      const execBatch: ExecBatchFn = (statements) => this.client!.execBatch(statements);

      // Initialize repositories
      this._files = new FileRepository(exec, execBatch);
      this._transactions = new TransactionRepository(exec, execBatch);
      this._kv = new KVRepository(exec, execBatch);
      this._stats = new StatsRepository(exec, execBatch);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Repository accessors with initialization check
  get files(): FileRepository {
    if (!this._files) throw new Error('Database not initialized');
    return this._files;
  }

  get transactions(): TransactionRepository {
    if (!this._transactions) throw new Error('Database not initialized');
    return this._transactions;
  }

  get kv(): KVRepository {
    if (!this._kv) throw new Error('Database not initialized');
    return this._kv;
  }

  get stats(): StatsRepository {
    if (!this._stats) throw new Error('Database not initialized');
    return this._stats;
  }

  /**
   * Insert a ledger file with its data.
   * Processing and verification happens in the worker for performance.
   * 
   * @param filename - Name of the ledger file
   * @param fileSize - Size of the file in bytes  
   * @param arrayBuffer - The file contents (ownership transferred to worker)
   * @param options - Optional parameters for verification
   */
  async insertLedgerFileWithData(
    filename: string,
    fileSize: number,
    arrayBuffer: ArrayBuffer,
    options?: InsertLedgerFileOptions
  ): Promise<InsertLedgerFileResult> {
    if (!this.client) throw new Error('Database not initialized');
    return await this.client.insertLedgerFile(filename, fileSize, arrayBuffer, options);
  }

  /**
   * Execute a raw SQL query (SELECT/WITH/PRAGMA only).
   * Used by the SQL runner UI.
   */
  async executeQuery(sqlQuery: string): Promise<unknown[]> {
    if (!this.client) throw new Error('Database not initialized');

    const trimmedQuery = sqlQuery.trim().toUpperCase();
    const isAllowed =
      trimmedQuery.startsWith('SELECT') ||
      trimmedQuery.startsWith('WITH') ||
      trimmedQuery.startsWith('PRAGMA');

    if (!isAllowed) {
      throw new Error('Only SELECT, WITH, and PRAGMA queries are allowed for security reasons');
    }

    return await this.client.exec(sqlQuery);
  }

  /**
   * Nuclear option: Delete the entire OPFS database file and recreate.
   */
  async deleteAndRecreateDatabase(): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');
    console.warn('[CCFDatabase] Deleting and recreating entire database - all data will be lost!');
    await this.client.deleteDatabase();
  }

  /**
   * Clear all data from tables while preserving schema.
   * Use this to reset the database without deleting the file.
   * Also resets the Merkle tree state in the worker.
   */
  async clearAllData(): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');
    console.warn('[CCFDatabase] Clearing all data from tables');
    await this.client.clearAllData();
  }

  /**
   * Reset the Merkle tree state in the worker.
   * Call this before starting a fresh import sequence to ensure
   * verification starts from a clean state.
   */
  async resetMerkleState(): Promise<void> {
    if (!this.client) throw new Error('Database not initialized');
    await this.client.resetMerkleState();
  }

  /**
   * Close the database connection.
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this._files = null;
      this._transactions = null;
      this._kv = null;
      this._stats = null;
    }
  }
}
