/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { AIChat } from '../components/AIChat';
import { useDatabase } from '../hooks/use-ccf-data';
import { Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useConversationContext } from '../contexts/ConversationContext';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
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
  mainContent: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
  clearChatFunction,
}) => {
  const { data: database, isLoading, error } = useDatabase();
  const styles = useStyles();
  const {
    loadedMessages,
    saveAndReset,
    syncMessages,
  } = useConversationContext();

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
    <div className={styles.container}>
      <div className={styles.mainContent}>
        <AIChat
          database={database}
          onChatStateChange={onChatStateChange}
          onRegisterClearChat={onRegisterClearChat}
          clearChatFunction={clearChatFunction}
          onSaveConversation={saveAndReset}
          onMessagesChange={syncMessages}
          loadedMessages={loadedMessages}
        />
      </div>
    </div>
  );
};
