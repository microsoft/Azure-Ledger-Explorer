/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Button,
  Spinner,
  Text,
  CompoundButton,
  MessageBar,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Send24Regular,
  ChatAddRegular,
  Edit24Regular,
  Stop24Regular,
} from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { CCFDatabase } from '@ccf/database';
import { useConfig } from '../pages/ConfigPage';
import { useVerification } from '../hooks/use-verification';
import { getDatabase } from '../hooks/use-ccf-data';
import { useDownloadMstFiles } from './MstLedgerImportView';
import type { SavedProgress } from '../services/verification-service';

// Max tokens we have is 720K per minute
// Which is a very rough limit of 720k*4=2.88M characters
// Assuming 10 parallel clients for demo lets say we have 288k characters per minute
// If one request takes ~10 sec for the user to scan through then the limit could be 288k/6=48k characters per request
const MAX_INPUT_LENGTH = 48000;
const MAX_OUTPUT_TOKENS = 2000;
const AI_TEMPERATURE = 0.0; // less means more deterministic
const MESSAGES_KEY = 'ccf-chat-messages';

const UIActionName = {
  ImportMST: 'importmst',
  RunSQL: 'runsql',
  VerifyLedger: 'verifyledger',
} as const;

type UIActionName = typeof UIActionName[keyof typeof UIActionName] | string;

interface UIAction {
  actionName: UIActionName;
  actionContent?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actionResult?: any;
  actionError?: string;
  cleanedResult?: string;
}

interface ChatAnnotation {
  refs?: number[]; // references in text, multiple per file
  file_id?: string;
  filename?: string;
}

export interface ChatMessage {
  id: string;
  state: 'initial' | 'streaming' | 'finished';
  role: 'user' | 'assistant';
  responseId?: string;
  content: string;
  annotations?: Record<string, ChatAnnotation>;
  timestamp: Date;
  error?: string;
  actions?: UIAction[];
}

interface AIChatProps {
  database?: CCFDatabase;
  onChatStateChange?: (hasActiveChat: boolean) => void;
  onRegisterClearChat?: (clearFn: (() => void) | null) => void;
  clearChatFunction?: (() => void) | null;
  onSaveConversation?: (messages: ChatMessage[]) => void;
  loadedMessages?: ChatMessage[];
  sidebarWidth?: number; // width of conversation sidebar to adjust centering
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    minHeight: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerWithMessages: {
    display: 'flex',
    minHeight: '100%',
    height: '100vh',
    overflowY: 'auto', // Enable vertical scrolling when messages are present
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  sageTitle: {
    fontSize: '48px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    marginBottom: '32px',
    textAlign: 'center',
  },
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '830px',
    marginBottom: '220px', // Space for input area
  },
  messagesArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: '0', // Changed from 100vh to prevent initial page scroll
  },
  messageContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  userMessageContent: {
    maxWidth: '70%',
    minWidth: 0,
  },
  messageBubble: {
    padding: '12px',
    borderRadius: '8px',
  },
  userBubble: {
    backgroundColor: tokens.colorNeutralBackground4,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  messageText: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '16px',
  },
  markdownContent: {
    fontSize: '16px',
    lineHeight: '1.5',
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      marginTop: '16px',
      marginBottom: '8px',
      fontWeight: '600',
      color: tokens.colorNeutralForeground1,
    },
    '& h1': { fontSize: '20px' },
    '& h2': { fontSize: '18px' },
    '& h3': { fontSize: '16px' },
    '& p': {
      margin: '8px 0',
      lineHeight: '1.5',
    },
    '& ul, & ol': {
      margin: '8px 0',
      paddingLeft: '24px',
    },
    '& li': {
      margin: '4px 0',
    },
    '& blockquote': {
      margin: '12px 0',
      padding: '8px 16px',
      borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
      backgroundColor: tokens.colorNeutralBackground2,
      fontStyle: 'italic',
    },
    '& code': {
      backgroundColor: tokens.colorNeutralBackground3,
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '14px',
      fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
    },
    '& pre': {
      margin: '12px 0',
      padding: '12px',
      backgroundColor: tokens.colorNeutralBackground6,
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '14px',
      lineHeight: '1.4',
    },
    '& pre code': {
      backgroundColor: 'transparent',
      padding: '0',
    },
    '& a': {
      color: tokens.colorBrandForeground1,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      margin: '12px 0',
    },
    '& th, & td': {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: '8px 12px',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: tokens.colorNeutralBackground2,
      fontWeight: '600',
    },
  },
  annotationsSection: {
    margin: '12px 0 0 0',
  },
  annotationsHeader: {
    fontSize: '16px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground3,
  },
  annotationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '0',
  },
  annotationItem: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    listStyleType: 'none',
  },
  annotationLink: {
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  sqlSection: {
    margin: '12px 0 0 0',
  },
  sqlHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorBrandForeground1,
  },
  sqlResultHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorPaletteGreenForeground1,
  },
  sqlQuery: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '8px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    margin: '4px 0',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
  },
  sqlResult: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    padding: '8px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    margin: '4px 0',
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
  },
  errorSection: {
    margin: '8px 0 0 0',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorNeutralForeground3,
  },
  errorContainer: {
    padding: '8px 16px 0 16px',
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 10, // Ensure it appears above other content
  },
  inputArea: {
    position: 'fixed',
    bottom: '20px',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 16px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `0px solid ${tokens.colorNeutralStroke2}`,
  },
  inputAreaAnimating: {
    transition: 'left 0.25s ease, width 0.25s ease',
  },
  inputAreaCentered: {}, // unused after refactor but keep reference to avoid code churn

  starterTemplates: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '12px',
    width: '100%',
    maxWidth: '830px',
    justifyContent: 'center',
  },
  chatInputContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 10px 5px 10px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: '28px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    '&:focus-within': {
      border: `1px solid ${tokens.colorBrandStroke1}`,
    },
  },
  inputTextareaContainer: {
    width: '100%',
    padding: '8px 20px 8px 8px',
    minHeight: '24px',
  },
  buttonsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '0px',
  },
  plusButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: 'none',
    color: tokens.colorNeutralForeground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2,
      color: tokens.colorNeutralForeground1,
    },
  },
  inputTextarea: {
    flex: 1,
    width: '100%',
    minHeight: '24px',
    maxHeight: '72px', // 3 lines at 24px line height
    border: 'none',
    backgroundColor: 'transparent',
    resize: 'none',
    fontSize: '16px',
    lineHeight: '24px',
    padding: '0',
    fontFamily: 'inherit',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    overflowY: 'auto',
    color: tokens.colorNeutralForeground1,
    '&:focus': {
      outline: 'none',
    },
    '&::placeholder': {
      color: tokens.colorNeutralForeground3,
    },
  },
  sendButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
  border: 'none',
    color: tokens.colorNeutralForegroundInverted,
    '&:disabled': {
      backgroundColor: tokens.colorNeutralBackground4,
      color: tokens.colorNeutralForeground4,
    },
    '&:hover:not(:disabled)': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  stopButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: tokens.colorPaletteBlueBorderActive,
    border: 'none',
    color: tokens.colorNeutralForegroundInverted,
  },
  newConversationButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground1,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      border: `1px solid ${tokens.colorNeutralStroke1Hover}`,
    },
  },
  cleanedResult: {
    margin: '8px 0',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  rawDataDetails: {
    margin: '8px 0',
    '& summary': {
      cursor: 'pointer',
      fontSize: '12px',
      color: tokens.colorNeutralForeground3,
      padding: '4px 0',
      '&:hover': {
        color: tokens.colorNeutralForeground2,
      },
    },
    '& summary::-webkit-details-marker': {
      display: 'none',
    },
    '& summary::before': {
      content: '"▶ "',
      fontSize: '10px',
    },
    '&[open] summary::before': {
      content: '"▼ "',
    },
  },
});

export const AIChat: React.FC<AIChatProps> = ({
  database,
  onChatStateChange,
  onRegisterClearChat,
  clearChatFunction,
  onSaveConversation,
  loadedMessages,
  sidebarWidth = 0
}) => {
  const styles = useStyles();
  const { config } = useConfig();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (loadedMessages && loadedMessages.length) return loadedMessages;
    try {
      const raw = localStorage.getItem(MESSAGES_KEY);
      return raw ? JSON.parse(raw).map((m: ChatMessage) => ({ ...m, timestamp: new Date(m.timestamp) })) : [];
    } catch { return []; }
  });
  const [currentMessage, setCurrentMessage] = useState('');
  const [allTransactionsCount, setAllTransactionsCount] = useState(0);

  useEffect(() => {
    if (database) {
      database.transactions.getAllCount().then((count: number) => {
        setAllTransactionsCount(count);
      }).catch((error: Error) => {
        console.error('Failed to get transaction count:', error);
        setAllTransactionsCount(0);
      });
    }
  }, [database]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add verification hooks
  const verification = useVerification();
  const hasMessages = messages.length > 0;
  const { downloadFiles: downloadMstFiles } = useDownloadMstFiles();
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [animatingLayout, setAnimatingLayout] = useState(false);

  useLayoutEffect(() => {
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

    // Register clearChat function with parent component
  useEffect(() => {
    onRegisterClearChat?.(() => clearChat);
    return () => onRegisterClearChat?.(null);
  }, [onRegisterClearChat]);

  useEffect(() => {
    // Ensure page starts at the top on initial load
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    // Cleanup abort controller on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    onChatStateChange?.(hasMessages);
  }, [hasMessages, onChatStateChange]);

  // Sync externally loaded conversation messages
  useEffect(() => {
    if (loadedMessages) {
      setMessages(loadedMessages);
    }
  }, [loadedMessages]);

 
  useEffect(() => {
    // Save messages to localStorage
    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
    
    // Auto-scroll to the last content streamed to the view
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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to calculate scrollHeight properly
      textarea.style.height = '24px'; // 1 line

      // Calculate the required height
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24;
      const minHeight = lineHeight; // 1 line
      const maxHeight = lineHeight * 3; // 3 lines

      // Set height between min and max, allow scrolling beyond max
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = newHeight + 'px';

      // Show scrollbar if content exceeds 3 lines
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [currentMessage]);

  const getImportedDataStatus = () => {
    if (allTransactionsCount && allTransactionsCount > 0) {
      return `\n## State of SQLite database\n\nSQLite database exists and has transactions, it is safe to use action:runsql if necessary. There is no need to import ledger data.\n`;
    } else {
      return `\n## State of SQLite database\n\nLedger data was not imported and querying SQLite database using action:runsql is not possible. Do not attempt to query the ledger and suggest the user to import the data if the question is asking for it.\n`;
    }
  };

  const getSystemPrompt = () => {
    let systemPrompt = config.systemPrompt || '';
    systemPrompt += getImportedDataStatus();
    return systemPrompt;
  };

  const executeLedgerVerification = async (): Promise<SavedProgress> => {
    try {
      const result = verification.getSavedProgress();
      return result;
    } catch (error) {
      console.error('Ledger verification error:', error);
      return {
        lastProcessedTransaction: 0,
        totalTransactions: 0,
        status: 'error'
      };
    }
  };

  const callOpenAIResponseAPI = async (messages: ChatMessage[], newMessage: string, signal?: AbortSignal): Promise<Response> => {
    if (!config.baseUrl) {
      throw new Error('Base URL is required to send the request');
    }

    const input = `## User asks:\n${newMessage}`;

    const previousResponseId = messages.length > 0 ? messages[messages.length - 1].responseId : null;

    const response = await fetch(config.baseUrl + '/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stream: true,
        input: input,
        instructions: getSystemPrompt(),
        previous_response_id: previousResponseId,
        temperature: AI_TEMPERATURE,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: signal, // Add abort signal support
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    return response;
  };

  const extractActions = (content: string): Array<UIAction> => {
    const actionRegex = /```action:([a-zA-Z_][a-zA-Z0-9_]*)\n([\s\S]*?)```/g;
    const actions: Array<UIAction> = [];
    const trackDuplicates = new Set<string>();

    let match;
    while ((match = actionRegex.exec(content)) !== null) {
      const actionName = match[1].trim();
      const actionContent = match[2].trim();
      const actionKey = `${actionName}:${actionContent}`;
      // LLM sometimes generates duplicate actions
      if (!trackDuplicates.has(actionKey)) {
        trackDuplicates.add(actionKey);
        actions.push({ actionName, actionContent });
      }
    }

    return actions;
  }

  const processResponse = async (response: Response, signal?: AbortSignal) => {
    if (!response.body) {
      throw new Error('Response body is empty');
    }
    // Put blank message which is in progress and periodically update it
    const message: ChatMessage = {
      id: (Date.now() + 1).toString(),
      state: 'streaming',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);

    // Append response to the message as it gets streamed
    // ------------------

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const sseDataPrefix = 'data: ';
    let fullResponseText = '';
    let responseId: string;
    const annotations: Record<string, ChatAnnotation> = {};
    try {
      while (true) {
        // Check if we should abort
        if (signal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
              last.state = 'finished';
              last.annotations = annotations;
            }
            return updated;
          });
          break;
        }

        // Handle SSE value
        const chunk = decoder.decode(value);
        // split by new lines
        const lines = chunk.split('\n');

        let textDelta = '';
        for (const line of lines) {
          if (!line.startsWith(sseDataPrefix)) {
            continue;
          }
          const dataString = line.slice(sseDataPrefix.length).trim();
          if (dataString && dataString !== '[DONE]') {
            try {
              const data = JSON.parse(dataString);
              if (data.type === 'response.output_text.delta') {
                textDelta += data.delta || '';
              } else if (data.type === 'response.output_text.annotation.added') {
                // print annotation/reference/footnote in text
                if (data.annotation_index >= 0) {
                  const annotationref = data.annotation_index + 1;
                  textDelta += ` [${annotationref}]`;

                  if (!annotations[data.annotation.file_id]) {
                    annotations[data.annotation.file_id] = {
                      file_id: data.annotation.file_id,
                      filename: data.annotation.filename,
                      refs: [annotationref]
                    };
                  } else {
                    const existing = annotations[data.annotation.file_id];
                    if (existing) {
                      existing.refs = existing.refs || [];
                      existing.refs.push(annotationref);
                    }
                  }
                }
              } else if (data.type === 'response.output_item.added') {
                if (data.item.type === 'mcp_list_tools' || data.item.type === 'message') {
                  continue;
                } else if (data.item.type === 'file_search_call') {
                  textDelta += '\n> Searching for files ...\n\n';
                } else if (data.item.type === 'mcp_call') {
                  textDelta += '\n> Calling: ' + data.item.server_label + ':' + data.item.name + (data.item.arguments ? ' with: ' + JSON.stringify(data.item.arguments) : '') + '\n\n';
                } else {
                  textDelta += '\n> Using: ' + data.item.type + '\n\n';
                }
              } else if (data.type === 'response.completed') {
                responseId = data.response.id;
              }
            } catch (error) {
              console.error('Error parsing SSE data:', dataString, 'error is:', error);
            }
          }
        }
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last) {
            last.content += textDelta;
            fullResponseText += textDelta;
            if (responseId != null) {
              last.responseId = responseId;
            }
          }
          return updated;
        });
      }
    } finally {
      reader.releaseLock();
      // Mark the message as finished if it was aborted
      if (signal?.aborted) {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.state === 'streaming') {
            last.state = 'finished';
            if (!last.content.trim()) {
              last.content = '*Response was stopped by user*';
            }
          }
          return updated;
        });
      }
    }

    return fullResponseText;
  }

  const postprocessResponse = async (message: string) => {
    const actions = extractActions(message);
    for (const action of actions) {
      if (action.actionName === UIActionName.RunSQL) {
        const sqlQuery = action.actionContent;
        if (!sqlQuery || !sqlQuery.trim() || !database) {
          action.actionError = 'Could not execute SQL query.' + (database ? '' : ' Database not initialized.');
          continue;
        }
        try {
          action.actionResult = await database.executeQuery(sqlQuery);
        } catch (err) {
          action.actionError = err instanceof Error ? err.message : 'SQL execution failed';
        }
      } else if (action.actionName === UIActionName.VerifyLedger) {
        try {
          action.actionResult = await executeLedgerVerification();
        } catch (err) {
          action.actionError = err instanceof Error ? err.message : 'Ledger verification failed';
        }
      } else if (action.actionName === UIActionName.ImportMST) {
        if (!action.actionContent) {
          action.actionError = 'MST domain was missing';
          continue
        }
        try {
          await downloadMstFiles(action.actionContent.trim());
        } catch (err) {
          action.actionError = err instanceof Error ? err.message : 'Failed to download MST files';
          continue;
        }
        action.actionResult = 'MST files downloaded successfully';
        if (!database) {
          // make sure database is initialized after MST import
          database = await getDatabase();
        }
      }
    }

    // Process JSON responses to make them more intelligible
    await processJsonResponses(actions, message);

    if (actions.length > 0) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) {
          last.actions = actions;
        }
        return updated;
      });
    }
  }

  // Helper function to process and clean up JSON responses
  const processJsonResponses = async (actions: UIAction[], message: string) => {
    for (const action of actions) {
      if (action.actionResult && typeof action.actionResult === 'object' && !action.actionError) {
        try {
          const jsonString = JSON.stringify(action.actionResult);
          const cleanedResponse = await requestJsonCleanup(jsonString, action.actionName, message);
          if (cleanedResponse) {
            action.cleanedResult = cleanedResponse;
          }
        } catch (err) {
          console.error('Error processing JSON response:', err);
          // Don't set an error here as this is supplementary processing
        }
      }
    }
  }

  // Make an AI request to clean up JSON data
  const requestJsonCleanup = async (jsonString: string, actionName: string, message: string): Promise<string | null> => {
    if (jsonString && jsonString.length > MAX_INPUT_LENGTH) {
      console.warn('JSON response too large to process for cleanup:', jsonString.length, 'limit:', MAX_INPUT_LENGTH);
      return null;
    }

    try {
      const cleanupPrompt = `Please analyze and summarize this JSON response from a ${actionName} action. Make it more readable and highlight the key information in a clear, structured format. Focus on the most important data points and answer the user's question: ${message}.

JSON to analyze:
${jsonString}

Please provide a clean, human-readable summary that captures the essential information without overwhelming technical details. `;

      const response = await fetch(config.baseUrl + '/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream: false, // Non-streaming for cleanup requests
          input: cleanupPrompt,
          instructions: 'You are a helpful assistant that specializes in making complex JSON data more readable and understandable. Focus on clarity, structure, and highlighting important information.',
          temperature: AI_TEMPERATURE,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
      });

      if (!response.ok) {
        console.error('Failed to request JSON cleanup:', response.status);
        return null;
      }

      const data = await response.json();
      for (const output of data.output) {
        if (output?.role === "assistant") {
          // Process the assistant's output
          return output?.content[0]?.text;
        }
      }
      return null;
    } catch (err) {
      console.error('Error requesting JSON cleanup:', err);
      return null;
    }
  }

  const handleSendMessage = async (optionalMessage?: string) => {
    if (isLoading || (!optionalMessage && !currentMessage.trim())) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      state: 'finished',
      role: 'user',
      content: optionalMessage || currentMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Get AI response
      const aiResponse = await callOpenAIResponseAPI(messages, userMessage.content, abortController.signal);
      // Stream response to chat
      const messageText = await processResponse(aiResponse, abortController.signal);
      // Execute actions only if not aborted
      if (!abortController.signal.aborted) {
        await postprocessResponse(messageText);
      }
    } catch (err) {
      // Don't show error if request was aborted by user
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startFromExample = (example: string) => {
    setMessages([]);
    setError(null);
    setCurrentMessage(example);
    handleSendMessage(example);
  };

  const getAnnotationUrl = (fileId?: string) => {
    if (!fileId || !config.baseUrl) {
      return null;
    }
    const trimmedBase = config.baseUrl.replace(/\/+$/, '');
    return `${trimmedBase}/docs/file/download/${encodeURIComponent(fileId)}`;
  };

  const clearChat = () => {
    // Clear messages and reset error state
    setMessages([]);
    setError(null);

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const formatSqlResult = (result: unknown[]): string => {
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
  };

  const renderMessageTemplates = () => {

    if (hasMessages) return null;

    const messages = [
      {show: true, group: "Azure Attestation", text: "How does MAA's SGX attestation work?"},
      {show: true, group: "Azure Attestation", text: "How can I trust MAA?"},
      {show: true, group: "Transparency", text: "Can you verify that MAA is transparent right now?"},
      {show: true, group: "Transparency", text: "Can you show me the history of MAA builds?"},
      {show: allTransactionsCount && allTransactionsCount > 0, group: "Ledger", text: "How many transactions are in the database?"},
      {show: allTransactionsCount && allTransactionsCount > 0, group: "Ledger", text: "Show me recent transactions"},
      {show: allTransactionsCount && allTransactionsCount > 0, group: "Ledger", text: "Find transactions with specific keys"},
    ];

    return <div className={styles.starterTemplates}>
      {messages.map((msg) => 
        !!msg.show &&
        <CompoundButton
          icon={<ChatAddRegular />}
          secondaryContent={msg.text}
          appearance="transparent"
          onClick={() => startFromExample(msg.text)}
        >{msg.group}</CompoundButton>
      )}
    </div>;
  };

  return (
    <>
      <div className={"chat-messages-container " + (hasMessages ? styles.containerWithMessages : styles.container)}>
        {/* Title - visible when no messages */}
        {!hasMessages && (
          <div className={styles.sageTitle}>
            Sage
          </div>
        )}

        {/* Input Area - positioned based on whether there are messages */}
        <div
          ref={inputAreaRef}
          className={(hasMessages ? styles.inputArea : styles.inputAreaCentered) + (animatingLayout ? ' ' + styles.inputAreaAnimating : '')}
        >
          {error && (
            <div className={styles.errorContainer}>
              <MessageBar intent="error">
                {error}
              </MessageBar>
            </div>
          )}

          <div className={styles.chatInputContainer}>
            {/* Text input on top */}
            <div className={styles.inputTextareaContainer}>
              <textarea
                ref={textareaRef}
                placeholder="Message Sage..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className={styles.inputTextarea}
                rows={1}
              />
            </div>

            {/* Buttons row below */}
            <div className={styles.buttonsRow}>
              <div>
              </div>

              {/* Right side buttons group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* New Conversation button - only show when there are messages */}
                {hasMessages && (
                  <Button
                    appearance="subtle"
                    icon={<Edit24Regular />}
                    onClick={() => {
                      onSaveConversation?.(messages);
                      clearChatFunction?.();
                    }}
                    className={styles.newConversationButton}
                    title="New Conversation"
                  />
                )}

                {/* Send button on right */}
                <Button
                  appearance="primary"
                  icon={isLoading ? <Stop24Regular /> : <Send24Regular />}
                  onClick={isLoading ? handleStopResponse : () => handleSendMessage()}
                  disabled={(!currentMessage.trim() && !isLoading) || !config.baseUrl}
                  className={isLoading ? styles.stopButton : styles.sendButton}
                  title={isLoading ? "Stop response" : "Send message"}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Starter templates - visible when no messages, positioned under input area */}
        {renderMessageTemplates()}

        {/* Chat Area with Messages - only visible when there are messages */}
        {hasMessages && (
          <div className={styles.chatPane}>
            {/* Messages Area */}
            <div
              className={styles.messagesArea}
              style={{
                paddingTop: '20px' // Always add padding when messages exist
              }}
            >

              {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? styles.userMessageContainer : styles.messageContainer} data-message-role={message.role} data-message-id={message.id}>

                  <div className={message.role === 'user' ? styles.userMessageContent : styles.messageContent}>
                    <div className={`${styles.messageBubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                      {message.role === 'user' ? (
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

                      {message.annotations && Object.keys(message.annotations).length > 0 && (
                        <div className={styles.annotationsSection}>
                          <Text className={styles.annotationsHeader}>References:</Text>
                          <ul className={styles.annotationsList}>
                            {Object.values(message.annotations).map((annotation) => {
                              const refsText = annotation.refs && annotation.refs.length > 0 ? annotation.refs.map(r => `[${r}]`).join(', ') + ' ' : '';
                              const annotationUrl = getAnnotationUrl(annotation.file_id);
                              const displayName = annotation.filename || annotation.file_id || 'Referenced file';

                              return (
                                <li key={annotation.file_id} className={styles.annotationItem}>
                                  {annotationUrl ? (
                                    <a href={annotationUrl} className={styles.annotationLink} target="_blank" rel="noopener noreferrer">
                                      {refsText}{displayName}
                                    </a>
                                  ) : (
                                    <>{refsText}{displayName}</>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {message.actions && message.actions.length > 0 && (
                        <>{message.actions.map((action, index) => (
                          <div className={styles.sqlSection} key={index}>
                            <Text size={200} weight="semibold" className={styles.sqlHeader}>
                              Action: {action.actionName}
                            </Text>
                            {action.cleanedResult && (
                              <div className={styles.cleanedResult}>
                                <Text size={200} weight="semibold" className={styles.sqlHeader}>
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
                                  <pre className={styles.sqlQuery}>
                                    {action.actionName === UIActionName.RunSQL ? (
                                      <>{formatSqlResult(action.actionResult)}</>
                                    ) : (
                                      <>{typeof action.actionResult === 'string'
                                        ? action.actionResult
                                        : JSON.stringify(action.actionResult, null, 2)}</>
                                    )}
                                  </pre>
                                </details>
                              </div>
                            )}
                            {action.actionResult && !action.cleanedResult && (
                              <pre className={styles.sqlQuery}>
                                {action.actionName === UIActionName.RunSQL ? (
                                  <>{formatSqlResult(action.actionResult)}</>
                                ) : (
                                  <>{typeof action.actionResult === 'string'
                                    ? action.actionResult
                                    : JSON.stringify(action.actionResult, null, 2)}</>
                                )}
                              </pre>
                            )}
                            {action.actionError && (
                              <MessageBar intent="error">
                                <Text size={200}>Error: {action.actionError}</Text>
                              </MessageBar>
                            )}
                          </div>
                        ))}
                        </>
                      )}

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
              ))}

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
        )}
      </div>

    </>
  );
};
