// Types for the verification web worker and checkpointing system

export interface VerificationProgress {
  currentTransaction: number;
  totalTransactions: number;
  processedFiles: number;
  totalFiles: number;
  currentFileName: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  startTime: number;
  lastCheckpoint: number;
  errorMessage?: string;
  failedTransaction?: number;
}

export interface VerificationCheckpoint {
  id: string; // unique identifier for the verification session
  timestamp: number;
  lastVerifiedTransaction: number;
  lastVerifiedFile: string;
  currentFileIndex: number; // Track which file we're processing
  status: 'pass' | 'fail' | 'stopped'; // Added 'stopped' status
  totalTransactionsProcessed: number;
  failureDetails?: {
    transactionNumber: number;
    fileName: string;
    errorMessage: string;
    timestamp: number;
  };
  // Add file list for resumption
  originalFiles?: Array<{
    name: string;
    size: number;
    lastModified: number;
  }>;
}

export interface VerificationConfig {
  checkpointInterval: number; // Number of transactions between checkpoints (default: 100)
  progressReportInterval: number; // Number of transactions between progress reports (default: 50)
  resumeFromCheckpoint: boolean; // Whether to resume from the last checkpoint
}

// Messages sent from main thread to worker
export type WorkerInMessage = 
  | { type: 'start'; files: File[]; config: VerificationConfig; sessionId: string }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' };

// Messages sent from worker to main thread
export type WorkerOutMessage = 
  | { type: 'progress'; data: VerificationProgress }
  | { type: 'checkpoint'; data: VerificationCheckpoint }
  | { type: 'completed'; data: { success: boolean; finalCheckpoint: VerificationCheckpoint } }
  | { type: 'error'; data: { message: string; checkpoint?: VerificationCheckpoint } }
  | { type: 'stopped' };

export interface VerificationResult {
  transactionNumber: number;
  fileName: string;
  passed: boolean;
  errorMessage?: string;
  txDigest?: Uint8Array;
  expectedDigest?: Uint8Array;
}
