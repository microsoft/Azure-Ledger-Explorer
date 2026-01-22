/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Spinner,
  Text,
  Button,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import { ErrorCircleRegular, ArrowClockwiseRegular, DeleteRegular } from '@fluentui/react-icons';
import ccfLogo from '../assets/ccf.svg';

const useStyles = makeStyles({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    zIndex: 10000,
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '48px',
  },
  logos: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
  },
  logo: {
    height: '80px',
    width: 'auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16px',
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  statusText: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    marginTop: '8px',
  },
  errorIcon: {
    fontSize: '48px',
    color: tokens.colorPaletteRedForeground1,
  },
  dialogBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorDetails: {
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'monospace',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '150px',
    overflowY: 'auto',
  },
  warningText: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

export interface SplashScreenProps {
  onInitialized: () => void;
  initializeDatabase: () => Promise<void>;
  resetDatabase: () => Promise<void>;
}

type InitState = 'loading' | 'success' | 'error';

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onInitialized,
  initializeDatabase,
  resetDatabase,
}) => {
  const styles = useStyles();
  const [state, setState] = useState<InitState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [isResetting, setIsResetting] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const initialize = useCallback(async () => {
    setState('loading');
    setError(null);
    setStatusMessage('Checking browser compatibility...');

    try {
      // Check for required APIs
      if (!('indexedDB' in window)) {
        throw new Error('IndexedDB is not supported in this browser. Please use a modern browser.');
      }

      setStatusMessage('Initializing OPFS storage...');
      
      // Check for OPFS support
      if (!('storage' in navigator) || !('getDirectory' in (navigator.storage || {}))) {
        throw new Error('Origin Private File System (OPFS) is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
      }

      setStatusMessage('Initializing database...');
      
      // Initialize the database
      await initializeDatabase();

      setStatusMessage('Ready!');
      setState('success');
      
      // Brief delay to show success before transitioning
      setTimeout(() => {
        onInitialized();
      }, 500);

    } catch (err) {
      console.error('Database initialization failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setState('error');
      setShowErrorDialog(true);
    }
  }, [initializeDatabase, onInitialized]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleRetry = () => {
    setShowErrorDialog(false);
    initialize();
  };

  const handleReset = async () => {
    setIsResetting(true);
    setShowErrorDialog(false);
    setStatusMessage('Clearing database...');
    
    try {
      await resetDatabase();
      setStatusMessage('Database cleared. Reinitializing...');
      // Give a moment for the reset to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      initialize();
    } catch (err) {
      console.error('Failed to reset database:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset database';
      setError(errorMessage);
      setState('error');
      setShowErrorDialog(true);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
        <div className={styles.logos}>
          <img src={ccfLogo} alt="CCF Logo" className={styles.logo} />
        </div>
        <Text className={styles.title}>CCF Ledger Explorer</Text>
        <Text className={styles.subtitle}>Azure Confidential Ledger Visualization Tool</Text>
      </div>

      <div className={styles.loadingContainer}>
        {state === 'loading' && (
          <>
            <Spinner size="large" />
            <Text className={styles.statusText}>{statusMessage}</Text>
          </>
        )}

        {state === 'success' && (
          <>
            <Spinner size="large" />
            <Text className={styles.statusText}>{statusMessage}</Text>
          </>
        )}        

        {state === 'error' && !showErrorDialog && (
          <>
            <ErrorCircleRegular className={styles.errorIcon} />
            <Text className={styles.statusText}>Initialization failed</Text>
            <Button appearance="primary" onClick={() => setShowErrorDialog(true)}>
              View Details
            </Button>
          </>
        )}
      </div>

      <Dialog open={showErrorDialog} onOpenChange={(_, data) => setShowErrorDialog(data.open)}>
        <DialogSurface>
          <DialogTitle>Database Initialization Failed</DialogTitle>
          <DialogContent>
            <DialogBody className={styles.dialogBody}>
              <Text>
                The application could not initialize its local database. This may be due to:
              </Text>
              <ul>
                <li>Browser storage permissions being denied</li>
                <li>Corrupted database files</li>
                <li>Another tab or window using the database</li>
                <li>Insufficient storage space</li>
              </ul>

              {error && (
                <div className={styles.errorDetails}>
                  {error}
                </div>
              )}

              <Text>
                You can try again, or reset the database to clear all stored data and start fresh.
              </Text>

              <Text className={styles.warningText}>
                ⚠️ Resetting the database will delete all imported ledger files and data.
              </Text>
            </DialogBody>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="secondary"
              icon={<ArrowClockwiseRegular />}
              onClick={handleRetry}
              disabled={isResetting}
            >
              Try Again
            </Button>
            <Button
              appearance="primary"
              icon={<DeleteRegular />}
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset Database'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
