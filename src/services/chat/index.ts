/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

export { ChatService, createChatService } from './chat-service';
export type { 
  ChatServiceConfig, 
  SendMessageOptions, 
  StreamCallbacks, 
  ChatResponse 
} from './chat-service';

export { parseSSEChunk, createSSEReader } from './sse-parser';
export type { SSEParseResult, SSEEventType } from './sse-parser';

// Actions
export {
  initializeActions,
  registerAction,
  hasAction,
  executeAction,
  executeActions,
  extractActions,
  getRegisteredActions,
  clearActions,
} from './actions';
export type { ActionContext, ActionResult, ActionHandler } from './actions';
