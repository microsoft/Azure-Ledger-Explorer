/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Configuration for CCFDatabase initialization
 */
export interface DatabaseConfig {
  filename: string;
  useOpfs?: boolean;
}

/**
 * Database Transaction type (app-specific, different from the parsed Transaction type)
 * Represents a transaction record as returned from the database with file context.
 */
export interface DatabaseTransaction {
  id: number;
  fileId: number;
  fileName: string;
  sequenceNumber: number;
  version: number;
  flags: number;
  size: number;
  entryType: number;
  txVersion: number;
  txView: number;
  maxConflictVersion: number;
  txId: string;
  writeCount: number;
  deleteCount: number;
  fileSize: number;
}
