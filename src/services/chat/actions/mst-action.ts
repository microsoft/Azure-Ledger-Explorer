/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ActionHandler, ActionResult } from './action-registry';

/**
 * Handler for MST file import
 */
export const mstActionHandler: ActionHandler = async (
  content,
  context
): Promise<ActionResult> => {
  if (!content || !content.trim()) {
    return { error: 'MST domain was missing' };
  }
  
  if (!context.downloadMstFiles) {
    return { error: 'MST download function not available' };
  }
  
  try {
    await context.downloadMstFiles(content.trim());
    
    // Ensure database is initialized after MST import
    if (!context.database && context.getDatabase) {
      await context.getDatabase();
    }
    
    return { result: 'MST files downloaded successfully' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to download MST files',
    };
  }
};
