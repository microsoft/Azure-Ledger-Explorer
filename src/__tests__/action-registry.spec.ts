/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  registerAction, 
  hasAction, 
  executeAction, 
  executeActions,
  extractActions,
  clearActions
} from '../services/chat/actions/action-registry';
import type { UIAction } from '../types/chat-types';

describe('Action Registry', () => {
  beforeEach(() => {
    // Clear all registered actions for test isolation
    clearActions();
    
    // Register a test action before each test
    registerAction('testaction', async (content) => {
      return { result: `Executed: ${content}` };
    });
  });

  describe('registerAction', () => {
    it('registers an action handler', () => {
      registerAction('myaction', async () => ({ result: 'ok' }));
      expect(hasAction('myaction')).toBe(true);
    });

    it('is case-insensitive', () => {
      registerAction('CaseSensitive', async () => ({ result: 'ok' }));
      expect(hasAction('casesensitive')).toBe(true);
      expect(hasAction('CASESENSITIVE')).toBe(true);
    });
  });

  describe('hasAction', () => {
    it('returns true for registered actions', () => {
      expect(hasAction('testaction')).toBe(true);
    });

    it('returns false for unregistered actions', () => {
      expect(hasAction('nonexistent')).toBe(false);
    });
  });

  describe('executeAction', () => {
    it('executes a registered action', async () => {
      const action: UIAction = {
        actionName: 'testaction',
        actionContent: 'test content'
      };
      
      const result = await executeAction(action, {});
      
      expect(result.result).toBe('Executed: test content');
      expect(result.error).toBeUndefined();
    });

    it('returns error for unknown actions', async () => {
      const action: UIAction = {
        actionName: 'unknownaction',
        actionContent: 'content'
      };
      
      const result = await executeAction(action, {});
      
      expect(result.error).toBe('Unknown action: unknownaction');
    });

    it('handles action errors gracefully', async () => {
      registerAction('failingaction', async () => {
        throw new Error('Action failed!');
      });
      
      const action: UIAction = {
        actionName: 'failingaction',
        actionContent: 'content'
      };
      
      const result = await executeAction(action, {});
      
      expect(result.error).toBe('Action failed!');
    });

    it('passes context to action handlers', async () => {
      const mockDatabase = { query: vi.fn() };
      
      registerAction('contextaction', async (_content, context) => {
        return { result: context.database ? 'has database' : 'no database' };
      });
      
      const action: UIAction = {
        actionName: 'contextaction',
        actionContent: ''
      };
      
      const result = await executeAction(action, { database: mockDatabase });
      
      expect(result.result).toBe('has database');
    });
  });

  describe('executeActions', () => {
    it('executes multiple actions in sequence', async () => {
      const actions: UIAction[] = [
        { actionName: 'testaction', actionContent: 'first' },
        { actionName: 'testaction', actionContent: 'second' }
      ];
      
      const results = await executeActions(actions, {});
      
      expect(results[0].actionResult).toBe('Executed: first');
      expect(results[1].actionResult).toBe('Executed: second');
    });

    it('populates errors for failed actions', async () => {
      registerAction('failaction', async () => {
        throw new Error('Oops!');
      });
      
      const actions: UIAction[] = [
        { actionName: 'testaction', actionContent: 'works' },
        { actionName: 'failaction', actionContent: 'fails' }
      ];
      
      const results = await executeActions(actions, {});
      
      expect(results[0].actionResult).toBe('Executed: works');
      expect(results[0].actionError).toBeUndefined();
      expect(results[1].actionError).toBe('Oops!');
    });
  });

  describe('extractActions', () => {
    it('extracts action blocks from message text', () => {
      const text = 'Here is a query:\n```action:runsql\nSELECT * FROM users\n```\nDone!';
      
      const actions = extractActions(text);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].actionName).toBe('runsql');
      expect(actions[0].actionContent).toBe('SELECT * FROM users');
    });

    it('extracts multiple actions', () => {
      const text = '```action:runsql\nquery1\n```\ntext\n```action:verifyledger\nverify\n```';
      
      const actions = extractActions(text);
      
      expect(actions).toHaveLength(2);
      expect(actions[0].actionName).toBe('runsql');
      expect(actions[1].actionName).toBe('verifyledger');
    });

    it('returns empty array when no actions', () => {
      const text = 'Just some regular text with ```code blocks```';
      
      const actions = extractActions(text);
      
      expect(actions).toHaveLength(0);
    });

    it('handles actions without content', () => {
      const text = '```action:importmst\n\n```';
      
      const actions = extractActions(text);
      
      expect(actions).toHaveLength(1);
      expect(actions[0].actionName).toBe('importmst');
      expect(actions[0].actionContent).toBe('');
    });

    it('deduplicates identical actions', () => {
      const text = '```action:runsql\nSELECT 1\n```\n```action:runsql\nSELECT 1\n```';
      
      const actions = extractActions(text);
      
      expect(actions).toHaveLength(1);
    });
  });
});
