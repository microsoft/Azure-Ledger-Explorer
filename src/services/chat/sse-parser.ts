/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatAnnotation } from '../../types/chat-types';

/**
 * Result of parsing a single SSE chunk
 */
export interface SSEParseResult {
  /** Text delta to append to the message */
  textDelta: string;
  /** Response ID if response completed */
  responseId?: string;
  /** New annotations discovered */
  annotations: Record<string, ChatAnnotation>;
  /** Leftover partial line to prepend to next chunk */
  remainingBuffer?: string;
}

/**
 * SSE event types from the OpenAI-compatible API
 */
export type SSEEventType =
  | 'response.output_text.delta'
  | 'response.output_text.annotation.added'
  | 'response.output_item.added'
  | 'response.completed';

const SSE_DATA_PREFIX = 'data: ';

/**
 * Parse a single SSE data line into structured data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSSELine(line: string): any | null {
  if (!line.startsWith(SSE_DATA_PREFIX)) {
    return null;
  }
  
  const dataString = line.slice(SSE_DATA_PREFIX.length).trim();
  if (!dataString || dataString === '[DONE]') {
    return null;
  }
  
  try {
    return JSON.parse(dataString);
  } catch (error) {
    console.error('Error parsing SSE data:', dataString, 'error:', error);
    return null;
  }
}

/**
 * Process an annotation event and return updated text delta and annotation
 */
function processAnnotationEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  annotations: Record<string, ChatAnnotation>
): string {
  if (data.annotation_index < 0) {
    return '';
  }
  
  const annotationRef = data.annotation_index + 1;
  const fileId = data.annotation.file_id;
  
  if (!annotations[fileId]) {
    annotations[fileId] = {
      file_id: fileId,
      filename: data.annotation.filename,
      refs: [annotationRef]
    };
  } else {
    const existing = annotations[fileId];
    if (existing) {
      existing.refs = existing.refs || [];
      existing.refs.push(annotationRef);
    }
  }
  
  return ` [${annotationRef}]`;
}

/**
 * Process an output item added event (tools, file search, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processOutputItemEvent(data: any): string {
  const itemType = data.item?.type;
  
  if (itemType === 'mcp_list_tools' || itemType === 'message') {
    return '';
  }
  
  if (itemType === 'file_search_call') {
    return '\n> Searching for files ...\n\n';
  }
  
  if (itemType === 'mcp_call') {
    const args = data.item.arguments ? ' with: ' + JSON.stringify(data.item.arguments) : '';
    return `\n> Calling: ${data.item.server_label}:${data.item.name}${args}\n\n`;
  }
  
  return `\n> Using: ${itemType}\n\n`;
}

/**
 * Parse a chunk of SSE data and extract text deltas, annotations, and response ID
 * @param chunk - The raw chunk to parse
 * @param existingAnnotations - Previously discovered annotations
 * @param buffer - Partial line from previous chunk (optional)
 * @returns Parse result including any remaining buffer
 */
export function parseSSEChunk(
  chunk: string, 
  existingAnnotations: Record<string, ChatAnnotation> = {},
  buffer = ''
): SSEParseResult {
  // Prepend any buffered partial line from previous chunk
  const fullChunk = buffer + chunk;
  const lines = fullChunk.split('\n');
  
  // The last element might be a partial line (no trailing newline)
  // If chunk ends with \n, the last element will be empty string and can be discarded
  const remainingBuffer = fullChunk.endsWith('\n') ? '' : lines.pop() || '';
  
  const annotations = { ...existingAnnotations };
  let textDelta = '';
  let responseId: string | undefined;
  
  for (const line of lines) {
    const data = parseSSELine(line);
    if (!data) continue;
    
    switch (data.type as SSEEventType) {
      case 'response.output_text.delta':
        textDelta += data.delta || '';
        break;
        
      case 'response.output_text.annotation.added':
        textDelta += processAnnotationEvent(data, annotations);
        break;
        
      case 'response.output_item.added':
        textDelta += processOutputItemEvent(data);
        break;
        
      case 'response.completed':
        responseId = data.response?.id;
        break;
    }
  }
  
  return { textDelta, responseId, annotations, remainingBuffer };
}

/**
 * Create a streaming reader that processes SSE chunks
 */
export function createSSEReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (result: SSEParseResult) => void,
  signal?: AbortSignal
): Promise<{ fullText: string; annotations: Record<string, ChatAnnotation>; responseId?: string }> {
  const decoder = new TextDecoder();
  let fullText = '';
  let allAnnotations: Record<string, ChatAnnotation> = {};
  let finalResponseId: string | undefined;
  let buffer = ''; // Buffer for incomplete SSE lines
  
  const processStream = async (): Promise<{ fullText: string; annotations: Record<string, ChatAnnotation>; responseId?: string }> => {
    try {
      while (true) {
        if (signal?.aborted) {
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer
          if (buffer) {
            const finalResult = parseSSEChunk('', allAnnotations, buffer);
            fullText += finalResult.textDelta;
            allAnnotations = finalResult.annotations;
            if (finalResult.responseId) {
              finalResponseId = finalResult.responseId;
            }
            onChunk(finalResult);
          }
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const result = parseSSEChunk(chunk, allAnnotations, buffer);
        
        // Store any partial line for next iteration
        buffer = result.remainingBuffer || '';
        
        fullText += result.textDelta;
        allAnnotations = result.annotations;
        if (result.responseId) {
          finalResponseId = result.responseId;
        }
        
        onChunk(result);
      }
      
      return { fullText, annotations: allAnnotations, responseId: finalResponseId };
    } finally {
      reader.releaseLock();
    }
  };

  return processStream();
}
