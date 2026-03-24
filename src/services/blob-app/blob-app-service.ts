/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { BlobAppConfig } from '../../types/blob-app-types';

/**
 * Validate that the configuration is sufficient to perform operations.
 */
export function validateConfig(config: BlobAppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.serviceBusNamespace) errors.push('Service Bus namespace is required');
  if (!config.serviceBusQueueName) errors.push('Service Bus queue name is required');
  if (!config.serviceBusSasKeyName) errors.push('Service Bus SAS policy name is required');
  if (!config.serviceBusSasKey) errors.push('Service Bus SAS key is required');
  if (!config.storageAccountName) errors.push('Storage account name is required');
  if (!config.storageSasToken) errors.push('Storage SAS token is required');
  if (!config.managedAppName) errors.push('Managed app name is required');

  return { valid: errors.length === 0, errors };
}
