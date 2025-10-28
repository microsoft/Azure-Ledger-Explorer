// Client interface to communicate with the database worker
// Provides a simple promise-based API for executing SQL queries

export class DatabaseWorkerClient {
  private worker: Worker;
  private messageId = 0;
  private pendingMessages = new Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private readyPromise: Promise<void>;

  constructor() {
    // Create the database worker
    this.worker = new Worker(
      new URL('../workers/database-worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Set up message handler
    this.worker.onmessage = (event: MessageEvent) => {
      const { type, id, result, error } = event.data;

      if (type === 'ready') {
        // Worker is ready
        return;
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
      const readyHandler = (event: MessageEvent) => {
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
   * Wait for the worker to be ready
   */
  async waitForReady(): Promise<void> {
    await this.readyPromise;
  }

  /**
   * Execute a SQL query and return results
   */
  async exec(sql: string, bind?: unknown[]): Promise<unknown[]> {
    await this.readyPromise;

    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { 
        resolve: resolve as (result: unknown) => void, 
        reject 
      });
      
      this.worker.postMessage({
        type: 'exec',
        id,
        payload: { sql, bind },
      });
    }) as Promise<unknown[]>;
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async execBatch(statements: Array<{ sql: string; bind?: unknown[] }>): Promise<void> {
    await this.readyPromise;

    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { 
        resolve: resolve as (result: unknown) => void, 
        reject 
      });
      
      this.worker.postMessage({
        type: 'execBatch',
        id,
        payload: { statements },
      });
    }) as Promise<void>;
  }

  /**
   * Execute multiple SQL statements in a transaction using optimized prepared statements
   */
  async execBatchOptimized(statements: Array<{ sql: string; bind?: unknown[] }>): Promise<void> {
    await this.readyPromise;

    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { 
        resolve: resolve as (result: unknown) => void, 
        reject 
      });
      
      this.worker.postMessage({
        type: 'execBatchOptimized',
        id,
        payload: { statements },
      });
    }) as Promise<void>;
  }

  /**
   * Insert a ledger file directly in the worker using transferable ArrayBuffer
   */
  async insertLedgerFile(filename: string, fileSize: number, arrayBuffer: ArrayBuffer): Promise<{ fileId: number; transactionCount: number }> {
    await this.readyPromise;

    const id = this.messageId++;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { 
        resolve: resolve as (result: unknown) => void, 
        reject 
      });
      
      // Use transferable object to transfer ArrayBuffer ownership to worker
      this.worker.postMessage({
        type: 'insertLedgerFile',
        id,
        payload: { filename, fileSize, arrayBuffer },
      }, [arrayBuffer]); // Transfer ownership of arrayBuffer
    }) as Promise<{ fileId: number; transactionCount: number }>;
  }

  /**
   * Close the database and terminate the worker
   */
  async close(): Promise<void> {
    await this.readyPromise;

    const id = this.messageId++;
    
    await new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      
      this.worker.postMessage({
        type: 'close',
        id,
        payload: {},
      });
    });

    this.worker.terminate();
  }

  /**
   * Delete the entire OPFS database file and recreate a fresh database
   * This is a nuclear option for recovering from corrupted databases
   */
  async deleteDatabase(): Promise<void> {
    await this.readyPromise;

    const id = this.messageId++;
    
    await new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      
      this.worker.postMessage({
        type: 'deleteDatabase',
        id,
        payload: {},
      });
    });
  }
}
