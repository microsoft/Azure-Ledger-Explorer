/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export interface VerificationProgress {
  currentChunk: number;
  totalChunks: number;
  currentChunkName: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  startTime: number;
  errorMessage?: string;
  failedChunk?: string;
  // Completion stats
  verifiedChunks?: number;
  failedChunks?: number;
  // Legacy fields for backwards compatibility (mapped from chunk progress)
  currentTransaction: number;
  totalTransactions: number;
}

export interface SimpleVerificationState {
  lastProcessedChunk: number;
  totalChunks: number;
  startTime: number;
  status: 'running' | 'paused' | 'stopped';
}

export interface VerificationConfig {
  progressReportInterval: number; // Not used in chunk-based verification, kept for compatibility
  resumeFromChunk?: number; // Chunk index to resume from
  resumeFromTransaction?: number; // Legacy, not used
}

/**
 * Transaction data with related tables for verification
 */
export interface VerificationTransaction {
  txId: number;
  txHash: number[]; // Uint8Array serialized as number array for worker transfer
  tables: Array<{
    storeName: string;
    value: string;
  }>;
}

/**
 * Ledger file info for chunk-based verification
 */
export interface ChunkInfo {
  id: number;
  filename: string;
  fileSize: number;
  verified: boolean | null;
}

/**
 * Result of verifying a single chunk
 */
export interface ChunkVerificationResult {
  fileId: number;
  filename: string;
  verified: boolean;
  error?: string;
  signatureSeqNo?: number;
  expectedRoot?: string;
  calculatedRoot?: string;
  transactionCount: number;
}

// Messages sent from main thread to worker
export type WorkerInMessage = 
  | { type: 'start'; config: VerificationConfig }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'chunksResponse'; requestId: number; chunks: ChunkInfo[] }
  | { type: 'chunkTransactionsResponse'; requestId: number; transactions: VerificationTransaction[] }
  | { type: 'updateChunkVerificationResponse'; requestId: number; success: boolean }
  // Legacy - kept for backwards compatibility
  | { type: 'totalCountResponse'; requestId: number; count: number }
  | { type: 'transactionsResponse'; requestId: number; transactions: VerificationTransaction[] };

// Messages sent from worker to main thread
export type WorkerOutMessage = 
  | { type: 'progress'; data: VerificationProgress }
  | { type: 'chunkVerified'; data: ChunkVerificationResult }
  | { type: 'completed'; data: { success: boolean; totalChunks: number; verifiedChunks: number; failedChunks: number } }
  | { type: 'error'; data: { message: string } }
  | { type: 'stopped' }
  | { type: 'paused'; data: { currentChunk: number; totalChunks: number } }
  | { type: 'requestChunks'; requestId: number }
  | { type: 'requestChunkTransactions'; requestId: number; fileId: number }
  | { type: 'updateChunkVerification'; requestId: number; fileId: number; verified: boolean; error?: string }
  // Legacy
  | { type: 'requestTotalCount'; requestId: number }
  | { type: 'requestTransactions'; requestId: number; start: number; limit: number };

export interface VerificationResult {
  transactionNumber: number;
  fileName: string;
  passed: boolean;
  errorMessage?: string;
  txDigest?: Uint8Array;
  expectedDigest?: Uint8Array;
}
