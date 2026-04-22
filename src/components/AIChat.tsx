/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * AIChat Component - Main chat interface.
 *
 * This component orchestrates the chat experience using sub-components:
 * - ChatMessageList: Renders the scrollable message history
 * - ChatInput: Handles user input and send/stop actions
 * - ChatStarterTemplates: Shows initial prompt suggestions
 *
 * State management is handled by the useChat hook.
 * The active provider (Sage or CCF Ledger Chat) is determined by the
 * VITE_ENABLE_SAGE build flag.
 */

import React, { useState, useEffect } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';

import { useConfig } from '../pages/ConfigPage';
import { useVerification } from '../hooks/use-verification';
import { getDatabase } from '../hooks/use-ccf-data';
import { useDownloadMstFiles } from './MstLedgerImportView';
import { useChat } from '../hooks/use-chat';
import { getDatabaseSchema } from '@microsoft/ccf-database';

// Chat sub-components
import { ChatMessageList } from './chat/ChatMessageList';
import { ChatInput } from './chat/ChatInput';
import { ChatStarterTemplates } from './chat/ChatStarterTemplates';

// Types
import type { AIChatProps } from '../types/chat-types';
import type { ChatProvider } from '../types/chat-types';
import type { DatabaseSchema } from '@microsoft/ccf-database';
// Re-export ChatMessage for backward compatibility
export type { ChatMessage } from '../types/chat-types';

/**
 * Minimal styles for the main container layout.
 * Sub-component styles are in chat/chat.styles.ts
 */
const useStyles = makeStyles({
  container: {
    display: 'flex',
    minHeight: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerWithMessages: {
    display: 'flex',
    minHeight: '100%',
    height: '100vh',
    overflowY: 'auto',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: '48px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    marginBottom: '32px',
    textAlign: 'center',
  },
});

/**
 * AIChat - Main chat interface component
 *
 * Renders the chat experience with:
 * - Welcome screen with starter templates when no messages
 * - Message history with streaming responses
 * - Input area with send/stop functionality
 * - Action execution and result display
 */
export const AIChat: React.FC<AIChatProps> = ({
  database,
  onChatStateChange,
  onRegisterClearChat,
  onSaveConversation,
  onMessagesChange,
  loadedMessages,
  sidebarWidth = 0,
}) => {
  const styles = useStyles();
  const { config } = useConfig();

  // Get dependencies for action context
  const verification = useVerification();
  const { downloadFiles: downloadMstFiles } = useDownloadMstFiles();

  // Track transaction count for system prompt context
  const [allTransactionsCount, setAllTransactionsCount] = useState(0);

  // Database schema for OpenAI system prompt
  const [dbSchema, setDbSchema] = useState<DatabaseSchema | undefined>(undefined);

  useEffect(() => {
    if (database) {
      database.transactions
        .getAllCount()
        .then((count: number) => {
          setAllTransactionsCount(count);
        })
        .catch((error: Error) => {
          console.error('Failed to get transaction count:', error);
          setAllTransactionsCount(0);
        });

      // Fetch schema only when using OpenAI provider (CCF Ledger Chat)
      if (import.meta.env.VITE_ENABLE_SAGE !== 'true') {
        getDatabaseSchema((sql: string) => database.executeQuery(sql))
          .then((schema) => {
            setDbSchema(schema);
          })
          .catch((error: Error) => {
            console.error('Failed to get database schema:', error);
          });
      }
    }
  }, [database]);

  // Determine the active chat provider from build flag
  const activeProvider: ChatProvider =
    import.meta.env.VITE_ENABLE_SAGE === 'true' ? 'sage' : 'openai';

  // The chat is enabled if the active provider is configured
  const isChatEnabled =
    activeProvider === 'openai' ? !!config.openaiApiKey : !!config.baseUrl;

  // Use the chat hook for all chat state management
  const {
    messages,
    isLoading,
    error,
    hasMessages,
    sendMessage,
    stopResponse,
    clearChat,
    setMessages,
    getAnnotationUrl,
  } = useChat({
    baseUrl: config.baseUrl,
    openaiApiKey: config.openaiApiKey,
    openaiModel: config.openaiModel,
    databaseSchema: dbSchema,
    provider: activeProvider,
    initialMessages: loadedMessages,
    actionContext: {
      database,
      getDatabase,
      verification,
      downloadMstFiles,
    },
  });

  // Local UI state for input
  const [currentMessage, setCurrentMessage] = useState('');

  // Register clearChat function with parent component
  useEffect(() => {
    onRegisterClearChat?.(clearChat);
    return () => onRegisterClearChat?.(null);
  }, [onRegisterClearChat, clearChat]);

  // Ensure page starts at the top on initial load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Notify parent of chat state changes
  useEffect(() => {
    onChatStateChange?.(hasMessages);
  }, [hasMessages, onChatStateChange]);

  // Sync externally loaded conversation messages
  useEffect(() => {
    if (loadedMessages) {
      setMessages(loadedMessages);
    }
  }, [loadedMessages, setMessages]);

  // Notify parent of every message mutation so it can persist to storage.
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Event handlers
  const handleSendMessage = async (optionalMessage?: string) => {
    const messageToSend = optionalMessage || currentMessage.trim();
    if (!messageToSend) return;
    setCurrentMessage('');
    await sendMessage(messageToSend);
  };

  const handleNewConversation = () => {
    console.log('Starting new conversation');
    onSaveConversation?.(messages);
    clearChat();
    setCurrentMessage('');
  };

  const handleStartFromTemplate = (text: string) => {
    clearChat();
    handleSendMessage(text);
  };

  // Build starter templates based on available data and active provider
  const sageTemplates = [
    { show: true, group: 'Azure Attestation', text: "How does MAA's SGX attestation work?" },
    { show: true, group: 'Azure Attestation', text: 'How can I trust MAA?' },
    { show: true, group: 'Transparency', text: 'Can you verify that MAA is transparent right now?' },
    { show: true, group: 'Transparency', text: 'Can you show me the history of MAA builds?' },
    {
      show: allTransactionsCount > 0,
      group: 'Ledger',
      text: 'How many transactions are in the database?',
    },
    { show: allTransactionsCount > 0, group: 'Ledger', text: 'Show me recent transactions' },
    { show: allTransactionsCount > 0, group: 'Ledger', text: 'Find transactions with specific keys' },
  ];

  const openaiTemplates = [
    {
      show: allTransactionsCount > 0,
      group: 'Overview',
      text: 'How many transactions are in the database?',
    },
    { show: allTransactionsCount > 0, group: 'Overview', text: 'Show me a summary of all loaded ledger files' },
    { show: allTransactionsCount > 0, group: 'Explore', text: 'What CCF tables (map names) exist in the data?' },
    { show: allTransactionsCount > 0, group: 'Explore', text: 'Show me the most recent transactions' },
    {
      show: allTransactionsCount > 0,
      group: 'Query',
      text: 'Find all key-value writes for the governance tables',
    },
    { show: allTransactionsCount > 0, group: 'Query', text: 'Which map has the most writes?' },
  ];

  const starterTemplates = activeProvider === 'openai' ? openaiTemplates : sageTemplates;
  const chatTitle = activeProvider === 'openai' ? 'CCF Ledger Chat' : 'Sage';

  return (
    <>
      <div
        className={
          'chat-messages-container ' +
          (hasMessages ? styles.containerWithMessages : styles.container)
        }
      >
        {/* Title - visible when no messages */}
        {!hasMessages && <div className={styles.chatTitle}>{chatTitle}</div>}

        {/* Input Area */}
        <ChatInput
          value={currentMessage}
          onChange={setCurrentMessage}
          onSend={() => handleSendMessage()}
          onStop={stopResponse}
          onNewConversation={handleNewConversation}
          isLoading={isLoading}
          error={error}
          hasMessages={hasMessages}
          disabled={!isChatEnabled}
          messages={messages}
          sidebarWidth={sidebarWidth}
        />

        {/* Starter templates - visible when no messages */}
        {!hasMessages && (
          <ChatStarterTemplates
            templates={starterTemplates}
            onSelect={handleStartFromTemplate}
          />
        )}

        {/* Chat message list - visible when there are messages */}
        {hasMessages && (
          <ChatMessageList
            messages={messages}
            isLoading={isLoading}
            getAnnotationUrl={getAnnotationUrl}
          />
        )}
      </div>
    </>
  );
};
