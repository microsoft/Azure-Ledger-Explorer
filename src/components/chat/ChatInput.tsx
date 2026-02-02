/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useRef, useEffect } from 'react';
import { Button, MessageBar } from '@fluentui/react-components';
import { Send24Regular, Edit24Regular, Stop24Regular } from '@fluentui/react-icons';
import type { ChatMessage } from '../../types/chat-types';
import { useChatStyles } from './chat.styles';

interface ChatInputProps {
  /** Current input value */
  value: string;
  /** Callback when input changes */
  onChange: (value: string) => void;
  /** Callback to send the message */
  onSend: () => void;
  /** Callback to stop the current response */
  onStop: () => void;
  /** Callback to save conversation and start new */
  onNewConversation?: () => void;
  /** Whether currently loading a response */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Whether there are existing messages */
  hasMessages: boolean;
  /** Whether sending is disabled (e.g., no API URL) */
  disabled?: boolean;
  /** Current messages for save callback */
  messages?: ChatMessage[];
  /** Width of the sidebar (for positioning) */
  sidebarWidth?: number;
}

/**
 * Chat input area with textarea and action buttons
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  onNewConversation,
  isLoading,
  error,
  hasMessages,
  disabled = false,
  sidebarWidth = 0,
}) => {
  const styles = useChatStyles();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [animatingLayout, setAnimatingLayout] = React.useState(false);

  // Handle keyboard events
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '24px';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24;
      const maxHeight = lineHeight * 3;
      const newHeight = Math.min(Math.max(scrollHeight, lineHeight), maxHeight);
      textarea.style.height = newHeight + 'px';
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [value]);

  // Input area positioning
  React.useLayoutEffect(() => {
    const maxWidth = 830;
    const horizontalMargin = 20;
    const sync = () => {
      if (!inputAreaRef.current) return;
      const vw = window.innerWidth;
      const available = vw - sidebarWidth;
      const contentWidth = Math.min(maxWidth, Math.max(320, available - horizontalMargin * 2));
      const left = sidebarWidth + (available - contentWidth) / 2;
      inputAreaRef.current.style.left = left + 'px';
      inputAreaRef.current.style.width = contentWidth - 35 + 'px';
    };
    sync();
    setAnimatingLayout(true);
    const raf = requestAnimationFrame(() => { sync(); setAnimatingLayout(false); });
    window.addEventListener('resize', sync);
    return () => { window.removeEventListener('resize', sync); cancelAnimationFrame(raf); };
  }, [sidebarWidth]);

  return (
    <div
      ref={inputAreaRef}
      className={
        (hasMessages ? styles.inputArea : styles.inputAreaCentered) + 
        (animatingLayout ? ' ' + styles.inputAreaAnimating : '')
      }
    >
      {/* Error message */}
      {error && (
        <div className={styles.errorContainer}>
          <MessageBar intent="error">
            {error}
          </MessageBar>
        </div>
      )}

      <div className={styles.chatInputContainer}>
        {/* Text input */}
        <div className={styles.inputTextareaContainer}>
          <textarea
            ref={textareaRef}
            placeholder="Message Sage..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            className={styles.inputTextarea}
            rows={1}
          />
        </div>

        {/* Buttons row */}
        <div className={styles.buttonsRow}>
          <div />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* New Conversation button */}
            {hasMessages && onNewConversation && (
              <Button
                appearance="subtle"
                icon={<Edit24Regular />}
                onClick={onNewConversation}
                className={styles.newConversationButton}
                title="New Conversation"
              />
            )}

            {/* Send/Stop button */}
            <Button
              appearance="primary"
              icon={isLoading ? <Stop24Regular /> : <Send24Regular />}
              onClick={isLoading ? onStop : onSend}
              disabled={(!value.trim() && !isLoading) || disabled}
              className={isLoading ? styles.stopButton : styles.sendButton}
              title={isLoading ? "Stop response" : "Send message"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
