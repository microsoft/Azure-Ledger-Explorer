/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { verificationService, type SavedProgress, type VerificationServiceEvents } from '../services/verification-service';
import type { 
  VerificationProgress, 
  VerificationConfig,
  ChunkVerificationResult,
} from '../types/verification-types';
import { queryKeys } from './use-ccf-data';

interface UseVerificationResult {
  // State
  isRunning: boolean;
  progress: VerificationProgress | null;
  error: string | null;
  lastVerifiedChunk: ChunkVerificationResult | null;

  // Actions
  start: (config?: Partial<VerificationConfig>) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  clearProgress: () => void;
  getSavedProgress: () => SavedProgress;
  canResumeVerification: () => boolean;
}

export function useVerification(): UseVerificationResult {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastVerifiedChunk, setLastVerifiedChunk] = useState<ChunkVerificationResult | null>(null);
  
  const eventsSetRef = useRef(false);

  // Set up event handlers
  useEffect(() => {
    if (eventsSetRef.current) return;
    
    const events: VerificationServiceEvents = {
      onProgress: (progressData) => {
        setProgress(progressData);
        setError(null);
      },
      
      onChunkVerified: (result) => {
        setLastVerifiedChunk(result);
        // Invalidate ledger files query to refresh verification status in UI
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
      },
      
      onCompleted: (data) => {
        setIsRunning(false);
        setProgress(prev => prev ? { 
          ...prev, 
          status: 'completed',
          verifiedChunks: data.verifiedChunks,
          failedChunks: data.failedChunks
        } : null);
        setError(null);
        // Final invalidation to ensure UI is up to date
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
      },
      
      onError: (errorData) => {
        console.error('Verification error:', errorData);
        setError(errorData.message);
        setIsRunning(false);
        setProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      },
      
      onStopped: () => {
        setIsRunning(false);
        setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
      },
      
      onVerificationCleared: () => {
        // Immediately invalidate ledger files query so UI shows all files as unverified
        queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
      }
    };

    verificationService.setEvents(events);
    eventsSetRef.current = true;
  }, [queryClient]);

  // Initialize running state from service and restore saved progress
  useEffect(() => {
    setIsRunning(verificationService.isRunning());
    
    // Restore progress state from localStorage when component mounts
    const savedProgress = verificationService.getSavedProgress();
    if (savedProgress && savedProgress.status) {
      const restoredProgress: VerificationProgress = {
        currentChunk: savedProgress.lastProcessedChunk,
        totalChunks: savedProgress.totalChunks,
        currentChunkName: '',
        status: savedProgress.status as 'stopped' | 'running' | 'paused' | 'completed' | 'failed',
        startTime: Date.now(),
        // Legacy fields
        currentTransaction: savedProgress.lastProcessedChunk,
        totalTransactions: savedProgress.totalChunks,
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

  const stop = useCallback(() => {
    verificationService.stopVerification();
    setIsRunning(false);
    setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
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
    lastVerifiedChunk,

    // Actions
    start,
    pause,
    resume,
    stop,
    clearProgress,
    canResumeVerification: () => {
      const savedProgress = verificationService.getSavedProgress();
      return savedProgress !== null && 
             (savedProgress.status === 'paused' || savedProgress.status === 'stopped') &&
             savedProgress.lastProcessedChunk > 0;
    },
    getSavedProgress
  };
}
