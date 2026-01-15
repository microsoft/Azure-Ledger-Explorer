/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import { MerkleTree, toHexStringLower, areByteArraysEqual, hexStringToBytes } from '../utils/merkle-tree';
import { CCFDatabase } from '@ccf/database';
import type { 
  WorkerInMessage, 
  WorkerOutMessage,
  VerificationConfig
} from '../types/verification-types';

// Database instance in worker context
let database: CCFDatabase | null = null;

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

      // Reduced batch size for more responsive pause behavior
      const limit = 500;
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
          
          // Check for pause more frequently during transaction processing
          if (this.isPaused && !this.shouldStop) {
            // Send paused message
            this.postMessage({ 
              type: 'paused',
              data: {
                currentTransaction: processedCount,
                totalTransactions: totalCount
              }
            });
            
            // Wait while paused
            while (this.isPaused && !this.shouldStop) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // If we were stopped while paused, exit
            if (this.shouldStop) break;
          }

          // Look for signature transactions FIRST - before adding to tree
          const signatureTx = transaction.tables.find(table => 
            table.storeName.includes('public:ccf.internal.signatures')
          );

          if (signatureTx) {
            try {
              const signatures = JSON.parse(signatureTx.value);
              if (signatures.root) {
                // Check for pause before expensive Merkle tree calculation
                if (this.isPaused && !this.shouldStop) {
                  // Send paused message
                  this.postMessage({ 
                    type: 'paused',
                    data: {
                      currentTransaction: processedCount,
                      totalTransactions: totalCount
                    }
                  });
                  
                  // Wait while paused
                  while (this.isPaused && !this.shouldStop) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                  
                  // If we were stopped while paused, exit
                  if (this.shouldStop) break;
                }
                
                // Calculate root of all transactions processed so far (excluding current signature transaction)
                const calculatedRootBytes = await this.merkleTree.calculateRootHash();
                
                // Parse the expected root from signature data  
                let expectedRootBytes: Uint8Array;
                if (typeof signatures.root === 'string') {
                  expectedRootBytes = hexStringToBytes(signatures.root);
                } else {
                  expectedRootBytes = new Uint8Array(signatures.root);
                }
                
                // Compare byte arrays directly - much faster than hex string comparison
                if (!areByteArraysEqual(calculatedRootBytes, expectedRootBytes)) {
                  // Only convert to hex for error message
                  const calculatedRootHex = toHexStringLower(calculatedRootBytes);
                  const expectedRootHex = toHexStringLower(expectedRootBytes);
                  throw new Error(`Merkle root mismatch at transaction ${transaction.txId}. Expected: ${expectedRootHex}, Calculated: ${calculatedRootHex}`);
                }
                
                // Only log success occasionally to reduce string conversion overhead
                if (transaction.txId % 1000 === 0) {
                  const calculatedRootHex = toHexStringLower(calculatedRootBytes);
                  console.log(`Signature verification passed at transaction ${transaction.txId}. Root hash: ${calculatedRootHex}`);
                }
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

          // Report progress more frequently for better UI responsiveness
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
      if (database) {
        await database.close();
        database = null;
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
    const limit = 500; // Use smaller batches for better pause responsiveness
    let start = 0;

    while (start < upToTransaction) {
      // Check for pause before each batch during rebuild
      if (this.isPaused && !this.shouldStop) {
        while (this.isPaused && !this.shouldStop) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (this.shouldStop) return;
      }
      
      const transactions = await this.getTransactionsWithRelated(start, Math.min(limit, upToTransaction - start));
      
      for (const transaction of transactions) {
        if (this.shouldStop) return;
        
        // Check for pause during transaction processing in rebuild
        if (this.isPaused && !this.shouldStop) {
          while (this.isPaused && !this.shouldStop) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (this.shouldStop) return;
        }
        
        await this.merkleTree.insertLeaf(transaction.txHash);
      }

      start += limit;
    }
  }

  // Initialize database connection in worker context
  private async initializeDatabase(): Promise<void> {
    // Create a new database instance with default OPFS filename
    database = new CCFDatabase({ filename: 'ccf-ledger.sqlite3', useOpfs: true });
    await database.initialize();
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
    if (!database) throw new Error('Database not initialized');

    return await database.transactions.getWithRelated(start, limit);
  }

  private async getTotalTransactionsCount(): Promise<number> {
    if (!database) throw new Error('Database not initialized');

    return await database.transactions.getTotalCount();
  }
}

// Initialize the worker
new VerificationWorker();
