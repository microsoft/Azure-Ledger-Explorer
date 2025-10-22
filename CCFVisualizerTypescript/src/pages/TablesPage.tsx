import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    tokens,
    makeStyles,
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
    Accordion,
    AccordionItem,
    AccordionHeader,
    AccordionPanel,
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
        padding: '16px 24px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
        borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground1,
        overflow: 'auto',
    },
    sidebarHeader: {
        padding: '16px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground2,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
    },
    sidebarContent: {
        padding: '8px',
    },
    tablesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    tableItem: {
        padding: '8px 12px',
        borderRadius: '4px',
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
        padding: '16px 24px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    searchContainer: {
        padding: '16px 24px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    tableContainer: {
        flex: 1,
        overflow: 'auto',
        padding: '16px 24px',
    },
    paginationContainer: {
        padding: '8px 16px',
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
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
        borderRadius: '8px',
        width: '800px',
        maxHeight: '600px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    keyTransactionsHeader: {
        padding: '16px 24px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    keyTransactionsBody: {
        flex: 1,
        overflow: 'auto',
        padding: '16px 24px',
    },
    actionButtons: {
        display: 'flex',
        gap: '8px',
    },
    sqlDialogSurface: {
        width: '800px',
        maxWidth: '90vw',
    },
    sqlDialogBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    sqlTextarea: {
        fontFamily: 'monospace',
    },
    sqlExecutionStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: tokens.colorNeutralForeground2,
    },
    sqlResultContainer: {
        maxHeight: '320px',
        overflow: 'auto',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: '6px',
        padding: '12px',
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

    // Read existing search param before state initialization
    const [searchParams, setSearchParams] = useSearchParams();
    const initialSearch = searchParams.get('q') || '';
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const initialPage = (() => {
        const p = parseInt(searchParams.get('page') || '1', 10);
        return isNaN(p) || p < 1 ? 1 : p;
    })();
    const [currentPage, setCurrentPage] = useState(initialPage);
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
        // Reset to first page and clear search when switching table; reflect in URL
        setSearchQuery('');
        setCurrentPage(1);
        navigate(`/tables/${encodeURIComponent(table)}?page=1`);
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
        // Reset to first page when searching
        const params: Record<string, string> = { page: '1' };
        if (query.trim().length > 0) params.q = query;
        setCurrentPage(1);
        if (tableName) {
            const searchString = new URLSearchParams(params).toString();
            navigate(`/tables/${encodeURIComponent(tableName)}?${searchString}`);
        } else {
            setSearchParams(params);
        }
    }, [navigate, tableName, setSearchParams]);

    const handlePreviousPage = useCallback(() => {
        if (hasPreviousPage) {
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            const params: Record<string, string> = { page: String(newPage) };
            if (searchQuery.trim().length > 0) params.q = searchQuery;
            if (tableName) {
                const qs = new URLSearchParams(params).toString();
                navigate(`/tables/${encodeURIComponent(tableName)}?${qs}`);
            } else {
                setSearchParams(params);
            }
        }
    }, [currentPage, hasPreviousPage, navigate, tableName, setSearchParams, searchQuery]);

    const handleNextPage = useCallback(() => {
        if (hasNextPage) {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            const params: Record<string, string> = { page: String(newPage) };
            if (searchQuery.trim().length > 0) params.q = searchQuery;
            if (tableName) {
                const qs = new URLSearchParams(params).toString();
                navigate(`/tables/${encodeURIComponent(tableName)}?${qs}`);
            } else {
                setSearchParams(params);
            }
        }
    }, [currentPage, hasNextPage, navigate, tableName, setSearchParams, searchQuery]);

    // Sync when URL page param changes externally (e.g. browser navigation)
    useEffect(() => {
        const urlPageRaw = searchParams.get('page');
        const urlQuery = searchParams.get('q') || '';
        if (urlQuery !== searchQuery) {
            setSearchQuery(urlQuery);
        }
        if (urlPageRaw) {
            const urlPage = parseInt(urlPageRaw, 10);
            if (!isNaN(urlPage) && urlPage > 0 && urlPage !== currentPage) {
                setCurrentPage(urlPage);
            }
        }
    }, [searchParams, currentPage, searchQuery]);

    // Clamp current page if total pages shrinks due to search query
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            const params: Record<string, string> = { page: String(totalPages) };
            if (searchQuery.trim().length > 0) params.q = searchQuery;
            setCurrentPage(totalPages);
            if (tableName) {
                const qs = new URLSearchParams(params).toString();
                navigate(`/tables/${encodeURIComponent(tableName)}?${qs}`);
            } else {
                setSearchParams(params);
            }
        }
    }, [currentPage, totalPages, navigate, tableName, setSearchParams, searchQuery]);

    const goToPage = useCallback((page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        const params: Record<string, string> = { page: String(page) };
        if (searchQuery.trim().length > 0) params.q = searchQuery;
        if (tableName) {
            const qs = new URLSearchParams(params).toString();
            navigate(`/tables/${encodeURIComponent(tableName)}?${qs}`);
        } else {
            setSearchParams(params);
        }
    }, [navigate, tableName, totalPages, setSearchParams, searchQuery]);

    const paginationPageButtons = useMemo(() => {
        // Generate page numbers with ellipsis when many pages
        const pages: (number | 'ellipsis')[] = [];
        const maxButtons = 7; // including first/last and ellipsis markers
        if (totalPages <= maxButtons) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            const showRange = 2; // pages adjacent to current
            const first = 1;
            const last = totalPages;
            pages.push(first);
            const start = Math.max(currentPage - showRange, 2);
            const end = Math.min(currentPage + showRange, totalPages - 1);
            if (start > 2) pages.push('ellipsis');
            for (let p = start; p <= end; p++) pages.push(p);
            if (end < totalPages - 1) pages.push('ellipsis');
            pages.push(last);
        }
        return pages;
    }, [totalPages, currentPage]);

    // Group tables by prefix for sidebar
    const { governanceTables, internalTables, otherTables } = useMemo(() => {
        const govPrefix = 'public:ccf.gov';
        const internalPrefix = 'public:ccf.internal';
        const governance: string[] = [];
        const internal: string[] = [];
        const others: string[] = [];
        (tables || []).forEach(t => {
            if (t.startsWith(govPrefix)) governance.push(t);
            else if (t.startsWith(internalPrefix)) internal.push(t);
            else others.push(t);
        });
        return { governanceTables: governance, internalTables: internal, otherTables: others };
    }, [tables]);

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
                return `SELECT * FROM kv_writes where map_name="${tableName}" ORDER BY created_at ASC LIMIT 5;`;
            }

            // Updated default query to use sqlite_schema and exclude internal sqlite_ tables
            return `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%';`;
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
        const placeholder = `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%';`;

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
                                <Accordion multiple collapsible defaultOpenItems={['public']}> 
                                    {governanceTables.length > 0 && (
                                        <AccordionItem value="governance">
                                            <AccordionHeader>Governance</AccordionHeader>
                                            <AccordionPanel>
                                                {governanceTables.map(table => (
                                                    <div
                                                        key={table}
                                                        className={`${classes.tableItem} ${table === tableName ? classes.tableItemActive : ''}`}
                                                        onClick={() => handleTableSelect(table)}
                                                    >
                                                        <Text size={300} weight={table === tableName ? 'semibold' : 'regular'}>
                                                            {table}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </AccordionPanel>
                                        </AccordionItem>
                                    )}
                                    {internalTables.length > 0 && (
                                        <AccordionItem value="internal">
                                            <AccordionHeader>Internal</AccordionHeader>
                                            <AccordionPanel>
                                                {internalTables.map(table => (
                                                    <div
                                                        key={table}
                                                        className={`${classes.tableItem} ${table === tableName ? classes.tableItemActive : ''}`}
                                                        onClick={() => handleTableSelect(table)}
                                                    >
                                                        <Text size={300} weight={table === tableName ? 'semibold' : 'regular'}>
                                                            {table}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </AccordionPanel>
                                        </AccordionItem>
                                    )}
                                    {otherTables.length > 0 && (
                                        <AccordionItem value="public">
                                            <AccordionHeader>Public</AccordionHeader>
                                            <AccordionPanel>
                                                {otherTables.map(table => (
                                                    <div
                                                        key={table}
                                                        className={`${classes.tableItem} ${table === tableName ? classes.tableItemActive : ''}`}
                                                        onClick={() => handleTableSelect(table)}
                                                    >
                                                        <Text size={300} weight={table === tableName ? 'semibold' : 'regular'}>
                                                            {table}
                                                        </Text>
                                                    </div>
                                                ))}
                                            </AccordionPanel>
                                        </AccordionItem>
                                    )}
                                </Accordion>
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
                                        {paginationPageButtons.map((p, idx) => p === 'ellipsis' ? (
                                            <Text key={`ellipsis-${idx}`} size={300} style={{ padding: '0 4px' }}>...</Text>
                                        ) : (
                                            <Button
                                                key={p}
                                                appearance={p === currentPage ? 'primary' : 'subtle'}
                                                onClick={() => goToPage(p)}
                                                disabled={p === currentPage}
                                                style={{ minWidth: '40px' }}
                                            >
                                                {p}
                                            </Button>
                                        ))}
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
