# Code Standards and Requirements

## Overview

This document outlines the coding standards, patterns, and requirements for the Azure Ledger Explorer project. All contributors must follow these guidelines to ensure code consistency, maintainability, and reliability.

## Core Technology Requirements

### 1. React Query (TanStack Query) - MANDATORY

**All data fetching and mutations MUST use TanStack Query**

#### ✅ Correct Usage

```typescript
// Use useQuery for data fetching
export const useLedgerFiles = () => {
  return useQuery({
    queryKey: queryKeys.ledgerFiles,
    queryFn: async () => {
      const db = await getDatabase();
      return db.getLedgerFiles();
    },
  });
};

// Use useMutation for data modifications
export const useUploadLedgerFile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (file: File) => {
      const db = await getDatabase();
      return db.insertLedgerFile(file.name, file.size);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
    },
  });
};
```

#### ❌ Prohibited Patterns

```typescript
// DON'T use useState for server state
const [data, setData] = useState(null);
useEffect(() => {
  fetchData().then(setData);
}, []);

// DON'T use fetch/axios directly in components
const handleClick = async () => {
  const response = await fetch('/api/data');
  const data = await response.json();
  setData(data);
};
```

### 2. TypeScript - STRICT MODE REQUIRED

**All code MUST be written in TypeScript with strict type checking enabled**

#### Configuration Requirements

```json
// tsconfig.json - Required settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### Type Definition Requirements

```typescript
// ✅ Always define interfaces for props
interface TransactionViewerProps {
  fileId: number;
  fileName: string;
  transactionId?: number;
}

// ✅ Use proper generic typing
const useTransactions = <T = Transaction[]>(
  fileId: number, 
  limit = 100, 
  offset = 0
): UseQueryResult<T> => {
  // Implementation
};

// ❌ No 'any' types allowed
const handleData = (data: any) => { // FORBIDDEN
  // Implementation
};
```

### 3. Component Architecture

#### Functional Components Only

```typescript
// ✅ Use functional components with hooks
export const TransactionViewer: React.FC<TransactionViewerProps> = ({
  fileId,
  fileName,
  transactionId
}) => {
  // Implementation
};

// ❌ No class components
class TransactionViewer extends React.Component { // FORBIDDEN
  // Implementation
}
```

#### Custom Hooks Pattern

```typescript
// ✅ Extract reusable logic into custom hooks
export const useTransactionPagination = (fileId: number) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  
  const { data, isLoading, error } = useTransactions(
    fileId, 
    pageSize, 
    currentPage * pageSize
  );
  
  return {
    transactions: data,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
  };
};
```

## Data Handling Standards

### 1. Query Key Management

**All query keys MUST be centrally defined**

```typescript
// ✅ Centralized query keys
export const queryKeys = {
  ledgerFiles: ['ledgerFiles'] as const,
  transactions: (fileId: number) => ['transactions', fileId] as const,
  transactionDetails: (transactionId: number) => ['transactionDetails', transactionId] as const,
  stats: ['stats'] as const,
  enhancedStats: ['enhancedStats'] as const,
} as const;

// ❌ Inline query keys
useQuery({
  queryKey: ['transactions', fileId], // FORBIDDEN - use queryKeys.transactions(fileId)
  queryFn: () => fetchTransactions(fileId),
});
```

### 2. Error Handling

**All async operations MUST include proper error handling**

```typescript
// ✅ Proper error handling in mutations
export const useUploadLedgerFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<{ fileId: number; transactionCount: number }> => {
      try {
        const db = await getDatabase();
        return await db.processFile(file);
      } catch (error) {
        console.error('Failed to upload ledger file:', error);
        throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    onError: (error) => {
      console.error('Upload mutation failed:', error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
    },
  });
};
```

### 3. Loading and Error States

**All data-dependent components MUST handle loading and error states**

```typescript
// ✅ Proper state handling
export const TransactionViewer: React.FC<TransactionViewerProps> = ({ fileId }) => {
  const { data: transactions, isLoading, error } = useTransactions(fileId);

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="large" label="Loading transactions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <MessageBar intent="error">
          Error loading transactions: {error.message}
        </MessageBar>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Text>No transactions found</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Render transactions */}
    </div>
  );
};
```

## Styling Standards

### 1. FluentUI Components - REQUIRED

**Use FluentUI components for all UI elements**

```typescript
// ✅ Use FluentUI components
import {
  Button,
  Text,
  Card,
  Spinner,
  MessageBar,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ❌ Don't use HTML elements directly for UI
<button onClick={handleClick}>Click me</button> // FORBIDDEN
<div className="card">Content</div> // FORBIDDEN
```

### 2. Styling Approach

**Use makeStyles for component styling**

```typescript
// ✅ Proper makeStyles usage
const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '24px',
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

export const MyComponent: React.FC = () => {
  const styles = useStyles();
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {/* Content */}
      </div>
    </div>
  );
};
```

**Note:** The `shorthands` helper is deprecated as of Fluent UI v9.57.0. Use standard CSS shorthand properties directly instead.

## File Organization Standards

### 1. Directory Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page-level components
├── hooks/              # Custom React hooks
├── database/           # Database layer
├── parser/             # CCF parsing logic
├── services/           # External service integrations
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── assets/             # Static assets
```

### 2. File Naming Conventions

```typescript
// ✅ Correct naming
TransactionViewer.tsx     // Components: PascalCase
use-ccf-data.ts          // Hooks: kebab-case with 'use-' prefix
ccf-types.ts             // Types: kebab-case
ledger-validation.ts     // Utils: kebab-case
```

### 3. Import/Export Standards

```typescript
// ✅ Named exports for components
export const TransactionViewer: React.FC<Props> = () => {
  // Implementation
};

// ✅ Default export for pages
const TransactionDetailsPage: React.FC = () => {
  // Implementation
};
export default TransactionDetailsPage;

// ✅ Barrel exports for utilities
// In utils/index.ts
export { validateLedgerSequence } from './ledger-validation';
export { formatBytes, formatHex } from './formatting';
```

## Database Interaction Standards

### 1. Database Access Pattern

**Always use the singleton database pattern**

```typescript
// ✅ Correct database access
import { CCFDatabase, DATABASE_FILENAME } from '@microsoft/ccf-database';

const getDatabase = async (): Promise<CCFDatabase> => {
  if (!dbInstance) {
    dbInstance = new CCFDatabase({
      filename: DATABASE_FILENAME,
      useOpfs: true,
    });
    await dbInstance.initialize();
  }
  return dbInstance;
};

export const useLedgerFiles = () => {
  return useQuery({
    queryKey: queryKeys.ledgerFiles,
    queryFn: async () => {
      const db = await getDatabase();
      return db.getLedgerFiles();
    },
  });
};
```

### 2. SQL Query Safety

**All user-facing SQL queries MUST be validated**

```typescript
// ✅ Safe SQL execution
async executeQuery(sqlQuery: string): Promise<unknown[]> {
  if (!this.db) throw new Error('Database not initialized');

  // Validate the query is a SELECT statement only
  const trimmedQuery = sqlQuery.trim().toUpperCase();
  if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
    throw new Error('Only SELECT queries are allowed for security reasons');
  }

  try {
    const result = this.db.exec(sqlQuery);
    return this.formatQueryResult(result);
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  }
}
```

## Performance Requirements

### 1. Component Performance

```typescript
// ✅ Use React.memo for expensive components
export const TransactionList = React.memo<TransactionListProps>(({ 
  transactions,
  onTransactionClick 
}) => {
  return (
    <div>
      {transactions.map(tx => (
        <TransactionRow 
          key={tx.id} 
          transaction={tx} 
          onClick={onTransactionClick} 
        />
      ))}
    </div>
  );
});

// ✅ Use useMemo for expensive computations
const expensiveValue = useMemo(() => {
  return transactions.reduce((sum, tx) => sum + tx.size, 0);
}, [transactions]);
```

### 2. Bundle Size Management

```typescript
// ✅ Lazy load heavy components
const AIPage = lazy(() => import('./pages/AIPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));

// ✅ Dynamic imports for utilities
const loadParser = async () => {
  const { LedgerChunkV2 } = await import('./parser/ledger-chunk');
  return LedgerChunkV2;
};
```

## Testing Requirements

### 1. Component Testing

```typescript
// ✅ Test components with React Testing Library
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionViewer } from './TransactionViewer';

describe('TransactionViewer', () => {
  it('should display loading state initially', () => {
    const queryClient = new QueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <TransactionViewer fileId={1} fileName="test.committed" />
      </QueryClientProvider>
    );

    expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
  });
});
```

### 2. Hook Testing

```typescript
// ✅ Test custom hooks
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLedgerFiles } from './use-ccf-data';

describe('useLedgerFiles', () => {
  it('should fetch ledger files', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLedgerFiles(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

## Documentation Requirements

### 1. Component Documentation

```typescript
/**
 * TransactionViewer displays a paginated list of transactions for a specific ledger file.
 * 
 * @param fileId - The ID of the ledger file to display transactions for
 * @param fileName - The name of the ledger file (for display purposes)
 * @param transactionId - Optional transaction ID to highlight/scroll to
 * 
 * @example
 * ```tsx
 * <TransactionViewer 
 *   fileId={1} 
 *   fileName="ledger_0-999.committed"
 *   transactionId={123}
 * />
 * ```
 */
export const TransactionViewer: React.FC<TransactionViewerProps> = ({
  fileId,
  fileName,
  transactionId
}) => {
  // Implementation
};
```

### 2. Hook Documentation

```typescript
/**
 * Custom hook for managing transaction data with pagination support.
 * 
 * @param fileId - The ID of the ledger file
 * @param limit - Number of transactions per page (default: 100)
 * @param offset - Starting offset for pagination (default: 0)
 * 
 * @returns Query result with transactions data, loading state, and error handling
 * 
 * @example
 * ```typescript
 * const { data: transactions, isLoading, error } = useTransactions(1, 50, 0);
 * ```
 */
export const useTransactions = (fileId: number, limit = 100, offset = 0) => {
  return useQuery({
    queryKey: [...queryKeys.transactions(fileId), limit, offset],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTransactions(fileId, limit, offset);
    },
    enabled: fileId > 0,
  });
};
```

## Code Review Checklist

### Before Submitting Code

- [ ] All data fetching uses TanStack Query
- [ ] TypeScript strict mode compliance
- [ ] FluentUI components used for all UI
- [ ] Proper error handling implemented
- [ ] Loading states handled
- [ ] Performance optimizations applied (memo, useMemo where needed)
- [ ] Tests written for new functionality
- [ ] Documentation updated
- [ ] No console.log statements in production code
- [ ] Proper query key management
- [ ] Database access follows singleton pattern

### Code Review Focus Areas

1. **TanStack Query Usage**: Verify all server state uses React Query
2. **Type Safety**: Check for proper TypeScript usage, no `any` types
3. **Error Handling**: Ensure all async operations have error handling
4. **Performance**: Look for unnecessary re-renders or expensive operations
5. **Security**: Validate SQL query safety and input validation
6. **Consistency**: Check naming conventions and file organization

---

**⚠️ CRITICAL**: These standards are MANDATORY for all code contributions. Any code that doesn't follow these patterns will be rejected during code review. When these standards are updated, all team members must be notified and existing code should be gradually migrated to follow the new patterns.
