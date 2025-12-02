/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatMessage } from '../components/AIChat';
import type { SavedConversation } from '../types/conversation-types';

export const CONVERSATION_STORAGE_KEY = 'ccf-saved-conversations';

/**
 * Saves a conversation to localStorage history.
 * Creates a new conversation entry with a title derived from the first user message.
 * @param messages - The array of chat messages to save
 * @returns The generated conversation ID, or undefined if messages is empty
 */
export const saveConversationToHistory = (messages: ChatMessage[]): string | undefined => {
  if (!messages.length) return;

  const firstUserMessage = messages.find(m => m.role === 'user');
  const titleBase = firstUserMessage?.content?.trim() || 'New Conversation';
  const title = titleBase.slice(0, 30) + (titleBase.length > 30 ? '...' : '');
  const id = 'conv-' + Date.now();

  const conversation: SavedConversation = {
    id,
    title,
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
  return remaining;
};
