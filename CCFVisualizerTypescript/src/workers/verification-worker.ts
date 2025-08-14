// Verification Web Worker
// Performs ledger verification in the background with checkpointing

import { LedgerChunkV2 } from '../parser/ledger-chunk';
import type { 
  WorkerInMessage, 
  WorkerOutMessage, 
  VerificationProgress, 
  VerificationCheckpoint, 
  VerificationConfig,
  VerificationResult 
} from '../types/verification-types';

class VerificationWorker {
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private currentSessionId = '';
  private config: VerificationConfig = {
    checkpointInterval: 100,
    progressReportInterval: 50,
    resumeFromCheckpoint: false
  };

  private progress: VerificationProgress = {
    currentTransaction: 0,
    totalTransactions: 0,
    processedFiles: 0,
    totalFiles: 0,
    currentFileName: '',
    status: 'stopped',
    startTime: 0,
    lastCheckpoint: 0
  };

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent<WorkerInMessage>) {
    const message = event.data;

    switch (message.type) {
      case 'start':
        this.start(message.files, message.config, message.sessionId);
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

  private async start(files: File[], config: VerificationConfig, sessionId: string) {
    if (this.isRunning) {
      this.postMessage({ type: 'error', data: { message: 'Verification is already running' } });
      return;
    }

    this.currentSessionId = sessionId;
    this.config = { ...this.config, ...config };
    this.isRunning = true;
    this.isPaused = false;
    this.shouldStop = false;

    // Check for existing failed checkpoint
    if (await this.hasFailedCheckpoint(sessionId)) {
      this.postMessage({ 
        type: 'error', 
        data: { message: 'Cannot resume verification after a failure. Please clear checkpoints first.' } 
      });
      this.isRunning = false;
      return;
    }

    // Check for resumable checkpoint
    let resumeCheckpoint: VerificationCheckpoint | null = null;
    if (config.resumeFromCheckpoint) {
      resumeCheckpoint = await this.getLatestCheckpoint(sessionId);
      if (resumeCheckpoint && resumeCheckpoint.status === 'fail') {
        resumeCheckpoint = null; // Don't resume from failed checkpoints
      }
    }

    this.progress = {
      currentTransaction: resumeCheckpoint?.lastVerifiedTransaction || 0,
      totalTransactions: 0,
      processedFiles: resumeCheckpoint?.currentFileIndex || 0,
      totalFiles: files.length,
      currentFileName: resumeCheckpoint?.lastVerifiedFile || '',
      status: 'running',
      startTime: Date.now(),
      lastCheckpoint: resumeCheckpoint?.lastVerifiedTransaction || 0
    };

    try {
      await this.runVerification(files, resumeCheckpoint);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const failureCheckpoint: VerificationCheckpoint = {
        id: this.currentSessionId,
        timestamp: Date.now(),
        lastVerifiedTransaction: this.progress.currentTransaction,
        lastVerifiedFile: this.progress.currentFileName,
        currentFileIndex: this.progress.processedFiles,
        status: 'fail',
        totalTransactionsProcessed: this.progress.currentTransaction,
        originalFiles: files.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified })),
        failureDetails: {
          transactionNumber: this.progress.currentTransaction,
          fileName: this.progress.currentFileName,
          errorMessage,
          timestamp: Date.now()
        }
      };

      await this.saveCheckpoint(failureCheckpoint);
      this.postMessage({ type: 'error', data: { message: errorMessage, checkpoint: failureCheckpoint } });
    } finally {
      this.isRunning = false;
    }
  }

  private async runVerification(files: File[], resumeCheckpoint?: VerificationCheckpoint | null) {
    // Calculate total transactions for progress reporting
    let totalTransactions = 0;
    for (const file of files) {
      totalTransactions += await this.estimateTransactionCount(file);
    }
    this.progress.totalTransactions = totalTransactions;

    let globalTransactionNumber = resumeCheckpoint?.lastVerifiedTransaction || 0;
    let startFileIndex = resumeCheckpoint?.currentFileIndex || 0;

    for (let fileIndex = startFileIndex; fileIndex < files.length && !this.shouldStop; fileIndex++) {
      const file = files[fileIndex];
      this.progress.currentFileName = file.name;
      this.progress.processedFiles = fileIndex;

      const buffer = await file.arrayBuffer();
      const parser = new LedgerChunkV2(file.name, buffer);

      try {
        let transactionInFile = 0;
        
        for await (const transaction of parser.readAllTransactions()) {
          if (this.shouldStop) break;

          // Skip transactions we've already processed if resuming
          if (resumeCheckpoint && globalTransactionNumber < resumeCheckpoint.lastVerifiedTransaction) {
            globalTransactionNumber++;
            transactionInFile++;
            continue;
          }

          // Handle pause
          while (this.isPaused && !this.shouldStop) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          globalTransactionNumber++;
          transactionInFile++;
          this.progress.currentTransaction = globalTransactionNumber;

          // Verify the transaction
          const result = await this.verifyTransaction(transaction, globalTransactionNumber, file.name);
          
          if (!result.passed) {
            // Failure detected - create failure checkpoint and stop
            const failureCheckpoint: VerificationCheckpoint = {
              id: this.currentSessionId,
              timestamp: Date.now(),
              lastVerifiedTransaction: globalTransactionNumber,
              lastVerifiedFile: file.name,
              currentFileIndex: fileIndex,
              status: 'fail',
              totalTransactionsProcessed: globalTransactionNumber,
              originalFiles: files.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified })),
              failureDetails: {
                transactionNumber: globalTransactionNumber,
                fileName: file.name,
                errorMessage: result.errorMessage || 'Transaction verification failed',
                timestamp: Date.now()
              }
            };

            await this.saveCheckpoint(failureCheckpoint);
            throw new Error(`Transaction ${globalTransactionNumber} failed verification: ${result.errorMessage}`);
          }

          // Report progress
          if (globalTransactionNumber % this.config.progressReportInterval === 0) {
            this.postMessage({ type: 'progress', data: { ...this.progress } });
          }

          // Create checkpoint
          if (globalTransactionNumber % this.config.checkpointInterval === 0) {
            const checkpoint: VerificationCheckpoint = {
              id: this.currentSessionId,
              timestamp: Date.now(),
              lastVerifiedTransaction: globalTransactionNumber,
              lastVerifiedFile: file.name,
              currentFileIndex: fileIndex,
              status: 'pass',
              totalTransactionsProcessed: globalTransactionNumber,
              originalFiles: files.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified }))
            };

            await this.saveCheckpoint(checkpoint);
            this.progress.lastCheckpoint = globalTransactionNumber;
            this.postMessage({ type: 'checkpoint', data: checkpoint });
          }
        }
      } finally {
        // Clean up parser if needed
      }

      this.progress.processedFiles = fileIndex + 1;
    }

    if (this.shouldStop) {
      // Create a stopped checkpoint so we can resume later
      const stoppedCheckpoint: VerificationCheckpoint = {
        id: this.currentSessionId,
        timestamp: Date.now(),
        lastVerifiedTransaction: globalTransactionNumber,
        lastVerifiedFile: this.progress.currentFileName,
        currentFileIndex: this.progress.processedFiles,
        status: 'stopped',
        totalTransactionsProcessed: globalTransactionNumber,
        originalFiles: files.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified }))
      };

      await this.saveCheckpoint(stoppedCheckpoint);
      this.postMessage({ type: 'checkpoint', data: stoppedCheckpoint });
    } else {
      // Final checkpoint - completed
      const finalCheckpoint: VerificationCheckpoint = {
        id: this.currentSessionId,
        timestamp: Date.now(),
        lastVerifiedTransaction: globalTransactionNumber,
        lastVerifiedFile: this.progress.currentFileName,
        currentFileIndex: this.progress.processedFiles,
        status: 'pass',
        totalTransactionsProcessed: globalTransactionNumber,
        originalFiles: files.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified }))
      };

      await this.saveCheckpoint(finalCheckpoint);
      this.progress.status = 'completed';
      this.postMessage({ type: 'completed', data: { success: true, finalCheckpoint } });
    }
  }

  private async verifyTransaction(transaction: any, transactionNumber: number, fileName: string): Promise<VerificationResult> {
    try {
      // Basic verification - you can expand this with more sophisticated checks
      // For now, just verify that the transaction has required fields
      if (!transaction.header || !transaction.gcmHeader || !transaction.publicDomain || !transaction.txDigest) {
        return {
          transactionNumber,
          fileName,
          passed: false,
          errorMessage: 'Transaction missing required fields'
        };
      }

      // Verify digest length
      if (transaction.txDigest.length !== 32) {
        return {
          transactionNumber,
          fileName,
          passed: false,
          errorMessage: `Invalid digest length: expected 32, got ${transaction.txDigest.length}`
        };
      }

      // Add more verification logic here as needed
      // For example, you could re-calculate the digest and compare it

      return {
        transactionNumber,
        fileName,
        passed: true
      };
    } catch (error) {
      return {
        transactionNumber,
        fileName,
        passed: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown verification error'
      };
    }
  }

  private async estimateTransactionCount(file: File): Promise<number> {
    // Simple estimation - you might want to make this more accurate
    // For now, estimate based on file size (rough approximation)
    const avgTransactionSize = 1024; // Rough estimate in bytes
    return Math.ceil(file.size / avgTransactionSize);
  }

  private stop() {
    this.shouldStop = true;
    this.progress.status = 'stopped';
    this.postMessage({ type: 'stopped' });
  }

  private pause() {
    this.isPaused = true;
    this.progress.status = 'paused';
    this.postMessage({ type: 'progress', data: { ...this.progress } });
  }

  private resume() {
    this.isPaused = false;
    this.progress.status = 'running';
    this.postMessage({ type: 'progress', data: { ...this.progress } });
  }

  private postMessage(message: WorkerOutMessage) {
    self.postMessage(message);
  }

  // Simple IndexedDB operations for the worker context
  private async saveCheckpoint(checkpoint: VerificationCheckpoint): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CCFVerificationCheckpoints', 1);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('checkpoints')) {
          const store = db.createObjectStore('checkpoints', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['checkpoints'], 'readwrite');
        const store = transaction.objectStore('checkpoints');
        const putRequest = store.put(checkpoint);

        putRequest.onerror = () => reject(new Error('Failed to save checkpoint'));
        putRequest.onsuccess = () => {
          db.close();
          resolve();
        };
      };
    });
  }

  private async hasFailedCheckpoint(sessionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CCFVerificationCheckpoints', 1);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['checkpoints'], 'readonly');
        const store = transaction.objectStore('checkpoints');
        const getRequest = store.get(sessionId);

        getRequest.onerror = () => reject(new Error('Failed to check for failed checkpoint'));
        getRequest.onsuccess = () => {
          const checkpoint = getRequest.result;
          db.close();
          resolve(checkpoint?.status === 'fail');
        };
      };
    });
  }

  private async getLatestCheckpoint(sessionId: string): Promise<VerificationCheckpoint | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CCFVerificationCheckpoints', 1);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['checkpoints'], 'readonly');
        const store = transaction.objectStore('checkpoints');
        const getRequest = store.get(sessionId);

        getRequest.onerror = () => reject(new Error('Failed to get checkpoint'));
        getRequest.onsuccess = () => {
          const checkpoint = getRequest.result;
          db.close();
          resolve(checkpoint || null);
        };
      };
    });
  }
}

// Initialize the worker
new VerificationWorker();
