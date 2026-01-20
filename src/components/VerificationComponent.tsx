/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useMemo } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Text,
  ProgressBar,
  MessageBar,
  MessageBarBody,
  Badge,
  Tooltip,
  makeStyles,
  tokens,
  Divider,
} from '@fluentui/react-components';
import {
  Play24Regular,
  Pause24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  Stop24Regular,
  Clock24Regular,
  ShieldCheckmark24Regular,
  DocumentMultiple24Regular,
  ArrowSync24Regular,
  Info24Regular,
} from '@fluentui/react-icons';
import { useVerification } from '../hooks/use-verification';
import { useLedgerFiles } from '../hooks/use-ccf-data';
import type { VerificationConfig } from '../types/verification-types';
import type { LedgerFile } from '@ccf/database';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalL,
    maxWidth: '1200px',
    margin: '0 auto',
  },
  
  // Hero section at the top
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXXL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusXLarge,
    textAlign: 'center',
  },
  heroIcon: {
    fontSize: '64px',
    color: tokens.colorBrandForeground1,
  },
  heroStats: {
    display: 'flex',
    gap: tokens.spacingHorizontalXXL,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: tokens.spacingVerticalM,
    minWidth: '100px',
  },
  statNumber: {
    fontSize: tokens.fontSizeHero900,
    fontWeight: tokens.fontWeightBold,
    lineHeight: '1',
  },
  statLabel: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },
  
  // Controls section
  controlsCard: {
    padding: tokens.spacingVerticalL,
  },
  controlsRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalM,
  },
  
  // Chunk grid visualization
  chunkGridSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  chunkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  chunkCard: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    transition: 'all 0.2s ease',
    cursor: 'default',
  },
  chunkCardVerified: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  chunkCardFailed: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
  },
  chunkCardPending: {
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  chunkCardActive: {
    backgroundColor: tokens.colorPaletteBerryBackground1,
    border: `1px solid ${tokens.colorPaletteBerryBorder1}`,
    boxShadow: tokens.shadow8,
    transform: 'scale(1.02)',
  },
  chunkName: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chunkMeta: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  chunkStatusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacingVerticalXS,
  },
  
  // Progress section
  progressSection: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalM,
  },
  
  // Verification timeline/log
  logSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logContainer: {
    maxHeight: '300px',
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  logEntry: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    fontSize: tokens.fontSizeBase200,
    ':last-child': {
      borderBottom: 'none',
    },
  },
  logTime: {
    color: tokens.colorNeutralForeground3,
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase100,
    minWidth: '80px',
  },
  logMessage: {
    flex: 1,
  },
  logSuccess: {
    color: tokens.colorPaletteGreenForeground1,
  },
  logError: {
    color: tokens.colorPaletteRedForeground1,
  },
  logInfo: {
    color: tokens.colorNeutralForeground2,
  },
  
  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
});

// Log entry type for verification history
interface LogEntry {
  id: number;
  time: Date;
  type: 'info' | 'success' | 'error';
  message: string;
}

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper to format time
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const VerificationComponent: React.FC = () => {
  const styles = useStyles();
  const { data: ledgerFiles = [] } = useLedgerFiles();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logIdCounter, setLogIdCounter] = useState(0);
  
  const [config] = useState<VerificationConfig>({
    progressReportInterval: 50
  });

  const {
    progress,
    isRunning,
    error,
    start: startVerification,
    pause: pauseVerification,
    resume: resumeVerification,
    stop: stopVerification,
  } = useVerification();

  // Calculate verification stats
  const stats = useMemo(() => {
    const verified = ledgerFiles.filter((f: LedgerFile) => f.verified === true).length;
    const failed = ledgerFiles.filter((f: LedgerFile) => f.verified === false).length;
    const pending = ledgerFiles.filter((f: LedgerFile) => f.verified === null).length;
    const total = ledgerFiles.length;
    const totalSize = ledgerFiles.reduce((acc: number, f: LedgerFile) => acc + f.fileSize, 0);
    return { verified, failed, pending, total, totalSize };
  }, [ledgerFiles]);

  // Add log entry helper
  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [{
      id: logIdCounter,
      time: new Date(),
      type,
      message
    }, ...prev].slice(0, 100)); // Keep last 100 entries
    setLogIdCounter(c => c + 1);
  };

  const handleStart = async () => {
    try {
      addLog('info', '🚀 Starting verification of all chunks...');
      await startVerification(config);
      addLog('success', '✅ Verification completed successfully');
    } catch (err) {
      addLog('error', `❌ Verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePause = () => {
    addLog('info', '⏸️ Verification paused');
    pauseVerification();
  };

  const handleResume = () => {
    addLog('info', '▶️ Verification resumed');
    resumeVerification();
  };

  const handleStop = () => {
    addLog('info', '⏹️ Verification stopped');
    stopVerification();
  };

  // Progress is now chunk-based
  const progressPercentage = progress 
    ? Math.round((progress.currentChunk / Math.max(1, progress.totalChunks)) * 100) 
    : 0;

  // Current chunk index comes directly from progress now
  const currentChunkIndex = useMemo(() => {
    if (!progress || !isRunning) return -1;
    return progress.currentChunk;
  }, [progress, isRunning]);

  const getChunkCardClass = (file: LedgerFile, index: number): string => {
    const baseClass = styles.chunkCard;
    if (isRunning && index === currentChunkIndex) {
      return `${baseClass} ${styles.chunkCardActive}`;
    }
    if (file.verified === true) {
      return `${baseClass} ${styles.chunkCardVerified}`;
    }
    if (file.verified === false) {
      return `${baseClass} ${styles.chunkCardFailed}`;
    }
    return `${baseClass} ${styles.chunkCardPending}`;
  };

  const getStatusIcon = (file: LedgerFile, index: number) => {
    if (isRunning && index === currentChunkIndex) {
      return <ArrowSync24Regular style={{ color: tokens.colorPaletteBerryForeground1 }} />;
    }
    if (file.verified === true) {
      return <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />;
    }
    if (file.verified === false) {
      return <ErrorCircle24Regular style={{ color: tokens.colorPaletteRedForeground1 }} />;
    }
    return <Clock24Regular style={{ color: tokens.colorNeutralForeground3 }} />;
  };

  return (
    <div className={styles.container}>
      {/* Hero Section with Stats */}
      <div className={styles.heroSection}>
        <ShieldCheckmark24Regular className={styles.heroIcon} />
        <Text size={800} weight="bold">Merkle Tree Verification</Text>
        <Text size={400} style={{ color: tokens.colorNeutralForeground3, maxWidth: '600px' }}>
          Verify the cryptographic integrity of your ledger by rebuilding and validating
          the Merkle tree against signed roots in each chunk.
        </Text>
        
        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <span className={styles.statNumber} style={{ color: tokens.colorPaletteGreenForeground1 }}>
              {stats.verified}
            </span>
            <Text className={styles.statLabel}>Verified</Text>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber} style={{ color: tokens.colorPaletteRedForeground1 }}>
              {stats.failed}
            </span>
            <Text className={styles.statLabel}>Failed</Text>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber} style={{ color: tokens.colorNeutralForeground3 }}>
              {stats.pending}
            </span>
            <Text className={styles.statLabel}>Pending</Text>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber} style={{ color: tokens.colorBrandForeground1 }}>
              {stats.total}
            </span>
            <Text className={styles.statLabel}>Total Chunks</Text>
          </div>
        </div>
      </div>

      {/* Controls Card */}
      <Card className={styles.controlsCard}>
        <CardHeader
          header={<Text size={500} weight="semibold">Verification Controls</Text>}
          description={
            stats.pending > 0 
              ? `${stats.pending} chunk${stats.pending > 1 ? 's' : ''} awaiting verification`
              : stats.failed > 0
                ? `${stats.failed} chunk${stats.failed > 1 ? 's' : ''} failed verification`
                : 'All chunks verified'
          }
          action={
            <Tooltip content="Verification reads data from the database and rebuilds the Merkle tree to check against signed roots" relationship="label">
              <Info24Regular style={{ color: tokens.colorNeutralForeground3 }} />
            </Tooltip>
          }
        />
        
        <div className={styles.controlsRow}>
          {!isRunning ? (
            <Button 
              appearance="primary" 
              size="large"
              icon={<Play24Regular />} 
              onClick={handleStart}
              disabled={stats.total === 0}
            >
              {stats.pending === stats.total ? 'Verify All' : 'Re-verify All'}
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
                  appearance="primary" 
                  size="large"
                  icon={<Play24Regular />} 
                  onClick={handleResume}
                >
                  Resume
                </Button>
              ) : null}
              <Button 
                appearance="outline" 
                size="large"
                icon={<Stop24Regular />} 
                onClick={handleStop}
              >
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Progress Bar when running */}
        {progress && isRunning && (
          <div className={styles.progressSection} style={{ marginTop: tokens.spacingVerticalM }}>
            <div className={styles.progressHeader}>
              <Text>
                Chunk {progress.currentChunk + 1} of {progress.totalChunks}
                {progress.currentChunkName && ` — ${progress.currentChunkName}`}
              </Text>
              <Badge appearance="tint" color="brand">{progressPercentage}%</Badge>
            </div>
            <ProgressBar value={progressPercentage / 100} />
          </div>
        )}
      </Card>

      {/* Error Display */}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <strong>Verification failed:</strong> {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Success Display */}
      {progress?.status === 'completed' && !error && (progress.failedChunks ?? 0) === 0 && (
        <MessageBar intent="success">
          <MessageBarBody>
            ✅ Verification complete! All {progress.totalChunks} chunks passed integrity checks.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Partial Success Display (some failures) */}
      {progress?.status === 'completed' && !error && (progress.failedChunks ?? 0) > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>
            ⚠️ Verification complete with issues: {progress.verifiedChunks} of {progress.totalChunks} chunks passed, {progress.failedChunks} failed.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Chunk Grid Visualization */}
      <div className={styles.chunkGridSection}>
        <Divider>
          <Text size={400} weight="semibold">
            <DocumentMultiple24Regular style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Chunk Status
          </Text>
        </Divider>
        
        {ledgerFiles.length === 0 ? (
          <div className={styles.emptyState}>
            <DocumentMultiple24Regular style={{ fontSize: '48px' }} />
            <Text size={400}>No ledger files loaded</Text>
            <Text size={300}>Import ledger files to begin verification</Text>
          </div>
        ) : (
          <div className={styles.chunkGrid}>
            {ledgerFiles.map((file: LedgerFile, index: number) => (
              <Tooltip
                key={file.id}
                content={
                  <div>
                    <div><strong>{file.filename}</strong></div>
                    <div>Size: {formatFileSize(file.fileSize)}</div>
                    <div>Status: {file.verified === true ? 'Verified' : file.verified === false ? 'Failed' : 'Pending'}</div>
                    {file.verifiedAt && <div>Verified: {new Date(file.verifiedAt).toLocaleString()}</div>}
                    {file.verificationError && <div style={{ color: tokens.colorPaletteRedForeground1 }}>Error: {file.verificationError}</div>}
                  </div>
                }
                relationship="description"
              >
                <div className={getChunkCardClass(file, index)}>
                  <span className={styles.chunkName}>{file.filename}</span>
                  <span className={styles.chunkMeta}>{formatFileSize(file.fileSize)}</span>
                  <div className={styles.chunkStatusRow}>
                    {getStatusIcon(file, index)}
                    {file.verified === true && (
                      <Badge appearance="tint" color="success" size="small">✓</Badge>
                    )}
                    {file.verified === false && (
                      <Badge appearance="tint" color="danger" size="small">✗</Badge>
                    )}
                    {file.verified === null && (
                      <Badge appearance="tint" color="subtle" size="small">—</Badge>
                    )}
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {/* Verification Log */}
      {logs.length > 0 && (
        <div className={styles.logSection}>
          <div className={styles.logHeader}>
            <Text size={400} weight="semibold">Verification Log</Text>
            <Button appearance="subtle" size="small" onClick={() => setLogs([])}>
              Clear
            </Button>
          </div>
          <div className={styles.logContainer}>
            {logs.map(log => (
              <div key={log.id} className={styles.logEntry}>
                <span className={styles.logTime}>{formatTime(log.time)}</span>
                <span className={`${styles.logMessage} ${
                  log.type === 'success' ? styles.logSuccess :
                  log.type === 'error' ? styles.logError :
                  styles.logInfo
                }`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
