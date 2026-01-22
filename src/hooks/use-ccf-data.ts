/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { CCFDatabase, DATABASE_FILENAME } from '@ccf/database';
import { getStorageQuota, checkStorageCapacity, estimateDatabaseSize } from '../utils/storage-quota';
import { verificationService } from '../services/verification-service';

// Global database instance (singleton pattern)
let dbInstance: CCFDatabase | null = null;
let dbInitialized = false;

export type TableLatestStateSortColumn = 'sequence' | 'transactionId' | 'keyName' | 'value';
export type TableLatestStateSortDirection = 'asc' | 'desc';

/**
 * Initialize the database. This should be called once at app startup.
 * Throws if initialization fails.
 */
export const initializeDatabase = async (): Promise<void> => {
  if (dbInitialized && dbInstance) {
    return; // Already initialized
  }
  
  // Note: The actual filename is defined in @ccf/database constants
  dbInstance = new CCFDatabase({
    filename: DATABASE_FILENAME,
    useOpfs: true,
  });
  
  await dbInstance.initialize();
  dbInitialized = true;
};

/**
 * Reset the database by clearing OPFS storage.
 * This will delete all stored data.
 */
export const resetDatabase = async (): Promise<void> => {
  // Clear the current instance
  dbInstance = null;
  dbInitialized = false;
  
  // Try to delete the OPFS directory
  try {
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      const root = await navigator.storage.getDirectory();
      // Try to remove the database files
      try {
        await root.removeEntry(DATABASE_FILENAME, { recursive: true });
      } catch {
        // File might not exist, ignore
      }
      try {
        await root.removeEntry(`${DATABASE_FILENAME}-journal`, { recursive: true });
      } catch {
        // File might not exist, ignore
      }
      try {
        await root.removeEntry(`${DATABASE_FILENAME}-wal`, { recursive: true });
      } catch {
        // File might not exist, ignore
      }
    }
  } catch (error) {
    console.error('Failed to clear OPFS storage:', error);
    // Continue anyway - the database might still work after reinitialization
  }
  
  // Also clear IndexedDB if used
  try {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name && db.name.includes('sqlite')) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  } catch {
    // IndexedDB.databases() might not be supported, ignore
  }
};

/**
 * Check if the database has been initialized.
 */
export const isDatabaseInitialized = (): boolean => {
  return dbInitialized && dbInstance !== null;
};

export const getDatabase = async (): Promise<CCFDatabase> => {
  if (!dbInstance || !dbInitialized) {
    // If not initialized, do it now (for backwards compatibility)
    await initializeDatabase();
  }
  return dbInstance!;
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
      return db.files.getAll();
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
      return db.transactions.getByFileId(fileId, limit, offset);
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
        db.transactions.getWrites(transactionId),
        db.transactions.getDeletes(transactionId),
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
      return db.transactions.searchByKey(query, limit);
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
      return db.transactions.searchByKeyOrValue(query, limit);
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
      return db.transactions.getAll(limit, offset, searchQuery);
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
      return db.transactions.getWithRelated(start, limit);
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
      return db.transactions.getAllCount(searchQuery);
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
      return db.transactions.getTotalCount();
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
      return db.stats.getStats();
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
      return db.stats.getEnhancedStats();
    },
  });
};

/**
 * Hook to upload and parse a ledger file
 */
export const useUploadLedgerFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      file: File; 
      shouldVerify?: boolean;
    }) => {
      const { file, shouldVerify } = params;
      const db = await getDatabase();
      
      // Read file into ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Transfer the ArrayBuffer to the worker for processing
      // The worker will parse, verify, and insert everything
      // Merkle tree state is maintained inside the worker across calls
      const result = await db.insertLedgerFileWithData(file.name, file.size, arrayBuffer, {
        shouldVerify: shouldVerify !== false,
      });
      
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
      await db.files.delete(fileId);
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
 * Progress information for file uploads
 */
export interface FileUploadProgress {
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  /** All filenames in the upload queue */
  allFiles: string[];
  /** Set of filenames that have been successfully processed */
  completedFiles: Set<string>;
  /** The filename currently being processed */
  processingFile: string | null;
}

// Shared upload progress state (module-level singleton)
let sharedUploadProgress: FileUploadProgress | null = null;
const uploadProgressListeners = new Set<() => void>();

function setSharedUploadProgress(progress: FileUploadProgress | null) {
  sharedUploadProgress = progress;
  // Notify all listeners (all components using useFileDrop)
  uploadProgressListeners.forEach(listener => listener());
}

function subscribeToUploadProgress(listener: () => void) {
  uploadProgressListeners.add(listener);
  return () => uploadProgressListeners.delete(listener);
}

function getUploadProgressSnapshot() {
  return sharedUploadProgress;
}

/**
 * Custom hook to handle file drop functionality
 * Uses shared state so upload progress is visible across all components
 */
export const useFileDrop = () => {
  const uploadMutation = useUploadLedgerFile();
  
  // Subscribe to shared upload progress state
  const uploadProgress = useSyncExternalStore(
    subscribeToUploadProgress,
    getUploadProgressSnapshot,
    getUploadProgressSnapshot
  );

  const handleFiles = useCallback(async (
    files: FileList | File[], 
    options?: { shouldVerify?: boolean }
  ) => {
    const fileArray = Array.from(files).filter(f => f.size > 0);
    const totalFiles = fileArray.length;
    const allFiles = fileArray.map(f => f.name);
    const completedFiles = new Set<string>();
    const shouldVerify = options?.shouldVerify !== false;
    
    // Reset Merkle tree state before starting a new import sequence
    // This ensures verification starts from a clean state
    if (shouldVerify && totalFiles > 0) {
      const db = await getDatabase();
      await db.resetMerkleState();
    }
    
    // Show all files immediately in the pending state
    if (totalFiles > 0) {
      setSharedUploadProgress({
        currentFileIndex: 0,
        totalFiles,
        currentFileName: '',
        allFiles,
        completedFiles: new Set(),
        processingFile: null,
      });
    }
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        // Update progress before processing
        setSharedUploadProgress({
          currentFileIndex: i + 1,
          totalFiles,
          currentFileName: file.name,
          allFiles,
          completedFiles: new Set(completedFiles),
          processingFile: file.name,
        });
        
        // Worker maintains Merkle tree state internally across calls
        await uploadMutation.mutateAsync({
          file,
          shouldVerify,
        });
        
        // Mark as completed
        completedFiles.add(file.name);
        setSharedUploadProgress({
          currentFileIndex: i + 1,
          totalFiles,
          currentFileName: file.name,
          allFiles,
          completedFiles: new Set(completedFiles),
          processingFile: null,
        });
      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        // Clear progress on error
        setSharedUploadProgress(null);
        // Re-throw to stop processing more files if there's an error
        throw error;
      }
    }
    
    // Clear progress when all done
    setSharedUploadProgress(null);
  }, [uploadMutation]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      handleFiles(event.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  return {
    handleDrop,
    handleDragOver,
    handleFiles,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    uploadProgress,
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
      return db.transactions.getByFileIdWithDetails(fileId, limit, offset, searchQuery);
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
      return db.transactions.getById(transactionId);
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
      return db.transactions.getCountByFileId(fileId, searchQuery);
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
      return db.kv.getTables();
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
      return db.kv.getTableKeyValues(mapName, limit, offset, searchQuery);
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
      return db.kv.getTableLatestState(mapName, limit, offset, searchQuery, sortColumn, sortDirection);
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
      return db.kv.getTableLatestStateCount(mapName, searchQuery);
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
      return db.kv.getKeyTransactions(mapName, keyName, limit, offset);
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
