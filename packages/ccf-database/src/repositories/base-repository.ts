/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Type for the exec function used by repositories
 */
export type ExecFn = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Type for batch execution
 */
export type ExecBatchFn = (statements: Array<{ sql: string; bind?: unknown[] }>) => Promise<void>;

/**
 * Base repository class with shared utilities.
 * All domain-specific repositories extend this class.
 */
export abstract class BaseRepository {
  protected exec: ExecFn;
  protected execBatch: ExecBatchFn;

  constructor(exec: ExecFn, execBatch: ExecBatchFn) {
    this.exec = exec;
    this.execBatch = execBatch;
  }

  /**
   * Helper to convert LIKE pattern with escaping
   */
  protected likePattern(query: string): string {
    return `%${query.trim()}%`;
  }
}
