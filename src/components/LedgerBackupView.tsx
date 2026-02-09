/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { AzureFileShareService, type DownloadProgress } from '../services/AzureFileShareService';
import { parseLedgerFilename, type LedgerFileInfo } from '@microsoft/ccf-ledger-parser';
import type { ChunkFileInfo } from '../types/chunk-types';
import {
  makeStyles,
  Button,
  Text,
  Caption1,
  Input,
  Field,
  Spinner,
  Card,
  CardHeader,
  MessageBar,
  MessageBarBody,
  tokens,
} from '@fluentui/react-components';
import {
  StorageRegular,
  CheckmarkCircle24Regular,
} from '@fluentui/react-icons';
import { useFileDrop, useClearAllData, useLedgerFiles } from '../hooks/use-ccf-data';
import { type ImportMode } from './ReplaceDataConfirmDialog';
import { ChunkSelector } from './ChunkSelector';
import { verificationService } from '../services/verification-service';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px',
    width: '100%',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  headerIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.7,
  },
  connectionForm: {
    width: '100%',
    maxWidth: '500px',
    marginBottom: '24px',
  },
  selectorContainer: {
    width: '100%',
    marginTop: '16px',
  },
  fileSequenceInfo: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    width: '100%',
  },
  sequenceText: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
  recentFiles: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  fileCard: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: 'var(--shadow4)',
    },
  },
  fileCardContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
  },
  fileIcon: {
    fontSize: '32px',
    color: tokens.colorBrandBackground,
  },
  fileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fileName: {
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  progressContainer: {
    width: '100%',
    marginTop: '16px',
  },
});

export interface LedgerBackupViewProps {
  onImportComplete?: () => void;
}

export const LedgerBackupView: React.FC<LedgerBackupViewProps> = ({ onImportComplete }) => {
  const styles = useStyles();
  const clearAllDataMutation = useClearAllData();
  const { data: existingLedgerFiles } = useLedgerFiles();
  const [sasToken, setSasToken] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [ledgerFiles, setFiles] = useState<LedgerFileInfo[]>([]);
  const [downloadedLedgerFiles, setDownloadedFiles] = useState<LedgerFileInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const fileShareService = React.useMemo(() => new AzureFileShareService(), []);
  const { handleFiles } = useFileDrop();

  const hasExistingData = existingLedgerFiles && existingLedgerFiles.length > 0;

  // Convert LedgerFileInfo to ChunkFileInfo for the selector
  const chunkFiles: ChunkFileInfo[] = useMemo(() => {
    return ledgerFiles.map(file => ({
      ...file,
      id: file.filename, // Use filename as unique ID
    }));
  }, [ledgerFiles]);

  // Compute set of already-loaded range keys
  const existingRanges = useMemo(() => {
    if (!existingLedgerFiles) return new Set<string>();
    const ranges = new Set<string>();
    for (const file of existingLedgerFiles) {
      const parsed = parseLedgerFilename(file.filename);
      if (parsed.isValid) {
        ranges.add(`${parsed.startNo}-${parsed.endNo}`);
      }
    }
    return ranges;
  }, [existingLedgerFiles]);

  // Handle clear database
  const handleClearDatabase = useCallback(async () => {
    await clearAllDataMutation.mutateAsync();
  }, [clearAllDataMutation]);

  const verifyAccess = async () => {
    if (!sasToken) {
      setVerificationError('Please enter a SAS token');
      setFiles([]);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setDownloadedFiles([]);
    setIsDownloading(false);

    try {
      await fileShareService.initialize(sasToken);
      const files = await fileShareService.listLedgerFiles();
      setFiles(files);
      setVerificationError(null);
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : 'Failed to verify access');
      setFiles([]);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleImportClick = async (selectedFiles: ChunkFileInfo[], overwriteExisting: boolean, autoVerify: boolean) => {
    const mode: ImportMode = overwriteExisting ? 'replace' : 'append';
    await performImport(selectedFiles, mode, autoVerify);
  };

  const performImport = async (selectedFiles: ChunkFileInfo[], mode: ImportMode, autoVerify: boolean) => {
    setIsDownloading(true);
    setDownloadProgress(null);

    try {
      // Only clear existing data if user chose replace mode
      if (mode === 'replace') {
        await clearAllDataMutation.mutateAsync();
        // Clear any existing verification progress when replacing data
        verificationService.clearSavedProgress();
      }

      const filenames = selectedFiles.map(f => f.filename);
      const { files: downloadedFiles, filesDownloaded } = await fileShareService.downloadSelectedFiles(
        filenames,
        (progress) => setDownloadProgress(progress)
      );

      if (downloadedFiles.length > 0) {
        // Import files - shouldVerify controls inline merkle verification during parsing
        await handleFiles(downloadedFiles, { shouldVerify: autoVerify });
        setFiles([]);
        setDownloadedFiles(filesDownloaded);
        
        // Clear saved verification progress
        verificationService.clearSavedProgress();
        
        // If autoVerify is enabled, start the verification service to verify all chunks
        if (autoVerify) {
          // Start verification without awaiting - let it run in background
          verificationService.startVerification({ progressReportInterval: 50 });
        }
      } else {
        console.error('No files downloaded');
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
      
      // Close dialog only after import is complete
      onImportComplete?.();
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <StorageRegular />
        </div>
        <Text size={500} weight="semibold">
          Load From Azure Backup
        </Text>
        <Caption1>Import ledger chunks from an Azure File Share backup</Caption1>
      </div>

      {/* Connection Form */}
      <div className={styles.connectionForm}>
        <Field
          label="SAS Token"
          validationMessage={verificationError}
          validationState={verificationError ? "error" : "none"}
        >
          <Input
            type="url"
            value={sasToken}
            onChange={(_, data) => setSasToken(data.value)}
            placeholder="Enter your SAS token"
            style={{ width: '100%' }}
          />
        </Field>
        <Button
          appearance="primary"
          onClick={verifyAccess}
          disabled={isVerifying}
          style={{ marginTop: '10px' }}
        >
          {isVerifying ? <Spinner size="tiny" /> : 'Connect & List Files'}
        </Button>
      </div>

      {/* Download Progress */}
      {isDownloading && downloadProgress && (
        <div className={styles.progressContainer}>
          <MessageBar intent="info">
            <MessageBarBody>
              <Spinner size="tiny" style={{ marginRight: 8 }} />
              Downloading {downloadProgress.currentFile} of {downloadProgress.totalFiles}: {downloadProgress.currentFilename}
            </MessageBarBody>
          </MessageBar>
        </div>
      )}

      {/* Chunk Selector */}
      {chunkFiles.length > 0 && !isDownloading && (
        <div className={styles.selectorContainer}>
          <ChunkSelector
            files={chunkFiles}
            onImport={handleImportClick}
            isImporting={isDownloading}
            importButtonLabel="Import"
            showOverwriteOption={hasExistingData}
            defaultOverwrite={false}
            existingRanges={existingRanges}
            onClearDatabase={handleClearDatabase}
          />
        </div>
      )}

      {/* Downloaded Files Summary */}
      {downloadedLedgerFiles && downloadedLedgerFiles.length > 0 && (
        <>
          <div className={styles.fileSequenceInfo}>
            <Text size={300} weight="semibold" style={{ marginBottom: '8px' }}>
              Imported Sequence:
            </Text>
            <div className={styles.sequenceText}>
              {downloadedLedgerFiles
                .map(file => parseLedgerFilename(file.filename))
                .filter(info => info.isValid)
                .sort((a, b) => a.startNo - b.startNo)
                .map(info => `${info.startNo}-${info.endNo}`)
                .join(' → ')}
            </div>
          </div>

          <div className={styles.recentFiles}>
            <Text size={600} weight="semibold">
              Imported Files ({downloadedLedgerFiles.length})
            </Text>

            {downloadedLedgerFiles
              .map(file => parseLedgerFilename(file.filename))
              .filter(file => file.isValid)
              .sort((a, b) => a.startNo - b.startNo)
              .slice(0, 10)
              .map((file) => (
                <Card key={file.filename} className={styles.fileCard}>
                  <CardHeader
                    header={
                      <div className={styles.fileCardContent}>
                        <CheckmarkCircle24Regular className={styles.fileIcon} />
                        <div className={styles.fileInfo}>
                          <Text className={styles.fileName}>
                            {file.filename}
                          </Text>
                        </div>
                      </div>
                    }
                  />
                </Card>
              ))}

            {downloadedLedgerFiles.length > 10 && (
              <Caption1 style={{ textAlign: 'center', padding: '8px' }}>
                + {downloadedLedgerFiles.length - 10} more files
              </Caption1>
            )}
          </div>
        </>
      )}
    </div>
  );
};