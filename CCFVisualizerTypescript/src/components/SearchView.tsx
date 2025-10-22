import React, { useState, useMemo } from 'react';
import {
  makeStyles,
  Text,
  Caption1,
  Button,
  Card,
  Badge,
  Spinner,
  Input,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from '@fluentui/react-components';
import {
  Search24Regular,
  Database24Regular,
  Dismiss24Regular,
} from '@fluentui/react-icons';
import { useSearchByKeyOrValue } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
  container: {
    padding: '24px',
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  searchControls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  searchInput: {
    flex: 1,
    maxWidth: '400px',
  },
  resultsTable: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  keyName: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  mapName: {
    fontFamily: 'monospace',
    color: tokens.colorNeutralForeground2,
  },
  sequenceNumber: {
    fontFamily: 'monospace',
    color: tokens.colorNeutralForeground2,
  },
  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: tokens.colorNeutralForeground3,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptySubtext: {
    marginTop: '8px',
  },
  resultCount: {
    color: tokens.colorNeutralForeground3,
  },
});

export const SearchView: React.FC = () => {
  const styles = useStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query to avoid too many API calls
  const debounceTimeout = React.useRef<number | undefined>(undefined);
  
  React.useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  const { data: searchResults, isLoading, error } = useSearchByKeyOrValue(
    debouncedQuery,
    100 // limit to 100 results
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const resultsSummary = useMemo(() => {
    if (!searchResults) return null;
    
    const writeCount = searchResults.filter(r => r.hasValue).length;
    const deleteCount = searchResults.filter(r => !r.hasValue).length;
    
    return { total: searchResults.length, writes: writeCount, deletes: deleteCount };
  }, [searchResults]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <Text size={600} weight="semibold">
            Search Transactions
          </Text>
          <Caption1>
            Search for keys and values across all uploaded ledger files
          </Caption1>
        </div>
        
        <div className={styles.searchControls}>
          <div className={styles.searchInput}>
            <Input
              placeholder="Search keys and values..."
              value={searchQuery}
              onChange={handleSearchChange}
              contentBefore={<Search24Regular />}
              contentAfter={
                searchQuery && (
                  <Button
                    appearance="transparent"
                    icon={<Dismiss24Regular />}
                    size="small"
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                  />
                )
              }
            />
          </div>
        </div>

        {/* Results Summary */}
        {resultsSummary && debouncedQuery && (
          <Caption1 className={styles.resultCount}>
            Found {resultsSummary.total} results ({resultsSummary.writes} writes, {resultsSummary.deletes} deletes)
          </Caption1>
        )}
      </div>

      {/* Loading State */}
      {isLoading && debouncedQuery && (
        <div className={styles.loadingState}>
          <Spinner size="large" label="Searching..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.emptyState}>
          <Text size={500}>Error searching: {error.message}</Text>
        </div>
      )}

      {/* Empty State - No Query */}
      {!debouncedQuery && !isLoading && (
        <div className={styles.emptyState}>
          <Search24Regular className={styles.emptyIcon} />
          <Text size={500} weight="semibold">Search for key names</Text>
          <Caption1 className={styles.emptySubtext}>
            Enter a search term above to find all transactions with matching keys or values.
          </Caption1>
        </div>
      )}

      {/* Empty State - No Results */}
      {debouncedQuery && !isLoading && searchResults?.length === 0 && (
        <div className={styles.emptyState}>
          <Database24Regular className={styles.emptyIcon} />
          <Text size={500} weight="semibold">No results found</Text>
          <Caption1 className={styles.emptySubtext}>
            No transactions found containing "{debouncedQuery}" in keys or values. Try a different search term.
          </Caption1>
        </div>
      )}

      {/* Results Table */}
      {debouncedQuery && searchResults && searchResults.length > 0 && !isLoading && (
        <Card className={styles.resultsTable}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Sequence</TableHeaderCell>
                <TableHeaderCell>Operation</TableHeaderCell>
                <TableHeaderCell>Match Type</TableHeaderCell>
                <TableHeaderCell>Map Name</TableHeaderCell>
                <TableHeaderCell>Key Name</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((result, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <TableCellLayout>
                      <Text className={styles.sequenceNumber}>
                        {result.transactionId}
                      </Text>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout>
                      <Badge 
                        appearance="outline"
                        color={result.hasValue ? 'success' : 'danger'}
                      >
                        {result.hasValue ? 'WRITE' : 'DELETE'}
                      </Badge>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout>
                      <Badge 
                        appearance="filled"
                        color={result.matchType === 'key' ? 'brand' : 'warning'}
                      >
                        {result.matchType === 'key' ? 'KEY' : 'VALUE'}
                      </Badge>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout>
                      <Text className={styles.mapName}>
                        {result.mapName}
                      </Text>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout>
                      <Text className={styles.keyName}>
                        {result.keyName}
                      </Text>
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout>
                      <Text className={styles.sequenceNumber}>
                        {result.version}
                      </Text>
                    </TableCellLayout>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
