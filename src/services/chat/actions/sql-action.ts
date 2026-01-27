/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ActionHandler, ActionResult } from './action-registry';

/**
 * Handler for SQL query execution
 */
export const sqlActionHandler: ActionHandler = async (
  content,
  context
): Promise<ActionResult> => {
  if (!content || !content.trim()) {
    return { error: 'SQL query is empty' };
  }
  
  if (!context.database) {
    return { error: 'Could not execute SQL query. Database not initialized.' };
  }
  
  try {
    const result = await context.database.executeQuery(content);
    return { result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'SQL execution failed',
    };
  }
};
