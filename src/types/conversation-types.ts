import type { ChatMessage } from '../components/AIChat';

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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  refreshSignal?: number; // increment to trigger reload after save
}
