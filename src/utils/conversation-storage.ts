/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatMessage } from '../types/chat-types';
import type { SavedConversation } from '../types/conversation-types';

export const CONVERSATION_STORAGE_KEY = 'ccf-saved-conversations';
export const ACTIVE_CONVERSATION_ID_KEY = 'ccf-active-conversation-id';

/**
 * Derive a conversation title from its messages.
 */
const deriveTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(m => m.role === 'user');
  const titleBase = firstUserMessage?.content?.trim() || 'New Conversation';
  return titleBase.slice(0, 30) + (titleBase.length > 30 ? '...' : '');
};

/**
 * Saves a conversation to localStorage history.
 * Creates a new conversation entry with a title derived from the first user message.
 * @param messages - The array of chat messages to save
 * @returns The generated conversation ID, or undefined if messages is empty
 */
export const saveConversationToHistory = (messages: ChatMessage[]): string | undefined => {
  if (!messages.length) return;

  const firstUserMessage = messages.find(m => m.role === 'user');
  const id = 'conv-' + Date.now();

  const conversation: SavedConversation = {
    id,
    title: deriveTitle(messages),
    messages: messages,
    createdAt: firstUserMessage?.timestamp || new Date(),
    updatedAt: new Date(),
  };

  try {
    const savedConversationsJson = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    const savedConversations: SavedConversation[] = savedConversationsJson 
      ? JSON.parse(savedConversationsJson) 
      : [];
    savedConversations.unshift(conversation);
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(savedConversations));
  } catch (e) {
    console.error('Failed to save conversation', e);
  }

  return id;
};

/**
 * Create or update a conversation in history.
 * If `id` is provided and matches an existing conversation, it is updated in place
 * (and moved to the top by updatedAt). Otherwise a new conversation is created.
 * Returns the conversation id (generated if not provided).
 */
export const upsertConversationInHistory = (
  id: string | undefined,
  messages: ChatMessage[],
): string | undefined => {
  if (!messages.length) return id;

  const conversations = loadConversationsFromHistory();
  const now = new Date();

  if (id) {
    const idx = conversations.findIndex(c => c.id === id);
    if (idx >= 0) {
      const existing = conversations[idx];
      const updated: SavedConversation = {
        ...existing,
        // Only auto-derive the title if the user hasn't renamed it to something
        // different from the previously-derived value.
        title: existing.title === deriveTitle(existing.messages)
          ? deriveTitle(messages)
          : existing.title,
        messages,
        updatedAt: now,
      };
      conversations.splice(idx, 1);
      conversations.unshift(updated);
      try {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversations));
      } catch (e) {
        console.error('Failed to update conversation', e);
      }
      return id;
    }
  }

  const newId = id || 'conv-' + Date.now();
  const firstUserMessage = messages.find(m => m.role === 'user');
  conversations.unshift({
    id: newId,
    title: deriveTitle(messages),
    messages,
    createdAt: firstUserMessage?.timestamp || now,
    updatedAt: now,
  });
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to create conversation', e);
  }
  return newId;
};

/**
 * Loads all saved conversations from localStorage.
 * @returns Array of saved conversations, or empty array if none exist or on error
 */
export const loadConversationsFromHistory = (): SavedConversation[] => {
  try {
    const raw = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedConversation[];
  } catch (e) {
    console.error('Failed to load conversations', e);
    return [];
  }
};

/**
 * Look up a single saved conversation by id.
 */
export const getConversationById = (id: string): SavedConversation | undefined => {
  return loadConversationsFromHistory().find(c => c.id === id);
};

/**
 * Persist the id of the conversation currently being viewed/edited so that
 * navigating away and back restores the active chat.
 */
export const getActiveConversationId = (): string | undefined => {
  try {
    return localStorage.getItem(ACTIVE_CONVERSATION_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
};

export const setActiveConversationId = (id: string | undefined): void => {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CONVERSATION_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CONVERSATION_ID_KEY);
    }
  } catch (e) {
    console.error('Failed to persist active conversation id', e);
  }
};

/**
 * Deletes a conversation from localStorage by ID.
 * @param id - The conversation ID to delete
 * @returns The remaining conversations after deletion
 */
export const deleteConversationFromHistory = (id: string): SavedConversation[] => {
  const conversations = loadConversationsFromHistory();
  const remaining = conversations.filter(c => c.id !== id);
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.error('Failed to delete conversation', e);
  }
  if (getActiveConversationId() === id) {
    setActiveConversationId(undefined);
  }
  return remaining;
};

/**
 * Rename a conversation. Trims and truncates to 120 chars. Empty values are
 * rejected (no change). Does not bump updatedAt so the list order is stable.
 */
export const renameConversationInHistory = (
  id: string,
  newTitle: string,
): SavedConversation[] => {
  const conversations = loadConversationsFromHistory();
  const trimmed = newTitle.trim().slice(0, 120);
  if (!trimmed) return conversations;
  const next = conversations.map(c =>
    c.id === id ? { ...c, title: trimmed } : c
  );
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to rename conversation', e);
  }
  return next;
};

/**
 * Toggle the `pinned` flag for a conversation. Does not change updatedAt.
 */
export const togglePinConversationInHistory = (id: string): SavedConversation[] => {
  const conversations = loadConversationsFromHistory();
  const next = conversations.map(c =>
    c.id === id ? { ...c, pinned: !c.pinned } : c
  );
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to pin conversation', e);
  }
  return next;
};
