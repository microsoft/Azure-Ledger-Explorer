/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  makeStyles,
  mergeClasses,
  Button,
  Text,
  Caption1,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  tokens,
} from '@fluentui/react-components';
import {
  CloudArrowUp24Regular,
  DocumentAdd24Regular,
} from '@fluentui/react-icons';
import { useFileDrop, useLedgerFiles, useClearAllData } from '../hooks/use-ccf-data';
import { parseLedgerFilename } from '@microsoft/ccf-ledger-parser';
import type { ChunkFileInfo } from '../types/chunk-types';
import { ChunkSelector } from './ChunkSelector';
import { type ImportMode } from './ReplaceDataConfirmDialog';
import { verificationService } from '../services/verification-service';

const useStyles = makeStyles({
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    height: '100%',
    overflow: 'auto',
  },
  dropZone: {
    background: 'linear-gradient(135deg, rgba(0,120,212,0.05), rgba(0,120,212,0.02))',
    border: '2px dashed rgba(0,120,212,0.3)',
    borderRadius: '8px',
    padding: '40px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    backdropFilter: 'blur(20px)',
    '&:hover': {
      border: '2px dashed #0078D4',
      boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
    },
  },
  dropZoneActive: {
    background: 'linear-gradient(135deg, rgba(0,120,212,0.15), rgba(0,120,212,0.08))',
    border: '2px dashed #0078D4',
    transform: 'scale(1.02)',
    boxShadow: '0 8px 32px rgba(0,120,212,0.15)',
  },
  dropZoneIcon: {
    fontSize: '48px',
    color: '#0078D4',
    marginBottom: '16px',
    transition: 'all 0.3s ease',
  },
  dropZoneIconActive: {
    opacity: '1',
    transform: 'scale(1.1)',
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  fileFormatHint: {
    marginTop: '12px',
    padding: '8px 16px',
    background: 'rgba(0,0,0,0.03)',
    borderRadius: '6px',
    color: tokens.colorNeutralForeground2,
  },
  dividerText: {
    margin: '8px 0',
    opacity: '0.6',
    color: tokens.colorNeutralForeground3,
  },
  dropZoneText: {
    marginBottom: '12px',
    color: tokens.colorNeutralForeground1,
  },
  dropZoneSubtext: {
    color: tokens.colorNeutralForeground3,
    marginBottom: '4px',
    display: 'block',
    fontSize: '12px',
  },
  hiddenInput: {
    display: 'none',
  },
  uploadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '24px',
  },
  relativePosition: {
    position: 'relative',
  },
  emptySubtext: {
    color: tokens.colorNeutralForeground3,
  },
  validationError: {
    marginBottom: '16px',
  },
  chunkSelectorWrapper: {
    marginTop: '16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
});

export interface FileUploadAreaProps {
  onImportComplete?: () => void;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({ onImportComplete }) => {
  const styles = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [chunkFiles, setChunkFiles] = useState<ChunkFileInfo[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  const { handleDragOver, handleFiles } = useFileDrop();
  const { data: existingLedgerFiles } = useLedgerFiles();
  const clearAllDataMutation = useClearAllData();

  const hasExistingData = existingLedgerFiles && existingLedgerFiles.length > 0;

  // Convert existing database files to ChunkFileInfo format
  const existingChunkFiles = useMemo((): ChunkFileInfo[] => {
    if (!existingLedgerFiles) return [];
    return existingLedgerFiles
      .map(file => {
        const parsed = parseLedgerFilename(file.filename);
        if (!parsed.isValid) return null;
        return {
          id: `existing-${file.id}`,
          filename: file.filename,
          startNo: parsed.startNo,
          endNo: parsed.endNo,
          isValid: true,
          size: file.fileSize,
          lastModified: file.createdAt ? new Date(file.createdAt) : undefined,
          isExisting: true, // Mark as already in database
        } as ChunkFileInfo;
      })
      .filter((chunk): chunk is ChunkFileInfo => chunk !== null);
  }, [existingLedgerFiles]);

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

  // Combine existing and new files for display
  const allChunkFiles = useMemo(() => {
    // Combine existing files with newly selected files
    // Filter out any newly selected files that duplicate existing ones
    const newFilesFiltered = chunkFiles.filter(f => {
      const rangeKey = `${f.startNo}-${f.endNo}`;
      return !existingRanges.has(rangeKey);
    });
    return [...existingChunkFiles, ...newFilesFiltered];
  }, [existingChunkFiles, chunkFiles, existingRanges]);

  // Handle clear database
  const handleClearDatabase = useCallback(async () => {
    await clearAllDataMutation.mutateAsync();
  }, [clearAllDataMutation]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Convert selected files to ChunkFileInfo for the ChunkSelector
  const processSelectedFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Filter for .committed files only
    const committedFiles = fileArray.filter(file => file.name.endsWith('.committed'));
    
    if (fileArray.length > committedFiles.length) {
      const rejectedFiles = fileArray.filter(file => !file.name.endsWith('.committed'));
      console.warn('Rejected non-.committed files:', rejectedFiles.map(f => f.name));
    }
    
    if (committedFiles.length === 0) {
      setImportError('No valid .committed files found. Please select files with .committed extension.');
      return;
    }

    // Parse and convert to ChunkFileInfo
    const chunks: ChunkFileInfo[] = committedFiles
      .map(file => {
        const parsed = parseLedgerFilename(file.name);
        if (!parsed.isValid) return null;
        return {
          id: file.name,
          filename: file.name,
          startNo: parsed.startNo,
          endNo: parsed.endNo,
          isValid: true,
          size: file.size,
          lastModified: new Date(file.lastModified),
        } as ChunkFileInfo;
      })
      .filter((chunk): chunk is ChunkFileInfo => chunk !== null);

    if (chunks.length === 0) {
      setImportError('No valid ledger files found. Files must be named like ledger_1-18.committed');
      return;
    }

    // Clear previous state
    setImportError(null);
    setPendingFiles(committedFiles);
    setChunkFiles(chunks);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processSelectedFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDropZoneDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragActive(false);
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    processSelectedFiles(files);
  };

  // Perform the import of selected files
  const doImport = useCallback(async (
    selectedFiles: ChunkFileInfo[], 
    allPendingFiles: File[], 
    mode: ImportMode,
    autoVerify: boolean
  ) => {
    if (selectedFiles.length === 0) return;

    // Close dialog immediately when import starts
    onImportComplete?.();

    setIsImporting(true);
    setImportError(null);

    try {
      if (mode === 'replace') {
        await clearAllDataMutation.mutateAsync();
        // Clear any existing verification progress when replacing data
        verificationService.clearSavedProgress();
      }

      // Build selected filenames
      const selectedFilenames = new Set(selectedFiles.map(f => f.filename));

      // Filter pending files to only include selected ones
      const filesToImport = allPendingFiles.filter(f => selectedFilenames.has(f.name));
      
      if (filesToImport.length > 0) {
        // Import files - shouldVerify controls inline merkle verification during parsing
        await handleFiles(filesToImport, { shouldVerify: autoVerify });
      }

      // Clear state after successful import
      setPendingFiles([]);
      setChunkFiles([]);
      
      // Clear saved verification progress
      verificationService.clearSavedProgress();
      
      // If autoVerify is enabled, start the verification service to verify all chunks
      // This runs after import and provides UI feedback on verification progress
      if (autoVerify) {
        // Start verification without awaiting - let it run in background
        verificationService.startVerification({ progressReportInterval: 50 });
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import files');
    } finally {
      setIsImporting(false);
    }
  }, [clearAllDataMutation, handleFiles, onImportComplete]);

  // Called from ChunkSelector's onImport - uses overwrite preference and autoVerify from ChunkSelector
  const handleImportRequest = useCallback((selectedFiles: ChunkFileInfo[], overwriteExisting: boolean, autoVerify: boolean) => {
    const mode: ImportMode = overwriteExisting ? 'replace' : 'append';
    doImport(selectedFiles, pendingFiles, mode, autoVerify);
  }, [doImport, pendingFiles]);

  return (
    <div className={styles.container}>
      {/* Drop Zone */}
      <div
        className={mergeClasses(styles.dropZone, isDragActive && styles.dropZoneActive)}
        onClick={handleClick}
        onDrop={handleDropZoneDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <div className={styles.relativePosition}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".committed"
            onChange={handleFileChange}
            className={styles.hiddenInput}
            aria-label="Upload ledger files"
          />

          {!isImporting ? (
            <div style={{ textAlign: 'center' }}>
              <CloudArrowUp24Regular 
                className={mergeClasses(styles.dropZoneIcon, isDragActive && styles.dropZoneIconActive)}
                style={{
                  opacity: isDragActive ? 1 : 0.7,
                  transform: isDragActive ? 'scale(1.1)' : 'scale(1)',
                }}
              />
              <div className={styles.dropZoneContent}>
                <Text size={500} weight="semibold" style={{ color: '#0078D4' }}>
                  {isDragActive ? 'Release to upload' : 'Drop files here'}
                </Text>
                <Text size={200} className={styles.dividerText}>
                  — or —
                </Text>
                <Button 
                  appearance="primary" 
                  size="large" 
                  icon={<DocumentAdd24Regular />}
                  style={{
                    background: 'linear-gradient(135deg, #0078D4, #005a9e)',
                    boxShadow: '0 4px 12px rgba(0,120,212,0.3)',
                  }}
                >
                  Browse Files
                </Button>
                <Caption1 className={styles.fileFormatHint}>
                  .committed files only • Format: ledger_1-18.committed
                </Caption1>
              </div>
            </div>
          ) : (
            <div className={styles.uploadingContent}>
              <Spinner size="large" />
              <Text size={500} weight="semibold">
                Processing ledger files...
              </Text>
              <Caption1>
                Parsing transactions and storing to database
              </Caption1>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {importError && (
        <MessageBar intent="error" className={styles.validationError}>
          <MessageBarBody>
            <MessageBarTitle>Import Error</MessageBarTitle>
            {importError}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Chunk Selector - show when there are files (existing or newly selected) */}
      {allChunkFiles.length > 0 && (
        <div className={styles.chunkSelectorWrapper}>
          <ChunkSelector
            files={allChunkFiles}
            onImport={handleImportRequest}
            isImporting={isImporting}
            importButtonLabel="Import Selected"
            showOverwriteOption={hasExistingData}
            defaultOverwrite={false}
            existingRanges={existingRanges}
            onClearDatabase={handleClearDatabase}
          />
        </div>
      )}

      {/* Empty State */}
      {allChunkFiles.length === 0 && !isImporting && (
        <div className={styles.emptyState}>
          <Caption1 className={styles.emptySubtext}>
            Select ledger .committed files to preview and import.
          </Caption1>
        </div>
      )}
    </div>
  );
};