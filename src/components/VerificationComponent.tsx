// Simplified Verification Component - UI for ledger verification without checkpointing

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardPreview,
  Text,
  ProgressBar,
  MessageBar,
  MessageBarBody,
  Badge,
  Field,
  Input,
  makeStyles,
  tokens
} from '@fluentui/react-components';
import {
  Play24Regular,
  Pause24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  Delete24Regular
} from '@fluentui/react-icons';
import { useVerification } from '../hooks/use-verification';
import type { VerificationConfig } from '../types/verification-types';

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    maxWidth: '800px',
    margin: '0 auto'
  },
  card: {
    width: '100%'
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS
  },
  controls: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  configSection: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
});

export const VerificationComponent: React.FC = () => {
  const styles = useStyles();
  
  // Simplified configuration without checkpointing
  const [config, setConfig] = useState<VerificationConfig>({
    progressReportInterval: 50
  });

  const {
    progress,
    isRunning,
    error,
    start: startVerification,
    pause: pauseVerification,
    resume: resumeVerification,
    clearProgress
  } = useVerification();

  const handleStart = async () => {
    try {
      await startVerification(config);
    } catch (error) {
      console.error('Failed to start verification:', error);
    }
  };

  const handlePause = () => {
    pauseVerification();
  };

  const handleResume = () => {
    resumeVerification();
  };

  const handleClearProgress = () => {
    clearProgress();
  };

  const getStatusBadge = () => {
    if (!progress) return null;
    
    const { status } = progress;
    
    switch (status) {
      case 'running':
        return <Badge appearance="filled" color="brand">Running</Badge>;
      case 'paused':
        return <Badge appearance="filled" color="warning">Paused</Badge>;
      case 'completed':
        return <Badge appearance="filled" color="success" icon={<Checkmark24Regular />}>Completed</Badge>;
      case 'failed':
        return <Badge appearance="filled" color="danger" icon={<ErrorCircle24Regular />}>Failed</Badge>;
      case 'stopped':
        return <Badge appearance="filled" color="subtle">Stopped</Badge>;
      default:
        return null;
    }
  };

  const progressPercentage = progress ? Math.round((progress.currentTransaction / progress.totalTransactions) * 100) : 0;

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader
          header={<Text size={600}>Ledger Verification</Text>}
          description="Verify the integrity of the ledger data using database-stored transactions"
        />
        <CardPreview>
          <div className={styles.progressContainer}>
            {/* Configuration Section */}
            <div className={styles.configSection}>
              <Text size={500} weight="semibold">Configuration</Text>
              <Field label="Progress Report Interval" hint="Number of transactions between progress updates">
                <Input
                  type="number"
                  value={config.progressReportInterval.toString()}
                  onChange={(_, data) => setConfig(prev => ({ 
                    ...prev, 
                    progressReportInterval: parseInt(data.value) || 50 
                  }))}
                  disabled={isRunning}
                />
              </Field>
            </div>

            {/* Progress Section */}
            {progress && (
              <div className={styles.progressContainer}>
                <div className={styles.progressInfo}>
                  <Text size={400}>
                    Transaction {progress.currentTransaction.toLocaleString()} of {progress.totalTransactions.toLocaleString()} 
                    ({progressPercentage}%)
                  </Text>
                  {getStatusBadge()}
                </div>
                <ProgressBar value={progressPercentage} />
              </div>
            )}

            {/* Error Display */}
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>
                  <strong>Verification Error:</strong> {error}
                </MessageBarBody>
              </MessageBar>
            )}

            {/* Controls */}
            <div className={styles.controls}>
              {!isRunning ? (
                <Button 
                  appearance="primary" 
                  size="large"
                  icon={<Play24Regular />} 
                  onClick={handleStart}
                >
                  Start Verification
                </Button>
              ) : (
                <>
                  {progress?.status === 'running' ? (
                    <Button 
                      appearance="secondary" 
                      size="large"
                      icon={<Pause24Regular />} 
                      onClick={handlePause}
                    >
                      Pause
                    </Button>
                  ) : progress?.status === 'paused' ? (
                    <Button 
                      appearance="secondary" 
                      size="large"
                      icon={<Play24Regular />} 
                      onClick={handleResume}
                    >
                      Resume
                    </Button>
                  ) : null}
                </>
              )}
              
              <Button 
                appearance="outline" 
                size="large"
                icon={<Delete24Regular />} 
                onClick={handleClearProgress}
                disabled={isRunning}
              >
                Clear Progress
              </Button>
            </div>
          </div>
        </CardPreview>
      </Card>
    </div>
  );
};
