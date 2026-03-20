/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { BlobAppConfig, AuditTriggerMessage, AuditBlob, AuditResult, AuditRecord, AuditValidityPeriod, AuditBlobEntry } from '../../types/blob-app-types';

const isDev = import.meta.env.DEV;

/**
 * Build a Blob Storage URL. In development, routes through the Vite proxy
 * at /api/blob/<account>/ to avoid CORS.
 */
function blobUrl(accountName: string, path: string): string {
  if (isDev) {
    return `/api/blob/${accountName}/${path}`;
  }
  return `https://${accountName}.blob.core.windows.net/${path}`;
}

/**
 * Build a Service Bus URL. In development, routes through the Vite proxy
 * at /api/servicebus/<namespace>/ to avoid CORS.
 */
function serviceBusUrl(namespace: string, path: string): string {
  if (isDev) {
    return `/api/servicebus/${namespace}/${path}`;
  }
  return `https://${namespace}.servicebus.windows.net/${path}`;
}

/**
 * Generate an Azure Service Bus SAS token using the Web Crypto API.
 * This runs entirely in the browser—no server is needed.
 */
async function generateServiceBusSasToken(
  namespace: string,
  queueName: string,
  sasKeyName: string,
  sasKey: string,
  expiryMinutes: number = 60,
): Promise<string> {
  const uri = encodeURIComponent(`https://${namespace}.servicebus.windows.net/${queueName}`);
  const expiry = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
  const stringToSign = `${uri}\n${expiry}`;

  // HMAC-SHA256 using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(sasKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(stringToSign));
  const signature = encodeURIComponent(
    btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))),
  );

  return `SharedAccessSignature sr=${uri}&sig=${signature}&se=${expiry}&skn=${sasKeyName}`;
}

/**
 * Send a message to the Service Bus queue to trigger an audit.
 */
export async function triggerAudit(
  config: BlobAppConfig,
  storageAccount: string,
  blobContainer: string,
  getUsers: boolean = false,
): Promise<number> {
  const sasToken = await generateServiceBusSasToken(
    config.serviceBusNamespace,
    config.serviceBusQueueName,
    config.serviceBusSasKeyName,
    config.serviceBusSasKey,
  );

  const queueUrl = serviceBusUrl(config.serviceBusNamespace, `${config.serviceBusQueueName}/messages`);

  const message: AuditTriggerMessage = {
    eventType: 'PerformAudit',
    storageAccount,
    blobContainer,
    ...(getUsers ? { getUsers: true } : {}),
  };

  const brokerProperties = JSON.stringify({
    TimeToLive: 60,
    SessionId: `audit-${storageAccount}-${blobContainer}`,
  });

  const response = await fetch(queueUrl, {
    method: 'POST',
    headers: {
      Authorization: sasToken,
      'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
      BrokerProperties: brokerProperties,
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send audit message to Service Bus: ${response.status} - ${errorText}`);
  }

  return response.status;
}

/**
 * Ensure the SAS token starts with "?".
 */
function normalizeSasToken(token: string): string {
  const trimmed = token.trim();
  return trimmed.startsWith('?') ? trimmed : `?${trimmed}`;
}

/**
 * List blobs in the audit-records container for a given storage account / container prefix.
 */
export async function listAuditBlobs(
  config: BlobAppConfig,
  storageAccount?: string,
  containerName?: string,
): Promise<AuditBlob[]> {
  const auditContainer = `${config.managedAppName}-audit-records`;
  const sasToken = normalizeSasToken(config.storageSasToken);

  let url = `${blobUrl(config.storageAccountName, auditContainer)}?restype=container&comp=list${sasToken.replace('?', '&')}`;

  // If storageAccount and containerName provided, filter by prefix
  if (storageAccount && containerName) {
    url += `&prefix=${encodeURIComponent(`${storageAccount}/${containerName}/`)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-ms-version': '2020-08-04',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list audit blobs: ${response.status} - ${errorText}`);
  }

  const textResponse = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(textResponse, 'text/xml');

  const blobs: AuditBlob[] = Array.from(xmlDoc.getElementsByTagName('Blob')).map((blob) => ({
    name: blob.getElementsByTagName('Name')[0]?.textContent || '',
    lastModified: blob.getElementsByTagName('Last-Modified')[0]?.textContent || '',
    contentLength: blob.getElementsByTagName('Content-Length')[0]?.textContent || '0',
  }));

  // Sort by last modified descending
  return blobs.sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  );
}

/**
 * Download and parse a single audit result file from blob storage.
 */
export async function downloadAuditResult(
  config: BlobAppConfig,
  blobName: string,
): Promise<AuditResult> {
  const auditContainer = `${config.managedAppName}-audit-records`;
  const sasToken = normalizeSasToken(config.storageSasToken);

  const fileUrl = `${blobUrl(config.storageAccountName, `${auditContainer}/${blobName}`)}${sasToken}`;

  const response = await fetch(fileUrl, {
    method: 'GET',
    headers: {
      'x-ms-version': '2020-08-04',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download audit result: ${response.status} - ${errorText}`);
  }

  const rawContent = await response.text();

  // Try to parse the JSON content into audit records
  let records: AuditRecord[] = [];
  let hasTamperedBlobs = false;
  let validityPeriod: AuditValidityPeriod | undefined;

  try {
    const parsed = JSON.parse(rawContent);
    if (Array.isArray(parsed)) {
      // The actual format is an array where:
      // - Element 0 has { audit_validity_period: { ... } }
      // - Elements 1+ have { block_id_N: { blobs_in_block, acl_stored_hash, computed_hash, tampered } }
      for (const element of parsed) {
        if (typeof element !== 'object' || element === null) continue;
        const keys = Object.keys(element);
        if (keys.length === 0) continue;

        const key = keys[0];
        const value = element[key] as Record<string, unknown>;

        if (key === 'audit_validity_period' && value) {
          validityPeriod = {
            firstTrackedBlobTimestamp: String(value.first_tracked_blob_timestamp ?? ''),
            currentAuditTimestamp: String(value.current_audit_timestamp ?? ''),
          };
        } else if (key.startsWith('block_id_') && value) {
          records.push(parseBlockRecord(key, value));
        }
      }
    }
    hasTamperedBlobs = records.some((r) => r.isTampered);
  } catch {
    // If JSON parsing fails, store raw content as-is
    records = [];
  }

  return {
    fileName: blobName,
    lastModified: new Date().toISOString(),
    rawContent,
    records,
    hasTamperedBlobs,
    validityPeriod,
  };
}

/**
 * Parse a block record from the audit result JSON.
 * Format: { block_id_N: { blobs_in_block: [...], acl_stored_hash, computed_hash, tampered } }
 */
function parseBlockRecord(blockId: string, block: Record<string, unknown>): AuditRecord {
  const blobsInBlock = (block.blobs_in_block as AuditBlobEntry[] | undefined) ?? [];
  const blobName = blobsInBlock.map((b) => b.blob_name).join(', ') || blockId;

  const ledgerDigest = String(block.acl_stored_hash ?? '');
  const recalculatedDigest = String(block.computed_hash ?? '');
  const isMatch = ledgerDigest !== '' && recalculatedDigest !== '' && ledgerDigest === recalculatedDigest;

  // The "tampered" field is a string "True" / "False"
  const tamperedRaw = String(block.tampered ?? '');
  const isTampered = tamperedRaw.toLowerCase() === 'true';

  const user = block.user as { upn: string; oid: string } | undefined;

  return {
    blockId,
    blobsInBlock,
    blobName,
    recalculatedDigest,
    ledgerDigest,
    isMatch,
    isTampered,
    user,
  };
}

/**
 * Download the latest audit result for a given storage account + container.
 */
export async function downloadLatestAuditResult(
  config: BlobAppConfig,
  storageAccount: string,
  containerName: string,
): Promise<AuditResult | null> {
  const blobs = await listAuditBlobs(config, storageAccount, containerName);

  if (blobs.length === 0) {
    return null;
  }

  // blobs are already sorted by lastModified desc—grab the first
  const latestBlob = blobs[0];
  const result = await downloadAuditResult(config, latestBlob.name);
  result.lastModified = latestBlob.lastModified;
  return result;
}

/**
 * List error logs from the error-logs container.
 */
export async function listErrorLogs(config: BlobAppConfig): Promise<AuditBlob[]> {
  const errorContainer = `${config.managedAppName}-error-logs`;
  const sasToken = normalizeSasToken(config.storageSasToken);

  const url = `${blobUrl(config.storageAccountName, errorContainer)}?restype=container&comp=list${sasToken.replace('?', '&')}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-ms-version': '2020-08-04',
    },
  });

  if (!response.ok) {
    // Error logs container might not exist yet
    if (response.status === 404) {
      return [];
    }
    const errorText = await response.text();
    throw new Error(`Failed to list error logs: ${response.status} - ${errorText}`);
  }

  const textResponse = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(textResponse, 'text/xml');

  return Array.from(xmlDoc.getElementsByTagName('Blob')).map((blob) => ({
    name: blob.getElementsByTagName('Name')[0]?.textContent || '',
    lastModified: blob.getElementsByTagName('Last-Modified')[0]?.textContent || '',
    contentLength: blob.getElementsByTagName('Content-Length')[0]?.textContent || '0',
  }));
}

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
