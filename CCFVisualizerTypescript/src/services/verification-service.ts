// Verification Service - Manages the verification web worker

import type { 
  WorkerInMessage, 
  WorkerOutMessage, 
  VerificationProgress, 
  VerificationCheckpoint, 
  VerificationConfig 
} from '../types/verification-types';
import { checkpointService } from './verification-checkpoint';

export interface VerificationServiceEvents {
  onProgress: (progress: VerificationProgress) => void;
  onCheckpoint: (checkpoint: VerificationCheckpoint) => void;
  onCompleted: (data: { success: boolean; finalCheckpoint: VerificationCheckpoint }) => void;
  onError: (data: { message: string; checkpoint?: VerificationCheckpoint }) => void;
  onStopped: () => void;
}

export class VerificationService {
  private worker: Worker | null = null;
  private events: Partial<VerificationServiceEvents> = {};
  private currentSessionId: string | null = null;

  constructor() {
    this.initializeCheckpointService();
  }

  private async initializeCheckpointService() {
    try {
      await checkpointService.init();
    } catch (error) {
      console.error('Failed to initialize checkpoint service:', error);
    }
  }

  /**
   * Set event handlers
   */
  setEvents(events: Partial<VerificationServiceEvents>) {
    this.events = { ...this.events, ...events };
  }

  /**
   * Start verification process
   */
  async startVerification(
    files: File[], 
    config: Partial<VerificationConfig> = {},
    sessionId?: string,
    resumeFromCheckpoint: boolean = false
  ): Promise<string> {
    if (this.worker) {
      throw new Error('Verification is already running');
    }

    // Generate session ID if not provided
    const sid = sessionId || `verification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSessionId = sid;

    // Check for existing failed checkpoint
    if (await checkpointService.hasFailedCheckpoint(sid)) {
      throw new Error('Cannot start verification: Previous session failed. Please clear checkpoints first.');
    }

    const defaultConfig: VerificationConfig = {
      checkpointInterval: 100,
      progressReportInterval: 50,
      resumeFromCheckpoint: resumeFromCheckpoint
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      // Create and start worker
      this.worker = new Worker(
        new URL('../workers/verification-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Start the verification
      const message: WorkerInMessage = {
        type: 'start',
        files,
        config: finalConfig,
        sessionId: sid
      };

      this.worker.postMessage(message);

      return sid;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Resume verification from the last checkpoint
   */
  async resumeVerificationFromCheckpoint(sessionId: string, files: File[]): Promise<string> {
    // Check if we can resume from this session
    if (await checkpointService.hasFailedCheckpoint(sessionId)) {
      throw new Error('Cannot resume verification: Session has failed. Please clear checkpoints first.');
    }

    if (!(await checkpointService.canResumeFromCheckpoint(sessionId))) {
      throw new Error('Cannot resume verification: No resumable checkpoint found.');
    }

    // Start verification with resume flag
    return this.startVerification(files, {}, sessionId, true);
  }

  /**
   * Stop verification process
   */
  stopVerification(): void {
    if (this.worker) {
      const message: WorkerInMessage = { type: 'stop' };
      this.worker.postMessage(message);
    }
  }

  /**
   * Pause verification process
   */
  pauseVerification(): void {
    if (this.worker) {
      const message: WorkerInMessage = { type: 'pause' };
      this.worker.postMessage(message);
    }
  }

  /**
   * Resume paused verification process
   */
  resumeVerification(): void {
    if (this.worker) {
      const message: WorkerInMessage = { type: 'resume' };
      this.worker.postMessage(message);
    }
  }

  /**
   * Check if verification is currently running
   */
  isRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get all checkpoints
   */
  async getAllCheckpoints(): Promise<VerificationCheckpoint[]> {
    return checkpointService.getAllCheckpoints();
  }

  /**
   * Get latest checkpoint for a session
   */
  async getLatestCheckpoint(sessionId: string): Promise<VerificationCheckpoint | null> {
    return checkpointService.getLatestCheckpoint(sessionId);
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(sessionId: string): Promise<void> {
    return checkpointService.deleteCheckpoint(sessionId);
  }

  /**
   * Clear all checkpoints
   */
  async clearAllCheckpoints(): Promise<void> {
    return checkpointService.clearAllCheckpoints();
  }

  /**
   * Check if a session has a failed checkpoint
   */
  async hasFailedCheckpoint(sessionId: string): Promise<boolean> {
    return checkpointService.hasFailedCheckpoint(sessionId);
  }

  /**
   * Check if a session can be resumed from checkpoint
   */
  async canResumeFromCheckpoint(sessionId: string): Promise<boolean> {
    return checkpointService.canResumeFromCheckpoint(sessionId);
  }

  private handleWorkerMessage(event: MessageEvent<WorkerOutMessage>) {
    const message = event.data;

    switch (message.type) {
      case 'progress':
        this.events.onProgress?.(message.data);
        break;
      case 'checkpoint':
        this.events.onCheckpoint?.(message.data);
        break;
      case 'completed':
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

  private handleWorkerError(error: ErrorEvent) {
    console.error('Worker error:', error);
    this.events.onError?.({ message: `Worker error: ${error.message}` });
    this.cleanup();
  }

  private cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.currentSessionId = null;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.cleanup();
    checkpointService.close();
  }
}

// Export a singleton instance
export const verificationService = new VerificationService();
