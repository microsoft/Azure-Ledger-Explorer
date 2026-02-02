/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { UIAction } from '../../../types/chat-types';

/**
 * Context passed to action handlers
 */
export interface ActionContext {
  /** Database instance for SQL queries */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database?: any;
  /** Function to get/initialize the database */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDatabase?: () => Promise<any>;
  /** Verification service for ledger verification */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verification?: any;
  /** Function to download MST files */
  downloadMstFiles?: (domain: string) => Promise<void>;
}

/**
 * Result from executing an action
 */
export interface ActionResult {
  /** The result data from the action */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  /** Error message if the action failed */
  error?: string;
}

/**
 * Handler function for an action
 */
export type ActionHandler = (
  content: string | undefined,
  context: ActionContext
) => Promise<ActionResult>;

/**
 * Registry of action handlers
 */
const actionHandlers = new Map<string, ActionHandler>();

/**
 * Register an action handler
 * @param actionName - The name of the action (e.g., 'runsql', 'verifyledger')
 * @param handler - The handler function to execute for this action
 */
export function registerAction(actionName: string, handler: ActionHandler): void {
  actionHandlers.set(actionName.toLowerCase(), handler);
}

/**
 * Check if an action handler is registered
 */
export function hasAction(actionName: string): boolean {
  return actionHandlers.has(actionName.toLowerCase());
}

/**
 * Execute a registered action
 * @param action - The action to execute
 * @param context - The context containing dependencies
 * @returns The result of the action execution
 */
export async function executeAction(
  action: UIAction,
  context: ActionContext
): Promise<ActionResult> {
  const handler = actionHandlers.get(action.actionName.toLowerCase());
  
  if (!handler) {
    return { error: `Unknown action: ${action.actionName}` };
  }
  
  try {
    return await handler(action.actionContent, context);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : `Action ${action.actionName} failed`,
    };
  }
}

/**
 * Execute multiple actions in sequence
 * @param actions - Array of actions to execute
 * @param context - The context containing dependencies
 * @returns The actions with results/errors populated
 */
export async function executeActions(
  actions: UIAction[],
  context: ActionContext
): Promise<UIAction[]> {
  for (const action of actions) {
    const result = await executeAction(action, context);
    action.actionResult = result.result;
    action.actionError = result.error;
  }
  return actions;
}

/**
 * Extract actions from a message content
 * @param content - The message content to parse
 * @returns Array of extracted actions
 */
export function extractActions(content: string): UIAction[] {
  const actionRegex = /```action:([a-zA-Z_][a-zA-Z0-9_]*)\n([\s\S]*?)```/g;
  const actions: UIAction[] = [];
  const trackDuplicates = new Set<string>();

  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    const actionName = match[1].trim();
    const actionContent = match[2].trim();
    const actionKey = `${actionName}:${actionContent}`;
    
    // LLM sometimes generates duplicate actions
    if (!trackDuplicates.has(actionKey)) {
      trackDuplicates.add(actionKey);
      actions.push({ actionName, actionContent });
    }
  }

  return actions;
}

/**
 * Get all registered action names
 */
export function getRegisteredActions(): string[] {
  return Array.from(actionHandlers.keys());
}

/**
 * Clear all registered actions (useful for testing)
 */
export function clearActions(): void {
  actionHandlers.clear();
}
