/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  Button,
  Text,
  ProgressBar,
  Badge,
  Tooltip,
  makeStyles,
  tokens,
  Divider,
} from '@fluentui/react-components';
import {
  Play16Regular,
  Stop16Regular,
  ArrowSync16Regular,
  ShieldCheckmark16Regular,
  Warning16Regular,
  Clock16Regular,
} from '@fluentui/react-icons';
import { useVerification } from '../hooks/use-verification';
import type { LedgerFile } from '@microsoft/ccf-database';

const useStyles = makeStyles({
  container: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  statusIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  verifiedIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },
  failedIcon: {
    color: tokens.colorPaletteYellowForeground2,
  },
  pendingIcon: {
    color: tokens.colorNeutralForeground4,
  },
  controls: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  progressText: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground2,
  },
});

interface VerificationSidebarControlsProps {
  ledgerFiles: LedgerFile[] | undefined;
}

export const VerificationSidebarControls: React.FC<VerificationSidebarControlsProps> = ({
  ledgerFiles,
}) => {
  const styles = useStyles();
  const {
    progress,
    isRunning,
    start: startVerification,
    stop: stopVerification,
    clearProgress,
  } = useVerification();

  // Calculate verification statistics
  const stats = React.useMemo(() => {
    if (!ledgerFiles || ledgerFiles.length === 0) {
      return { verified: 0, failed: 0, pending: 0, total: 0 };
    }
    
    return {
      verified: ledgerFiles.filter(f => f.verified === true).length,
      failed: ledgerFiles.filter(f => f.verified === false).length,
      pending: ledgerFiles.filter(f => f.verified === null).length,
      total: ledgerFiles.length,
    };
  }, [ledgerFiles]);

  // Check if there are unverified files (for "Continue" button)
  const hasUnverifiedFiles = stats.pending > 0 || stats.failed > 0;
  const allVerified = stats.verified === stats.total && stats.total > 0;

  const handleVerifyAll = async () => {
    clearProgress();
    try {
      await startVerification({ progressReportInterval: 50 });
    } catch (error) {
      console.error('Failed to start verification:', error);
    }
  };

  const handleContinue = async () => {
    // Continue verification from where we left off
    try {
      await startVerification({ progressReportInterval: 50 });
    } catch (error) {
      console.error('Failed to continue verification:', error);
    }
  };

  const handleStop = () => {
    stopVerification();
  };

  const progressPercentage = progress 
    ? Math.round((progress.currentChunk / Math.max(1, progress.totalChunks)) * 100) 
    : 0;

  if (!ledgerFiles || ledgerFiles.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Divider />
      
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <ShieldCheckmark16Regular />
          <Text size={200} weight="semibold">Verification</Text>
        </div>
        {allVerified && (
          <Badge appearance="filled" color="success" size="small">
            All Verified
          </Badge>
        )}
      </div>

      {/* Status Summary */}
      <div className={styles.statusSummary}>
        <div className={styles.statusRow}>
          <span className={`${styles.statusIcon} ${styles.verifiedIcon}`}>
            <ShieldCheckmark16Regular />
          </span>
          <Text size={200}>{stats.verified} verified</Text>
        </div>
        {stats.failed > 0 && (
          <div className={styles.statusRow}>
            <span className={`${styles.statusIcon} ${styles.failedIcon}`}>
              <Warning16Regular />
            </span>
            <Text size={200}>{stats.failed} failed</Text>
          </div>
        )}
        {stats.pending > 0 && (
          <div className={styles.statusRow}>
            <span className={`${styles.statusIcon} ${styles.pendingIcon}`}>
              <Clock16Regular />
            </span>
            <Text size={200}>{stats.pending} not verified</Text>
          </div>
        )}
      </div>

      {/* Progress when running */}
      {isRunning && progress && (
        <div className={styles.progressSection}>
          <ProgressBar value={progressPercentage / 100} />
          <Text className={styles.progressText}>
            {progress.currentTransaction.toLocaleString()} / {progress.totalTransactions.toLocaleString()} transactions ({progressPercentage}%)
          </Text>
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        {!isRunning ? (
          <>
            <Tooltip content="Start verification from the beginning" relationship="label">
              <Button
                size="small"
                appearance="primary"
                icon={<Play16Regular />}
                onClick={handleVerifyAll}
              >
                Verify All
              </Button>
            </Tooltip>
            
            {hasUnverifiedFiles && (
              <Tooltip content="Continue verification for unverified files" relationship="label">
                <Button
                  size="small"
                  appearance="secondary"
                  icon={<ArrowSync16Regular />}
                  onClick={handleContinue}
                >
                  Continue
                </Button>
              </Tooltip>
            )}
          </>
        ) : (
          <Button
            size="small"
            appearance="secondary"
            icon={<Stop16Regular />}
            onClick={handleStop}
          >
            Stop
          </Button>
        )}
      </div>
    </div>
  );
};
