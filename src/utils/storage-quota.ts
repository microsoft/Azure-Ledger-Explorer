/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



export interface StorageQuota {
  usage: number;           // Bytes currently used
  quota: number;           // Total bytes available
  available: number;       // Bytes available for use
  usagePercentage: number; // Percentage of quota used (0-100)
  availablePercentage: number; // Percentage of quota available (0-100)
}

export interface StorageStatus {
  supportsQuota: boolean;
  quota: StorageQuota | null;
  error?: string;
}

/**
 * Get current storage quota and usage information
 */
export const getStorageQuota = async (): Promise<StorageStatus> => {
  try {
    // Check if the Storage API is available
    if (!navigator.storage || !navigator.storage.estimate) {
      return {
        supportsQuota: false,
        quota: null,
        error: 'Storage quota API not supported',
      };
    }

    const estimate = await navigator.storage.estimate();
    
    if (estimate.quota === undefined || estimate.usage === undefined) {
      return {
        supportsQuota: false,
        quota: null,
        error: 'Storage quota information not available',
      };
    }

    const usage = estimate.usage;
    const quota = estimate.quota;
    const available = quota - usage;
    const usagePercentage = (usage / quota) * 100;
    const availablePercentage = (available / quota) * 100;

    return {
      supportsQuota: true,
      quota: {
        usage,
        quota,
        available,
        usagePercentage,
        availablePercentage,
      },
    };
  } catch (error) {
    console.error('Failed to get storage quota:', error);
    return {
      supportsQuota: false,
      quota: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Check if there's enough storage space for a given size
 */
export const checkStorageCapacity = async (requiredBytes: number): Promise<{
  hasCapacity: boolean;
  availableBytes: number;
  requiredBytes: number;
  shortfallBytes?: number;
}> => {
  const storageStatus = await getStorageQuota();
  
  if (!storageStatus.supportsQuota || !storageStatus.quota) {
    // If we can't determine quota, assume we have capacity
    return {
      hasCapacity: true,
      availableBytes: Number.MAX_SAFE_INTEGER,
      requiredBytes,
    };
  }

  const available = storageStatus.quota.available;
  const hasCapacity = available >= requiredBytes;
  
  return {
    hasCapacity,
    availableBytes: available,
    requiredBytes,
    shortfallBytes: hasCapacity ? undefined : requiredBytes - available,
  };
};

/**
 * Format bytes into human-readable format
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Get database file size estimate based on transaction count and complexity
 */
export const estimateDatabaseSize = (transactionCount: number, averageKVPairs = 5): number => {
  // Rough estimates based on typical CCF data:
  // - Transaction record: ~200 bytes
  // - KV write record: ~150 bytes on average (varies greatly by value size)
  // - KV delete record: ~100 bytes
  // - Indexes and metadata: ~20% overhead
  
  const transactionSize = 200;
  const averageKVSize = 125; // Average of writes and deletes
  const indexOverhead = 0.2;
  
  const baseSize = transactionCount * (transactionSize + (averageKVPairs * averageKVSize));
  const totalSize = baseSize * (1 + indexOverhead);
  
  return Math.round(totalSize);
};

/**
 * Get storage recommendations based on current usage
 */
export const getStorageRecommendations = (quota: StorageQuota): string[] => {
  const recommendations: string[] = [];
  
  if (quota.usagePercentage > 90) {
    recommendations.push('Storage is critically low. Consider clearing old data or reducing file sizes.');
  } else if (quota.usagePercentage > 75) {
    recommendations.push('Storage is getting low. Monitor usage and consider cleanup if needed.');
  }
  
  if (quota.usagePercentage > 50) {
    recommendations.push('Use the "Clear All Data" option to free up space when finished with analysis.');
  }
  
  if (quota.available < 100 * 1024 * 1024) { // Less than 100MB
    recommendations.push('Less than 100MB available. Large ledger files may not fit.');
  }
  
  return recommendations;
};

/**
 * Calculate storage efficiency metrics
 */
export const calculateStorageMetrics = (quota: StorageQuota) => {
  return {
    totalCapacity: formatBytes(quota.quota),
    usedSpace: formatBytes(quota.usage),
    availableSpace: formatBytes(quota.available),
    usagePercentage: Math.round(quota.usagePercentage * 10) / 10,
    isLowSpace: quota.usagePercentage > 75,
    isCriticalSpace: quota.usagePercentage > 90,
  };
};
