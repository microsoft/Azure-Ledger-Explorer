// React hooks for CCF data using TanStack Query
// Provides state management for the application

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CCFDatabase } from '../database/ccf-database';
import { LedgerChunkV2 } from '../parser/ledger-chunk';
import type { Transaction } from '../types/ccf-types';

// Global database instance (singleton pattern)
let dbInstance: CCFDatabase | null = null;

const getDatabase = async (): Promise<CCFDatabase> => {
  if (!dbInstance) {
    dbInstance = new CCFDatabase({
      filename: 'ccf-ledger.db',
      useOpfs: true,
    });
    await dbInstance.initialize();
  }
  return dbInstance;
};

// Query keys for TanStack Query
export const queryKeys = {
  ledgerFiles: ['ledgerFiles'] as const,
  transactions: (fileId: number) => ['transactions', fileId] as const,
  transactionDetails: (transactionId: number) => ['transactionDetails', transactionId] as const,
  search: (query: string) => ['search', query] as const,
  stats: ['stats'] as const,
  enhancedStats: ['enhancedStats'] as const,
  ccfTables: ['ccfTables'] as const,
  tableKeyValues: (mapName: string, limit: number, offset: number, searchQuery?: string) => ['tableKeyValues', mapName, limit, offset, searchQuery] as const,
  tableLatestState: (mapName: string, limit: number, offset: number, searchQuery?: string) => ['tableLatestState', mapName, limit, offset, searchQuery] as const,
  keyTransactions: (mapName: string, keyName: string, limit: number, offset: number) => ['keyTransactions', mapName, keyName, limit, offset] as const,
  searchByKeyOrValue: (query: string, limit: number) => ['searchByKeyOrValue', query, limit] as const,
};

/**
 * Hook to get all ledger files
 */
export const useLedgerFiles = () => {
  return useQuery({
    queryKey: queryKeys.ledgerFiles,
    queryFn: async () => {
      const db = await getDatabase();
      return db.getLedgerFiles();
    },
  });
};

/**
 * Hook to get transactions for a specific file
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

/**
 * Hook to get transaction details (writes and deletes)
 */
export const useTransactionDetails = (transactionId: number) => {
  return useQuery({
    queryKey: queryKeys.transactionDetails(transactionId),
    queryFn: async () => {
      const db = await getDatabase();
      const [writes, deletes] = await Promise.all([
        db.getTransactionWrites(transactionId),
        db.getTransactionDeletes(transactionId),
      ]);
      return { writes, deletes };
    },
    enabled: transactionId > 0,
  });
};

/**
 * Hook to search transactions by key name
 */
export const useSearchTransactions = (query: string, limit = 50) => {
  return useQuery({
    queryKey: [...queryKeys.search(query), limit],
    queryFn: async () => {
      const db = await getDatabase();
      return db.searchByKey(query, limit);
    },
    enabled: query.length > 0,
  });
};

/**
 * Hook to search transactions by key name or value content
 */
export const useSearchByKeyOrValue = (query: string, limit = 50) => {
  return useQuery({
    queryKey: queryKeys.searchByKeyOrValue(query, limit),
    queryFn: async () => {
      const db = await getDatabase();
      return db.searchByKeyOrValue(query, limit);
    },
    enabled: query.length > 0,
  });
};

/**
 * Hook to get all transactions across all files
 */
export const useAllTransactions = (limit = 1000, offset = 0, searchQuery?: string) => {
  return useQuery({
    queryKey: ['allTransactions', limit, offset, searchQuery],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getAllTransactions(limit, offset, searchQuery);
    },
  });
};

/**
 * Hook to get total count of all transactions
 */
export const useAllTransactionsCount = (searchQuery?: string) => {
  return useQuery({
    queryKey: ['allTransactionsCount', searchQuery],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getAllTransactionsCount(searchQuery);
    },
  });
};

/**
 * Hook to get database statistics
 */
export const useStats = () => {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const db = await getDatabase();
      return db.getStats();
    },
  });
};

/**
 * Hook to get enhanced database statistics
 */
export const useEnhancedStats = () => {
  return useQuery({
    queryKey: queryKeys.enhancedStats,
    queryFn: async () => {
      const db = await getDatabase();
      return db.getEnhancedStats();
    },
  });
};

/**
 * Hook to upload and parse a ledger file
 */
export const useUploadLedgerFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<{ fileId: number; transactionCount: number }> => {
      const db = await getDatabase();
      
      // Read file into ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Insert file record
      const fileId = await db.insertLedgerFile(file.name, file.size);
      
      // Parse ledger
      const ledgerChunk = new LedgerChunkV2(file.name, arrayBuffer);
      let transactionCount = 0;

      // Process transactions in batches to avoid blocking the UI
      const batchSize = 100;
      const transactions: Transaction[] = [];
      
      for await (const transaction of ledgerChunk.readAllTransactions()) {
        transactions.push(transaction);
        
        if (transactions.length >= batchSize) {
          // Process batch
          for (const tx of transactions) {
            await db.insertTransaction(fileId, tx);
            transactionCount++;
          }
          transactions.length = 0; // Clear array
          
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Process remaining transactions
      for (const tx of transactions) {
        await db.insertTransaction(fileId, tx);
        transactionCount++;
      }

      await db.save();
      return { fileId, transactionCount };
    },
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
    onError: (error) => {
      console.error('Failed to upload and parse ledger file:', error);
    },
  });
};

/**
 * Hook to delete a ledger file and all its associated data
 */
export const useDeleteLedgerFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: number) => {
      const db = await getDatabase();
      await db.deleteLedgerFile(fileId);
    },
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error) => {
      console.error('Failed to delete ledger file:', error);
    },
  });
};

/**
 * Hook to clear all data from the database
 */
export const useClearAllData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const db = await getDatabase();
      await db.clearAllData();
    },
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Failed to clear all data:', error);
    },
  });
};

/**
 * Hook to drop the entire database (complete reset)
 */
export const useDropDatabase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const db = await getDatabase();
      await db.dropDatabase();
    },
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Failed to drop database:', error);
    },
  });
};

/**
 * Custom hook to handle file drop functionality
 */
export const useFileDrop = () => {
  const uploadMutation = useUploadLedgerFile();

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      // Check if file appears to be a ledger file
      if (file.size > 0) {
        try {
          await uploadMutation.mutateAsync(file);
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
        }
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  return {
    handleDrop,
    handleDragOver,
    handleFiles,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
  };
};

/**
 * Hook to get transactions for a specific file with full structure (like useAllTransactions)
 */
export const useFileTransactions = (fileId: number, limit = 100, offset = 0) => {
  return useQuery({
    queryKey: ['fileTransactions', fileId, limit, offset],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getFileTransactions(fileId, limit, offset);
    },
    enabled: fileId > 0,
  });
};

/**
 * Hook to get a transaction by ID
 */
export const useTransactionById = (transactionId: number) => {
  return useQuery({
    queryKey: ['transactionById', transactionId],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTransactionById(transactionId);
    },
    enabled: transactionId > 0,
  });
};

/**
 * Hook to get total count of transactions for a specific file
 */
export const useFileTransactionsCount = (fileId: number) => {
  return useQuery({
    queryKey: ['fileTransactionsCount', fileId],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getFileTransactionsCount(fileId);
    },
    enabled: fileId > 0,
  });
};

/**
 * Hook to get all CCF tables
 */
export const useCCFTables = () => {
  return useQuery({
    queryKey: queryKeys.ccfTables,
    queryFn: async () => {
      const db = await getDatabase();
      return db.getCCFTables();
    },
  });
};

/**
 * Hook to get key-value pairs from a specific CCF table
 */
export const useTableKeyValues = (mapName: string, limit = 100, offset = 0, searchQuery?: string) => {
  return useQuery({
    queryKey: queryKeys.tableKeyValues(mapName, limit, offset, searchQuery),
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTableKeyValues(mapName, limit, offset, searchQuery);
    },
    enabled: mapName.length > 0,
  });
};

/**
 * Hook to get the latest state of all keys in a specific CCF table
 */
export const useTableLatestState = (mapName: string, limit = 100, offset = 0, searchQuery?: string) => {
  return useQuery({
    queryKey: queryKeys.tableLatestState(mapName, limit, offset, searchQuery),
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTableLatestState(mapName, limit, offset, searchQuery);
    },
    enabled: mapName.length > 0,
  });
};

/**
 * Hook to get transactions for a specific key in a CCF table
 */
export const useKeyTransactions = (mapName: string, keyName: string, limit = 100, offset = 0) => {
  return useQuery({
    queryKey: queryKeys.keyTransactions(mapName, keyName, limit, offset),
    queryFn: async () => {
      const db = await getDatabase();
      return db.getKeyTransactions(mapName, keyName, limit, offset);
    },
    enabled: mapName.length > 0 && keyName.length > 0,
  });
};

/**
 * Hook to get the database instance
 */
export const useDatabase = () => {
  return useQuery({
    queryKey: ['database'],
    queryFn: getDatabase,
    staleTime: Infinity, // Database instance doesn't change once created
  });
};
