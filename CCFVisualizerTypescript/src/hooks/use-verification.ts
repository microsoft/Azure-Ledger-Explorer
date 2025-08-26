// Simplified React hook for verification functionality

import { useState, useEffect, useCallback, useRef } from 'react';
import { verificationService, type VerificationServiceEvents } from '../services/verification-service';
import type { 
  VerificationProgress, 
  VerificationConfig 
} from '../types/verification-types';

interface UseVerificationResult {
  // State
  isRunning: boolean;
  progress: VerificationProgress | null;
  error: string | null;

  // Actions
  start: (config?: Partial<VerificationConfig>) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  clearProgress: () => void;
  getSavedProgress: () => { lastProcessedTransaction: number; totalTransactions: number; status?: string } | null;
  canResumeVerification: () => boolean;
}

export function useVerification(): UseVerificationResult {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const eventsSetRef = useRef(false);

  // Set up event handlers
  useEffect(() => {
    if (eventsSetRef.current) return;
    
    const events: VerificationServiceEvents = {
      onProgress: (progressData) => {
        setProgress(progressData);
        setError(null);
      },
      
      onCompleted: (data) => {
        console.log('Verification completed:', data);
        setIsRunning(false);
        setProgress(prev => prev ? { ...prev, status: 'completed' } : null);
        setError(null);
      },
      
      onError: (errorData) => {
        console.error('Verification error:', errorData);
        setError(errorData.message);
        setIsRunning(false);
        setProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      },
      
      onStopped: () => {
        console.log('Verification stopped');
        setIsRunning(false);
        setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
      }
    };

    verificationService.setEvents(events);
    eventsSetRef.current = true;
  }, []);

  // Initialize running state from service and restore saved progress
  useEffect(() => {
    setIsRunning(verificationService.isRunning());
    
    // Restore progress state from localStorage when component mounts
    const savedProgress = verificationService.getSavedProgress();
    if (savedProgress && savedProgress.status) {
      const restoredProgress: VerificationProgress = {
        currentTransaction: savedProgress.lastProcessedTransaction,
        totalTransactions: savedProgress.totalTransactions,
        status: savedProgress.status as any,
        startTime: Date.now() // Default to current time since we don't store startTime
      };
      setProgress(restoredProgress);
      
      // If it was paused/stopped, user can resume
      if (savedProgress.status === 'paused' || savedProgress.status === 'stopped') {
        setIsRunning(false);
      }
    }
  }, []);

  const start = useCallback(async (config?: Partial<VerificationConfig>) => {
    try {
      setError(null);
      setIsRunning(true);
      await verificationService.startVerification(config);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsRunning(false);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    verificationService.stopVerification();
  }, []);

  const pause = useCallback(() => {
    verificationService.pauseVerification();
    // Don't immediately set UI state - wait for worker to report paused status
  }, []);

  const resume = useCallback(() => {
    verificationService.resumeVerification();
    setProgress(prev => prev ? { ...prev, status: 'running' } : null);
  }, []);

  const clearProgress = useCallback(() => {
    verificationService.clearSavedProgress();
    setProgress(null);
    setError(null);
  }, []);

  const getSavedProgress = useCallback(() => {
    return verificationService.getSavedProgress();
  }, []);

  return {
    // State
    isRunning,
    progress,
    error,

    // Actions
    start,
    stop,
    pause,
    resume,
    clearProgress,
    canResumeVerification: () => {
      const savedProgress = verificationService.getSavedProgress();
      return savedProgress !== null && 
             (savedProgress.status === 'paused' || savedProgress.status === 'stopped') &&
             savedProgress.lastProcessedTransaction > 0;
    },
    getSavedProgress
  };
}
