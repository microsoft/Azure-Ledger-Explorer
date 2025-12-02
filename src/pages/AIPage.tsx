/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState } from 'react';
import { AIChat } from '../components/AIChat';
import type { ChatMessage } from '../components/AIChat';
import { ConversationHistory } from '../components/ConversationHistory';
import { saveConversationToHistory } from '../utils/conversation-storage';
import type { SavedConversation } from '../types/conversation-types';
import { useDatabase } from '../hooks/use-ccf-data';
import { Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0, // Critical for flex child to shrink
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    gap: '16px',
  },
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    gap: '16px',
    color: tokens.colorPaletteRedForeground1,
  },
});

interface AIPageProps {
  onChatStateChange?: (hasActiveChat: boolean) => void;
  onRegisterClearChat?: (clearFn: (() => void) | null) => void;
  clearChatFunction?: (() => void) | null;
}

export const AIPage: React.FC<AIPageProps> = ({
  onChatStateChange,
  onRegisterClearChat,
  clearChatFunction
}) => {
  const { data: database, isLoading, error } = useDatabase();
  const styles = useStyles();

  // Conversation state
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[] | undefined>(undefined);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const handleSaveConversation = (messages: ChatMessage[]) => {
    if (!messages.length) return;
    // Save to history and refresh sidebar
    saveConversationToHistory(messages);
    setRefreshSignal(r => r + 1);
    // Reset active conversation (new thread)
    setActiveConversationId(undefined);
  };

  const handleConversationSelect = (conv: SavedConversation) => {
    setActiveConversationId(conv.id);
    setLoadedMessages(conv.messages || []);
  };

  const handleNewConversation = () => {
    setActiveConversationId(undefined);
    setLoadedMessages(undefined);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="large" />
          <Text>Loading...</Text>
        </div>
      </div>
    );
  }

  if (error || !database) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <Text>Error</Text>
          <Text size={200}>
            Error: {error?.message || 'Unknown error'}. Please try refreshing the page and/or clearing cookies and local storage.
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <ConversationHistory
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
        activeConversationId={activeConversationId}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(c => !c)}
        refreshSignal={refreshSignal}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AIChat
          database={database}
          onChatStateChange={onChatStateChange}
          onRegisterClearChat={onRegisterClearChat}
          clearChatFunction={clearChatFunction}
          onSaveConversation={handleSaveConversation}
          loadedMessages={loadedMessages}
          sidebarWidth={isCollapsed ? 48 : 300}
        />
      </div>
    </div>
  );
};
