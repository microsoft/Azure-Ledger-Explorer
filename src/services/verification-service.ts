/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { 
  WorkerInMessage, 
  WorkerOutMessage, 
  VerificationProgress, 
  VerificationConfig,
  VerificationTransaction,
  ChunkVerificationResult,
} from '../types/verification-types';
import type { CCFDatabase } from '@ccf/database';
import { getDatabase } from '../hooks/use-ccf-data';

export interface VerificationServiceEvents {
  onProgress: (progress: VerificationProgress) => void;
  onChunkVerified: (result: ChunkVerificationResult) => void;
  onCompleted: (data: { success: boolean; totalChunks: number; verifiedChunks: number; failedChunks: number }) => void;
  onError: (data: { message: string }) => void;
  onStopped: () => void;
  onVerificationCleared: () => void;
}

export interface SavedProgress {
  lastProcessedChunk: number;
  totalChunks: number;
  status?: string;
}

export class VerificationService {
  private worker: Worker | null = null;
  private events: Partial<VerificationServiceEvents> = {};
  private lastProgress: VerificationProgress | null = null;
  private database: CCFDatabase | null = null;

  /**
   * Set the database instance to use for querying data
   */
  setDatabase(database: CCFDatabase): void {
    this.database = database;
  }

  /**
   * Set event handlers
   */
  setEvents(events: Partial<VerificationServiceEvents>) {
    this.events = { ...this.events, ...events };
  }

  /**
   * Start verification process - chunk-based verification
   */
  async startVerification(config: Partial<VerificationConfig> = {}): Promise<void> {
    if (this.worker) {
      console.warn('Verification already in progress');
      return;
    }

    // Ensure we have a database connection for handling data requests from worker
    if (!this.database) {
      this.database = await getDatabase();
    }

    // Get all files to find the first unverified chunk
    const allFiles = await this.database.files.getAll();
    
    // Sort by filename to match worker's processing order
    allFiles.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
    
    // Find index of first unverified chunk
    const firstUnverifiedIndex = allFiles.findIndex(f => f.verified !== true);
    
    // If all chunks are already verified, nothing to do
    if (firstUnverifiedIndex === -1 && allFiles.length > 0) {
      console.warn('All chunks already verified, skipping verification');
      this.events.onCompleted?.({ 
        success: true, 
        totalChunks: allFiles.length, 
        verifiedChunks: allFiles.length, 
        failedChunks: 0 
      });
      return;
    }
    
    // Only clear verification results for unverified files (from firstUnverifiedIndex onwards)
    // This preserves already-verified files when resuming
    if (firstUnverifiedIndex > 0) {
      // We have some verified files - only clear from the unverified point
      for (let i = firstUnverifiedIndex; i < allFiles.length; i++) {
        await this.database.files.clearVerificationResult(allFiles[i].id);
      }
    } else {
      // No verified files yet, clear all
      await this.database.files.clearAllVerificationResults();
    }
    
    // Notify that verification results were cleared (so UI can update)
    this.events.onVerificationCleared?.();

    // Use firstUnverifiedIndex as the starting point (or 0 if no files exist)
    const resumeFromChunk = firstUnverifiedIndex >= 0 ? firstUnverifiedIndex : 0;

    // Default configuration
    const fullConfig: VerificationConfig = {
      progressReportInterval: 50, // Legacy, not used in chunk-based
      resumeFromChunk,
      ...config
    };

    try {
      // Create worker
      this.worker = new Worker(
        new URL('../workers/verification-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.events.onError?.({ message: 'Worker error occurred' });
        this.cleanup();
      };

      // Start verification
      const startMessage: WorkerInMessage = {
        type: 'start',
        config: fullConfig
      };

      this.worker.postMessage(startMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.events.onError?.({ message: errorMessage });
      this.cleanup();
    }
  }

  /**
   * Stop verification
   */
  stopVerification(): void {
    if (this.worker) {
      this.saveCurrentStateAsStoppedProgress();
      this.worker.postMessage({ type: 'stop' });
    }
  }

  /**
   * Pause verification
   */
  pauseVerification(): void {
    if (this.worker) {
      this.saveCurrentStateAsPausedProgress();
      this.worker.postMessage({ type: 'pause' });
    }
  }

  /**
   * Resume verification
   */
  resumeVerification(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'resume' });
    }
  }

  /**
   * Check if verification is running
   */
  isRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * Clear saved progress from browser storage
   */
  clearSavedProgress(): void {
    localStorage.removeItem('ccf-verification-progress');
  }

  /**
   * Get saved progress from browser storage
   */
  getSavedProgress(): SavedProgress {
    try {
      const saved = localStorage.getItem('ccf-verification-progress');
      return saved ? JSON.parse(saved) : { lastProcessedChunk: 0, totalChunks: 0 };
    } catch {
      return { lastProcessedChunk: 0, totalChunks: 0 };
    }
  }

  /**
   * Check if there's a verification that can be resumed
   */
  canResumeVerification(): boolean {
    const saved = this.getSavedProgress();
    return saved !== null && saved.lastProcessedChunk > 0;
  }

  private saveCurrentStateAsStoppedProgress(): void {
    if (this.lastProgress) {
      const progressData = {
        lastProcessedChunk: this.lastProgress.currentChunk,
        totalChunks: this.lastProgress.totalChunks,
        startTime: this.lastProgress.startTime,
        status: 'stopped'
      };
      localStorage.setItem('ccf-verification-progress', JSON.stringify(progressData));
    }
  }

  private saveCurrentStateAsPausedProgress(): void {
    if (this.lastProgress) {
      const progressData = {
        lastProcessedChunk: this.lastProgress.currentChunk,
        totalChunks: this.lastProgress.totalChunks,
        startTime: this.lastProgress.startTime,
        status: 'paused'
      };
      localStorage.setItem('ccf-verification-progress', JSON.stringify(progressData));
    }
  }

  private handleWorkerMessage(message: WorkerOutMessage): void {
    switch (message.type) {
      case 'requestChunks':
        this.handleChunksRequest(message.requestId);
        break;
        
      case 'requestChunkTransactions':
        this.handleChunkTransactionsRequest(message.requestId, message.fileId);
        break;

      case 'updateChunkVerification':
        this.handleUpdateChunkVerification(message.requestId, message.fileId, message.verified, message.error);
        break;

      case 'progress':
        this.lastProgress = message.data;
        this.saveProgressToStorage(message.data);
        this.events.onProgress?.(message.data);
        break;

      case 'chunkVerified':
        this.events.onChunkVerified?.(message.data);
        break;

      case 'paused': {
        const pausedProgress: VerificationProgress = {
          currentChunk: message.data.currentChunk,
          totalChunks: message.data.totalChunks,
          currentChunkName: '',
          status: 'paused',
          startTime: this.lastProgress?.startTime || Date.now(),
          currentTransaction: message.data.currentChunk,
          totalTransactions: message.data.totalChunks,
        };
        this.lastProgress = pausedProgress;
        this.saveProgressToStorage(pausedProgress);
        this.events.onProgress?.(pausedProgress);
        break;
      }

      case 'completed':
        this.clearSavedProgress();
        this.events.onCompleted?.(message.data);
        this.cleanup();
        break;

      case 'error':
        this.events.onError?.(message.data);
        this.cleanup();
        break;

      case 'stopped':
        this.events.onStopped?.();
        this.cleanup();
        break;
    }
  }

  /**
   * Handle request for all chunks (ledger files) from worker
   */
  private async handleChunksRequest(requestId: number): Promise<void> {
    if (!this.database) {
      console.error('Database not set for verification service');
      this.worker?.postMessage({
        type: 'chunksResponse',
        requestId,
        chunks: []
      } as WorkerInMessage);
      return;
    }

    try {
      const files = await this.database.files.getAll();
      const chunks = files.map(f => ({
        id: f.id,
        filename: f.filename,
        fileSize: f.fileSize,
        verified: f.verified,
      }));
      
      this.worker?.postMessage({
        type: 'chunksResponse',
        requestId,
        chunks
      } as WorkerInMessage);
    } catch (error) {
      console.error('Error getting chunks:', error);
      this.worker?.postMessage({
        type: 'chunksResponse',
        requestId,
        chunks: []
      } as WorkerInMessage);
    }
  }

  /**
   * Handle request for transactions of a specific chunk from worker
   */
  private async handleChunkTransactionsRequest(requestId: number, fileId: number): Promise<void> {
    if (!this.database) {
      console.error('Database not set for verification service');
      this.worker?.postMessage({
        type: 'chunkTransactionsResponse',
        requestId,
        transactions: [],
        lastSignature: null
      } as WorkerInMessage);
      return;
    }

    try {
      const { transactions, lastSignature } = await this.database.transactions.getByFileIdForVerification(fileId);
      
      // Convert Uint8Array to regular array for postMessage serialization
      const serializableTransactions: VerificationTransaction[] = transactions.map(tx => ({
        txId: tx.txId,
        txHash: Array.from(tx.txHash),
      }));
      
      this.worker?.postMessage({
        type: 'chunkTransactionsResponse',
        requestId,
        transactions: serializableTransactions,
        lastSignature
      } as WorkerInMessage);
    } catch (error) {
      console.error('Error getting chunk transactions:', error);
      this.worker?.postMessage({
        type: 'chunkTransactionsResponse',
        requestId,
        transactions: [],
        lastSignature: null
      } as WorkerInMessage);
    }
  }

  /**
   * Handle request to update chunk verification status
   */
  private async handleUpdateChunkVerification(requestId: number, fileId: number, verified: boolean, error?: string): Promise<void> {
    if (!this.database) {
      console.error('Database not set for verification service');
      this.worker?.postMessage({
        type: 'updateChunkVerificationResponse',
        requestId,
        success: false
      } as WorkerInMessage);
      return;
    }

    try {
      await this.database.files.updateVerificationStatus(fileId, verified, error);
      
      this.worker?.postMessage({
        type: 'updateChunkVerificationResponse',
        requestId,
        success: true
      } as WorkerInMessage);
    } catch (err) {
      console.error('Error updating chunk verification:', err);
      this.worker?.postMessage({
        type: 'updateChunkVerificationResponse',
        requestId,
        success: false
      } as WorkerInMessage);
    }
  }

  private saveProgressToStorage(progress: VerificationProgress): void {
    const progressData = {
      lastProcessedChunk: progress.currentChunk,
      totalChunks: progress.totalChunks,
      startTime: progress.startTime,
      status: progress.status
    };
    localStorage.setItem('ccf-verification-progress', JSON.stringify(progressData));
  }

  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Create singleton instance
export const verificationService = new VerificationService();
