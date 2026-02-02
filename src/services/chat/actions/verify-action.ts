/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ActionHandler, ActionResult } from './action-registry';

/**
 * Handler for ledger verification
 */
export const verifyActionHandler: ActionHandler = async (
  _content,
  context
): Promise<ActionResult> => {
  if (!context.verification) {
    return { error: 'Verification service not available' };
  }
  
  try {
    const result = context.verification.getSavedProgress();
    return { result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Ledger verification failed',
    };
  }
};
