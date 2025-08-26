// Simplified Verification Web Worker - Database-based approach with browser storage for progress

import { MerkleTree, toHexStringLower } from '../utils/merkle-tree';
import type { 
  WorkerInMessage, 
  WorkerOutMessage,
  VerificationConfig
} from '../types/verification-types';

// Database connection in worker context
let db: any = null;

class VerificationWorker {
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private merkleTree: MerkleTree = new MerkleTree();

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent<WorkerInMessage>) {
    const message = event.data;

    switch (message.type) {
      case 'start':
        this.startVerification(message.config);
        break;
      case 'stop':
        this.stop();
        break;
      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.resume();
        break;
    }
  }

  private async startVerification(config: VerificationConfig): Promise<void> {
    if (this.isRunning) {
      this.postMessage({ type: 'error', data: { message: 'Verification is already running' } });
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.merkleTree = new MerkleTree();

    try {
      // Initialize database connection in worker
      await this.initializeDatabase();
      
      // Get total transaction count
      const totalCount = await this.getTotalTransactionsCount();
      
      // Start from the beginning (progress tracking handled by main thread)
      const startFromTransaction = config.resumeFromTransaction || 0;
      
      this.postMessage({ 
        type: 'progress', 
        data: {
          currentTransaction: startFromTransaction,
          totalTransactions: totalCount,
          status: 'running',
          startTime: Date.now()
        }
      });

      const limit = 1000;
      let start = startFromTransaction;
      let processedCount = startFromTransaction;

      // If resuming, rebuild the Merkle tree up to the resume point
      if (startFromTransaction > 0) {
        await this.rebuildMerkleTree(startFromTransaction);
      }

      while (!this.shouldStop && start < totalCount) {
        // Handle pause
        // Handle pausing
        if (this.isPaused && !this.shouldStop) {
          // Send paused message once when entering paused state
          this.postMessage({ 
            type: 'paused',
            data: {
              currentTransaction: processedCount,
              totalTransactions: totalCount
            }
          });
          
          // Keep worker thread responsive while paused
          while (this.isPaused && !this.shouldStop) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (this.shouldStop) break;

        // Get batch of transactions with related data
        const transactions = await this.getTransactionsWithRelated(start, limit);
        
        if (transactions.length === 0) {
          break;
        }

        for (const transaction of transactions) {
          if (this.shouldStop) break;

          // Look for signature transactions FIRST - before adding to tree
          const signatureTx = transaction.tables.find(table => 
            table.storeName.includes('public:ccf.internal.signatures')
          );

          if (signatureTx) {
            try {
              const signatures = JSON.parse(signatureTx.value);
              if (signatures.root) {
                // Calculate root of all transactions processed so far (excluding current signature transaction)
                const calculatedRootBytes = await this.merkleTree.calculateRootHash();
                const calculatedRootHex = toHexStringLower(calculatedRootBytes);
                
                // Parse the expected root from signature data
                let expectedRootHex: string;
                if (typeof signatures.root === 'string') {
                  expectedRootHex = signatures.root;
                } else {
                  const expectedRootBytes = new Uint8Array(signatures.root);
                  expectedRootHex = toHexStringLower(expectedRootBytes);
                }
                
                if (calculatedRootHex !== expectedRootHex) {
                  throw new Error(`Merkle root mismatch at transaction ${transaction.txId}. Expected: ${expectedRootHex}, Calculated: ${calculatedRootHex}`);
                }
                
                console.log(`Signature verification passed at transaction ${transaction.txId}. Root hash: ${calculatedRootHex}`);
              }
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message.includes('Merkle root mismatch')) {
                throw parseError; // Re-throw verification failures
              }
              console.warn(`Failed to parse signature data at transaction ${transaction.txId}:`, parseError);
            }
          }

          // Add transaction hash to Merkle tree AFTER checking signature
          await this.merkleTree.insertLeaf(transaction.txHash);
          processedCount++;

          // Report progress every 100 transactions (removed localStorage calls)
          if (processedCount % (config.progressReportInterval || 50) === 0) {
            this.postMessage({ 
              type: 'progress', 
              data: {
                currentTransaction: processedCount,
                totalTransactions: totalCount,
                status: 'running',
                startTime: Date.now()
              }
            });
          }
        }

        start += limit;
      }

      if (!this.shouldStop) {
        // Send final progress update with exact transaction count
        this.postMessage({ 
          type: 'progress', 
          data: {
            currentTransaction: processedCount,
            totalTransactions: totalCount,
            status: 'completed',
            startTime: Date.now()
          }
        });

        // Verification completed successfully - progress handling done by main thread
        this.postMessage({ 
          type: 'completed', 
          data: { 
            success: true, 
            totalTransactions: processedCount
          } 
        });
      } else {
        // Stopped - progress handling done by main thread
        this.postMessage({ type: 'stopped' });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.postMessage({ type: 'error', data: { message: errorMessage } });
    } finally {
      this.isRunning = false;
      if (db) {
        db.close();
        db = null;
      }
    }
  }

  private stop(): void {
    this.shouldStop = true;
  }

  private pause(): void {
    this.isPaused = true;
  }

  private resume(): void {
    this.isPaused = false;
  }

  private postMessage(message: WorkerOutMessage): void {
    self.postMessage(message);
  }

  // Note: Progress storage is now handled by the main thread, not the worker
  // Workers don't have access to localStorage

  // Rebuild Merkle tree up to a specific transaction for resumption
  private async rebuildMerkleTree(upToTransaction: number): Promise<void> {
    const limit = 1000;
    let start = 0;

    while (start < upToTransaction) {
      const transactions = await this.getTransactionsWithRelated(start, Math.min(limit, upToTransaction - start));
      
      for (const transaction of transactions) {
        await this.merkleTree.insertLeaf(transaction.txHash);
      }

      start += limit;
    }
  }

  // Initialize database connection in worker context
  private async initializeDatabase(): Promise<void> {
    // Import sql.js dynamically in worker
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });

    // Open the existing database from OPFS
    const opfsRoot = await navigator.storage.getDirectory();
    let dbData: Uint8Array;

    try {
      const dbFile = await opfsRoot.getFileHandle('ccf-ledger.db');
      const file = await dbFile.getFile();
      const arrayBuffer = await file.arrayBuffer();
      dbData = new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error('Database not found. Please load ledger data first.');
    }

    db = new SQL.Database(dbData);
  }

  // Get transactions with their related data for verification
  private async getTransactionsWithRelated(start: number, limit: number): Promise<Array<{
    txId: number;
    txHash: Uint8Array;
    tables: Array<{
      storeName: string;
      value: string;
    }>;
  }>> {
    if (!db) throw new Error('Database not initialized');

    // Get transactions with their tx_digest (hash)
    const transactionResult = db.exec(`
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
      const writesResult = db.exec(`
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

  private async getTotalTransactionsCount(): Promise<number> {
    if (!db) throw new Error('Database not initialized');

    const result = db.exec(`SELECT COUNT(*) as count FROM transactions`);

    if (result.length === 0 || result[0].values.length === 0) return 0;

    return result[0].values[0][0] as number;
  }
}

// Initialize the worker
new VerificationWorker();
