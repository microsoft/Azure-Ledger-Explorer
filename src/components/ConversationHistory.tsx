import React, { useEffect, useState } from 'react';
import { makeStyles, tokens, Button, Text, Spinner, MessageBar } from '@fluentui/react-components';
import { DeleteRegular, ChevronLeftRegular, ChevronRightRegular, ChatRegular } from '@fluentui/react-icons';
import type { ConversationHistoryProps, SavedConversation } from '../types/conversation-types';
import type { ChatMessage } from './AIChat';

const STORAGE_KEY = 'ccf-saved-conversations';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    transition: 'width 0.2s ease',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  expanded: {
    width: '300px',
  },
  collapsed: {
    width: '48px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 12px',
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  item: {
    position: 'relative',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 12px',
    gap: '4px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  active: {
    backgroundColor: tokens.colorBrandBackground2,
    '&:hover': { backgroundColor: tokens.colorBrandBackground2 },
  },
  itemTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightMedium,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  date: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  deleteBtn: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0,
    transition: 'opacity 0.15s',
    minWidth: '24px',
    width: '24px',
    height: '24px',
    '&:hover': {
      color: tokens.colorPaletteRedForeground2,
      backgroundColor: tokens.colorPaletteRedBackground2,
    },
  },
  // Hover handled via React state now
  collapsedContent: {
  display: 'none', // no longer show extra icons when collapsed
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 12px',
    gap: '8px',
    color: tokens.colorNeutralForeground3,
  },
});

const formatDisplayDate = (before: Date) => {
  if (!(before instanceof Date)) before = new Date(before);
  const now = new Date();
  const diffHours = (now.getTime() - before.getTime()) / 36e5;
  if (diffHours < 24) return before.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffHours < 24 * 7) return before.toLocaleDateString([], { weekday: 'short' });
  return before.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  onConversationSelect,
  onNewConversation,
  activeConversationId,
  isCollapsed,
  onToggleCollapse,
  refreshSignal,
}) => {
  const styles = useStyles();
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const load = () => {
    try {
      setLoading(true);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setConversations([]); return; }
      const parsed = JSON.parse(raw) as SavedConversation[];
      setConversations(parsed);
    } catch (e) {
      console.error(e);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [refreshSignal]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const remainingConversations = conversations.filter(c => c.id !== id);
      setConversations(remainingConversations);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingConversations));
      if (activeConversationId === id) onNewConversation();
    } catch(err) {
      console.error(err);
      setError('Failed to delete');
    }
  };

  if (isCollapsed) {
    return (
      <div className={`${styles.root} ${styles.collapsed}`}>
        <div className={styles.header}>
          <Button appearance="subtle" icon={<ChevronRightRegular />} onClick={onToggleCollapse} title="Expand" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${styles.expanded}`}>
      <div className={styles.header}>
        <Text className={styles.title}>Conversations</Text>
        <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={onToggleCollapse} title="Collapse" />
      </div>
      {error && <MessageBar intent="error" style={{ margin: '8px' }}>{error}</MessageBar>}
      <div className={styles.list}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner size="small" /></div>
        ) : conversations.length === 0 ? (
          <div className={styles.empty}>
            <ChatRegular style={{ fontSize: 32 }} />
            <Text>Older conversations will appear here.</Text>
          </div>
        ) : (
          conversations.map(c => (
            <div
              key={c.id}
              className={`${styles.item} ${c.id === activeConversationId ? styles.active : ''}`}
              onClick={() => onConversationSelect(c)}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(id => (id === c.id ? null : id))}
            >
              <Text className={styles.itemTitle}>{c.title}</Text>
              <Text className={styles.date}>Started {formatDisplayDate(c.createdAt)} (last update {formatDisplayDate(c.updatedAt)})</Text>
              <Button
                appearance="subtle"
                icon={<DeleteRegular />}
                className={styles.deleteBtn + ' delete-btn'}
                title="Delete"
                style={{ opacity: hoveredId === c.id ? 1 : 0 }}
                onClick={(e) => handleDelete(c.id, e)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Helper for saving conversations
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
