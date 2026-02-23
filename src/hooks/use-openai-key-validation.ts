/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface OpenAIKeyValidationResult {
  valid: boolean;
  models?: string[];
  error?: string;
}

/** Debounce delay in ms before validating the key */
const VALIDATION_DEBOUNCE_MS = 800;

/**
 * Hook to validate an OpenAI API key by calling the /v1/models endpoint.
 * Debounces input so validation only fires after the user stops typing.
 */
export const useOpenAIKeyValidation = (apiKey: string) => {
  const [debouncedKey, setDebouncedKey] = useState(apiKey);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(apiKey), VALIDATION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [apiKey]);

  return useQuery<OpenAIKeyValidationResult>({
    queryKey: ['openai-key-validation', debouncedKey],
    queryFn: async (): Promise<OpenAIKeyValidationResult> => {
      if (!debouncedKey || debouncedKey.length < 10) {
        return { valid: false, error: 'API key is too short' };
      }

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            return { valid: false, error: 'Invalid API key' };
          }
          return { valid: false, error: `API error: ${response.status}` };
        }

        const data = await response.json();
        const modelIds = (data.data || [])
          .map((m: { id: string }) => m.id)
          .filter((id: string) => id.startsWith('gpt-') || id.startsWith('o'));

        return { valid: true, models: modelIds };
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Failed to validate key',
        };
      }
    },
    enabled: !!debouncedKey && debouncedKey.length >= 10,
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
