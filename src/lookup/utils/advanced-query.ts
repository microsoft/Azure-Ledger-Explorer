/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import type { AdvancedQuery, IndexField, QueryNode, QueryOperator } from '../types/lookup-types';

export const MAX_QUERY_DEPTH = 4;
// The server allows 50 OData nodes; reserve four for the pagination predicate.
export const MAX_QUERY_NODES = 46;
export const MAX_QUERY_LENGTH = 12_000;

export function newCondition(): QueryNode {
  return { kind: 'condition', field: 'subject', operator: 'contains', value: '', negated: false };
}

export function newGroup(): QueryNode {
  return { kind: 'group', match: 'all', children: [newCondition()], negated: false };
}

/** Validate untrusted URL data and return a canonical, allowlisted expression. */
export function validateQuery(input: unknown): AdvancedQuery {
  let nodes = 0;
  function visit(value: unknown, depth: number): QueryNode {
    if (depth > MAX_QUERY_DEPTH) throw new Error(`Queries may be at most ${MAX_QUERY_DEPTH} levels deep.`);
    if (!value || typeof value !== 'object') throw new Error('Invalid query expression.');
    const node = value as Record<string, unknown>;
    if (typeof node.negated !== 'boolean') throw new Error('Invalid NOT setting.');
    let result: QueryNode;
    if (node.kind === 'group') {
      if (node.match !== 'all' && node.match !== 'any') throw new Error('Invalid group operator.');
      if (!Array.isArray(node.children) || node.children.length === 0) throw new Error('Each group needs at least one condition.');
      if (node.children.length > MAX_QUERY_NODES) throw new Error('Too many query conditions.');
      nodes += node.children.length - 1;
      result = { kind: 'group', match: node.match, negated: node.negated, children: node.children.map((child) => visit(child, depth + 1)) };
    } else if (node.kind === 'condition') {
      if (typeof node.field !== 'string' || !['issuer', 'subject', 'payloadHash'].includes(node.field)) throw new Error('Invalid query field.');
      if (typeof node.operator !== 'string' || !['eq', 'contains', 'startswith', 'endswith'].includes(node.operator)) throw new Error('Invalid comparison operator.');
      if (typeof node.value !== 'string' || !node.value.trim() || node.value.trim().length > 1024) {
        throw new Error('Each condition needs a value of 1 to 1024 characters.');
      }
      const field = node.field as IndexField;
      const operator = node.operator as QueryOperator;
      let text = node.value.trim();
      if (field === 'payloadHash') {
        if (operator !== 'eq') throw new Error('Payload hash supports equality only.');
        if (!/^[0-9a-f]{64}$/i.test(text)) throw new Error('Payload hash must be 64 hexadecimal characters.');
        text = text.toLowerCase();
      }
      nodes += 3;
      result = { kind: 'condition', field, operator, value: text, negated: node.negated };
    } else {
      throw new Error('Invalid query expression.');
    }
    if (node.negated) nodes++;
    if (nodes > MAX_QUERY_NODES) throw new Error('Query is too complex; remove a condition, group or NOT.');
    return result;
  }
  if (!input || typeof input !== 'object' || (input as Record<string, unknown>).version !== 1) {
    throw new Error('Unsupported advanced-query version.');
  }
  const query = input as Record<string, unknown>;
  if (query.order !== undefined && query.order !== 'newest' && query.order !== 'oldest') {
    throw new Error('Invalid search order.');
  }
  return {
    version: 1,
    root: visit(query.root, 1),
    ...(query.order === 'oldest' ? { order: 'oldest' as const } : {}),
  };
}

export function parseAdvancedQuery(value: string): AdvancedQuery {
  if (value.length > MAX_QUERY_LENGTH) throw new Error('Advanced query URL is too long.');
  return validateQuery(JSON.parse(value));
}

export function serializeQuery(query: AdvancedQuery): string {
  const value = JSON.stringify(validateQuery(query));
  if (value.length > MAX_QUERY_LENGTH) throw new Error('Advanced query URL is too long.');
  return value;
}

export function queryFilter(query: AdvancedQuery): string {
  const fields: Record<IndexField, string> = { issuer: 'Issuer', subject: 'Subject', payloadHash: 'PayloadHash' };
  function compile(node: QueryNode): string {
    let expression: string;
    if (node.kind === 'group') {
      expression = `(${node.children.map(compile).join(node.match === 'all' ? ' and ' : ' or ')})`;
    } else {
      const literal = `'${node.value.replace(/'/g, "''")}'`;
      expression = node.operator === 'eq'
        ? `${fields[node.field]} eq ${literal}`
        : `${node.operator}(${fields[node.field]},${literal})`;
    }
    return node.negated ? `not (${expression})` : expression;
  }
  // Always wrap the entire query so a cursor cannot bind to just one OR arm.
  return `(${compile(validateQuery(query).root)})`;
}
