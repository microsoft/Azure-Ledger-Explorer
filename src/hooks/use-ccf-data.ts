/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CCFDatabase } from '../database';
import { getStorageQuota, checkStorageCapacity, estimateDatabaseSize } from '../utils/storage-quota';
import { verificationService } from '../services/verification-service';

// Global database instance (singleton pattern)
let dbInstance: CCFDatabase | null = null;

export type TableLatestStateSortColumn = 'sequence' | 'transactionId' | 'keyName' | 'value';
export type TableLatestStateSortDirection = 'asc' | 'desc';

export const getDatabase = async (): Promise<CCFDatabase> => {
  if (!dbInstance) {
    dbInstance = new CCFDatabase({
      filename: 'ccf-ledger.db',
      useOpfs: true,
    });
    try {
      await dbInstance.initialize();
    } catch (error) {
      alert('Could not open local database. Please reload the page or close other windows or tabs that also use this page. ' + error);
      throw error;
    }
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
  tableLatestState: (
    mapName: string,
    limit: number,
    offset: number,
    searchQuery: string | undefined,
    sortColumn: TableLatestStateSortColumn,
    sortDirection: TableLatestStateSortDirection,
  ) => ['tableLatestState', mapName, limit, offset, searchQuery, sortColumn, sortDirection] as const,
  tableLatestStateCount: (mapName: string, searchQuery?: string) => ['tableLatestStateCount', mapName, searchQuery] as const,
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
 * Hook to get transactions with related data for verification
 */
export const useTransactionsWithRelated = (start: number, limit: number) => {
  return useQuery({
    queryKey: ['transactionsWithRelated', start, limit],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTransactionsWithRelated(start, limit);
    },
    enabled: start >= 0,
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
 * Hook to get total transactions count for verification
 */
export const useTotalTransactionsCount = () => {
  return useQuery({
    queryKey: ['totalTransactionsCount'],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTotalTransactionsCount();
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
      
      // Transfer the ArrayBuffer to the worker for processing
      // The worker will parse and insert everything
      const result = await db.insertLedgerFileWithData(file.name, file.size, arrayBuffer);
      
      return result;
    },
    onSuccess: () => {
      // Final comprehensive invalidation after upload completes
      queryClient.invalidateQueries({ queryKey: queryKeys.ledgerFiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.enhancedStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.ccfTables });
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && 
        (query.queryKey[0] === 'transactions' || 
         query.queryKey[0] === 'fileTransactions' || 
         query.queryKey[0] === 'fileTransactionsCount' ||
         query.queryKey[0] === 'transactionById')
      });
      // Invalidate all search queries
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && (query.queryKey[0] === 'search' || query.queryKey[0] === 'searchByKeyOrValue')
      });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.enhancedStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.ccfTables });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === 'transactions'
      });
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
      
      // Clear verification progress since data is cleared
      verificationService.clearSavedProgress();
    },
    onSuccess: () => {
      // Reset all queries to clear cached data and force re-fetch
      // This ensures the UI immediately shows empty state
      queryClient.resetQueries();
    },
    onError: (error) => {
      console.error('Failed to clear all data:', error);
    },
  });
};

/**
 * Hook to drop the entire database (complete reset)
 * Uses the nuclear option to delete the OPFS database file completely
 */
export const useDropDatabase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const db = await getDatabase();
      // Nuclear option: completely delete and recreate the OPFS database file
      await db.deleteAndRecreateDatabase();
      
      // Clear verification progress since database is reset
      verificationService.clearSavedProgress();
    },
    onSuccess: () => {
      // Reset all queries to clear cached data and force re-fetch
      // This ensures the UI immediately shows empty state
      queryClient.resetQueries();
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
          // Re-throw to stop processing more files if there's an error
          throw error;
        }
      } else {
        console.warn(`Skipping empty file: ${file.name}`);
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
export const useFileTransactions = (fileId: number, limit = 100, offset = 0, searchQuery?: string) => {
  return useQuery({
    queryKey: ['fileTransactions', fileId, limit, offset, searchQuery],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getFileTransactions(fileId, limit, offset, searchQuery);
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
export const useFileTransactionsCount = (fileId: number, searchQuery?: string) => {
  return useQuery({
    queryKey: ['fileTransactionsCount', fileId, searchQuery],
    queryFn: async () => {
      const db = await getDatabase();
      return db.getFileTransactionsCount(fileId, searchQuery);
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
export const useTableLatestState = (
  mapName: string,
  limit = 100,
  offset = 0,
  searchQuery?: string,
  sortColumn: TableLatestStateSortColumn = 'sequence',
  sortDirection: TableLatestStateSortDirection = 'asc',
) => {
  return useQuery({
    queryKey: queryKeys.tableLatestState(mapName, limit, offset, searchQuery, sortColumn, sortDirection),
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTableLatestState(mapName, limit, offset, searchQuery, sortColumn, sortDirection);
    },
    enabled: mapName.length > 0,
  });
};

/**
 * Hook to get the total count of keys in the latest state of a CCF table
 */
export const useTableLatestStateCount = (mapName: string, searchQuery?: string) => {
  return useQuery({
    queryKey: queryKeys.tableLatestStateCount(mapName, searchQuery),
    queryFn: async () => {
      const db = await getDatabase();
      return db.getTableLatestStateCount(mapName, searchQuery);
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

/**
 * Hook to get storage quota information
 */
export const useStorageQuota = () => {
  return useQuery({
    queryKey: ['storageQuota'],
    queryFn: getStorageQuota,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
};

/**
 * Hook to check storage capacity for a specific size
 */
export const useStorageCapacity = (requiredBytes: number) => {
  return useQuery({
    queryKey: ['storageCapacity', requiredBytes],
    queryFn: () => checkStorageCapacity(requiredBytes),
    enabled: requiredBytes > 0,
    staleTime: 5000, // Consider stale after 5 seconds
  });
};

/**
 * Hook to estimate database size for transaction count
 */
export const useEstimateDatabaseSize = (transactionCount: number) => {
  return useQuery({
    queryKey: ['estimateDatabaseSize', transactionCount],
    queryFn: () => estimateDatabaseSize(transactionCount),
    enabled: transactionCount > 0,
    staleTime: 60000, // Estimates don't change frequently
  });
};
