import type { SavedConversation } from '../types/conversation-types';
import type { ChatMessage } from '../components/AIChat';

const STORAGE_KEY = 'ccf-saved-conversations';

export const loadConversationHistory = (): SavedConversation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as SavedConversation[];
  } catch (e) {
    console.error('Failed to load conversations', e);
    return [];
  }
};

export const deleteConversationFromHistory = (id: string): SavedConversation[] => {
  try {
    const existing = loadConversationHistory();
    const remaining = existing.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    return remaining;
  } catch (e) {
    console.error('Failed to delete conversation', e);
    throw e;
  }
};

export const saveConversationToHistory = (messages: ChatMessage[]) => {
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
    const savedConversationsJson = localStorage.getItem(STORAGE_KEY);
    const savedConversations: SavedConversation[] = savedConversationsJson ? JSON.parse(savedConversationsJson) : [];
    savedConversations.unshift(conversation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConversations));
  } catch (e) {
    console.error('Failed to save conversation', e);
  }
  return id;
};
