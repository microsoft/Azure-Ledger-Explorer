/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Configuration for connecting to the Blob Managed App resources.
 * All credentials are stored only in browser localStorage and never sent to any server
 * except the target Azure endpoints.
 */
export interface BlobAppConfig {
  /** Service Bus namespace name (e.g., "my-namespace") */
  serviceBusNamespace: string;
  /** Service Bus queue name */
  serviceBusQueueName: string;
  /** SAS policy name for Service Bus (e.g., "RootManageSharedAccessKey") */
  serviceBusSasKeyName: string;
  /** SAS policy key for Service Bus */
  serviceBusSasKey: string;
  /** Storage account name for reading audit results */
  storageAccountName: string;
  /** SAS token for the storage account (starts with "?sv=..." or "sv=...") */
  storageSasToken: string;
  /** Managed application name (used to locate audit-records container) */
  managedAppName: string;
}

/**
 * A blob within a block from the audit result.
 */
export interface AuditBlobEntry {
  blob_name: string;
  insert_time: string;
}

/**
 * A single audit block record from the audit-records container.
 * Each block contains one or more blobs and their digest comparison.
 */
export interface AuditRecord {
  /** Block identifier (e.g., "block_id_0") */
  blockId: string;
  /** Blobs contained in this block */
  blobsInBlock: AuditBlobEntry[];
  /** Comma-joined blob names for display */
  blobName: string;
  /** Hash/digest recalculated during the audit */
  recalculatedDigest: string;
  /** Hash/digest originally stored in the confidential ledger */
  ledgerDigest: string;
  /** Whether the digests match */
  isMatch: boolean;
  /** Whether the blob has been tampered with */
  isTampered: boolean;
  /** Optional user info if user tracking was enabled */
  user?: {
    upn: string;
    oid: string;
  };
}

/**
 * Audit validity period metadata from the first element of the result array.
 */
export interface AuditValidityPeriod {
  firstTrackedBlobTimestamp: string;
  currentAuditTimestamp: string;
}

/**
 * Parsed audit result file from the audit-records container.
 */
export interface AuditResult {
  /** Name of the audit result file (blob name) */
  fileName: string;
  /** When the audit result was last modified */
  lastModified: string;
  /** Raw JSON content of the audit file */
  rawContent: string;
  /** Parsed block records from the audit file */
  records: AuditRecord[];
  /** Overall status: true if any blob was tampered with */
  hasTamperedBlobs: boolean;
  /** Audit validity period metadata */
  validityPeriod?: AuditValidityPeriod;
}

/**
 * A blob entry listed from the audit-records container.
 */
export interface AuditBlob {
  name: string;
  lastModified: string;
  contentLength: string;
}
