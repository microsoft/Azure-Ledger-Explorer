import React, { useRef, useState } from 'react';
import {
  makeStyles,
  Button,
  Text,
  Caption1,
  Spinner,
  Card,
  CardHeader,
  CardPreview,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  tokens,
} from '@fluentui/react-components';
import {
  CloudArrowUp24Regular,
  DocumentAdd24Regular,
  CheckmarkCircle24Regular,
  CheckmarkCircle20Filled,
  DismissCircle20Filled,
  Info20Regular,
} from '@fluentui/react-icons';
import { useFileDrop, useLedgerFiles } from '../hooks/use-ccf-data';
import { 
  validateLedgerSequence, 
  parseLedgerFilename, 
  formatFileSize, 
  formatDate,
  type LedgerFileInfo,
  type ValidationResult 
} from '../utils/ledger-validation';

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
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    padding: '48px 24px',
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1,
    },
  },
  dropZoneActive: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  dropZoneIcon: {
    fontSize: '48px',
    color: tokens.colorNeutralForeground3,
    marginBottom: '16px',
  },
  dropZoneText: {
    marginBottom: '8px',
    color: tokens.colorNeutralForeground2,
  },
  dropZoneSubtext: {
    color: tokens.colorNeutralForeground3,
    marginBottom: '16px',
  },
  hiddenInput: {
    display: 'none',
  },
  recentFiles: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  fileDetails: {
    color: tokens.colorNeutralForeground3,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colorNeutralBackground1Pressed,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  uploadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  errorCard: {
    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
  },
  emptyState: {
    textAlign: 'center',
    padding: '24px',
  },
  relativePosition: {
    position: 'relative',
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
  },
  emptySubtext: {
    color: tokens.colorNeutralForeground3,
  },
  validationError: {
    marginBottom: '16px',
  },
  validationWarning: {
    marginBottom: '16px',
  },
  fileSequenceInfo: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  sequenceText: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
  fileSelectionFeedback: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  feedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  feedbackStats: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statIcon: {
    fontSize: '16px',
  },
  newFileIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },
  skippedFileIcon: {
    color: tokens.colorNeutralForeground3,
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '200px',
    overflow: 'auto',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground1,
    fontSize: '12px',
  },
  fileItemSkipped: {
    opacity: 0.6,
  },
});

export const FileUploadArea: React.FC = () => {
  const styles = useStyles();
  const localFileUpload = false; // Enable local file upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFilesInfo, setSelectedFilesInfo] = useState<{
    newFiles: LedgerFileInfo[];
    skippedFiles: LedgerFileInfo[];
    totalSelected: number;
  } | null>(null);
  const [uploadCompleted, setUploadCompleted] = useState(false);
  
  const { handleDragOver, handleFiles, isUploading, uploadError } = useFileDrop();
  const { data: ledgerFiles, refetch: refetchFiles } = useLedgerFiles();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const validateAndHandleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Reset upload completed state when selecting new files
    setUploadCompleted(false);
    
    // Filter for .committed files only
    const committedFiles = fileArray.filter(file => file.name.endsWith('.committed'));
    
    if (fileArray.length > committedFiles.length) {
      const rejectedFiles = fileArray.filter(file => !file.name.endsWith('.committed'));
      console.warn('Rejected non-.committed files:', rejectedFiles.map(f => f.name));
    }
    
    if (committedFiles.length === 0) {
      setValidationResult({
        isValid: false,
        errors: ['No valid .committed files found. Please select files with .committed extension.'],
        sortedFiles: [],
        missingRanges: [],
      });
      setSelectedFilesInfo(null);
      return;
    }
    
    // Get existing file info
    const existingFileInfos: LedgerFileInfo[] = ledgerFiles?.map(file => 
      parseLedgerFilename(file.filename)
    ).filter(info => info.isValid) || [];
    
    // Parse selected files
    const selectedFileInfos = committedFiles.map(file => parseLedgerFilename(file.name));
    
    // Check for invalid filenames FIRST (before duplicate detection)
    const invalidFiles = selectedFileInfos.filter(info => !info.isValid);
    if (invalidFiles.length > 0) {
      // Show validation error for invalid filenames
      const validation = validateLedgerSequence(committedFiles, existingFileInfos);
      setValidationResult(validation);
      setSelectedFilesInfo(null);
      return;
    }
    
    // Categorize files: new vs already imported (only valid files at this point)
    const existingFilenames = new Set(existingFileInfos.map(f => f.filename));
    const newFiles = selectedFileInfos.filter(info => !existingFilenames.has(info.filename));
    const skippedFiles = selectedFileInfos.filter(info => existingFilenames.has(info.filename));
    
    // Set file selection feedback
    setSelectedFilesInfo({
      newFiles,
      skippedFiles,
      totalSelected: committedFiles.length,
    });
    
    // If we have new files to import or if all files are duplicates (skipped), don't show error
    if (newFiles.length > 0 || skippedFiles.length === committedFiles.length) {
      // Clear any validation errors since we're handling duplicates gracefully
      setValidationResult(null);
      
      // Only process new files (skip duplicates)
      const newFilesArray = committedFiles.filter(file => 
        newFiles.some(info => info.filename === file.name)
      );
      
      if (newFilesArray.length > 0) {
        handleFiles(newFilesArray);
      }
    } else {
      // Validate the sequence only if we have issues beyond duplicates
      const validation = validateLedgerSequence(committedFiles, existingFileInfos);
      setValidationResult(validation);
      
      if (validation.isValid) {
        handleFiles(committedFiles);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      validateAndHandleFiles(event.target.files);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // Only set drag inactive if we're leaving the drop zone entirely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDropZoneDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragActive(false);
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    validateAndHandleFiles(files);
  };

  React.useEffect(() => {
    if (!isUploading && selectedFilesInfo && !uploadCompleted) {
      // Mark upload as completed
      setUploadCompleted(true);
      refetchFiles();
      
      // Don't auto-clear feedback - let it stay visible for user review
      // Only clear if user starts a new upload
    } else if (isUploading) {
      // Reset uploadCompleted when starting new upload
      setUploadCompleted(false);
    }
  }, [isUploading, refetchFiles, selectedFilesInfo, uploadCompleted]);

  return (
    <div className={styles.container}>
      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${isDragActive ? styles.dropZoneActive : ''}`}
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
          aria-label="Upload CCF ledger files"
        />

        {!isUploading ? (
          <>
            <CloudArrowUp24Regular className={styles.dropZoneIcon} />
            <Text className={styles.dropZoneText} size={500} weight="semibold">
              {isDragActive ? 'Drop .committed files here' : 'Drag and drop CCF ledger .committed files'}
            </Text>
            <Caption1 className={styles.dropZoneSubtext}>
              Files must be named: ledger_&lt;start&gt;-&lt;end&gt;.committed (e.g., ledger_1-18.committed)
            </Caption1>
            <Button appearance="primary" icon={<DocumentAdd24Regular />}>
              Select .committed Files
            </Button>
          </>
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

      {/* Validation Errors */}
      {validationResult && !validationResult.isValid && (
        <MessageBar intent="error" className={styles.validationError}>
          <MessageBarBody>
            <MessageBarTitle>Invalid File Sequence</MessageBarTitle>
            {validationResult.errors.map((error, index) => (
              <div key={index}>• {error}</div>
            ))}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* File Selection Feedback */}
      {selectedFilesInfo && selectedFilesInfo.totalSelected > 0 && (
        <div className={styles.fileSelectionFeedback}>
          <div className={styles.feedbackHeader}>
            <Text size={400} weight="semibold">
              Selected Files ({selectedFilesInfo.totalSelected})
            </Text>
            <div className={styles.feedbackStats}>
              {selectedFilesInfo.newFiles.length > 0 && (
                <div className={styles.statItem}>
                  <CheckmarkCircle20Filled className={`${styles.statIcon} ${styles.newFileIcon}`} />
                  <Text size={200}>{selectedFilesInfo.newFiles.length} to import</Text>
                </div>
              )}
              {selectedFilesInfo.skippedFiles.length > 0 && (
                <div className={styles.statItem}>
                  <Info20Regular className={`${styles.statIcon} ${styles.skippedFileIcon}`} />
                  <Text size={200}>{selectedFilesInfo.skippedFiles.length} already imported</Text>
                </div>
              )}
            </div>
          </div>
          <div className={styles.fileList}>
            {selectedFilesInfo.newFiles.map((file, index) => (
              <div key={`new-${index}`} className={styles.fileItem}>
                <CheckmarkCircle20Filled className={`${styles.statIcon} ${styles.newFileIcon}`} />
                <Text size={200} style={{ flex: 1 }}>{file.filename}</Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                  {file.startNo}-{file.endNo}
                </Text>
              </div>
            ))}
            {selectedFilesInfo.skippedFiles.map((file, index) => (
              <div key={`skipped-${index}`} className={`${styles.fileItem} ${styles.fileItemSkipped}`}>
                <DismissCircle20Filled className={`${styles.statIcon} ${styles.skippedFileIcon}`} />
                <Text size={200} style={{ flex: 1 }}>{file.filename}</Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                  Already imported
                </Text>
              </div>
            ))}
          </div>
          
          {/* Show success message after upload completes */}
          {uploadCompleted && selectedFilesInfo.newFiles.length > 0 && (
            <MessageBar intent="success" style={{ marginTop: '12px' }}>
              <MessageBarBody>
                <MessageBarTitle>Upload Complete!</MessageBarTitle>
                Successfully imported {selectedFilesInfo.newFiles.length} file(s). 
                You can close this dialog or upload more files.
              </MessageBarBody>
            </MessageBar>
          )}
        </div>
      )}

      {/* File Sequence Info */}
      {localFileUpload &&  ledgerFiles && ledgerFiles.length > 0 && (
        <div className={styles.fileSequenceInfo}>
          <Text size={300} weight="semibold" style={{ marginBottom: '8px' }}>
            Current Sequence:
          </Text>
          <div className={styles.sequenceText}>
            {ledgerFiles
              .map(file => parseLedgerFilename(file.filename))
              .filter(info => info.isValid)
              .sort((a, b) => a.startNo - b.startNo)
              .map(info => `${info.startNo}-${info.endNo}`)
              .join(' → ')}
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <Card className={`${styles.fileCard} ${styles.errorCard}`}>
          <CardPreview>
            <div className={styles.fileCardContent}>
              <Text className={`${styles.fileName} ${styles.errorText}`}>
                Upload Error
              </Text>
              <Caption1 className={styles.fileDetails}>
                {uploadError.message}
              </Caption1>
            </div>
          </CardPreview>
        </Card>
      )}

      {/* Recently Uploaded Files */}
      {localFileUpload && ledgerFiles && ledgerFiles.length > 0 && (
        <div className={styles.recentFiles}>
          <Text size={600} weight="semibold">
            Ledger Files ({ledgerFiles.length}) - Sequential Order
          </Text>
          
          {ledgerFiles
            .map(file => ({ ...file, ...parseLedgerFilename(file.filename) }))
            .filter(file => file.isValid)
            .sort((a, b) => a.startNo - b.startNo)
            .slice(0, 10)
            .map((file) => (
              <Card key={file.id} className={styles.fileCard}>
                <CardHeader
                  header={
                    <div className={styles.fileCardContent}>
                      <CheckmarkCircle24Regular className={styles.fileIcon} />
                      <div className={styles.fileInfo}>
                        <Text className={styles.fileName}>
                          {file.filename}
                        </Text>
                        <Caption1 className={styles.fileDetails}>
                          Range: {file.startNo}-{file.endNo} • {formatFileSize(file.fileSize)} • {formatDate(file.createdAt)}
                        </Caption1>
                      </div>
                    </div>
                  }
                />
              </Card>
            ))}
          
          {ledgerFiles.length > 10 && (
            <div className={styles.emptyState}>
              <Caption1>
                + {ledgerFiles.length - 10} more files (showing first 10 in sequential order)
              </Caption1>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!ledgerFiles || (ledgerFiles.length === 0 && !isUploading) && (
        <div className={styles.emptyState}>
          <Caption1 className={styles.emptySubtext}>
            No ledger files uploaded yet. Start by uploading CCF ledger .committed files in sequential order starting from ledger_1-X.committed.
          </Caption1>
        </div>
      )}
    </div>
  );
};