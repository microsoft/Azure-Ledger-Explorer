/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatMessage } from './chat-types';

export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationHistoryProps {
  onConversationSelect: (conversation: SavedConversation) => void;
  onNewConversation: () => void;
  activeConversationId?: string;
  /** Whether the sidebar is collapsed (controlled mode) */
  isCollapsed?: boolean;
  /** Callback when collapse is toggled (controlled mode) */
  onToggleCollapse?: () => void;
  refreshSignal?: number; // increment to trigger reload after save
}
