/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { Text, MessageBar } from '@fluentui/react-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UIAction } from '../../types/chat-types';
import { UIActionName } from '../../types/chat-types';
import { useChatStyles } from './chat.styles';

interface ChatActionResultProps {
  /** The action to display */
  action: UIAction;
  /** Index for keying */
  index: number;
}

/**
 * Format SQL result for display
 */
function formatSqlResult(result: unknown[]): string {
  if (!result || result.length === 0) {
    return 'No results found';
  }

  if (result.length === 1 && typeof result[0] === 'object') {
    const obj = result[0] as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1) {
      return `${keys[0]}: ${obj[keys[0]]}`;
    }
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Format action result for display
 */
function formatActionResult(action: UIAction): string {
  if (action.actionName === UIActionName.RunSQL) {
    return formatSqlResult(action.actionResult);
  }
  
  if (typeof action.actionResult === 'string') {
    return action.actionResult;
  }
  
  return JSON.stringify(action.actionResult, null, 2);
}

/**
 * Displays the result of an executed action
 */
export const ChatActionResult: React.FC<ChatActionResultProps> = ({
  action,
  index,
}) => {
  const styles = useChatStyles();

  return (
    <div className={styles.actionSection} key={index}>
      <Text size={200} weight="semibold" className={styles.actionHeader}>
        Action: {action.actionName}
      </Text>
      
      {/* Cleaned/summarized result */}
      {action.cleanedResult && (
        <div className={styles.cleanedResult}>
          <Text size={200} weight="semibold" className={styles.actionHeader}>
            Summary:
          </Text>
          <div className={styles.markdownContent}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {action.cleanedResult}
            </ReactMarkdown>
          </div>
          <details className={styles.rawDataDetails}>
            <summary>
              <Text size={200}>Show raw data</Text>
            </summary>
            <pre className={styles.actionQuery}>
              {formatActionResult(action)}
            </pre>
          </details>
        </div>
      )}
      
      {/* Raw result (when no cleaned result) */}
      {action.actionResult && !action.cleanedResult && (
        <pre className={styles.actionQuery}>
          {formatActionResult(action)}
        </pre>
      )}
      
      {/* Error */}
      {action.actionError && (
        <MessageBar intent="error">
          <Text size={200}>Error: {action.actionError}</Text>
        </MessageBar>
      )}
    </div>
  );
};
