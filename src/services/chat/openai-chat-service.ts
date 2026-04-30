/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatMessage, ChatAnnotation } from '../../types/chat-types';
import type { DatabaseSchema } from '@microsoft/ccf-database';
import { MAX_INPUT_LENGTH, MAX_OUTPUT_TOKENS } from '../../constants/chat';
import type { StreamCallbacks, SendMessageOptions, ChatResponse } from './chat-service';

/**
 * OpenAI API message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Configuration for the OpenAI chat service
 */
export interface OpenAIChatServiceConfig {
  apiKey: string;
  model: string;
  databaseSchema?: DatabaseSchema;
}

/**
 * Build the system prompt that includes the database schema
 * and instructs the model to generate SQL queries.
 */
function buildSystemPrompt(schema?: DatabaseSchema): string {
  let schemaDescription = 'No database schema is currently available. The user has not loaded any ledger files yet.';

  if (schema && schema.tables.length > 0) {
    const tableDDLs = schema.tables.map(table => {
      const columns = table.columns
        .map(col => {
          let def = `  ${col.name} ${col.type}`;
          if (col.pk) def += ' PRIMARY KEY';
          if (col.notnull) def += ' NOT NULL';
          if (col.dflt_value !== null) def += ` DEFAULT ${col.dflt_value}`;
          return def;
        })
        .join(',\n');

      let ddl = `CREATE TABLE ${table.name} (\n${columns}\n);`;
      if (table.indexes.length > 0) {
        ddl += '\n-- Indexes: ' + table.indexes.join(', ');
      }
      return ddl;
    }).join('\n\n');

    schemaDescription = `The user has loaded ledger files into a local SQLite database. Here is the complete schema:\n\n${tableDDLs}`;
  }

  return `You are "Ledger Chat", a helpful assistant for exploring Azure Confidential Ledger data stored in a local SQLite database.

${schemaDescription}

Key relationships:
- ledger_files contains metadata about imported ledger files
- transactions belong to a ledger_files record via file_id
- kv_writes and kv_deletes belong to a transaction via transaction_id
- map_name in kv_writes/kv_deletes represents table names (e.g., "public:ccf.gov.nodes.info")
- key_name is the key within that table, value_text is the UTF-8 decoded value

When the user asks a question about their ledger data:
1. Write a SQL query inside an action block like this:
\`\`\`action:runsql
SELECT ...
\`\`\`
2. Only use SELECT, WITH, or PRAGMA queries. Never INSERT, UPDATE, or DELETE.
3. Use exact table and column names from the schema above.
4. Prefer concise queries; use LIMIT when browsing data.
5. After the action block executes, you will receive the results. Summarize them clearly in natural language.

If the user asks a general question that does not require a database query, answer it directly without an action block.

Keep responses concise, well-formatted, and helpful.`;
}

/**
 * Convert conversation messages to OpenAI chat format
 */
function toOpenAIMessages(
  systemPrompt: string,
  previousMessages: ChatMessage[],
  currentMessage: string
): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Include previous messages for conversation context
  for (const msg of previousMessages) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });

    // If the assistant message had action results, include them as context
    if (msg.actions && msg.actions.length > 0) {
      for (const action of msg.actions) {
        if (action.actionResult && !action.actionError) {
          messages.push({
            role: 'system',
            content: `The ${action.actionName} action returned the following result:\n${JSON.stringify(action.actionResult)}`,
          });
        }
      }
    }
  }

  // Add the current user message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

/**
 * Chat service that communicates directly with the OpenAI API
 * using the user's own API key (BYOK).
 *
 * This service translates natural language questions about ledger data
 * into SQL queries via the action system, then summarizes results.
 */
export class OpenAIChatService {
  private apiKey: string;
  private model: string;
  private systemPrompt: string;

  constructor(config: OpenAIChatServiceConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.systemPrompt = buildSystemPrompt(config.databaseSchema);
  }

  /**
   * Update the database schema (e.g., after new files are loaded)
   */
  updateSchema(schema: DatabaseSchema): void {
    this.systemPrompt = buildSystemPrompt(schema);
  }

  /**
   * Send a streaming message to the OpenAI API
   */
  async sendMessageStreaming(
    options: SendMessageOptions,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const { message, previousMessages, signal } = options;

    const openAIMessages = toOpenAIMessages(
      this.systemPrompt,
      previousMessages,
      message
    );

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: openAIMessages,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `OpenAI API error: ${response.status}`
        );
      }

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
   * Send a non-streaming message to OpenAI (used for JSON cleanup / summarization)
   */
  async sendMessage(
    input: string,
    signal?: AbortSignal
  ): Promise<ChatResponse | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: input },
          ],
          max_completion_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `OpenAI API error: ${response.status}`
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (choice?.message?.content) {
        return {
          text: choice.message.content,
          responseId: data.id,
        };
      }

      return null;
    } catch (error) {
      console.error('Error sending message to OpenAI:', error);
      return null;
    }
  }

  /**
   * Request JSON cleanup/summarization from OpenAI
   */
  async requestJsonCleanup(
    jsonString: string,
    actionName: string,
    userQuestion: string
  ): Promise<string | null> {
    if (jsonString.length > MAX_INPUT_LENGTH) {
      console.warn(
        'JSON response too large to process for cleanup:',
        jsonString.length,
        'limit:',
        MAX_INPUT_LENGTH
      );
      return null;
    }

    const prompt = `Please analyze and summarize this JSON response from a ${actionName} action. Make it more readable and highlight the key information in a clear, structured format. Focus on the most important data points and answer the user's question: ${userQuestion}.

JSON to analyze:
${jsonString}

Please provide a clean, human-readable summary that captures the essential information without overwhelming technical details.`;

    const result = await this.sendMessage(prompt);
    return result?.text || null;
  }

  /**
   * OpenAI direct mode does not support annotation URLs
   */
  getAnnotationUrl(_filename: string): string {
    return '';
  }

  /**
   * Process the OpenAI SSE stream
   */
  private async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const decoder = new TextDecoder();
    let fullText = '';
    const allAnnotations: Record<string, ChatAnnotation> = {};
    let responseId: string | undefined;
    let completed = false;
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) {
          callbacks.onComplete(fullText, allAnnotations, responseId);
          completed = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            callbacks.onComplete(fullText, allAnnotations, responseId);
            completed = true;
            break;
          }

          try {
            const data = JSON.parse(dataStr);

            // Capture response ID from first chunk
            if (data.id && !responseId) {
              responseId = data.id;
              callbacks.onResponseId(responseId as string);
            }

            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              callbacks.onTextDelta(delta, fullText);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }

        if (completed) break;
      }
    } finally {
      reader.releaseLock();

      if (signal?.aborted && !completed) {
        callbacks.onComplete(
          fullText || '*Response was stopped by user*',
          allAnnotations,
          responseId
        );
      }
    }
  }
}

/**
 * Create an OpenAI chat service instance
 */
export function createOpenAIChatService(
  config: OpenAIChatServiceConfig
): OpenAIChatService {
  return new OpenAIChatService(config);
}
