/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIChat } from '../components/AIChat';
import type { ChatMessage } from '../types/chat-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const isSageEnabled = import.meta.env.VITE_ENABLE_SAGE === 'true';

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

describe('AIChat component', () => {
  it('renders empty chat', () => {
    render(<QueryClientProvider client={new QueryClient()}><AIChat loadedMessages={[]}  /></QueryClientProvider>);
    expect(screen.getByText(/Sage|CCF Ledger Chat/i)).toBeInTheDocument();
  });

  it('renders message with references', () => {
    render(<QueryClientProvider client={new QueryClient()}><AIChat loadedMessages={[testMsg]}  /></QueryClientProvider>);
    expect(screen.getByText(/References:/i)).toBeInTheDocument();
    expect(screen.getByText(/\[1\], \[2\]/i)).toBeInTheDocument();
    expect(screen.getByText(/filename.txt/i)).toBeInTheDocument();
  });

  it.skipIf(!isSageEnabled)('renders annotation download links when Sage base URL is configured', () => {
    localStorage.setItem('chat_base_url', 'http://example.com');
    render(<QueryClientProvider client={new QueryClient()}><AIChat loadedMessages={[testMsg]}  /></QueryClientProvider>);
    expect((screen.getAllByRole('link').at(0) as HTMLAnchorElement).href).toBe('http://example.com/docs/file/download/ZmlsZW5hbWUudHh0');
    localStorage.removeItem('chat_base_url');
  });
});
