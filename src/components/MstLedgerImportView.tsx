/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState } from 'react';
/* eslint-disable react-refresh/only-export-components */
import { MstFilesService } from '../services/MstFilesService';
import { parseLedgerFilename, type LedgerFileInfo } from '../utils/ledger-validation';
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
    Tooltip,
    tokens,
} from '@fluentui/react-components';
import {
    StorageRegular,
    DocumentRegular,
    CheckmarkCircle24Regular,
} from '@fluentui/react-icons';
import { useFileDrop, useClearAllData, useLedgerFiles } from '../hooks/use-ccf-data';
import { setLedgerDomain as storeLedgerDomain } from '../utils/ledger-domain-storage';
import { ReplaceDataConfirmDialog } from './ReplaceDataConfirmDialog';


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

export const useDownloadMstFiles = () => {

    const { handleFiles } = useFileDrop();

    const downloadFiles = async (targetDomain?: string) => {
        const domainToUse = targetDomain;
        if (!domainToUse) {
            throw new Error('Domain is required to download files');
        }
        const fileShareService = new MstFilesService();
        await fileShareService.initialize(domainToUse);
        const { files: downloadedFiles } = await fileShareService.downloadAllLedgerFiles();
        await handleFiles(downloadedFiles);
    };

    return { 
        downloadFiles 
    };
};

export const MstLedgerImportView: React.FC = () => {
    const styles = useStyles();
    const clearAllDataMutation = useClearAllData();
    const { data: existingLedgerFiles } = useLedgerFiles();
    const [ledgerDomain, setLedgerDomain] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [ledgerFiles, setFiles] = useState<LedgerFileInfo[]>([]);
    const [downloadedLedgerFiles, setDownloadedFiles] = useState<LedgerFileInfo[]>([]);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingFileToVisualize, setPendingFileToVisualize] = useState<LedgerFileInfo | null>(null);
    const fileShareService = React.useMemo(() => new MstFilesService(), []);
    const { handleFiles } = useFileDrop();

    const hasExistingData = existingLedgerFiles && existingLedgerFiles.length > 0;

    const verifyAccess = async () => {
        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
        if (!ledgerDomain || !domainRegex.test(ledgerDomain)) {
            setVerificationError('Please enter a valid MST domain, e.g myledger.confidential-ledger.azure.com');
            setFiles([]);
            setIsVerifying(false);
            setIsDownloading(false);
            console.warn('Invalid MST domain format', ledgerDomain);
            return;
        }

        setIsVerifying(true);
        setVerificationError(null);
        setDownloadedFiles([]);
        setIsDownloading(false);

        try {
            await fileShareService.initialize(ledgerDomain);
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

    const handleVisualizeClick = (file: LedgerFileInfo) => {
        if (hasExistingData) {
            // Show confirmation dialog before clearing existing data
            setPendingFileToVisualize(file);
            setShowConfirmDialog(true);
        } else {
            // No existing data, proceed directly
            performVisualize(file);
        }
    };

    const performVisualize = async (fileToVisualize: LedgerFileInfo) => {
        setIsDownloading(true);
        
        // Clear existing data before importing new files
        await clearAllDataMutation.mutateAsync();
        
        const { files: downloadedFiles, filesDownloaded } = await fileShareService.downloadLedgerFiles(fileToVisualize);
        if (downloadedFiles.length > 0) {
            handleFiles(downloadedFiles);

            if (ledgerDomain) {
                storeLedgerDomain(ledgerDomain, 'MST');
            }
            
            setFiles([]);
            setDownloadedFiles(filesDownloaded);
        }
        else {
            console.error('No files downloaded');
        }
        setIsDownloading(false);
    };

    const handleConfirmReplace = async () => {
        setShowConfirmDialog(false);
        if (pendingFileToVisualize) {
            await performVisualize(pendingFileToVisualize);
            setPendingFileToVisualize(null);
        }
    };

    const handleCancelReplace = () => {
        setShowConfirmDialog(false);
        setPendingFileToVisualize(null);
    };

    return (
        <div className={styles.emptyTabContent}>
            <div className={styles.comingSoonIcon}>
                <StorageRegular />
            </div>
            <div style={{ width: '100%', maxWidth: '400px', margin: '20px 0' }}>
                <Field
                    label="MST ledger domain name"
                    validationMessage={verificationError}
                    validationState={verificationError ? "error" : "none"}
                >
                    <Input
                        type="url"
                        value={ledgerDomain}
                        onChange={(_, data) => setLedgerDomain(data.value)}
                        placeholder="Enter your MST ledger domain name"
                        style={{ width: '100%' }}
                    />
                </Field>
                <Button
                    appearance="primary"
                    onClick={verifyAccess}
                    disabled={isVerifying}
                    style={{ marginTop: '10px' }}
                >
                    {isVerifying ? <Spinner size="tiny" /> : 'Show available files'}
                </Button>
            </div>
            {/* Create Table to List all the ledger files present in the backup based on the MST domain provided */}
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
                                <TableHeaderCell style={{ whiteSpace: "nowrap" }}>File Name</TableHeaderCell>
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
                                        <Tooltip
                                            content="Downloads this file and all earlier ledger files in sequence"
                                            relationship="description"
                                        >
                                            <Button
                                                appearance="primary"
                                                disabled={isDownloading}
                                                onClick={() => handleVisualizeClick(file)}
                                            >
                                                {isDownloading ? <Spinner size="tiny" id={file.filename} /> : 'Import (including previous)'}
                                            </Button>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {/* Print File Sequence Info */}
            {downloadedLedgerFiles && downloadedLedgerFiles.length > 0 && (
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

            <ReplaceDataConfirmDialog
                open={showConfirmDialog}
                onOpenChange={setShowConfirmDialog}
                existingFileCount={existingLedgerFiles?.length || 0}
                sourceName="Signing Transparency"
                onConfirm={handleConfirmReplace}
                onCancel={handleCancelReplace}
            />
        </div>
    );
};