/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/** Maximum input length in characters */
export const MAX_INPUT_LENGTH = 48000;

/** Maximum output tokens for AI response */
export const MAX_OUTPUT_TOKENS = 16000;

/** LocalStorage key for persisting chat messages (Sage) */
export const MESSAGES_STORAGE_KEY = 'ccf-chat-messages';

/** LocalStorage key for persisting chat messages (OpenAI / CCF Ledger Chat) */
export const OPENAI_MESSAGES_STORAGE_KEY = 'ccf-ledger-chat-messages';

/** LocalStorage key for OpenAI API key */
export const OPENAI_API_KEY_STORAGE_KEY = 'openai_api_key';

/** LocalStorage key for OpenAI model selection */
export const OPENAI_MODEL_STORAGE_KEY = 'openai_model';

/** LocalStorage key for chat enabled setting */
export const CHAT_ENABLED_STORAGE_KEY = 'chat_enabled';

/** Default OpenAI model */
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

/** Available OpenAI models for selection */
export const OPENAI_MODELS = [
  { key: 'gpt-4o-mini', label: 'GPT-4o Mini (recommended)' },
  { key: 'gpt-4o', label: 'GPT-4o' },
  { key: 'o4-mini', label: 'o4-mini' },
] as const;
