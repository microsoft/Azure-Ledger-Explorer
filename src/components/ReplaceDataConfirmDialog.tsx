/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
    Button,
    Text,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    makeStyles,
    tokens,
    Card,
    CardHeader,
    Radio,
    RadioGroup,
} from '@fluentui/react-components';
import { 
    DocumentAdd24Regular,
    ArrowSync24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
    dialogTitleWithIcon: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    optionCard: {
        marginBottom: '12px',
        cursor: 'pointer',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        transition: 'all 0.2s ease',
    },
    optionCardSelected: {
        border: `1px solid ${tokens.colorBrandStroke1}`,
        backgroundColor: tokens.colorBrandBackground2,
    },
    optionContent: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '8px',
    },
    optionIcon: {
        fontSize: '24px',
        color: tokens.colorBrandForeground1,
        flexShrink: 0,
        marginTop: '2px',
    },
    optionText: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    optionTitle: {
        fontWeight: tokens.fontWeightSemibold,
    },
    optionDescription: {
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase200,
    },
    warningText: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: tokens.fontSizeBase200,
        marginTop: '4px',
    },
    radioGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
});

export type ImportMode = 'append' | 'replace';

export interface ImportModeDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when the dialog open state changes */
    onOpenChange: (open: boolean) => void;
    /** Number of existing ledger files */
    existingFileCount: number;
    /** Name of the import source (e.g., "Azure Ledger backup", "Signing Transparency") */
    sourceName: string;
    /** Callback when user confirms with a mode */
    onConfirm: (mode: ImportMode) => void;
    /** Callback when user cancels */
    onCancel: () => void;
}

/**
 * A dialog shown when importing data and there are existing ledger files.
 * Offers the user a choice between appending new files or replacing all data.
 */
export const ImportModeDialog: React.FC<ImportModeDialogProps> = ({
    open,
    onOpenChange,
    existingFileCount,
    sourceName,
    onConfirm,
    onCancel,
}) => {
    const styles = useStyles();
    const [selectedMode, setSelectedMode] = React.useState<ImportMode>('append');

    const handleOpenChange = (_: unknown, data: { open: boolean }) => {
        if (!data.open) {
            onCancel();
        }
        onOpenChange(data.open);
    };

    const handleConfirm = () => {
        onConfirm(selectedMode);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        Import Options
                    </DialogTitle>
                    <DialogContent>
                        <Text>
                            You have <strong>{existingFileCount} ledger file(s)</strong> already imported.
                            How would you like to import from {sourceName}?
                        </Text>
                        <br /><br />
                        
                        <RadioGroup 
                            value={selectedMode} 
                            onChange={(_, data) => setSelectedMode(data.value as ImportMode)}
                            className={styles.radioGroup}
                        >
                            <Card 
                                className={`${styles.optionCard} ${selectedMode === 'append' ? styles.optionCardSelected : ''}`}
                                onClick={() => setSelectedMode('append')}
                            >
                                <CardHeader
                                    header={
                                        <div className={styles.optionContent}>
                                            <Radio value="append" />
                                            <DocumentAdd24Regular className={styles.optionIcon} />
                                            <div className={styles.optionText}>
                                                <Text className={styles.optionTitle}>Add to existing data</Text>
                                                <Text className={styles.optionDescription}>
                                                    Import new files only. Files that already exist will be skipped.
                                                </Text>
                                            </div>
                                        </div>
                                    }
                                />
                            </Card>
                            
                            <Card 
                                className={`${styles.optionCard} ${selectedMode === 'replace' ? styles.optionCardSelected : ''}`}
                                onClick={() => setSelectedMode('replace')}
                            >
                                <CardHeader
                                    header={
                                        <div className={styles.optionContent}>
                                            <Radio value="replace" />
                                            <ArrowSync24Regular className={styles.optionIcon} />
                                            <div className={styles.optionText}>
                                                <Text className={styles.optionTitle}>Replace all data</Text>
                                                <Text className={styles.optionDescription}>
                                                    Clear all existing data before importing.
                                                </Text>
                                                <Text className={styles.warningText}>
                                                    ⚠️ This action cannot be undone
                                                </Text>
                                            </div>
                                        </div>
                                    }
                                />
                            </Card>
                        </RadioGroup>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button appearance="primary" onClick={handleConfirm}>
                            Continue
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

// Keep the old name as an alias for backwards compatibility during transition
/** @deprecated Use ImportModeDialog instead */
export const ReplaceDataConfirmDialog = ImportModeDialog;

