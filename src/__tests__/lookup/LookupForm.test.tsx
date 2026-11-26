/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LookupForm } from '../../lookup/components/LookupForm';
import { newGroup, parseAdvancedQuery, queryFilter, serializeQuery } from '../../lookup/utils/advanced-query';

describe('advanced lookup form', () => {
  it('lets shared condition roots expand without changing their negation or ordering', () => {
    const submit = vi.fn();
    const root = { kind: 'condition' as const, field: 'subject' as const, operator: 'contains' as const, value: 'maa', negated: true };
    render(<LookupForm initialLedger="my-ledger" initialEntry={{ by: 'advanced', value: serializeQuery({ version: 1, root, order: 'oldest' }) }} busy={false} onSubmit={submit} />);
    expect(screen.getByLabelText('Negate query')).not.toBeChecked();
    expect(screen.getByLabelText('Negate query.1')).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Oldest first' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    fireEvent.change(screen.getByLabelText('Value query.2'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
    fireEvent.change(screen.getByLabelText('Value query.3.1'), { target: { value: 'release' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(submit).toHaveBeenCalledOnce();
    const query = parseAdvancedQuery(submit.mock.calls[0][1].value);
    expect(query.order).toBe('oldest');
    expect(queryFilter(query)).toBe("((not (contains(Subject,'maa')) and contains(Subject,'test') and (contains(Subject,'release'))))");
  });

  it('does not duplicate control IDs and toggles NOT through its visible label', () => {
    render(<LookupForm initialLedger="my-ledger" initialEntry={null} busy={false} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'advanced' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
    const group = screen.getByRole('group', { name: 'Advanced index query' });
    const ids = [...group.querySelectorAll('input[id], select[id]')].map((control) => control.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of within(group).getAllByText('NOT', { selector: 'label' })) {
      const control = document.getElementById(label.getAttribute('for') ?? '');
      expect(control).toHaveAttribute('type', 'checkbox');
      expect(control).not.toBeChecked();
      fireEvent.click(label);
      expect(control).toBeChecked();
    }
    expect(screen.getByLabelText('Match query')).toHaveValue('all');
    expect(screen.getByLabelText('Match query.2')).toHaveValue('all');
  });

  it('offers oldest first only in advanced mode and preserves it when editing', () => {
    const submit = vi.fn();
    render(<LookupForm initialLedger="my-ledger" initialEntry={null} busy={false} onSubmit={submit} />);
    expect(screen.queryByRole('checkbox', { name: 'Oldest first' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'advanced' } });
    const checkbox = screen.getByRole('checkbox', { name: 'Oldest first' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText('Value query.1'), { target: { value: 'maa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(parseAdvancedQuery(submit.mock.calls[0][1].value).order).toBe('oldest');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(parseAdvancedQuery(submit.mock.calls[1][1].value).order).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'subject' } });
    expect(screen.queryByRole('checkbox', { name: 'Oldest first' })).not.toBeInTheDocument();
  });

  it('restores the checkbox from a shared oldest-first query', () => {
    const root = newGroup();
    if (root.kind === 'group' && root.children[0].kind === 'condition') root.children[0].value = 'maa';
    render(<LookupForm initialLedger="my-ledger" initialEntry={{ by: 'advanced', value: serializeQuery({ version: 1, root, order: 'oldest' }) }} busy={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Oldest first' })).toBeChecked();
  });

  it('builds a nested query, removes conditions and submits a shareable expression', () => {
    const submit = vi.fn();
    render(<LookupForm initialLedger="my-ledger" initialEntry={null} busy={false} onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'advanced' } });
    fireEvent.change(screen.getByLabelText('Field query.1'), { target: { value: 'issuer' } });
    fireEvent.change(screen.getByLabelText('Value query.1'), { target: { value: 'did:x509' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
    fireEvent.change(screen.getByLabelText('Match query.2'), { target: { value: 'any' } });
    fireEvent.change(screen.getByLabelText('Value query.2.1'), { target: { value: 'maa' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'query.2' })).getByRole('button', { name: 'Add condition' }));
    fireEvent.change(screen.getByLabelText('Value query.2.2'), { target: { value: 'potomac' } });
    fireEvent.click(screen.getByLabelText('Negate query.2'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove query.2.1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0]).toBe('my-ledger');
    const entry = submit.mock.calls[0][1];
    expect(entry.by).toBe('advanced');
    expect(queryFilter(parseAdvancedQuery(entry.value))).toBe("((contains(Issuer,'did:x509') and not ((contains(Subject,'potomac')))))");
  });

  it('does not submit incomplete conditions and restricts payload hash operators', () => {
    const submit = vi.fn();
    render(<LookupForm initialLedger="my-ledger" initialEntry={null} busy={false} onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'advanced' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText(/Each condition needs a value/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Field query.1'), { target: { value: 'payloadHash' } });
    expect(within(screen.getByLabelText('Comparison query.1')).getAllByRole('option')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Value query.1'), { target: { value: 'AB'.repeat(32) } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it('shows malformed shared-query errors and lets the user repair the query', () => {
    const submit = vi.fn();
    render(<LookupForm initialLedger="my-ledger" initialEntry={{ by: 'advanced', value: 'invalid' }} initialTouched busy={false} onSubmit={submit} />);
    expect(screen.getByText(/Unexpected token/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Value query.1'), { target: { value: 'maa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(submit).toHaveBeenCalledOnce();
  });
});
