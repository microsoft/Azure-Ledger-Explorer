/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { SearchRegular, ComposeRegular, DismissRegular } from '@fluentui/react-icons';
import type { SavedConversation } from '../types/conversation-types';
import type { ChatMessage } from '../types/chat-types';

interface Props {
  open: boolean;
  conversations: SavedConversation[];
  onClose: () => void;
  onSelect: (conversation: SavedConversation) => void;
  onNewChat: () => void;
}

interface SearchHit {
  conversation: SavedConversation;
  /** Short excerpt showing the first content match. Empty when match was title-only. */
  snippet: string;
}

type DateBucket = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Previous 30 Days' | 'Older';

const useStyles = makeStyles({
  surface: {
    maxWidth: '640px',
    width: '92vw',
    padding: 0,
    borderRadius: '12px',
    overflow: 'hidden',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70vh',
    minHeight: '320px',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  searchIcon: {
    fontSize: '18px',
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1,
    fontFamily: 'inherit',
    padding: 0,
    minWidth: 0,
    '::placeholder': {
      color: tokens.colorNeutralForeground3,
    },
  },
  kbdHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1px 6px',
    minWidth: '20px',
    height: '18px',
    fontSize: '11px',
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
  },
  clearBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    cursor: 'pointer',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground4,
    },
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 8px 10px',
  },
  sectionHeader: {
    padding: '10px 12px 4px',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 12px',
    margin: '1px 0',
    borderRadius: '8px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
  },
  rowActive: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  newChatRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    margin: '1px 0',
    borderRadius: '8px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightMedium,
    fontSize: tokens.fontSizeBase300,
  },
  rowTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowSnippet: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mark: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorNeutralForeground1,
    borderRadius: '2px',
    padding: '0 2px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '56px 16px',
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
});

const findIdx = (haystack: string, needle: string): number =>
  haystack.toLowerCase().indexOf(needle.toLowerCase());

const excerptFromMessages = (messages: ChatMessage[], q: string): string => {
  for (const m of messages) {
    if (!m.content) continue;
    const idx = findIdx(m.content, q);
    if (idx >= 0) {
      const start = Math.max(0, idx - 30);
      const end = Math.min(m.content.length, idx + q.length + 60);
      const prefix = start > 0 ? '…' : '';
      const suffix = end < m.content.length ? '…' : '';
      return prefix + m.content.slice(start, end).replace(/\s+/g, ' ').trim() + suffix;
    }
  }
  return '';
};

const bucketFor = (date: Date, now: Date): DateBucket => {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(now);
  const t = startOfDay(date instanceof Date ? date : new Date(date));
  const dayMs = 86_400_000;
  const diffDays = Math.round((todayStart - t) / dayMs);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 Days';
  if (diffDays <= 30) return 'Previous 30 Days';
  return 'Older';
};

const BUCKET_ORDER: DateBucket[] = [
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'Previous 30 Days',
  'Older',
];

const Highlighted: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className,
}) => {
  const styles = useStyles();
  if (!query) return <span className={className}>{text}</span>;
  const idx = findIdx(text, query);
  if (idx < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, idx)}
      <mark className={styles.mark}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
};

export const ConversationSearchDialog: React.FC<Props> = ({
  open,
  conversations,
  onClose,
  onSelect,
  onNewChat,
}) => {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const trimmedQuery = query.trim();

  const hits: SearchHit[] = useMemo(() => {
    if (!trimmedQuery) {
      return conversations.map(c => ({ conversation: c, snippet: '' }));
    }
    const matches: SearchHit[] = [];
    for (const c of conversations) {
      const titleMatch = findIdx(c.title, trimmedQuery) >= 0;
      const snippet = titleMatch ? '' : excerptFromMessages(c.messages, trimmedQuery);
      if (titleMatch || snippet) {
        matches.push({ conversation: c, snippet });
      }
    }
    return matches;
  }, [trimmedQuery, conversations]);

  /**
   * Flattened selectable items, used for keyboard navigation.
   * Index 0 is always "New chat"; remaining entries are the hits in display order.
   */
  const selectable = useMemo(() => {
    type Item =
      | { kind: 'new' }
      | { kind: 'hit'; hit: SearchHit };
    const items: Item[] = [{ kind: 'new' }];
    for (const h of hits) items.push({ kind: 'hit', hit: h });
    return items;
  }, [hits]);

  useEffect(() => {
    if (activeIndex >= selectable.length) {
      setActiveIndex(Math.max(0, selectable.length - 1));
    }
  }, [selectable.length, activeIndex]);

  // Group hits by date bucket (only when query is empty).
  const groupedHits = useMemo(() => {
    if (trimmedQuery) return null;
    const now = new Date();
    const groups = new Map<DateBucket, SearchHit[]>();
    for (const hit of hits) {
      const updated = hit.conversation.updatedAt instanceof Date
        ? hit.conversation.updatedAt
        : new Date(hit.conversation.updatedAt);
      const bucket = bucketFor(updated, now);
      const list = groups.get(bucket) ?? [];
      list.push(hit);
      groups.set(bucket, list);
    }
    return BUCKET_ORDER.filter(b => groups.has(b)).map(b => ({ bucket: b, items: groups.get(b)! }));
  }, [trimmedQuery, hits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(selectable.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = selectable[activeIndex];
      if (!item) return;
      if (item.kind === 'new') {
        onNewChat();
      } else {
        onSelect(item.hit.conversation);
      }
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Track the absolute index of each hit so hover highlight syncs with keyboard nav.
  let runningIndex = 1; // 0 is the "New chat" row.

  const renderHitRow = (hit: SearchHit) => {
    const idx = runningIndex++;
    const isActive = idx === activeIndex;
    return (
      <div
        key={hit.conversation.id}
        role="option"
        aria-selected={isActive}
        className={mergeClasses(styles.row, isActive && styles.rowActive)}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => {
          onSelect(hit.conversation);
          onClose();
        }}
      >
        <Highlighted
          text={hit.conversation.title}
          query={trimmedQuery}
          className={styles.rowTitle}
        />
        {hit.snippet && (
          <Highlighted
            text={hit.snippet}
            query={trimmedQuery}
            className={styles.rowSnippet}
          />
        )}
      </div>
    );
  };

  const isNewChatActive = activeIndex === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className={styles.surface}>
        <div className={styles.container}>
          <div className={styles.searchRow}>
            <SearchRegular className={styles.searchIcon} aria-hidden />
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search chats"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              aria-label="Search chats"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className={styles.clearBtn}
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <DismissRegular fontSize={12} />
              </button>
            )}
            <span className={styles.kbdHint} aria-hidden>
              <span className={styles.kbd}>Esc</span>
            </span>
          </div>

          <div className={styles.results} role="listbox" aria-label="Chats">
            {/* Always-present "New chat" row, as ChatGPT does */}
            <div
              key="__new"
              role="option"
              aria-selected={isNewChatActive}
              className={mergeClasses(styles.newChatRow, isNewChatActive && styles.rowActive)}
              onMouseEnter={() => setActiveIndex(0)}
              onClick={() => {
                onNewChat();
                onClose();
              }}
            >
              <ComposeRegular />
              <span>New chat</span>
            </div>

            {hits.length === 0 ? (
              conversations.length === 0 ? (
                <div className={styles.empty}>
                  <Text>Your chats will appear here.</Text>
                </div>
              ) : (
                <div className={styles.empty}>
                  <Text>No chats match &ldquo;{trimmedQuery}&rdquo;</Text>
                </div>
              )
            ) : trimmedQuery ? (
              // Flat list when searching
              hits.map(renderHitRow)
            ) : (
              // Grouped by date when browsing
              groupedHits?.map(group => (
                <div key={group.bucket}>
                  <Text className={styles.sectionHeader} as="p">{group.bucket}</Text>
                  {group.items.map(renderHitRow)}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogSurface>
    </Dialog>
  );
};
