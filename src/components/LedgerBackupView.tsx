/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState } from 'react';
import { AzureFileShareService } from '../services/AzureFileShareService';
import {parseLedgerFilename, type LedgerFileInfo} from '../utils/ledger-validation';
import {
  makeStyles,
  Button,
  Text,
  Caption1,
  Input,
  Field,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  TableCellLayout,
  Spinner,
  Card,
  CardHeader,
  tokens,
} from '@fluentui/react-components';
import {
  StorageRegular,
  DocumentRegular,
  CheckmarkCircle24Regular,
} from '@fluentui/react-icons';
import { useFileDrop , useClearAllData } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
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
  emptyState: {
    textAlign: 'center',
    padding: '24px',
  },
  hidden: {
    display: 'none',
  },
  emptyTabContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  comingSoonIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
});

export const LedgerBackupView: React.FC = () => {
    const styles = useStyles();
    const clearAllDataMutation = useClearAllData();
    const [sasToken, setSasToken] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [ledgerFiles, setFiles] = useState<LedgerFileInfo[]>([]);
    const [downloadedLedgerFiles, setDownloadedFiles] = useState<LedgerFileInfo[]>([]);
    const [selectedLedgerFile, setSelectedFileToVisualize] = useState<LedgerFileInfo | null>(null);
    const fileShareService = React.useMemo(() => new AzureFileShareService(), []);
    const { handleFiles} = useFileDrop(); 

    const verifyAccess = async () => {
    if (!sasToken) {
        setVerificationError('Please enter a SAS token');
        setFiles([]);
        setIsVerifying(false);
        setIsDownloading(false);
        console.warn('SAS token is empty');
        return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setDownloadedFiles([]);
    setIsDownloading(false);

    try 
    {
        await clearAllDataMutation.mutateAsync();
        await fileShareService.initialize(sasToken);
        const ledgerFiles = await fileShareService.listLedgerFiles();
        setFiles(ledgerFiles);
        setVerificationError(null);
    } catch (error) {
        setVerificationError(error instanceof Error ? error.message : 'Failed to verify access');
        setFiles([]);
    } finally {
        setIsVerifying(false);
    }
    };

    const handleVisualizeFileSelect = async (fileToVisualize: LedgerFileInfo) => {
    setSelectedFileToVisualize(fileToVisualize);
    if (selectedLedgerFile!== null) 
    {
        console.log(`All Ledger files will be selected  till the end Transaction: ${selectedLedgerFile.endNo}`);
    }
    const { files: downloadedFiles, filesDownloaded }  = await fileShareService.downloadLedgerFiles(fileToVisualize);
    if (downloadedFiles.length > 0) 
    {
        handleFiles(downloadedFiles);
        setFiles([]);
        setDownloadedFiles(filesDownloaded);
    } 
    else 
    {
        console.error('No files downloaded');
    }
    };

    return (
        <div className={styles.emptyTabContent}>
        <div className={styles.comingSoonIcon}>
            <StorageRegular />
        </div>
        <Text size={500} weight="semibold">
            Load From Back Up
        </Text>
        <div style={{ width: '100%', maxWidth: '400px', margin: '20px 0' }}>
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
            {isVerifying ? <Spinner size="tiny" /> : 'Get Ledger Files'}
            </Button>
        </div>
        {/* Create Table to List all the ledger files present in the backup based on the SAS token provided */}
        {ledgerFiles.length > 0 && (
            <div
            style={{
                width: "100%",
                maxHeight: "500px",
                overflowY: "auto",
                overflowX: "auto",
                marginTop: "20px",
            }}
            >
            <Table style={{ width: "100%", tableLayout: "auto" }}>
                <TableHeader>
                <TableRow>
                    <TableHeaderCell style={{ whiteSpace: "nowrap" }}>Ledger File Name</TableHeaderCell>
                    <TableHeaderCell style={{ whiteSpace: "nowrap" }}></TableHeaderCell>
                </TableRow>
                </TableHeader>
                <TableBody>
                {ledgerFiles.map((file) => (
                    <TableRow
                    key={file.filename}
                    style={{ cursor: "pointer" }}
                    >
                    <TableCell>
                        <TableCellLayout media={<DocumentRegular />}>
                        {file.filename}
                        </TableCellLayout>
                    </TableCell>
                    <TableCell>
                        <Button
                        appearance="primary"
                        disabled={isDownloading}
                        onClick={() => {
                            setIsDownloading(true);
                            handleVisualizeFileSelect(file);
                        }}
                        >
                        {isDownloading ? <Spinner size="tiny" id = {file.filename} /> : 'Visualize Ledger Files'}
                        </Button>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </div>
        )}
        {/* Print File Sequence Info */}
        { downloadedLedgerFiles && downloadedLedgerFiles.length > 0 && (
            <div className={styles.fileSequenceInfo}>
            <Text size={300} weight="semibold" style={{ marginBottom: '8px' }}>
                Current Sequence:
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
        )}
        {/* Recently Uploaded Files */}
        {downloadedLedgerFiles && downloadedLedgerFiles.length > 0 && (
            <div className={styles.recentFiles}>
            <Text size={600} weight="semibold">
                Ledger Files ({downloadedLedgerFiles.length}) - Sequential Order
            </Text>

            {downloadedLedgerFiles
                .map(file => (parseLedgerFilename(file.filename)))
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
            
            {ledgerFiles.length > 10 && (
                <div className={styles.emptyState}>
                <Caption1>
                    + {ledgerFiles.length - 10} more files (showing first 10 in sequential order)
                </Caption1>
                </div>
            )}
            </div>
        )}
        </div>
    );
};