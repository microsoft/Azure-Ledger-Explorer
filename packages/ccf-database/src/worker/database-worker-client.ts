/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



/**
 * Message types for worker communication
 */
type WorkerMessageType = 'exec' | 'execBatch' | 'execBatchOptimized' | 'insertLedgerFile' | 'close' | 'clearAllData' | 'deleteDatabase' | 'resetMerkleState' | 'analyzeDatabase' | 'exportDatabase';

interface WorkerMessage {
  type: WorkerMessageType;
  id: number;
  payload: unknown;
}

interface WorkerResponse {
  type: 'ready' | 'response' | 'error';
  id?: number;
  result?: unknown;
  error?: string;
}

/**
 * Result from inserting a ledger file with verification
 */
export interface InsertLedgerFileResult {
  fileId: number;
  transactionCount: number;
  verification: {
    verified: boolean;
    transactionCount: number;
    signatureSeqNo?: number;
    expectedRoot?: string;
    calculatedRoot?: string;
    error?: string;
  } | null;
}

/**
 * Options for inserting a ledger file
 */
export interface InsertLedgerFileOptions {
  shouldVerify?: boolean;
}

/**
 * Client for communicating with the database worker
 * Handles all message passing and promise resolution
 */
export class DatabaseWorkerClient {
  private worker: Worker;
  private messageId = 0;
  private pendingMessages = new Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private readyPromise: Promise<void>;

  constructor() {
    // Create the database worker (path relative to this file's location in the package)
    // Use .js extension since this will be bundled by the consumer's bundler
    this.worker = new Worker(
      new URL('./database-worker.js', import.meta.url),
      { type: 'module' }
    );

    // Set up message handler
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, id, result, error } = event.data;

      if (type === 'ready') {
        return; // Worker initialization complete
      }

      if (type === 'error' && id !== undefined) {
        const pending = this.pendingMessages.get(id);
        if (pending) {
          pending.reject(new Error(error));
          this.pendingMessages.delete(id);
        }
        return;
      }

      if (type === 'response' && id !== undefined) {
        const pending = this.pendingMessages.get(id);
        if (pending) {
          pending.resolve(result);
          this.pendingMessages.delete(id);
        }
      }
    };

    // Wait for the worker to be ready
    this.readyPromise = new Promise((resolve, reject) => {
      const readyHandler = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'ready') {
          this.worker.removeEventListener('message', readyHandler);
          resolve();
        } else if (event.data.type === 'error') {
          this.worker.removeEventListener('message', readyHandler);
          reject(new Error(event.data.error));
        }
      };
      this.worker.addEventListener('message', readyHandler);
    });
  }

  /**
   * Wait for the worker to be ready before sending commands
   */
  async waitForReady(): Promise<void> {
    await this.readyPromise;
  }

  /**
   * Execute a SQL query and return results
   */
  async exec(sql: string, bind?: unknown[]): Promise<unknown[]> {
    return this.sendMessage('exec', { sql, bind }) as Promise<unknown[]>;
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async execBatch(statements: Array<{ sql: string; bind?: unknown[] }>): Promise<void> {
    await this.sendMessage('execBatch', { statements });
  }

  /**
   * Execute multiple SQL statements using optimized prepared statements
   * Better performance for large batches
   */
  async execBatchOptimized(statements: Array<{ sql: string; bind?: unknown[] }>): Promise<void> {
    await this.sendMessage('execBatchOptimized', { statements });
  }

  /**
   * Insert a ledger file directly in the worker using transferable ArrayBuffer
   * Transfers ownership of ArrayBuffer to worker for zero-copy performance
   * 
   * @param filename - Name of the ledger file
   * @param fileSize - Size of the file in bytes
   * @param arrayBuffer - The file contents (ownership transferred to worker)
   * @param options - Optional parameters for verification
   */
  async insertLedgerFile(
    filename: string,
    fileSize: number,
    arrayBuffer: ArrayBuffer,
    options?: InsertLedgerFileOptions
  ): Promise<InsertLedgerFileResult> {
    await this.readyPromise;

    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { 
        resolve: resolve as (result: unknown) => void, 
        reject 
      });
      
      // Transfer ArrayBuffer ownership to worker (zero-copy)
      this.worker.postMessage({
        type: 'insertLedgerFile',
        id,
        payload: { 
          filename, 
          fileSize, 
          arrayBuffer,
          shouldVerify: options?.shouldVerify !== false,
        },
      }, [arrayBuffer]);
    }) as Promise<InsertLedgerFileResult>;
  }

  /**
   * Delete the entire OPFS database file and recreate a fresh database
   * Nuclear option for recovering from corrupted databases
   */
  async deleteDatabase(): Promise<void> {
    await this.sendMessage('deleteDatabase', {});
  }

  /**
   * Clear all data from tables while preserving schema
   * Use this to reset the database without deleting the file
   */
  async clearAllData(): Promise<void> {
    await this.sendMessage('clearAllData', {});
  }

  /**
   * Reset the Merkle tree state in the worker
   * Call this before starting a fresh import sequence
   */
  async resetMerkleState(): Promise<void> {
    await this.sendMessage('resetMerkleState', {});
  }

  /**
   * Refresh SQLite query-planner statistics (runs ANALYZE).
   * Call this once after a batch of insertLedgerFile() calls completes,
   * so subsequent queries pick optimal indexes without paying ANALYZE
   * per file during the import loop.
   */
  async analyzeDatabase(): Promise<void> {
    await this.sendMessage('analyzeDatabase', {});
  }

  /**
   * Export the live database as a streaming download. The worker sends chunks
   * (64 MB each) so peak memory stays bounded even for multi-GB databases.
   *
   * Accepts a callback that receives each chunk, its offset, total size, and
   * whether it is the final chunk. The callback can write the chunk to a
   * writable stream or accumulate it as needed.
   *
   * Returns the total byte length once all chunks have been delivered.
   */
  async exportDatabase(
    onChunk?: (chunk: ArrayBuffer, offset: number, totalSize: number, done: boolean) => void | Promise<void>
  ): Promise<{ totalSize: number }> {
    await this.readyPromise;

    const id = this.messageId++;

    return new Promise((resolve, reject) => {
      const handler = async (event: MessageEvent) => {
        const data = event.data;
        if (data.id !== id) return;

        if (data.type === 'exportChunk') {
          try {
            if (onChunk) {
              await onChunk(data.chunk, data.offset, data.totalSize, data.done);
            }
            if (data.done) {
              this.worker.removeEventListener('message', handler);
              resolve({ totalSize: data.totalSize });
            }
          } catch (err) {
            this.worker.removeEventListener('message', handler);
            reject(err);
          }
        } else if (data.type === 'error' && data.id === id) {
          this.worker.removeEventListener('message', handler);
          reject(new Error(data.error || 'Export failed'));
        }
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'exportDatabase', id, payload: {} });
    });
  }

  /**
   * Close the database and terminate the worker
   */
  async close(): Promise<void> {
    await this.sendMessage('close', {});
    this.worker.terminate();
  }

  /**
   * Internal helper to send messages to worker and handle promises
   */
  private async sendMessage(type: WorkerMessageType, payload: unknown): Promise<unknown> {
    await this.readyPromise;

    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      
      const message: WorkerMessage = { type, id, payload };
      this.worker.postMessage(message);
    });
  }
}
