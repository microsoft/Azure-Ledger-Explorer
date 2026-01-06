/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Sidebar width constants for consistent sizing across the app.
 */
export const SIDEBAR_WIDTH = {
  expanded: 300,
  collapsed: 48,
} as const;

export type SidebarWidthType = typeof SIDEBAR_WIDTH;
