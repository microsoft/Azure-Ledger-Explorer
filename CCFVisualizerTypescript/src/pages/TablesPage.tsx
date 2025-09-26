import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    tokens,
    makeStyles,
    shorthands,
    Text,
    Button,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    TableCellLayout,
    Badge,
    Spinner,
    MessageBar,
    SearchBox,
    Tooltip,
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogContent,
    DialogBody,
    DialogActions,
    Field,
    Textarea,
} from '@fluentui/react-components';
import { ChevronRightRegular, DatabaseRegular, KeyRegular, HistoryRegular, ChevronLeft24Regular, ChevronRight24Regular } from '@fluentui/react-icons';
import { useCCFTables, useTableLatestState, useTableLatestStateCount, useKeyTransactions, useDatabase } from '../hooks/use-ccf-data';
import type { DialogOpenChangeData } from '@fluentui/react-components';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
    },
    header: {
        ...shorthands.padding('16px', '24px'),
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        backgroundColor: tokens.colorNeutralBackground1,
    },
    breadcrumb: {
        marginBottom: '12px',
    },
    content: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
    },
    sidebar: {
        width: '300px',
        ...shorthands.borderRight('1px', 'solid', tokens.colorNeutralStroke2),
        backgroundColor: tokens.colorNeutralBackground1,
        overflow: 'auto',
    },
    sidebarHeader: {
        ...shorthands.padding('16px'),
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        backgroundColor: tokens.colorNeutralBackground2,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
    },
    sidebarContent: {
        ...shorthands.padding('8px'),
    },
    tablesList: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap('4px'),
    },
    tableItem: {
        ...shorthands.padding('8px', '12px'),
        ...shorthands.borderRadius('4px'),
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground2,
        },
    },
    tableItemActive: {
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground2,
    },
    mainContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    mainHeader: {
        ...shorthands.padding('16px', '24px'),
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        backgroundColor: tokens.colorNeutralBackground1,
    },
    searchContainer: {
        ...shorthands.padding('16px', '24px'),
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    },
    tableContainer: {
        flex: 1,
        overflow: 'auto',
        ...shorthands.padding('16px', '24px'),
    },
    paginationContainer: {
        ...shorthands.padding('8px', '16px'),
        ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: tokens.colorNeutralBackground2,
    },
    paginationControls: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    paginationInfo: {
        fontSize: '13px',
        color: tokens.colorNeutralForeground2,
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
    operationBadge: {
        fontSize: '12px',
    },
    keyTransactionsModal: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    keyTransactionsContent: {
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderRadius('8px'),
        width: '800px',
        maxHeight: '600px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    keyTransactionsHeader: {
        ...shorthands.padding('16px', '24px'),
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    keyTransactionsBody: {
        flex: 1,
        overflow: 'auto',
        ...shorthands.padding('16px', '24px'),
    },
    actionButtons: {
        display: 'flex',
        ...shorthands.gap('8px'),
    },
    sqlDialogSurface: {
        width: '800px',
        maxWidth: '90vw',
    },
    sqlDialogBody: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap('12px'),
    },
    sqlTextarea: {
        fontFamily: 'monospace',
    },
    sqlExecutionStatus: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap('8px'),
        color: tokens.colorNeutralForeground2,
    },
    sqlResultContainer: {
        maxHeight: '320px',
        overflow: 'auto',
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        ...shorthands.borderRadius('6px'),
        ...shorthands.padding('12px'),
        backgroundColor: tokens.colorNeutralBackground2,
    },
    sqlResultCell: {
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        verticalAlign: 'top',
        fontSize: '10px',
        lineHeight: '1',
    },
});

const TablesPage: React.FC = () => {
    const classes = useStyles();
    const navigate = useNavigate();
    const { tableName } = useParams<{ tableName?: string }>();

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedKey, setSelectedKey] = useState<{ mapName: string; keyName: string } | null>(null);
    const [isSqlDialogOpen, setIsSqlDialogOpen] = useState(false);
    const [sqlQuery, setSqlQuery] = useState('');
    const [sqlResult, setSqlResult] = useState<unknown[] | null>(null);
    const [sqlError, setSqlError] = useState<string | null>(null);
    const [hasExecutedSql, setHasExecutedSql] = useState(false);
    const [isExecutingSql, setIsExecutingSql] = useState(false);
    const itemsPerPage = 50;
    const offset = (currentPage - 1) * itemsPerPage;

    // Query hooks
    const { data: tables, isLoading: tablesLoading, error: tablesError } = useCCFTables();
    const { data: keyValues, isLoading: keyValuesLoading, error: keyValuesError } = useTableLatestState(
        tableName || '',
        itemsPerPage,
        offset,
        searchQuery // Pass search query to the hook
    );
    const { data: totalKeyCount } = useTableLatestStateCount(
        tableName || '',
        searchQuery
    );
    const { data: keyTransactions, isLoading: keyTransactionsLoading } = useKeyTransactions(
        selectedKey?.mapName || '',
        selectedKey?.keyName || '',
        100,
        0
    );
    const { data: database, isLoading: databaseLoading, error: databaseError } = useDatabase();

    // Pagination calculations
    const totalPages = Math.ceil((totalKeyCount || 0) / itemsPerPage);
    const hasNextPage = currentPage < totalPages;
    const hasPreviousPage = currentPage > 1;

    const handleTableSelect = useCallback((table: string) => {
        navigate(`/tables/${encodeURIComponent(table)}`);
        setCurrentPage(1);
        setSearchQuery('');
    }, [navigate]);

    const handleKeySelect = useCallback((keyName: string) => {
        if (tableName) {
            setSelectedKey({ mapName: tableName, keyName });
        }
    }, [tableName]);

    const handleTransactionSelect = useCallback((transactionId: number) => {
        navigate(`/transaction/${transactionId}`);
    }, [navigate]);

    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
        setCurrentPage(1); // Reset to first page when searching
    }, []);

    const handlePreviousPage = useCallback(() => {
        if (hasPreviousPage) {
            setCurrentPage(currentPage - 1);
        }
    }, [currentPage, hasPreviousPage]);

    const handleNextPage = useCallback(() => {
        if (hasNextPage) {
            setCurrentPage(currentPage + 1);
        }
    }, [currentPage, hasNextPage]);

    const formatValue = (value: Uint8Array | null): string => {
        if (!value) return '';
        try {
            // Try to decode as UTF-8 text first
            const text = new TextDecoder('utf-8').decode(value);
            if (text.length < 100) return text;
            return text.substring(0, 100) + '...';
        } catch {
            // If not valid UTF-8, show as hex
            const hex = Array.from(value)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            return hex.length > 100 ? hex.substring(0, 100) + '...' : hex;
        }
    };

    const formatSqlValue = (value: unknown): string => {
        if (value === null || value === undefined) {
            return 'NULL';
        }

        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return String(value);
            }
        }

        return String(value);
    };

    const sqlResultColumns = useMemo(() => {
        if (!sqlResult || sqlResult.length === 0) {
            return [] as string[];
        }

        const columnSet = new Set<string>();

        sqlResult.forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row as Record<string, unknown>).forEach(column => columnSet.add(column));
            }
        });

        return Array.from(columnSet);
    }, [sqlResult]);

    const databaseErrorMessage = databaseError instanceof Error ? databaseError.message : null;

    const closeSqlRunnerDialog = useCallback(() => {
        setIsSqlDialogOpen(false);
        setIsExecutingSql(false);
        setSqlError(null);
        setHasExecutedSql(false);
    }, []);

    const handleSqlDialogOpenChange = useCallback((_: React.SyntheticEvent | undefined, data: DialogOpenChangeData) => {
        if (data.open) {
            setIsSqlDialogOpen(true);
        } else {
            closeSqlRunnerDialog();
        }
    }, [closeSqlRunnerDialog]);

    const openSqlRunnerDialog = useCallback(() => {
        setIsSqlDialogOpen(true);
        setSqlError(null);
        setSqlResult(null);
        setHasExecutedSql(false);
        setIsExecutingSql(false);
        setSqlQuery(prev => {
            if (prev.trim().length > 0) {
                return prev;
            }

            if (tableName && tableName.length > 0) {
                return `SELECT * FROM "${tableName}" LIMIT 100;`;
            }

            return `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;`;
        });
    }, [tableName]);

    const handleExecuteSql = useCallback(async () => {
        const trimmedQuery = sqlQuery.trim();

        if (!trimmedQuery) {
            setSqlError('Please enter a SQL query to run.');
            return;
        }

        if (!database) {
            setSqlError('Database is not ready yet. Please try again in a moment.');
            return;
        }

        setIsExecutingSql(true);
        setSqlError(null);
        setSqlResult(null);
        setHasExecutedSql(true);

        try {
            const result = await database.executeQuery(sqlQuery);
            setSqlResult(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error executing query.';
            setSqlError(message);
        } finally {
            setIsExecutingSql(false);
        }
    }, [database, sqlQuery]);

    const renderKeyTransactionsModal = () => {
        if (!selectedKey) return null;

        return (
            <div className={classes.keyTransactionsModal} onClick={() => setSelectedKey(null)}>
                <div className={classes.keyTransactionsContent} onClick={(e) => e.stopPropagation()}>
                    <div className={classes.keyTransactionsHeader}>
                        <div>
                            <Text size={600} weight="semibold">
                                Transaction History: {selectedKey.keyName}
                            </Text>
                            <Text size={300} style={{ display: 'block', marginTop: '4px'}}>
                                Table: {selectedKey.mapName}
                            </Text>
                        </div>
                        <Button appearance="subtle" onClick={() => setSelectedKey(null)}>
                            Close
                        </Button>
                    </div>
                    <div className={classes.keyTransactionsBody}>
                        {keyTransactionsLoading ? (
                            <div className={classes.loadingContainer}>
                                <Spinner size="medium" />
                            </div>
                        ) : keyTransactions && keyTransactions.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Sequence</TableHeaderCell>
                                        <TableHeaderCell>Operation</TableHeaderCell>
                                        <TableHeaderCell>Version</TableHeaderCell>
                                        <TableHeaderCell>File</TableHeaderCell>
                                        <TableHeaderCell>Actions</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {keyTransactions.map((tx, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <TableCellLayout>
                                                    {tx.transactionId}
                                                </TableCellLayout>
                                            </TableCell>
                                            <TableCell>
                                                <TableCellLayout>
                                                    <Badge
                                                        appearance={tx.operationType === 'write' ? 'filled' : 'outline'}
                                                        color={tx.operationType === 'write' ? 'success' : 'danger'}
                                                        className={classes.operationBadge}
                                                    >
                                                        {tx.operationType}
                                                    </Badge>
                                                </TableCellLayout>
                                            </TableCell>
                                            <TableCell>
                                                <TableCellLayout>
                                                    {tx.version}
                                                </TableCellLayout>
                                            </TableCell>
                                            <TableCell>
                                                <TableCellLayout>
                                                    <Text size={200}>{tx.fileName}</Text>
                                                </TableCellLayout>
                                            </TableCell>
                                            <TableCell>
                                                <TableCellLayout>
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        onClick={() => handleTransactionSelect(tx.transactionId)}
                                                    >
                                                        View Details
                                                    </Button>
                                                </TableCellLayout>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className={classes.emptyState}>
                                <HistoryRegular style={{ fontSize: '48px', marginBottom: '16px' }} />
                                <Text size={500} weight="semibold">No transaction history found</Text>
                                <Text size={300}>This key has no recorded operations.</Text>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSqlRunnerDialog = () => {
        const placeholder = tableName && tableName.length > 0
            ? `SELECT * FROM "${tableName}" LIMIT 10;`
            : `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;`;

        return (
            <Dialog open={isSqlDialogOpen} onOpenChange={handleSqlDialogOpenChange}>
                <DialogSurface className={classes.sqlDialogSurface}>
                    <DialogTitle>Run SQL query</DialogTitle>
                    <DialogContent>
                        <DialogBody className={classes.sqlDialogBody}>
                            <Field label="SQL query" required>
                                <Textarea
                                    value={sqlQuery}
                                    onChange={(_, data) => setSqlQuery(data.value)}
                                    placeholder={placeholder}
                                    resize="vertical"
                                    rows={6}
                                    className={classes.sqlTextarea}
                                />
                            </Field>

                            {databaseLoading && (
                                <div className={classes.sqlExecutionStatus}>
                                    <Spinner size="tiny" />
                                    <Text size={200}>Loading database...</Text>
                                </div>
                            )}

                            {databaseErrorMessage && (
                                <MessageBar intent="error">
                                    Unable to load database: {databaseErrorMessage}
                                </MessageBar>
                            )}

                            {sqlError && (
                                <MessageBar intent="error">
                                    {sqlError}
                                </MessageBar>
                            )}

                            {isExecutingSql && !databaseLoading && (
                                <div className={classes.sqlExecutionStatus}>
                                    <Spinner size="tiny" />
                                    <Text size={200}>Running query...</Text>
                                </div>
                            )}

                            {!isExecutingSql && hasExecutedSql && !sqlError && sqlResult && sqlResult.length === 0 && (
                                <MessageBar intent="info">
                                    No rows returned for this query.
                                </MessageBar>
                            )}

                            {sqlResult && sqlResult.length > 0 && (
                                <div className={classes.sqlResultContainer}>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {sqlResultColumns.map(column => (
                                                    <TableHeaderCell key={column}>{column}</TableHeaderCell>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sqlResult.map((row, rowIndex) => {
                                                const record = (row && typeof row === 'object') ? row as Record<string, unknown> : {};
                                                return (
                                                    <TableRow key={rowIndex}>
                                                        {sqlResultColumns.map(column => (
                                                            <TableCell key={column}>
                                                                <TableCellLayout className={classes.sqlResultCell}>
                                                                    {formatSqlValue(record[column])}
                                                                </TableCellLayout>
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </DialogBody>
                        <DialogActions>
                            <Button appearance="secondary" onClick={closeSqlRunnerDialog} disabled={isExecutingSql}>
                                Close
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={handleExecuteSql}
                                disabled={
                                    isExecutingSql ||
                                    !sqlQuery.trim() ||
                                    databaseLoading ||
                                    Boolean(databaseErrorMessage)
                                }
                            >
                                {isExecutingSql ? 'Running...' : 'Run query'}
                            </Button>
                        </DialogActions>
                    </DialogContent>
                </DialogSurface>
            </Dialog>
        );
    };

    return (
        <div className={classes.container}>
            <div className={classes.content}>
                {/* Sidebar with tables list */}
                <div className={classes.sidebar}>
                    <div className={classes.sidebarHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text size={600} weight="semibold">
                            <DatabaseRegular style={{ marginRight: '8px' }} />
                            Tables
                        </Text>
                        <Button
                            appearance="secondary"
                            onClick={openSqlRunnerDialog}
                        >
                            Run SQL
                        </Button>
                    </div>
                    <div className={classes.sidebarContent}>
                        {tablesLoading ? (
                            <div className={classes.loadingContainer}>
                                <Spinner size="small" />
                            </div>
                        ) : tablesError ? (
                            <MessageBar intent="error">
                                Error loading tables: {tablesError.message}
                            </MessageBar>
                        ) : tables && tables.length > 0 ? (
                            <div className={classes.tablesList}>
                                {tables.map((table) => (
                                    <div
                                        key={table}
                                        className={`${classes.tableItem} ${table === tableName ? classes.tableItemActive : ''
                                            }`}
                                        onClick={() => handleTableSelect(table)}
                                    >
                                        <Text size={300} weight={table === tableName ? 'semibold' : 'regular'}>
                                            {table}
                                        </Text>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={classes.emptyState}>
                                <DatabaseRegular style={{ fontSize: '32px', marginBottom: '8px' }} />
                                <Text size={300}>No tables found</Text>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main content */}
                <div className={classes.mainContent}>
                    {tableName ? (
                        <>
                            <div className={classes.mainHeader}>
                                <Text size={600} weight="semibold">
                                    <KeyRegular style={{ marginRight: '8px' }} />
                                    {tableName}
                                </Text>
                                <Text size={300} style={{ marginTop: '4px' }}>
                                    Latest state of all keys in this table
                                </Text>
                            </div>

                            <div className={classes.searchContainer}>
                                <SearchBox
                                    placeholder="Search keys and values..."
                                    value={searchQuery}
                                    onChange={(_, data) => handleSearchChange(data?.value || '')}
                                />
                            </div>

                            <div className={classes.tableContainer}>
                                {keyValuesLoading ? (
                                    <div className={classes.loadingContainer}>
                                        <Spinner size="medium" />
                                    </div>
                                ) : keyValuesError ? (
                                    <MessageBar intent="error">
                                        Error loading key values: {keyValuesError.message}
                                    </MessageBar>
                                ) : keyValues && keyValues.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Sequence</TableHeaderCell>
                                                <TableHeaderCell>Key</TableHeaderCell>
                                                <TableHeaderCell>Value</TableHeaderCell>
                                                <TableHeaderCell>Actions</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {keyValues.map((kv, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <TableCellLayout>
                                                            {kv.transactionId}
                                                        </TableCellLayout>
                                                    </TableCell>
                                                    <TableCell>
                                                        <TableCellLayout truncate>
                                                            <Text size={300} weight="semibold">
                                                                {kv.keyName}
                                                            </Text>
                                                        </TableCellLayout>
                                                    </TableCell>
                                                    <TableCell>
                                                        <TableCellLayout truncate>
                                                            <Text size={200} style={{ fontFamily: 'monospace' }}>
                                                                {kv.isDeleted ? (
                                                                    <Text style={{ color: tokens.colorPaletteRedForeground2, fontStyle: 'italic' }}>
                                                                        [DELETED]
                                                                    </Text>
                                                                ) : (
                                                                    formatValue(kv.value)
                                                                )}
                                                            </Text>
                                                        </TableCellLayout>
                                                    </TableCell>

                                                    <TableCell>
                                                        <TableCellLayout>
                                                            <div className={classes.actionButtons}>
                                                                <Tooltip content="View transaction history for this key" relationship="label">
                                                                    <Button
                                                                        appearance="outline"
                                                                        size="small"
                                                                        onClick={() => handleKeySelect(kv.keyName)}
                                                                    >
                                                                        <HistoryRegular /> <span>History</span>
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip content="View transaction details" relationship="label">
                                                                    <Button
                                                                        appearance="outline"
                                                                        size="small"
                                                                        onClick={() => handleTransactionSelect(kv.transactionId)}
                                                                    >
                                                                        <span>Details</span> <ChevronRightRegular />
                                                                    </Button>
                                                                </Tooltip>
                                                            </div>
                                                        </TableCellLayout>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className={classes.emptyState}>
                                        <KeyRegular style={{ fontSize: '48px', marginBottom: '16px' }} />
                                        <Text size={500} weight="semibold">
                                            {searchQuery ? 'No matching keys or values found' : 'No keys found'}
                                        </Text>
                                        <Text size={300}>
                                            {searchQuery
                                                ? 'Try adjusting your search query.'
                                                : 'This table has no key-value pairs.'
                                            }
                                        </Text>
                                    </div>
                                )}
                            </div>

                            {/* Pagination Controls */}
                            {keyValues && keyValues.length > 0 && totalKeyCount && totalKeyCount > itemsPerPage && (
                                <div className={classes.paginationContainer}>
                                    <div className={classes.paginationInfo}>
                                        Page {currentPage} of {totalPages} ({totalKeyCount} total keys)
                                    </div>
                                    <div className={classes.paginationControls}>
                                        <Button
                                            appearance="subtle"
                                            icon={<ChevronLeft24Regular />}
                                            disabled={!hasPreviousPage}
                                            onClick={handlePreviousPage}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            appearance="subtle"
                                            icon={<ChevronRight24Regular />}
                                            disabled={!hasNextPage}
                                            onClick={handleNextPage}
                                            iconPosition="after"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={classes.emptyState}>
                            <DatabaseRegular style={{ fontSize: '64px', marginBottom: '16px' }} />
                            <Text size={600} weight="semibold">Select a table to explore</Text>
                            <Text size={400}>
                                Choose a table from the sidebar to view its key-value pairs
                            </Text>
                        </div>
                    )}
                </div>
            </div>

            {renderSqlRunnerDialog()}
            {renderKeyTransactionsModal()}
        </div>
    );
};

export default TablesPage;
