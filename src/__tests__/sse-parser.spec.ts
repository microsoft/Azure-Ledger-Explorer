/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseSSEChunk } from '../services/chat/sse-parser';

describe('SSE Parser', () => {
  describe('parseSSEChunk', () => {
    it('parses text delta events', () => {
      const chunk = 'data: {"type":"response.output_text.delta","delta":"Hello"}\n';
      const result = parseSSEChunk(chunk, {});
      
      expect(result.textDelta).toBe('Hello');
      expect(result.responseId).toBeUndefined();
      expect(Object.keys(result.annotations)).toHaveLength(0);
    });

    it('accumulates multiple text deltas', () => {
      const chunk = `data: {"type":"response.output_text.delta","delta":"Hello "}\ndata: {"type":"response.output_text.delta","delta":"World"}\n`;
      const result = parseSSEChunk(chunk, {});
      
      expect(result.textDelta).toBe('Hello World');
    });

    it('parses annotation events', () => {
      const chunk = 'data: {"type":"response.output_text.annotation.added","annotation_index":0,"annotation":{"file_id":"file123","filename":"test.pdf"}}\n';
      const annotations = {};
      const result = parseSSEChunk(chunk, annotations);
      
      expect(result.textDelta).toBe(' [1]');
      expect(result.annotations['file123']).toEqual({
        file_id: 'file123',
        filename: 'test.pdf',
        refs: [1]
      });
    });

    it('accumulates multiple refs for same file', () => {
      const annotations = {
        'file123': { file_id: 'file123', filename: 'test.pdf', refs: [1] }
      };
      const chunk = 'data: {"type":"response.output_text.annotation.added","annotation_index":1,"annotation":{"file_id":"file123","filename":"test.pdf"}}\n';
      const result = parseSSEChunk(chunk, annotations);
      
      expect(result.annotations['file123'].refs).toEqual([1, 2]);
    });

    it('handles response completed events', () => {
      const chunk = 'data: {"type":"response.completed","response":{"id":"resp_123"}}\n';
      const result = parseSSEChunk(chunk, {});
      
      expect(result.responseId).toBe('resp_123');
    });

    it('handles file search output items', () => {
      const chunk = 'data: {"type":"response.output_item.added","item":{"type":"file_search_call"}}\n';
      const result = parseSSEChunk(chunk, {});
      
      expect(result.textDelta).toContain('Searching for files');
    });

    it('ignores [DONE] marker', () => {
      const chunk = 'data: [DONE]\n';
      const result = parseSSEChunk(chunk, {});
      
      expect(result.textDelta).toBe('');
      expect(result.responseId).toBeUndefined();
    });

    it('handles malformed JSON gracefully', () => {
      // Suppress expected console.error output during this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const chunk = 'data: {invalid json}\n';
      const result = parseSSEChunk(chunk, {});
      
      expect(result.textDelta).toBe('');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('ignores non-data lines', () => {
      const chunk = 'event: message\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n';
      const result = parseSSEChunk(chunk, {});
      
      expect(result.textDelta).toBe('Hello');
    });

    it('handles empty chunks', () => {
      const result = parseSSEChunk('', {});
      
      expect(result.textDelta).toBe('');
      expect(result.annotations).toEqual({});
    });

    it('buffers incomplete lines across chunks', () => {
      // First chunk ends with incomplete line
      const chunk1 = 'data: {"type":"response.output_text.delta","delta":"Hel';
      const result1 = parseSSEChunk(chunk1, {});
      
      expect(result1.textDelta).toBe('');
      expect(result1.remainingBuffer).toBe(chunk1);
      
      // Second chunk completes the line
      const chunk2 = 'lo"}\n';
      const result2 = parseSSEChunk(chunk2, {}, result1.remainingBuffer);
      
      expect(result2.textDelta).toBe('Hello');
      expect(result2.remainingBuffer).toBe('');
    });

    it('buffers partial JSON across multiple chunks', () => {
      // First chunk has partial JSON
      const chunk1 = 'data: {"type":"response.output_text.delta","del';
      const result1 = parseSSEChunk(chunk1, {});
      
      expect(result1.textDelta).toBe('');
      expect(result1.remainingBuffer).toBe(chunk1);
      
      // Second chunk continues but still incomplete
      const chunk2 = 'ta":"Hello ';
      const result2 = parseSSEChunk(chunk2, {}, result1.remainingBuffer);
      
      expect(result2.textDelta).toBe('');
      expect(result2.remainingBuffer).toBe(chunk1 + chunk2);
      
      // Third chunk completes the line
      const chunk3 = 'World"}\n';
      const result3 = parseSSEChunk(chunk3, {}, result2.remainingBuffer);
      
      expect(result3.textDelta).toBe('Hello World');
      expect(result3.remainingBuffer).toBe('');
    });

    it('handles complete lines even when previous chunk had buffer', () => {
      // First chunk with buffer
      const chunk1 = 'data: {"type":"response.output_text.delta","delta":"First"}\ndata: {"type":"response';
      const result1 = parseSSEChunk(chunk1, {});
      
      expect(result1.textDelta).toBe('First');
      expect(result1.remainingBuffer).toBe('data: {"type":"response');
      
      // Second chunk completes previous and adds new complete line
      const chunk2 = '.output_text.delta","delta":"Second"}\ndata: {"type":"response.output_text.delta","delta":"Third"}\n';
      const result2 = parseSSEChunk(chunk2, {}, result1.remainingBuffer);
      
      expect(result2.textDelta).toBe('SecondThird');
      expect(result2.remainingBuffer).toBe('');
    });
  });
});
