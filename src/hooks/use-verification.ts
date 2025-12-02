/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import { useState, useEffect, useCallback, useRef } from 'react';
import { verificationService, type SavedProgress, type VerificationServiceEvents } from '../services/verification-service';
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
  pause: () => void;
  resume: () => void;
  clearProgress: () => void;
  getSavedProgress: () => SavedProgress;
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
        status: savedProgress.status as 'stopped' | 'running' | 'paused' | 'completed' | 'failed',
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

  const pause = useCallback(() => {
    verificationService.pauseVerification();
    // Immediately update UI to show pausing state for better user feedback
    setProgress(prev => prev ? { ...prev, status: 'paused' } : null);
    // Don't set isRunning to false immediately - let worker confirm the pause
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
