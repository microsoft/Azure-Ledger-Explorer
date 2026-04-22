/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */
/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ChatMessage } from '../types/chat-types';
import type { SavedConversation } from '../types/conversation-types';
import {
  getActiveConversationId,
  setActiveConversationId as persistActiveConversationId,
  getConversationById,
  upsertConversationInHistory,
  saveConversationToHistory,
} from '../utils/conversation-storage';

interface ConversationContextValue {
  /** ID of the currently-open conversation (undefined = brand new unsaved thread). */
  activeConversationId: string | undefined;
  /** Messages to hydrate the chat view with. Undefined = don't hydrate / start empty. */
  loadedMessages: ChatMessage[] | undefined;
  /** Bumped whenever the stored conversation list changes; used to refresh sidebar listings. */
  refreshSignal: number;
  /** Open a saved conversation in the chat view. */
  selectConversation: (conv: SavedConversation) => void;
  /** Start a new conversation (clears the chat view). */
  startNewConversation: () => void;
  /**
   * Called when the user explicitly ends / saves a conversation. Persists and resets state.
   */
  saveAndReset: (messages: ChatMessage[]) => void;
  /**
   * Called on every message change while chatting. Auto-upserts into history.
   */
  syncMessages: (messages: ChatMessage[]) => void;
  /** Notify the provider that the conversation list changed externally (e.g. delete). */
  bumpRefresh: () => void;
}

const ConversationContext = createContext<ConversationContextValue | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    () => getActiveConversationId(),
  );
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[] | undefined>(() => {
    const id = getActiveConversationId();
    return id ? getConversationById(id)?.messages : undefined;
  });
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    persistActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  const selectConversation = useCallback((conv: SavedConversation) => {
    setActiveConversationId(conv.id);
    setLoadedMessages(conv.messages || []);
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(undefined);
    setLoadedMessages([]);
  }, []);

  const saveAndReset = useCallback((messages: ChatMessage[]) => {
    if (!messages.length) {
      setActiveConversationId(undefined);
      return;
    }
    setActiveConversationId(currentId => {
      const id = upsertConversationInHistory(currentId, messages);
      if (!id) saveConversationToHistory(messages);
      return undefined;
    });
    setRefreshSignal(r => r + 1);
    setLoadedMessages(undefined);
  }, []);

  const syncMessages = useCallback((messages: ChatMessage[]) => {
    if (!messages.length) return;
    setActiveConversationId(currentId => {
      const id = upsertConversationInHistory(currentId, messages);
      return id && id !== currentId ? id : currentId;
    });
    setRefreshSignal(r => r + 1);
  }, []);

  const bumpRefresh = useCallback(() => {
    setRefreshSignal(r => r + 1);
  }, []);

  const value = useMemo<ConversationContextValue>(() => ({
    activeConversationId,
    loadedMessages,
    refreshSignal,
    selectConversation,
    startNewConversation,
    saveAndReset,
    syncMessages,
    bumpRefresh,
  }), [
    activeConversationId,
    loadedMessages,
    refreshSignal,
    selectConversation,
    startNewConversation,
    saveAndReset,
    syncMessages,
    bumpRefresh,
  ]);

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversationContext = (): ConversationContextValue => {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error('useConversationContext must be used within a ConversationProvider');
  }
  return ctx;
};
