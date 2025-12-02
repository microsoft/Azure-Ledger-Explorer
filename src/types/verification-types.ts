/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export interface VerificationProgress {
  currentTransaction: number;
  totalTransactions: number;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  startTime: number;
  errorMessage?: string;
  failedTransaction?: number;
}

export interface SimpleVerificationState {
  lastProcessedTransaction: number;
  totalTransactions: number;
  startTime: number;
  status: 'running' | 'paused' | 'stopped';
}

export interface VerificationConfig {
  progressReportInterval: number; // Number of transactions between progress reports (default: 50)
  resumeFromTransaction?: number; // Transaction number to resume from
}

// Messages sent from main thread to worker
export type WorkerInMessage = 
  | { type: 'start'; config: VerificationConfig }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' };

// Messages sent from worker to main thread
export type WorkerOutMessage = 
  | { type: 'progress'; data: VerificationProgress }
  | { type: 'completed'; data: { success: boolean; totalTransactions: number } }
  | { type: 'error'; data: { message: string } }
  | { type: 'stopped' }
  | { type: 'paused'; data: { currentTransaction: number; totalTransactions: number } };

export interface VerificationResult {
  transactionNumber: number;
  fileName: string;
  passed: boolean;
  errorMessage?: string;
  txDigest?: Uint8Array;
  expectedDigest?: Uint8Array;
}
