/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useRef, useEffect } from 'react';
import { Spinner, Text } from '@fluentui/react-components';
import type { ChatMessage } from '../../types/chat-types';
import { ChatMessageBubble } from './ChatMessageBubble';
import { useChatStyles } from './chat.styles';

interface ChatMessageListProps {
  /** Messages to display */
  messages: ChatMessage[];
  /** Whether currently loading a response */
  isLoading: boolean;
  /** Function to get URL for an annotation file */
  getAnnotationUrl: (fileId: string) => string | null;
}

/**
 * Scrollable list of chat messages
 */
export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  getAnnotationUrl,
}) => {
  const styles = useChatStyles();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (messages.length > 0) {
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        const chatMessagesContainer = document.querySelector('.chat-messages-container');
        const messageElements = document.querySelectorAll('[data-message-role]');
        const lastElement = messageElements[messageElements.length - 1] as HTMLElement;
        if (lastElement && chatMessagesContainer) {
          const elementRect = lastElement.getBoundingClientRect();
          const elementBottom = elementRect.bottom;
          const scrollingHeight = chatMessagesContainer.clientHeight;
          const targetBottomPosition = scrollingHeight - 400;
          const scrollAmount = elementBottom - targetBottomPosition;
          if (typeof chatMessagesContainer.scrollBy === 'function') {
            chatMessagesContainer.scrollBy({
              top: scrollAmount,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, [messages]);

  return (
    <div className={styles.chatPane}>
      <div
        className={styles.messagesArea}
        style={{ paddingTop: '20px' }}
      >
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            getAnnotationUrl={getAnnotationUrl}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className={styles.messageContainer}>
            <div className={styles.messageContent}>
              <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                <div className={styles.loadingContainer}>
                  <Spinner size="tiny" />
                  <Text size={200}>AI is thinking...</Text>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
