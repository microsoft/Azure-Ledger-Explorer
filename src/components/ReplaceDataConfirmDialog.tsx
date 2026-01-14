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
} from '@fluentui/react-components';
import { Warning24Regular } from '@fluentui/react-icons';

const useStyles = makeStyles({
    dialogTitleWithIcon: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    warningIcon: {
        color: tokens.colorPaletteYellowForeground1,
    },
});

export interface ReplaceDataConfirmDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when the dialog open state changes */
    onOpenChange: (open: boolean) => void;
    /** Number of existing ledger files that will be replaced */
    existingFileCount: number;
    /** Name of the import source (e.g., "Azure Ledger backup", "Signing Transparency") */
    sourceName: string;
    /** Callback when user confirms the replacement */
    onConfirm: () => void;
    /** Callback when user cancels */
    onCancel: () => void;
}

/**
 * A confirmation dialog shown when importing data would replace existing ledger files.
 * Warns the user about data loss and requires explicit confirmation before proceeding.
 */
export const ReplaceDataConfirmDialog: React.FC<ReplaceDataConfirmDialogProps> = ({
    open,
    onOpenChange,
    existingFileCount,
    sourceName,
    onConfirm,
    onCancel,
}) => {
    const styles = useStyles();

    const handleOpenChange = (_: unknown, data: { open: boolean }) => {
        if (!data.open) {
            onCancel();
        }
        onOpenChange(data.open);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <div className={styles.dialogTitleWithIcon}>
                            <Warning24Regular className={styles.warningIcon} />
                            Replace Existing Data?
                        </div>
                    </DialogTitle>
                    <DialogContent>
                        <Text>
                            You have <strong>{existingFileCount} ledger file(s)</strong> already imported.
                            Importing from {sourceName} will <strong>replace all existing data</strong>.
                        </Text>
                        <br /><br />
                        <Text>This action cannot be undone. Are you sure you want to continue?</Text>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button appearance="primary" onClick={onConfirm}>
                            Replace Data
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
