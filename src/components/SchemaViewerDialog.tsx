/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
    tokens,
    makeStyles,
    Text,
    Button,
    Badge,
    Spinner,
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogContent,
    DialogBody,
    DialogActions,
} from '@fluentui/react-components';
import { DatabaseRegular, TableStackLeftRegular, LightbulbRegular } from '@fluentui/react-icons';
import type { DatabaseSchema } from '../database/queries/schema-queries';

// ============================================================================
// STYLES
// ============================================================================

const useStyles = makeStyles({
    schemaDialogSurface: {
        width: '900px',
        maxWidth: '90vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
    },
    schemaDialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        overflowX: 'hidden',
        maxHeight: 'calc(85vh - 140px)',
        paddingRight: '8px',
    },
    schemaTableCard: {
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: '8px',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    schemaTableHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    },
    schemaTableIcon: {
        color: tokens.colorBrandForeground1,
    },
    schemaColumnsGrid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1fr) minmax(100px, auto) minmax(80px, auto)',
        gap: '4px 16px',
        fontSize: '13px',
    },
    schemaColumnHeader: {
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground2,
        paddingBottom: '6px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
        marginBottom: '4px',
    },
    schemaColumnName: {
        fontFamily: 'monospace',
        color: tokens.colorNeutralForeground1,
    },
    schemaColumnType: {
        fontFamily: 'monospace',
        color: tokens.colorBrandForeground1,
        fontSize: '12px',
    },
    schemaColumnMeta: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
    },
    schemaBadge: {
        fontSize: '10px',
    },
    schemaIndexSection: {
        marginTop: '12px',
        paddingTop: '8px',
        borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    },
    schemaIndexList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginTop: '8px',
    },
    schemaIndexItem: {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: tokens.colorNeutralForeground2,
        paddingLeft: '8px',
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        textAlign: 'center',
        color: tokens.colorNeutralForeground2,
    },
    introSection: {
        padding: '16px 20px',
        backgroundColor: tokens.colorNeutralBackground3,
        borderRadius: '8px',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        marginBottom: '8px',
    },
    introText: {
        color: tokens.colorNeutralForeground2,
        lineHeight: '1.5',
        marginBottom: '12px',
    },
    exampleSection: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: '6px',
        border: `1px solid ${tokens.colorNeutralStroke3}`,
    },
    exampleIcon: {
        color: tokens.colorPaletteYellowForeground2,
        flexShrink: 0,
        marginTop: '2px',
    },
    exampleContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1,
        minWidth: 0,
    },
    exampleLabel: {
        fontSize: '12px',
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground2,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    exampleCode: {
        fontFamily: 'Cascadia Code, Consolas, monospace',
        fontSize: '13px',
        color: tokens.colorNeutralForeground1,
        backgroundColor: tokens.colorNeutralBackground2,
        padding: '8px 12px',
        borderRadius: '4px',
        overflowX: 'auto',
        whiteSpace: 'pre',
    },
    tablesHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingBottom: '8px',
        marginBottom: '4px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    },
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface SchemaViewerDialogProps {
    /**
     * Whether the dialog is open
     */
    isOpen: boolean;
    /**
     * Callback when the dialog should close
     */
    onClose: () => void;
    /**
     * The database schema to display
     */
    schemaInfo: DatabaseSchema | null;
    /**
     * Whether the schema is currently loading
     */
    isLoading: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * A dialog component that displays the database schema in a visually appealing way.
 * Shows all tables, their columns (with types and constraints), and indexes.
 */
export const SchemaViewerDialog: React.FC<SchemaViewerDialogProps> = ({
    isOpen,
    onClose,
    schemaInfo,
    isLoading,
}) => {
    const classes = useStyles();

    const handleOpenChange = (_: unknown, data: { open: boolean }) => {
        if (!data.open) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogSurface className={classes.schemaDialogSurface}>
                <DialogTitle>Database Schema</DialogTitle>
                <DialogContent>
                    <DialogBody className={classes.schemaDialogContent}>
                        {isLoading ? (
                            <div className={classes.loadingContainer}>
                                <Spinner size="medium" label="Loading schema..." />
                            </div>
                        ) : schemaInfo && schemaInfo.tables.length > 0 ? (
                            <>
                                {/* Intro Section */}
                                <div className={classes.introSection}>
                                    <Text className={classes.introText} block>
                                        Your CCF ledger data has been parsed and transformed into a relational schema 
                                        for easy exploration. Use the <strong>Run SQL</strong> button to query this data directly.
                                    </Text>
                                    <div className={classes.exampleSection}>
                                        <LightbulbRegular className={classes.exampleIcon} />
                                        <div className={classes.exampleContent}>
                                            <span className={classes.exampleLabel}>Example Query</span>
                                            <code className={classes.exampleCode}>SELECT * FROM transactions ORDER BY sequence_no DESC LIMIT 10;</code>
                                        </div>
                                    </div>
                                </div>

                                {/* Tables Header */}
                                <div className={classes.tablesHeader}>
                                    <DatabaseRegular style={{ color: tokens.colorNeutralForeground3 }} />
                                    <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>
                                        {schemaInfo.tables.length} Table{schemaInfo.tables.length !== 1 ? 's' : ''}
                                    </Text>
                                </div>

                                {/* Table Cards */}
                                {schemaInfo.tables.map((table) => (
                                <div key={table.name} className={classes.schemaTableCard}>
                                    <div className={classes.schemaTableHeader}>
                                        <TableStackLeftRegular className={classes.schemaTableIcon} />
                                        <Text size={500} weight="semibold">{table.name}</Text>
                                        <Badge appearance="tint" size="small" className={classes.schemaBadge}>
                                            {table.columns.length} columns
                                        </Badge>
                                    </div>
                                    
                                    <div className={classes.schemaColumnsGrid}>
                                        <div className={classes.schemaColumnHeader}>Column</div>
                                        <div className={classes.schemaColumnHeader}>Type</div>
                                        <div className={classes.schemaColumnHeader}>Constraints</div>
                                        
                                        {table.columns.map((col) => (
                                            <React.Fragment key={col.name}>
                                                <div className={classes.schemaColumnName}>{col.name}</div>
                                                <div className={classes.schemaColumnType}>{col.type || 'ANY'}</div>
                                                <div className={classes.schemaColumnMeta}>
                                                    {col.pk && (
                                                        <Badge appearance="filled" color="brand" size="small" className={classes.schemaBadge}>
                                                            PK
                                                        </Badge>
                                                    )}
                                                    {col.notnull && !col.pk && (
                                                        <Badge appearance="outline" size="small" className={classes.schemaBadge}>
                                                            NOT NULL
                                                        </Badge>
                                                    )}
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    
                                    {table.indexes.length > 0 && (
                                        <div className={classes.schemaIndexSection}>
                                            <Text size={300} weight="semibold">Indexes</Text>
                                            <div className={classes.schemaIndexList}>
                                                {table.indexes.map((idx) => (
                                                    <div key={idx} className={classes.schemaIndexItem}>
                                                        {idx}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            </>
                        ) : (
                            <div className={classes.emptyState}>
                                <DatabaseRegular style={{ fontSize: '32px', marginBottom: '8px' }} />
                                <Text size={300}>No tables found in the database.</Text>
                            </div>
                        )}
                    </DialogBody>
                </DialogContent>
                <DialogActions style={{ justifyContent: 'flex-end', paddingTop: '12px' }}>
                    <Button appearance="secondary" onClick={onClose}>
                        Close
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    );
};

export default SchemaViewerDialog;
