/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { LedgerFileInfo } from '@ccf/ledger-parser';

/**
 * Extended file info with additional metadata for UI display and selection.
 * Used by ChunkSelector and import views.
 */
export interface ChunkFileInfo extends LedgerFileInfo {
  /** Unique identifier for this file (e.g., hash, path, or generated id) */
  id: string;
  /** File size in bytes (optional) */
  size?: number;
  /** Last modified date (optional) */
  lastModified?: Date;
  /** Whether this file is already loaded in the database */
  isExisting?: boolean;
}
