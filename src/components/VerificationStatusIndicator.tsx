/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  ProgressBar,
  Badge,
  Tooltip,
} from '@fluentui/react-components';
import {
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Dismiss16Regular,
  ShieldCheckmark16Regular,
} from '@fluentui/react-icons';
import { useVerification } from '../hooks/use-verification';

const useStyles = makeStyles({
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '320px',
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  cardSuccess: {
    borderLeftColor: tokens.colorPaletteGreenBorder1,
    borderLeftWidth: '3px',
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  cardError: {
    borderLeftColor: tokens.colorPaletteRedBorder1,
    borderLeftWidth: '3px',
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  progressText: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  spinnerIcon: {
    animationIterationCount: 'infinite',
    animationDuration: '1s',
    animationName: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
  },
});

/**
 * A floating indicator that shows verification status.
 * Appears when verification is running, completed, or has an error.
 * Auto-dismisses success messages after a delay.
 */
export const VerificationStatusIndicator: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { progress, isRunning, error, clearProgress } = useVerification();
  const [dismissed, setDismissed] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  // Track previous status to detect completion
  const prevStatusRef = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    if (progress?.status === 'completed' && prevStatusRef.current === 'running') {
      setShowSuccess(true);
      setDismissed(false);
      // Auto-dismiss success after 8 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = progress?.status ?? null;
  }, [progress?.status]);
  
  // Reset dismissed state when a new verification starts
  React.useEffect(() => {
    if (isRunning) {
      setDismissed(false);
      setShowSuccess(false);
    }
  }, [isRunning]);
  
  const handleDismiss = () => {
    setDismissed(true);
    setShowSuccess(false);
    if (error || progress?.status === 'failed') {
      clearProgress();
    }
  };
  
  const handleViewDetails = () => {
    navigate('/verification');
  };
  
  // Don't show if dismissed or nothing to show
  if (dismissed) return null;
  
  // Show running state
  if (isRunning && progress) {
    const percentage = progress.totalTransactions > 0 
      ? (progress.currentTransaction / progress.totalTransactions) * 100 
      : 0;
    
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <ShieldCheckmark16Regular primaryFill={tokens.colorBrandForeground1} />
              <Text className={styles.title}>Verifying Ledger</Text>
              <Badge appearance="filled" color="brand" size="small">
                {Math.round(percentage)}%
              </Badge>
            </div>
            <Tooltip content="Dismiss" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss16Regular />}
                onClick={handleDismiss}
              />
            </Tooltip>
          </div>
          <div className={styles.progressSection}>
            <ProgressBar value={percentage / 100} />
            <Text className={styles.progressText}>
              Transaction {progress.currentTransaction.toLocaleString()} of {progress.totalTransactions.toLocaleString()}
            </Text>
          </div>
          <div className={styles.actions}>
            <Button size="small" appearance="subtle" onClick={handleViewDetails}>
              View Details
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show success state
  if (showSuccess || progress?.status === 'completed') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.cardSuccess}`}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <CheckmarkCircle16Regular primaryFill={tokens.colorPaletteGreenForeground1} />
              <Text className={styles.title}>Verification Complete</Text>
            </div>
            <Tooltip content="Dismiss" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss16Regular />}
                onClick={handleDismiss}
              />
            </Tooltip>
          </div>
          <Text className={styles.progressText}>
            Ledger integrity verified successfully
          </Text>
          <div className={styles.actions}>
            <Button size="small" appearance="subtle" onClick={handleViewDetails}>
              View Details
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error || progress?.status === 'failed') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.cardError}`}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <ErrorCircle16Regular primaryFill={tokens.colorPaletteRedForeground1} />
              <Text className={styles.title}>Verification Failed</Text>
            </div>
            <Tooltip content="Dismiss" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss16Regular />}
                onClick={handleDismiss}
              />
            </Tooltip>
          </div>
          <Text className={styles.progressText}>
            {error || 'An error occurred during verification'}
          </Text>
          <div className={styles.actions}>
            <Button size="small" appearance="subtle" onClick={handleViewDetails}>
              View Details
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show paused state
  if (progress?.status === 'paused' || progress?.status === 'stopped') {
    const percentage = progress.totalTransactions > 0 
      ? (progress.currentTransaction / progress.totalTransactions) * 100 
      : 0;
    
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <ShieldCheckmark16Regular primaryFill={tokens.colorNeutralForeground3} />
              <Text className={styles.title}>Verification Paused</Text>
              <Badge appearance="outline" size="small">
                {Math.round(percentage)}%
              </Badge>
            </div>
            <Tooltip content="Dismiss" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss16Regular />}
                onClick={handleDismiss}
              />
            </Tooltip>
          </div>
          <Text className={styles.progressText}>
            Paused at transaction {progress.currentTransaction.toLocaleString()}
          </Text>
          <div className={styles.actions}>
            <Button size="small" appearance="subtle" onClick={handleViewDetails}>
              Resume
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
};

export default VerificationStatusIndicator;
