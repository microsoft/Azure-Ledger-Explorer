/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Chat-related constants
 * 
 * Rate limit calculations:
 * - Max tokens: 720K per minute
 * - Rough limit: 720k * 4 = 2.88M characters
 * - Assuming 10 parallel clients: 288k characters per minute
 * - If one request takes ~10 sec: 288k / 6 = 48k characters per request
 */

/** Maximum input length in characters */
export const MAX_INPUT_LENGTH = 48000;

/** Maximum output tokens for AI response */
export const MAX_OUTPUT_TOKENS = 2000;

/** AI temperature setting (0 = more deterministic) */
export const AI_TEMPERATURE = 0.0;

/** LocalStorage key for persisting chat messages */
export const MESSAGES_STORAGE_KEY = 'ccf-chat-messages';
