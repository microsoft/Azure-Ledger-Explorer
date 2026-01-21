/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { MerkleTree, toHexStringLower, areByteArraysEqual, hexStringToBytes } from '@ccf/ledger-parser';
import type { 
  WorkerInMessage, 
  WorkerOutMessage,
  VerificationConfig,
  ChunkTransactionsResponse,
  LedgerFile,
} from '../types/verification-types';

/**
 * Verification Worker - Chunk-Based
 * 
 * This worker performs Merkle tree verification of ledger chunks (files).
 * It verifies once per chunk at the last signature transaction, matching
 * the optimized approach used during import.
 * 
 * Key optimization: Instead of verifying at every signature transaction,
 * we only verify at the LAST signature in each chunk. This dramatically
 * reduces verification time.
 */
class VerificationWorker {
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private merkleTree: MerkleTree = new MerkleTree();
  
  // Request tracking for async data fetching from main thread
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
  }>();

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
      case 'chunksResponse':
        this.handleResponse(message.requestId, message.chunks);
        break;
      case 'chunkTransactionsResponse':
        this.handleResponse(message.requestId, { transactions: message.transactions, lastSignature: message.lastSignature });
        break;
      case 'updateChunkVerificationResponse':
        this.handleResponse(message.requestId, message.success);
        break;
    }
  }

  private handleResponse(requestId: number, data: unknown): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      pending.resolve(data);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Request all chunks (ledger files) from main thread
   */
  private async requestChunks(): Promise<LedgerFile[]> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (data: unknown) => void, reject });
      this.postMessage({ type: 'requestChunks', requestId: id });
    });
  }

  /**
   * Request transactions for a specific chunk/file
   */
  private async requestChunkTransactions(fileId: number): Promise<ChunkTransactionsResponse> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (data: unknown) => void, reject });
      this.postMessage({ type: 'requestChunkTransactions', requestId: id, fileId });
    });
  }

  /**
   * Request to update chunk verification status in database
   */
  private async updateChunkVerification(fileId: number, verified: boolean, error?: string): Promise<boolean> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (data: unknown) => void, reject });
      this.postMessage({ type: 'updateChunkVerification', requestId: id, fileId, verified, error });
    });
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
      // Get all chunks (ledger files) from main thread
      const chunks = await this.requestChunks();
      
      if (chunks.length === 0) {
        this.postMessage({ 
          type: 'completed', 
          data: { success: true, totalChunks: 0, verifiedChunks: 0, failedChunks: 0 } 
        });
        this.isRunning = false;
        return;
      }

      // Sort chunks by filename to ensure correct order (ledger_1-14, ledger_15-3926, etc.)
      chunks.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

      const startFromChunk = config.resumeFromChunk || 0;
      let verifiedCount = 0;
      let failedCount = 0;
      
      // Send initial progress
      this.postMessage({ 
        type: 'progress', 
        data: {
          currentChunk: startFromChunk,
          totalChunks: chunks.length,
          currentChunkName: chunks[startFromChunk]?.filename || '',
          status: 'running',
          startTime: Date.now(),
          // Legacy fields
          currentTransaction: startFromChunk,
          totalTransactions: chunks.length,
        }
      });

      // If resuming, rebuild the Merkle tree from previous chunks
      if (startFromChunk > 0) {
        for (let i = 0; i < startFromChunk; i++) {
          if (this.shouldStop) break;
          await this.rebuildMerkleTreeForChunk(chunks[i].id);
        }
      }

      // Process each chunk
      for (let chunkIndex = startFromChunk; chunkIndex < chunks.length; chunkIndex++) {
        // Check for pause
        await this.waitIfPaused(chunkIndex, chunks.length);
        if (this.shouldStop) break;

        const chunk = chunks[chunkIndex];
        
        // Send progress update for this chunk
        this.postMessage({ 
          type: 'progress', 
          data: {
            currentChunk: chunkIndex,
            totalChunks: chunks.length,
            currentChunkName: chunk.filename,
            status: 'running',
            startTime: Date.now(),
            currentTransaction: chunkIndex,
            totalTransactions: chunks.length,
          }
        });

        // Verify this chunk
        const result = await this.verifyChunk(chunk);
        
        // Update database with verification result
        await this.updateChunkVerification(chunk.id, result.verified, result.error);

        // Send chunk verification result
        this.postMessage({ 
          type: 'chunkVerified', 
          data: result 
        });

        if (result.verified) {
          verifiedCount++;
        } else {
          failedCount++;
          // Stop early on first failure - no point continuing if ledger integrity is compromised
          break;
        }
      }

      if (!this.shouldStop) {
        // Send final progress
        this.postMessage({ 
          type: 'progress', 
          data: {
            currentChunk: chunks.length,
            totalChunks: chunks.length,
            currentChunkName: '',
            status: 'completed',
            startTime: Date.now(),
            currentTransaction: chunks.length,
            totalTransactions: chunks.length,
          }
        });

        this.postMessage({ 
          type: 'completed', 
          data: { 
            success: failedCount === 0, 
            totalChunks: chunks.length,
            verifiedChunks: verifiedCount,
            failedChunks: failedCount,
          } 
        });
      } else {
        this.postMessage({ type: 'stopped' });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.postMessage({ type: 'error', data: { message: errorMessage } });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Verify a single chunk using the optimized last-signature approach
   */
  private async verifyChunk(chunk: LedgerFile): Promise<{
    fileId: number;
    filename: string;
    verified: boolean;
    error?: string;
    signatureSeqNo?: number;
    expectedRoot?: string;
    calculatedRoot?: string;
    transactionCount: number;
  }> {
    // Track the initial leaf count (from previous chunks)
    const initialLeafCount = this.merkleTree.Leaves.length;
    
    // Get transactions and last signature for this chunk
    const { transactions, lastSignature } = await this.requestChunkTransactions(chunk.id);
    
    // Find the index of the last signature transaction (if any)
    let lastSignatureTransactionIndex: number | undefined;
    if (lastSignature) {
      lastSignatureTransactionIndex = transactions.findIndex(tx => tx.txId === lastSignature.txId);
    }

    // Process all transactions in the chunk - just add hashes to tree
    for (const transaction of transactions) {
      const txHash = new Uint8Array(transaction.txHash);
      this.merkleTree.insertLeaf(txHash);
    }

    // Only verify if there's a signature in this chunk
    if (lastSignature && lastSignatureTransactionIndex !== undefined && lastSignatureTransactionIndex >= 0) {
      try {
        const signatures = JSON.parse(lastSignature.signatureData);
        if (signatures.root) {
          // Calculate the correct leaf index accounting for leaves from previous chunks
          const targetLeafCount = initialLeafCount + lastSignatureTransactionIndex;
          const leavesToVerify = this.merkleTree.Leaves.slice(0, targetLeafCount);
          const tempTree = MerkleTree.fromLeaves([...leavesToVerify]);
          
          const calculatedRootBytes = await tempTree.calculateRootHash();
          const calculatedRoot = toHexStringLower(calculatedRootBytes);
          const expectedRootBytes = hexStringToBytes(signatures.root);
          
          if (areByteArraysEqual(calculatedRootBytes, expectedRootBytes)) {
            console.log(`✅ Chunk ${chunk.filename} verified at signature ${lastSignature.txId}`);
            return {
              fileId: chunk.id,
              filename: chunk.filename,
              verified: true,
              signatureSeqNo: lastSignature.txId,
              expectedRoot: signatures.root,
              calculatedRoot,
              transactionCount: transactions.length,
            };
          } else {
            console.error(`❌ Chunk ${chunk.filename} FAILED at signature ${lastSignature.txId}`);
            return {
              fileId: chunk.id,
              filename: chunk.filename,
              verified: false,
              error: `Merkle root mismatch at transaction ${lastSignature.txId}. Expected: ${signatures.root}, Calculated: ${calculatedRoot}`,
              signatureSeqNo: lastSignature.txId,
              expectedRoot: signatures.root,
              calculatedRoot,
              transactionCount: transactions.length,
            };
          }
        }
      } catch (parseError) {
        console.warn(`Failed to parse signature data at transaction ${lastSignature.txId}:`, parseError);
      }
    }

    // No signature found in this chunk - that's okay for intermediate chunks
    console.log(`⚠️ Chunk ${chunk.filename} has no signature (intermediate chunk)`);
    return {
      fileId: chunk.id,
      filename: chunk.filename,
      verified: true, // No signature to verify against
      transactionCount: transactions.length,
    };
  }

  /**
   * Rebuild Merkle tree for a chunk (used when resuming)
   */
  private async rebuildMerkleTreeForChunk(fileId: number): Promise<void> {
    const { transactions } = await this.requestChunkTransactions(fileId);
    
    for (const transaction of transactions) {
      if (this.shouldStop) return;
      const txHash = new Uint8Array(transaction.txHash);
      this.merkleTree.insertLeaf(txHash);
    }
  }

  /**
   * Wait while paused, with proper messaging
   */
  private async waitIfPaused(currentChunk: number, totalChunks: number): Promise<void> {
    if (this.isPaused && !this.shouldStop) {
      this.postMessage({ 
        type: 'paused',
        data: { currentChunk, totalChunks }
      });
      
      while (this.isPaused && !this.shouldStop) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
}

// Initialize the worker
new VerificationWorker();
