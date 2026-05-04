/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { UIActionName } from '../../../types/chat-types';
import { registerAction } from './action-registry';
import { sqlActionHandler } from './sql-action';
import { verifyActionHandler } from './verify-action';
import { mstActionHandler } from './mst-action';
import { isMstEnabled } from '../../../utils/feature-flags';

/**
 * Initialize all built-in action handlers
 * Call this once at application startup
 */
export function initializeActions(): void {
  registerAction(UIActionName.RunSQL, sqlActionHandler);
  registerAction(UIActionName.VerifyLedger, verifyActionHandler);
  // MST is preview-gated. Don't register the import handler unless the user
  // has explicitly opted in; this prevents `action:importmst` blocks (from
  // pasted content or a future system-prompt change) from triggering an MST
  // download in a non-MST environment.
  if (isMstEnabled()) {
    registerAction(UIActionName.ImportMST, mstActionHandler);
  }
}

// Export everything from the registry
export {
  registerAction,
  hasAction,
  executeAction,
  executeActions,
  extractActions,
  getRegisteredActions,
  clearActions,
} from './action-registry';

export type { ActionContext, ActionResult, ActionHandler } from './action-registry';

// Export individual handlers for testing
export { sqlActionHandler } from './sql-action';
export { verifyActionHandler } from './verify-action';
export { mstActionHandler } from './mst-action';
