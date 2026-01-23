/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatMessage, ChatAnnotation } from '../../types/chat-types';
import { MAX_INPUT_LENGTH, MAX_OUTPUT_TOKENS, AI_TEMPERATURE } from '../../constants/chat';
import { parseSSEChunk } from './sse-parser';

/**
 * Configuration for the chat service
 */
export interface ChatServiceConfig {
  baseUrl: string;
  systemPrompt?: string;
}

/**
 * Request options for sending a message
 */
export interface SendMessageOptions {
  /** The user's message text */
  message: string;
  /** Previous messages for context (to get previousResponseId) */
  previousMessages: ChatMessage[];
  /** System prompt/instructions */
  systemPrompt: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Callback for streaming updates
 */
export interface StreamCallbacks {
  /** Called when new text content is received */
  onTextDelta: (delta: string, fullText: string) => void;
  /** Called when annotations are updated */
  onAnnotationsUpdate: (annotations: Record<string, ChatAnnotation>) => void;
  /** Called when response ID is received */
  onResponseId: (responseId: string) => void;
  /** Called when streaming is complete */
  onComplete: (fullText: string, annotations: Record<string, ChatAnnotation>, responseId?: string) => void;
  /** Called on error */
  onError: (error: Error) => void;
}

/**
 * Result from a non-streaming API call
 */
export interface ChatResponse {
  text: string;
  responseId?: string;
}

/**
 * Chat service for communicating with the OpenAI-compatible API
 */
export class ChatService {
  private baseUrl: string;
  
  constructor(config: ChatServiceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
  }
  
  /**
   * Send a streaming message to the API
   */
  async sendMessageStreaming(
    options: SendMessageOptions,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const { message, previousMessages, systemPrompt, signal } = options;
    
    try {
      const response = await this.makeRequest({
        input: `## User asks:\n${message}`,
        instructions: systemPrompt,
        previousResponseId: this.getLastResponseId(previousMessages),
        stream: true,
        signal,
      });
      
      if (!response.body) {
        throw new Error('Response body is empty');
      }
      
      await this.processStream(response.body.getReader(), callbacks, signal);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        callbacks.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * Send a non-streaming message to the API (e.g., for JSON cleanup)
   */
  async sendMessage(
    input: string,
    instructions: string,
    signal?: AbortSignal
  ): Promise<ChatResponse | null> {
    try {
      const response = await this.makeRequest({
        input,
        instructions,
        stream: false,
        signal,
      });
      
      const data = await response.json();
      
      for (const output of data.output) {
        if (output?.role === 'assistant') {
          return {
            text: output?.content[0]?.text || '',
            responseId: data.id,
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }
  
  /**
   * Request JSON cleanup/summarization from the API
   */
  async requestJsonCleanup(
    jsonString: string,
    actionName: string,
    userQuestion: string
  ): Promise<string | null> {
    if (jsonString.length > MAX_INPUT_LENGTH) {
      console.warn('JSON response too large to process for cleanup:', jsonString.length, 'limit:', MAX_INPUT_LENGTH);
      return null;
    }
    
    const prompt = `Please analyze and summarize this JSON response from a ${actionName} action. Make it more readable and highlight the key information in a clear, structured format. Focus on the most important data points and answer the user's question: ${userQuestion}.

JSON to analyze:
${jsonString}

Please provide a clean, human-readable summary that captures the essential information without overwhelming technical details.`;
    
    const result = await this.sendMessage(
      prompt,
      'You are a helpful assistant that specializes in making complex JSON data more readable and understandable. Focus on clarity, structure, and highlighting important information.'
    );
    
    return result?.text || null;
  }
  
  /**
   * Build the annotation download URL
   */
  getAnnotationUrl(fileId: string): string {
    return `${this.baseUrl}/docs/file/download/${encodeURIComponent(fileId)}`;
  }
  
  /**
   * Get the last response ID from previous messages
   */
  private getLastResponseId(messages: ChatMessage[]): string | null {
    if (messages.length === 0) return null;
    return messages[messages.length - 1].responseId || null;
  }
  
  /**
   * Make a request to the API
   */
  private async makeRequest(options: {
    input: string;
    instructions: string;
    previousResponseId?: string | null;
    stream: boolean;
    signal?: AbortSignal;
  }): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stream: options.stream,
        input: options.input,
        instructions: options.instructions,
        previous_response_id: options.previousResponseId,
        temperature: AI_TEMPERATURE,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: options.signal,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }
    
    return response;
  }
  
  /**
   * Process the SSE stream
   */
  private async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const decoder = new TextDecoder();
    let fullText = '';
    let allAnnotations: Record<string, ChatAnnotation> = {};
    let responseId: string | undefined;
    let completed = false;
    let buffer = ''; // Buffer for incomplete SSE lines
    
    try {
      while (true) {
        if (signal?.aborted) {
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) {
          // Flush any remaining buffered bytes from the TextDecoder
          const finalChunk = decoder.decode();
          if (finalChunk || buffer) {
            const finalResult = parseSSEChunk(finalChunk, allAnnotations, buffer);
            
            if (finalResult.textDelta) {
              fullText += finalResult.textDelta;
              callbacks.onTextDelta(finalResult.textDelta, fullText);
            }
            
            if (Object.keys(finalResult.annotations).length > Object.keys(allAnnotations).length) {
              allAnnotations = finalResult.annotations;
              callbacks.onAnnotationsUpdate(allAnnotations);
            }
            
            if (finalResult.responseId) {
              responseId = finalResult.responseId;
              callbacks.onResponseId(responseId);
            }
          }
          
          callbacks.onComplete(fullText, allAnnotations, responseId);
          completed = true;
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const result = parseSSEChunk(chunk, allAnnotations, buffer);
        
        // Store any partial line for next iteration
        buffer = result.remainingBuffer || '';
        
        if (result.textDelta) {
          fullText += result.textDelta;
          callbacks.onTextDelta(result.textDelta, fullText);
        }
        
        if (Object.keys(result.annotations).length > Object.keys(allAnnotations).length) {
          allAnnotations = result.annotations;
          callbacks.onAnnotationsUpdate(allAnnotations);
        }
        
        if (result.responseId) {
          responseId = result.responseId;
          callbacks.onResponseId(responseId);
        }
      }
    } finally {
      reader.releaseLock();
      
      if (signal?.aborted && !completed) {
        callbacks.onComplete(fullText || '*Response was stopped by user*', allAnnotations, responseId);
      }
    }
  }
}

/**
 * Create a chat service instance
 */
export function createChatService(baseUrl: string): ChatService {
  return new ChatService({ baseUrl });
}
