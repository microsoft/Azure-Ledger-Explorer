/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { useQuery } from '@tanstack/react-query';

interface Tool {
  name: string;
}

interface ToolsResponse {
  tools?: Tool[];
}

export const useTools = (baseUrl: string) => {
  return useQuery<ToolsResponse>({
    queryKey: ['tools', baseUrl],
    queryFn: async () => {
      if (!baseUrl) {
        return { tools: [] };
      }
      
      const url = baseUrl.endsWith('/') ? `${baseUrl}tools` : `${baseUrl}/tools`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!baseUrl,
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });
};
