/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { ChatMessage } from './chat-types';

export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  /** User-pinned to the top of the Recents list. */
  pinned?: boolean;
}
