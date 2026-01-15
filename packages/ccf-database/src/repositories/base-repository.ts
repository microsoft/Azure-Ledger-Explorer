/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ExecFn, ExecBatchFn } from '../types/repository-types';

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
