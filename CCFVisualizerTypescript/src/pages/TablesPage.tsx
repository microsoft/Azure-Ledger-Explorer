import React, { useState, useCallback } from 'react';
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
} from '@fluentui/react-components';
import { ChevronRightRegular, DatabaseRegular, KeyRegular, HistoryRegular } from '@fluentui/react-icons';
import { useCCFTables, useTableLatestState, useKeyTransactions } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
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
        ...shorthands.padding('16px', '24px'),
        ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
        display: 'flex',
        justifyContent: 'center',
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
});

const TablesPage: React.FC = () => {
    const classes = useStyles();
    const navigate = useNavigate();
    const { tableName } = useParams<{ tableName?: string }>();

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedKey, setSelectedKey] = useState<{ mapName: string; keyName: string } | null>(null);
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
    const { data: keyTransactions, isLoading: keyTransactionsLoading } = useKeyTransactions(
        selectedKey?.mapName || '',
        selectedKey?.keyName || '',
        100,
        0
    );

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
                            <Text size={300} style={{ display: 'block', marginTop: '4px' }}>
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

    return (
        <div className={classes.container}>
            <div className={classes.content}>
                {/* Sidebar with tables list */}
                <div className={classes.sidebar}>
                    <div className={classes.sidebarHeader}>
                        <Text size={600} weight="semibold">
                            <DatabaseRegular style={{ marginRight: '8px' }} />
                            Tables
                        </Text>
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
                                    onChange={(_, data) => setSearchQuery(data?.value || '')}
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
                                                                        appearance="subtle"
                                                                        size="small"
                                                                        onClick={() => handleKeySelect(kv.keyName)}
                                                                    >
                                                                        <HistoryRegular />
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip content="View transaction details" relationship="label">
                                                                    <Button
                                                                        appearance="subtle"
                                                                        size="small"
                                                                        onClick={() => handleTransactionSelect(kv.transactionId)}
                                                                    >
                                                                        <ChevronRightRegular />
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

            {renderKeyTransactionsModal()}
        </div>
    );
};

export default TablesPage;
