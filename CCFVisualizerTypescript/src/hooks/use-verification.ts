// React hook for verification functionality

import { useState, useEffect, useCallback, useRef } from 'react';
import { verificationService, type VerificationServiceEvents } from '../services/verification-service';
import type { 
  VerificationProgress, 
  VerificationCheckpoint, 
  VerificationConfig 
} from '../types/verification-types';

interface UseVerificationResult {
  // State
  isRunning: boolean;
  progress: VerificationProgress | null;
  checkpoints: VerificationCheckpoint[];
  lastCheckpoint: VerificationCheckpoint | null;
  error: string | null;
  currentSessionId: string | null;

  // Actions
  startVerification: (files: File[], config?: Partial<VerificationConfig>, sessionId?: string) => Promise<string>;
  resumeFromCheckpoint: (sessionId: string, files: File[]) => Promise<string>;
  stopVerification: () => void;
  pauseVerification: () => void;
  resumeVerification: () => void;
  clearAllCheckpoints: () => Promise<void>;
  deleteCheckpoint: (sessionId: string) => Promise<void>;
  refreshCheckpoints: () => Promise<void>;
  canResume: (sessionId: string) => Promise<boolean>;
  canResumeFromCheckpoint: (sessionId: string) => Promise<boolean>;
}

export function useVerification(): UseVerificationResult {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [checkpoints, setCheckpoints] = useState<VerificationCheckpoint[]>([]);
  const [lastCheckpoint, setLastCheckpoint] = useState<VerificationCheckpoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const eventsSetRef = useRef(false);

  // Set up event handlers
  useEffect(() => {
    if (eventsSetRef.current) return;
    
    const events: VerificationServiceEvents = {
      onProgress: (progressData) => {
        setProgress(progressData);
        setError(null);
      },
      onCheckpoint: (checkpoint) => {
        setLastCheckpoint(checkpoint);
        refreshCheckpoints();
      },
      onCompleted: (data) => {
        setProgress(prev => prev ? { ...prev, status: 'completed' } : null);
        setLastCheckpoint(data.finalCheckpoint);
        setIsRunning(false);
        refreshCheckpoints();
      },
      onError: (data) => {
        setError(data.message);
        setProgress(prev => prev ? { ...prev, status: 'failed' } : null);
        setIsRunning(false);
        if (data.checkpoint) {
          setLastCheckpoint(data.checkpoint);
          refreshCheckpoints();
        }
      },
      onStopped: () => {
        setProgress(prev => prev ? { ...prev, status: 'stopped' } : null);
        setIsRunning(false);
      }
    };

    verificationService.setEvents(events);
    eventsSetRef.current = true;
  }, []);

  // Load checkpoints on mount
  useEffect(() => {
    refreshCheckpoints();
  }, []);

  const refreshCheckpoints = useCallback(async () => {
    try {
      const allCheckpoints = await verificationService.getAllCheckpoints();
      setCheckpoints(allCheckpoints);
    } catch (err) {
      console.error('Failed to refresh checkpoints:', err);
    }
  }, []);

  const startVerification = useCallback(async (
    files: File[], 
    config?: Partial<VerificationConfig>,
    sessionId?: string
  ): Promise<string> => {
    try {
      setError(null);
      setIsRunning(true);
      
      const sid = await verificationService.startVerification(files, config, sessionId);
      setCurrentSessionId(sid);
      
      return sid;
    } catch (err) {
      setIsRunning(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start verification';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const stopVerification = useCallback(() => {
    verificationService.stopVerification();
  }, []);

  const pauseVerification = useCallback(() => {
    verificationService.pauseVerification();
  }, []);

  const resumeVerification = useCallback(() => {
    verificationService.resumeVerification();
  }, []);

  const clearAllCheckpoints = useCallback(async () => {
    try {
      await verificationService.clearAllCheckpoints();
      setCheckpoints([]);
      setLastCheckpoint(null);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear checkpoints';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deleteCheckpoint = useCallback(async (sessionId: string) => {
    try {
      await verificationService.deleteCheckpoint(sessionId);
      await refreshCheckpoints();
      
      // Clear last checkpoint if it was the deleted one
      if (lastCheckpoint?.id === sessionId) {
        setLastCheckpoint(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete checkpoint';
      setError(errorMessage);
      throw err;
    }
  }, [lastCheckpoint?.id, refreshCheckpoints]);

  const canResume = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const hasFailed = await verificationService.hasFailedCheckpoint(sessionId);
      return !hasFailed;
    } catch (err) {
      console.error('Failed to check if session can be resumed:', err);
      return false;
    }
  }, []);

  const resumeFromCheckpoint = useCallback(async (sessionId: string, files: File[]): Promise<string> => {
    try {
      setError(null);
      setIsRunning(true);
      
      const sid = await verificationService.resumeVerificationFromCheckpoint(sessionId, files);
      setCurrentSessionId(sid);
      
      return sid;
    } catch (err) {
      setIsRunning(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume verification from checkpoint';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const canResumeFromCheckpoint = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      return await verificationService.canResumeFromCheckpoint(sessionId);
    } catch (err) {
      console.error('Failed to check if session can be resumed from checkpoint:', err);
      return false;
    }
  }, []);

  // Update current session ID from service
  useEffect(() => {
    const serviceSessionId = verificationService.getCurrentSessionId();
    setCurrentSessionId(serviceSessionId);
  }, [isRunning]);

  return {
    // State
    isRunning,
    progress,
    checkpoints,
    lastCheckpoint,
    error,
    currentSessionId,

    // Actions
    startVerification,
    resumeFromCheckpoint,
    stopVerification,
    pauseVerification,
    resumeVerification,
    clearAllCheckpoints,
    deleteCheckpoint,
    refreshCheckpoints,
    canResume,
    canResumeFromCheckpoint
  };
}
