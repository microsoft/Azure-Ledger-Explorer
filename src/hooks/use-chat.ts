/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage, UIAction, ChatProvider } from '../types/chat-types';
import type { DatabaseSchema } from '@microsoft/ccf-database';
import { MESSAGES_STORAGE_KEY, OPENAI_MESSAGES_STORAGE_KEY } from '../constants/chat';
import { 
  createChatService, 
  createOpenAIChatService,
  extractActions, 
  executeActions,
  initializeActions,
} from '../services/chat';
import type { ActionContext } from '../services/chat';
import type { ChatService } from '../services/chat';
import type { OpenAIChatService } from '../services/chat';
import { trackEvent, TelemetryEvents } from '../services/telemetry';

// Initialize action handlers once at module load
initializeActions();

/** Union type for both chat service implementations */
type AnyChatService = ChatService | OpenAIChatService;

/**
 * Configuration for the useChat hook
 */
export interface UseChatConfig {
  /** Base URL for the Sage chat API */
  baseUrl?: string;
  /** OpenAI API key for BYOK mode */
  openaiApiKey?: string;
  /** OpenAI model name */
  openaiModel?: string;
  /** Database schema for OpenAI system prompt */
  databaseSchema?: DatabaseSchema;
  /** Active chat provider */
  provider?: ChatProvider;
  /** Initial messages to load */
  initialMessages?: ChatMessage[];
  /** Action context dependencies */
  actionContext?: ActionContext;
}

/**
 * Return type for the useChat hook
 */
export interface UseChatReturn {
  /** Current messages in the conversation */
  messages: ChatMessage[];
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Whether there are any messages */
  hasMessages: boolean;
  /** Send a new message */
  sendMessage: (content: string) => Promise<void>;
  /** Stop the current streaming response */
  stopResponse: () => void;
  /** Clear all messages and reset state */
  clearChat: () => void;
  /** Set messages directly (for loading conversations) */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Clear the current error */
  clearError: () => void;
  /** Get annotation URL for a file */
  getAnnotationUrl: (filename: string) => string | null;
}

/**
 * Custom hook for managing chat state and interactions
 */
export function useChat(config: UseChatConfig): UseChatReturn {
  const { 
    baseUrl,
    openaiApiKey,
    openaiModel = 'gpt-4o-mini',
    databaseSchema,
    provider = 'sage',
    initialMessages,
    actionContext = {},
  } = config;

  // Messages state with localStorage persistence (separate per provider)
  const storageKey = provider === 'openai' ? OPENAI_MESSAGES_STORAGE_KEY : MESSAGES_STORAGE_KEY;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      return raw 
        ? JSON.parse(raw).map((m: ChatMessage) => ({ 
            ...m, 
            timestamp: new Date(m.timestamp) 
          })) 
        : [];
    } catch { 
      return []; 
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create chat service instance based on provider
  const chatServiceRef = useRef<AnyChatService | null>(null);
  const lastProviderRef = useRef<string>('');
  const lastKeyRef = useRef<string>('');
  const lastBaseUrlRef = useRef<string>('');

  // Re-create the service when provider, key, baseUrl, or schema changes
  if (provider === 'openai' && openaiApiKey) {
    if (
      lastProviderRef.current !== 'openai' ||
      lastKeyRef.current !== openaiApiKey
    ) {
      chatServiceRef.current = createOpenAIChatService({
        apiKey: openaiApiKey,
        model: openaiModel,
        databaseSchema,
      });
      lastProviderRef.current = 'openai';
      lastKeyRef.current = openaiApiKey;
      lastBaseUrlRef.current = '';
    } else if (chatServiceRef.current && 'updateSchema' in chatServiceRef.current && databaseSchema) {
      // Update schema on the existing OpenAI service
      (chatServiceRef.current as OpenAIChatService).updateSchema(databaseSchema);
    }
  } else if (provider === 'sage' && baseUrl) {
    if (
      lastProviderRef.current !== 'sage' ||
      lastBaseUrlRef.current !== baseUrl
    ) {
      chatServiceRef.current = createChatService(baseUrl);
      lastProviderRef.current = 'sage';
      lastBaseUrlRef.current = baseUrl;
      lastKeyRef.current = '';
    }
  }

  // Persist messages to localStorage (provider-aware key)
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (err) {
      console.error('Failed to save messages:', err);
    }
  }, [messages, storageKey]);

  // Sync externally loaded messages
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const processJsonResponses = useCallback(async (
    actions: UIAction[], 
    userMessage: string
  ) => {
    if (!chatServiceRef.current) return;
    
    for (const action of actions) {
      if (action.actionResult && typeof action.actionResult === 'object' && !action.actionError) {
        try {
          const jsonString = JSON.stringify(action.actionResult);
          const cleanedResponse = await chatServiceRef.current.requestJsonCleanup(
            jsonString, 
            action.actionName, 
            userMessage
          );
          if (cleanedResponse) {
            action.cleanedResult = cleanedResponse;
          }
        } catch (err) {
          console.error('Error processing JSON response:', err);
        }
      }
    }
  }, []);

  const sendMessageWithStreaming = useCallback(async (
    userMessageContent: string, 
    previousMessages: ChatMessage[], 
    signal: AbortSignal
  ): Promise<string> => {
    if (!chatServiceRef.current) {
      const hint = provider === 'openai'
        ? 'Please set up an OpenAI API key in Configuration.'
        : 'Please set up a Sage Base URL in Configuration.';
      throw new Error(`Chat service is not configured. ${hint}`);
    }

    // Create assistant message placeholder
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      state: 'streaming',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    let fullText = '';

    await chatServiceRef.current.sendMessageStreaming(
      {
        message: userMessageContent,
        previousMessages,
        signal,
      },
      {
        onTextDelta: (_delta, accumulated) => {
          fullText = accumulated;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
              last.content = accumulated;
            }
            return updated;
          });
        },
        onAnnotationsUpdate: (annotations) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
              last.annotations = annotations;
            }
            return updated;
          });
        },
        onResponseId: (responseId) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
              last.responseId = responseId;
            }
            return updated;
          });
        },
        onComplete: (finalText, annotations, responseId) => {
          fullText = finalText;
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
              last.state = 'finished';
              last.content = finalText;
              last.annotations = annotations;
              if (responseId) {
                last.responseId = responseId;
              }
            }
            return updated;
          });
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );

    return fullText;
  }, [provider]);

  const postprocessResponse = useCallback(async (
    message: string,
    userMessageContent: string
  ) => {
    const actions = extractActions(message);
    
    if (actions.length === 0) {
      return;
    }

    // Execute all actions using the registry
    await executeActions(actions, actionContext);

    // Process JSON responses to make them more intelligible
    await processJsonResponses(actions, userMessageContent);

    // Update messages with action results
    setMessages(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last) {
        last.actions = actions;
      }
      return updated;
    });
  }, [actionContext, processJsonResponses]);

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading || !content.trim()) return;

    // Track chat message sent
    trackEvent(TelemetryEvents.CHAT_MESSAGE_SENT);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      state: 'finished',
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const messageText = await sendMessageWithStreaming(
        userMessage.content, 
        messages, 
        abortController.signal
      );
      
      if (!abortController.signal.aborted) {
        await postprocessResponse(messageText, userMessage.content);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, messages, sendMessageWithStreaming, postprocessResponse]);

  const stopResponse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getAnnotationUrl = useCallback((filename: string): string | null => {
    if (!chatServiceRef.current) {
      return null;
    }
    return chatServiceRef.current.getAnnotationUrl(filename);
  }, []);

  return {
    messages,
    isLoading,
    error,
    hasMessages: messages.length > 0,
    sendMessage,
    stopResponse,
    clearChat,
    setMessages,
    clearError,
    getAnnotationUrl,
  };
}
