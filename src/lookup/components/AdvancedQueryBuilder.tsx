/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { Button, Checkbox, Field, Input, Select, Text, makeStyles, tokens } from '@fluentui/react-components';
import type { IndexField, QueryNode, QueryOperator } from '../types/lookup-types';
import { MAX_QUERY_DEPTH, newCondition, newGroup } from '../utils/advanced-query';

const useStyles = makeStyles({
  group: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: tokens.colorNeutralBackground2,
    minWidth: 0,
  },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' },
  condition: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '8px' },
  value: { flex: '1 1 220px' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
});

const OPERATORS: Record<QueryOperator, string> = {
  eq: 'Equals', contains: 'Contains', startswith: 'Starts with', endswith: 'Ends with',
};

interface NodeEditorProps {
  node: QueryNode;
  depth: number;
  path: string;
  onChange: (node: QueryNode) => void;
  onRemove?: () => void;
}

function NodeEditor({ node, depth, path, onChange, onRemove }: NodeEditorProps) {
  const styles = useStyles();
  const negate = <Checkbox label="NOT" checked={node.negated} onChange={(_, data) => onChange({ ...node, negated: data.checked === true })} aria-label={`Negate ${path}`} />;
  const remove = onRemove && <Button appearance="subtle" onClick={onRemove} aria-label={`Remove ${path}`}>Remove</Button>;
  if (node.kind === 'condition') {
    return (
      <div className={styles.condition} role="group" aria-label={path}>
        <Field label="Field">
          <Select value={node.field} aria-label={`Field ${path}`} onChange={(_, data) => {
            const field = data.value as IndexField;
            onChange({ ...node, field, operator: field === 'payloadHash' ? 'eq' : node.operator });
          }}>
            <option value="issuer">Issuer</option>
            <option value="subject">Subject</option>
            <option value="payloadHash">Payload hash</option>
          </Select>
        </Field>
        <Field label="Comparison">
          <Select value={node.operator} aria-label={`Comparison ${path}`} onChange={(_, data) => onChange({ ...node, operator: data.value as QueryOperator })}>
            {Object.entries(OPERATORS).filter(([key]) => node.field !== 'payloadHash' || key === 'eq').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Value" className={styles.value}>
          <Input value={node.value} aria-label={`Value ${path}`} placeholder={node.field === 'payloadHash' ? '64 hex characters' : 'Case-sensitive text'} onChange={(_, data) => onChange({ ...node, value: data.value })} />
        </Field>
        {negate}
        {remove}
      </div>
    );
  }
  return (
    <div className={styles.group} role="group" aria-label={path}>
      <div className={styles.row}>
        <Select value={node.match} aria-label={`Match ${path}`} onChange={(_, data) => onChange({ ...node, match: data.value === 'all' ? 'all' : 'any' })}>
          <option value="all">Match all (AND)</option>
          <option value="any">Match any (OR)</option>
        </Select>
        {negate}
        {remove}
      </div>
      {node.children.map((child, index) => (
        <NodeEditor
          key={index}
          node={child}
          depth={depth + 1}
          path={`${path}.${index + 1}`}
          onChange={(next) => onChange({ ...node, children: node.children.map((item, i) => i === index ? next : item) })}
          onRemove={node.children.length > 1 ? () => onChange({ ...node, children: node.children.filter((_, i) => i !== index) }) : undefined}
        />
      ))}
      <div className={styles.actions}>
        <Button disabled={depth >= MAX_QUERY_DEPTH} onClick={() => onChange({ ...node, children: [...node.children, newCondition()] })}>Add condition</Button>
        <Button disabled={depth >= MAX_QUERY_DEPTH - 1} onClick={() => onChange({ ...node, children: [...node.children, newGroup()] })}>Add group</Button>
      </div>
    </div>
  );
}

export function AdvancedQueryBuilder({ root, onChange }: { root: QueryNode; onChange: (root: QueryNode) => void }): React.JSX.Element {
  return (
    <>
      <Text size={200}>Combine index filters with AND / OR. NOT excludes a condition or an entire group. Text comparisons are case-sensitive.</Text>
      <NodeEditor node={root} depth={1} path="query" onChange={onChange} />
    </>
  );
}
