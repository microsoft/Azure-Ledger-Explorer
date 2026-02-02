/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { CCFDatabase as CCFDatabaseType } from '@ccf/database';

/**
 * Chat message states during the conversation lifecycle
 */
export type ChatMessageState = 'initial' | 'streaming' | 'finished';

/**
 * Chat message roles
 */
export type ChatRole = 'user' | 'assistant';

/**
 * Known UI action names that can be executed from chat responses
 */
export const UIActionName = {
  ImportMST: 'importmst',
  RunSQL: 'runsql',
  VerifyLedger: 'verifyledger',
} as const;

export type UIActionNameType = typeof UIActionName[keyof typeof UIActionName] | string;

/**
 * Represents an action extracted from an AI response that can be executed
 */
export interface UIAction {
  actionName: UIActionNameType;
  actionContent?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actionResult?: any;
  actionError?: string;
  cleanedResult?: string;
}

/**
 * Annotation/reference attached to a chat message
 */
export interface ChatAnnotation {
  refs?: number[]; // references in text, multiple per file
  file_id?: string;
  filename?: string;
}

/**
 * A single chat message in the conversation
 */
export interface ChatMessage {
  id: string;
  state: ChatMessageState;
  role: ChatRole;
  responseId?: string;
  content: string;
  annotations?: Record<string, ChatAnnotation>;
  timestamp: Date;
  error?: string;
  actions?: UIAction[];
}

/**
 * Props for the AIChat component
 */
export interface AIChatProps {
  database?: CCFDatabaseType;
  onChatStateChange?: (hasActiveChat: boolean) => void;
  onRegisterClearChat?: (clearFn: (() => void) | null) => void;
  clearChatFunction?: (() => void) | null;
  onSaveConversation?: (messages: ChatMessage[]) => void;
  loadedMessages?: ChatMessage[];
  sidebarWidth?: number;
}
