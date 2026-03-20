/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BlobAppConfig, AuditBlob, AuditResult } from '../types/blob-app-types';
import { BLOB_APP_STORAGE_KEYS } from '../types/blob-app-types';
import {
  triggerAudit,
  listAuditBlobs,
  downloadAuditResult,
  downloadLatestAuditResult,
  listErrorLogs,
  validateConfig,
} from '../services/blob-app/blob-app-service';

/** Query key helpers for blob app data */
const blobAppQueryKeys = {
  all: ['blob-app'] as const,
  auditBlobs: (storageAccount?: string, container?: string) =>
    [...blobAppQueryKeys.all, 'audit-blobs', storageAccount, container] as const,
  auditResult: (blobName: string) =>
    [...blobAppQueryKeys.all, 'audit-result', blobName] as const,
  latestAuditResult: (storageAccount: string, container: string) =>
    [...blobAppQueryKeys.all, 'latest-audit', storageAccount, container] as const,
  errorLogs: () => [...blobAppQueryKeys.all, 'error-logs'] as const,
};

/**
 * Hook for managing BlobAppConfig state, persisted in localStorage.
 */
export function useBlobAppConfig() {
  const [config, setConfig] = useState<BlobAppConfig>(() => ({
    serviceBusNamespace: localStorage.getItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_NAMESPACE) || '',
    serviceBusQueueName: localStorage.getItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_QUEUE_NAME) || '',
    serviceBusSasKeyName: localStorage.getItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_SAS_KEY_NAME) || '',
    serviceBusSasKey: localStorage.getItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_SAS_KEY) || '',
    storageAccountName: localStorage.getItem(BLOB_APP_STORAGE_KEYS.STORAGE_ACCOUNT_NAME) || '',
    storageSasToken: localStorage.getItem(BLOB_APP_STORAGE_KEYS.STORAGE_SAS_TOKEN) || '',
    managedAppName: localStorage.getItem(BLOB_APP_STORAGE_KEYS.MANAGED_APP_NAME) || '',
  }));

  // Persist changes to localStorage
  useEffect(() => {
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_NAMESPACE, config.serviceBusNamespace);
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_QUEUE_NAME, config.serviceBusQueueName);
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_SAS_KEY_NAME, config.serviceBusSasKeyName);
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.SERVICE_BUS_SAS_KEY, config.serviceBusSasKey);
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.STORAGE_ACCOUNT_NAME, config.storageAccountName);
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.STORAGE_SAS_TOKEN, config.storageSasToken);
    localStorage.setItem(BLOB_APP_STORAGE_KEYS.MANAGED_APP_NAME, config.managedAppName);
  }, [config]);

  const updateConfig = useCallback((updates: Partial<BlobAppConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const validation = validateConfig(config);

  return { config, setConfig, updateConfig, validation };
}

/**
 * Hook to trigger an audit via Service Bus queue.
 */
export function useTriggerAudit(config: BlobAppConfig) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storageAccount,
      blobContainer,
      getUsers,
    }: {
      storageAccount: string;
      blobContainer: string;
      getUsers?: boolean;
    }) => {
      return triggerAudit(config, storageAccount, blobContainer, getUsers);
    },
    onSuccess: (_data, variables) => {
      // Invalidate audit blobs list after triggering
      void queryClient.invalidateQueries({
        queryKey: blobAppQueryKeys.auditBlobs(variables.storageAccount, variables.blobContainer),
      });
    },
  });
}

/**
 * Hook to list audit blobs from the audit-records container.
 */
export function useAuditBlobs(
  config: BlobAppConfig,
  storageAccount?: string,
  containerName?: string,
  enabled: boolean = true,
) {
  const validation = validateConfig(config);
  const canFetch = validation.valid && enabled && !!config.storageAccountName && !!config.managedAppName;

  return useQuery<AuditBlob[]>({
    queryKey: blobAppQueryKeys.auditBlobs(storageAccount, containerName),
    queryFn: () => listAuditBlobs(config, storageAccount, containerName),
    enabled: canFetch,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to download + parse a single audit result file.
 */
export function useDownloadAuditResult(config: BlobAppConfig) {
  return useMutation<AuditResult, Error, string>({
    mutationFn: (blobName: string) => downloadAuditResult(config, blobName),
  });
}

/**
 * Hook to download the latest audit result for a specific storage/container pair.
 */
export function useLatestAuditResult(
  config: BlobAppConfig,
  storageAccount: string,
  containerName: string,
  enabled: boolean = true,
) {
  const validation = validateConfig(config);
  const canFetch = validation.valid && enabled && !!storageAccount && !!containerName;

  return useQuery<AuditResult | null>({
    queryKey: blobAppQueryKeys.latestAuditResult(storageAccount, containerName),
    queryFn: () => downloadLatestAuditResult(config, storageAccount, containerName),
    enabled: canFetch,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to list error logs.
 */
export function useErrorLogs(config: BlobAppConfig, enabled: boolean = true) {
  const validation = validateConfig(config);
  const canFetch = validation.valid && enabled;

  return useQuery<AuditBlob[]>({
    queryKey: blobAppQueryKeys.errorLogs(),
    queryFn: () => listErrorLogs(config),
    enabled: canFetch,
    staleTime: 60 * 1000,
  });
}
