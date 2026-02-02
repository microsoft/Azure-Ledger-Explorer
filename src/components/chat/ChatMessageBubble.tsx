/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { Text, MessageBar } from '@fluentui/react-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types/chat-types';
import { ChatAnnotations } from './ChatAnnotations';
import { ChatActionResult } from './ChatActionResult';
import { useChatStyles } from './chat.styles';

interface ChatMessageBubbleProps {
  /** The message to display */
  message: ChatMessage;
  /** Function to get URL for an annotation file */
  getAnnotationUrl: (fileId: string) => string | null;
}

/**
 * Renders a single chat message bubble
 */
export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  getAnnotationUrl,
}) => {
  const styles = useChatStyles();
  const isUser = message.role === 'user';

  return (
    <div 
      className={isUser ? styles.userMessageContainer : styles.messageContainer} 
      data-message-role={message.role} 
      data-message-id={message.id}
    >
      <div className={isUser ? styles.userMessageContent : styles.messageContent}>
        <div className={`${styles.messageBubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
          {/* Message content */}
          {isUser ? (
            <Text className={styles.messageText}>
              {message.content}
            </Text>
          ) : (
            <div className={styles.markdownContent}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Annotations/References */}
          {message.annotations && Object.keys(message.annotations).length > 0 && (
            <ChatAnnotations 
              annotations={message.annotations} 
              getAnnotationUrl={getAnnotationUrl} 
            />
          )}

          {/* Action results */}
          {message.actions && message.actions.length > 0 && (
            <>
              {message.actions.map((action, index) => (
                <ChatActionResult key={index} action={action} index={index} />
              ))}
            </>
          )}

          {/* Message error */}
          {message.error && (
            <div className={styles.errorSection}>
              <MessageBar intent="error">
                <Text size={200}>Error: {message.error}</Text>
              </MessageBar>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
