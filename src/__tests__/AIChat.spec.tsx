/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIChat } from '../components/AIChat';
import type { ChatMessage } from '../types/chat-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('AIChat component', () => {
  it('renders empty chat', () => {
    render(<QueryClientProvider client={new QueryClient()}><AIChat loadedMessages={[]}  /></QueryClientProvider>);
    expect(screen.getByText(/Sage/i)).toBeInTheDocument();
  });
  it('renders message with references and no link', () => {
    const testMsg: ChatMessage = {
      id: Date.now().toString(),
      state: 'finished',
      role: 'user',
      content: 'foobar',
      timestamp: new Date(),
      annotations: {
        "fileidxxxx": {
          file_id: 'fileidxxxx',
          filename: 'filename.txt',
          refs: [1, 2],
        } 
      },
    };
    render(<QueryClientProvider client={new QueryClient()}><AIChat loadedMessages={[testMsg]}  /></QueryClientProvider>);
    /**
    <span class="fui-Text" >
      References:
    </span>
    <ul class="">
      <li class="">
        [1], [2]
        filename.txt
      </li>
    </ul>
     */
    expect(screen.getByText(/References:/i)).toBeInTheDocument();
    expect(screen.getByText(/\[1\], \[2\]/i)).toBeInTheDocument();
    expect(screen.getByText(/filename.txt/i)).toBeInTheDocument();

    localStorage.setItem('chat_base_url', 'http://example.com');
    render(<QueryClientProvider client={new QueryClient()}><AIChat loadedMessages={[testMsg]}  /></QueryClientProvider>);
    expect((screen.getAllByRole('link').at(0) as HTMLAnchorElement).href).toBe('http://example.com/docs/file/download/ZmlsZW5hbWUudHh0');
  });
});
