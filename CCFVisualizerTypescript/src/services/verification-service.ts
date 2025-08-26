// Simplified Verification Service - Manages the verification web worker

import type { 
  WorkerInMessage, 
  WorkerOutMessage, 
  VerificationProgress, 
  VerificationConfig 
} from '../types/verification-types';

export interface VerificationServiceEvents {
  onProgress: (progress: VerificationProgress) => void;
  onCompleted: (data: { success: boolean; totalTransactions: number }) => void;
  onError: (data: { message: string }) => void;
  onStopped: () => void;
}

export class VerificationService {
  private worker: Worker | null = null;
  private events: Partial<VerificationServiceEvents> = {};
  private lastProgress: VerificationProgress | null = null;

  /**
   * Set event handlers
   */
  setEvents(events: Partial<VerificationServiceEvents>) {
    this.events = { ...this.events, ...events };
  }

  /**
   * Start verification process - uses database with simple progress tracking
   */
  async startVerification(config: Partial<VerificationConfig> = {}): Promise<void> {
    if (this.worker) {
      console.warn('Verification already in progress');
      return;
    }

    // Check for saved progress
    const savedProgress = this.getSavedProgress();
    const resumeFromTransaction = savedProgress?.lastProcessedTransaction || 0;

    // Default configuration
    const fullConfig: VerificationConfig = {
      progressReportInterval: 50,
      resumeFromTransaction,
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
      // Immediately save current state before stopping
      this.saveCurrentStateAsStoppedProgress();
      this.worker.postMessage({ type: 'stop' });
    }
  }

  /**
   * Pause verification
   */
  pauseVerification(): void {
    if (this.worker) {
      // Immediately save current state as paused
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
   * Get saved progress from browser storage with enhanced state information
   */
  getSavedProgress(): { lastProcessedTransaction: number; totalTransactions: number; status?: string } | null {
    try {
      const saved = localStorage.getItem('ccf-verification-progress');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if there's a verification that can be resumed
   */
  canResumeVerification(): boolean {
    const saved = this.getSavedProgress();
    return saved !== null && saved.lastProcessedTransaction > 0;
  }

  private saveCurrentStateAsStoppedProgress(): void {
    if (this.lastProgress) {
      const progressData = {
        lastProcessedTransaction: this.lastProgress.currentTransaction,
        totalTransactions: this.lastProgress.totalTransactions,
        startTime: this.lastProgress.startTime,
        status: 'stopped'
      };
      localStorage.setItem('ccf-verification-progress', JSON.stringify(progressData));
    }
  }

  private saveCurrentStateAsPausedProgress(): void {
    if (this.lastProgress) {
      const progressData = {
        lastProcessedTransaction: this.lastProgress.currentTransaction,
        totalTransactions: this.lastProgress.totalTransactions,
        startTime: this.lastProgress.startTime,
        status: 'paused'
      };
      localStorage.setItem('ccf-verification-progress', JSON.stringify(progressData));
    }
  }

  private handleWorkerMessage(message: WorkerOutMessage): void {
    switch (message.type) {
      case 'progress':
        // Store the latest progress for state management
        this.lastProgress = message.data;
        // Save progress to localStorage when we receive progress updates
        this.saveProgressToStorage(message.data);
        this.events.onProgress?.(message.data);
        break;

      case 'paused':
        // Handle worker reporting it has paused
        const pausedProgress = {
          currentTransaction: message.data.currentTransaction,
          totalTransactions: message.data.totalTransactions,
          status: 'paused' as const,
          startTime: this.lastProgress?.startTime || Date.now()
        };
        this.lastProgress = pausedProgress;
        this.saveProgressToStorage(pausedProgress);
        this.events.onProgress?.(pausedProgress);
        break;

      case 'completed':
        // Clear saved progress on completion
        this.clearSavedProgress();
        this.events.onCompleted?.(message.data);
        this.cleanup();
        break;

      case 'error':
        // Keep progress saved on error so user can resume
        this.events.onError?.(message.data);
        this.cleanup();
        break;

      case 'stopped':
        // Keep progress saved when stopped so user can resume
        this.events.onStopped?.();
        this.cleanup();
        break;
    }
  }

  private saveProgressToStorage(progress: VerificationProgress): void {
    const progressData = {
      lastProcessedTransaction: progress.currentTransaction,
      totalTransactions: progress.totalTransactions,
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
