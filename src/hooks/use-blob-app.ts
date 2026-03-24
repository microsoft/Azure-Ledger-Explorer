/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { BlobAppConfig } from '../types/blob-app-types';
import { validateConfig } from '../services/blob-app/blob-app-service';

/**
 * Hook for managing BlobAppConfig state with hardcoded demo values.
 */
export function useBlobAppConfig() {
  const [config, setConfig] = useState<BlobAppConfig>(() => ({
    serviceBusNamespace: 'explorertestsbns20260319T234133179Z',
    serviceBusQueueName: 'explorertestsbns20260319t234133179zqueue',
    serviceBusSasKeyName: 'RootManageSharedAccessKey',
    serviceBusSasKey: 'dGhpcyBpcyBhIGRlbW8ga2V5IGZvciBwcmVzZW50YXRpb24gcHVycG9zZXM=',
    storageAccountName: 'explorerteststorage20260',
    storageSasToken: '?sv=2024-11-04&ss=b&srt=sco&sp=rl&se=2027-03-25T00:00:00Z&st=2026-03-24T00:00:00Z&spr=https&sig=DEMO_SAS_TOKEN_REDACTED',
    managedAppName: 'explorertest',
  }));

  const updateConfig = useCallback((updates: Partial<BlobAppConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const validation = validateConfig(config);

  return { config, setConfig, updateConfig, validation };
}

/**
 * Stub hook for triggering an audit (demo mode — does not make real API calls).
 */
export function useTriggerAudit(_config: BlobAppConfig) {
  return useMutation({
    mutationFn: async (_params: {
      storageAccount: string;
      blobContainer: string;
      getUsers?: boolean;
    }) => {
      // Demo stub: simulate a successful audit trigger
      await new Promise((resolve) => setTimeout(resolve, 800));
      return 201;
    },
  });
}
