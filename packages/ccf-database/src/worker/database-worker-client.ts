/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



/**
 * Message types for worker communication
 */
type WorkerMessageType = 'exec' | 'execBatch' | 'execBatchOptimized' | 'insertLedgerFile' | 'close' | 'clearAllData' | 'deleteDatabase';

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
   */
  async insertLedgerFile(
    filename: string,
    fileSize: number,
    arrayBuffer: ArrayBuffer
  ): Promise<{ fileId: number; transactionCount: number }> {
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
        payload: { filename, fileSize, arrayBuffer },
      }, [arrayBuffer]);
    }) as Promise<{ fileId: number; transactionCount: number }>;
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
