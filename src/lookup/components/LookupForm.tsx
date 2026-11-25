/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState } from 'react';
import { Button, Checkbox, Field, Input, Select, Text, makeStyles, tokens } from '@fluentui/react-components';
import {
  Fingerprint20Regular,
  NumberSymbol20Regular,
  PersonTag20Regular,
  Search20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import type { EntryRef, SearchBy } from '../types/lookup-types';
import { parseEntry, parseLedgerName } from '../utils/lookup-verdict';
import { newGroup, parseAdvancedQuery, queryFilter, serializeQuery } from '../utils/advanced-query';
import { AdvancedQueryBuilder } from './AdvancedQueryBuilder';

const useStyles = makeStyles({
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: '12px',
  },
  ledger: { flex: '2 1 240px' },
  by: { flex: '0 0 170px' },
  value: { flex: '3 1 240px' },
  submit: { marginTop: '26px' },
  advanced: { flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 },
  preview: { fontFamily: tokens.fontFamilyMonospace, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 },
});

const INDEX_HINT = 'Searches the MST indexer; works only for ledgers onboarded to it.';

const SEARCH_TYPES: Record<SearchBy, { label: string; placeholder: string; invalid: string; hint?: string }> = {
  advanced: {
    label: 'Advanced search',
    placeholder: '',
    invalid: 'Complete the query conditions.',
    hint: INDEX_HINT,
  },
  txId: {
    label: 'Transaction ID',
    placeholder: 'e.g. 1217.321066',
    invalid: 'Use <view>.<seqno>, e.g. 1217.321066',
  },
  issuer: {
    label: 'Issuer',
    placeholder: 'e.g. did:x509:0:sha256:…',
    invalid: 'Enter part of an issuer',
    hint: `Matches any issuer containing this text (case-sensitive). ${INDEX_HINT}`,
  },
  subject: {
    label: 'Subject',
    placeholder: 'e.g. potomac',
    invalid: 'Enter part of a subject',
    hint: `Matches any subject containing this text (case-sensitive). ${INDEX_HINT}`,
  },
  payloadHash: {
    label: 'Payload hash',
    placeholder: '64 hex characters',
    invalid: 'Use a SHA-256 hash: 64 hexadecimal characters',
    hint: `SHA-256 of the statement's embedded payload, as shown on a result. ${INDEX_HINT}`,
  },
};

const SEARCH_ICONS: Record<SearchBy, React.ReactElement> = {
  advanced: <Search20Regular />,
  txId: <NumberSymbol20Regular />,
  issuer: <PersonTag20Regular />,
  subject: <Tag20Regular />,
  payloadHash: <Fingerprint20Regular />,
};

interface LookupFormProps {
  initialLedger: string;
  initialEntry: EntryRef | null;
  /** Show validation errors straight away, e.g. for an invalid shared link. */
  initialTouched?: boolean;
  busy: boolean;
  onSubmit: (ledger: string, entry: EntryRef) => void;
}

/**
 * The ledger, what to search by, and the value. Values are validated on
 * submit, so a user can paste a full ledger URL and have it reduced to the name.
 */
export const LookupForm: React.FC<LookupFormProps> = ({ initialLedger, initialEntry, initialTouched = false, busy, onSubmit }) => {
  const styles = useStyles();
  const [ledger, setLedger] = useState(initialLedger);
  const [by, setBy] = useState<SearchBy>(initialEntry?.by ?? 'txId');
  const [value, setValue] = useState(initialEntry?.value ?? '');
  const [touched, setTouched] = useState(initialTouched);
  const [advanced, setAdvanced] = useState(() => {
    try {
      const query = initialEntry?.by === 'advanced' ? parseAdvancedQuery(initialEntry.value) : null;
      return { root: query?.root ?? newGroup(), oldestFirst: query?.order === 'oldest', error: '' };
    } catch (error) {
      return { root: newGroup(), oldestFirst: false, error: error instanceof Error ? error.message : 'Invalid advanced query.' };
    }
  });
  let advancedValue: string | null = null;
  let preview = '';
  let advancedError = advanced.error;
  try {
    const query = { version: 1 as const, root: advanced.root, order: advanced.oldestFirst ? 'oldest' as const : 'newest' as const };
    advancedValue = serializeQuery(query);
    preview = queryFilter(query);
  } catch (error) {
    advancedError ||= error instanceof Error ? error.message : 'Invalid advanced query.';
  }

  const parsedLedger = parseLedgerName(ledger);
  const parsedValue = by === 'advanced' ? (advancedError ? null : advancedValue) : parseEntry(by, value);
  const type = SEARCH_TYPES[by];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (parsedLedger && parsedValue) {
      setLedger(parsedLedger);
      onSubmit(parsedLedger, { by, value: parsedValue });
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} aria-label="Look up a transparent statement">
      <Field
        className={styles.ledger}
        label="Ledger name"
        validationState={touched && !parsedLedger ? 'error' : 'none'}
        validationMessage={touched && !parsedLedger ? 'Enter a ledger name or its confidential-ledger.azure.com host' : undefined}
      >
        <Input value={ledger} onChange={(_, d) => setLedger(d.value)} placeholder="e.g. esrp-cts-cp" />
      </Field>
      <Field className={styles.by} label="Search by">
        <Select value={by} onChange={(_, d) => setBy(d.value as SearchBy)}>
          {(Object.keys(SEARCH_TYPES) as SearchBy[]).map((key) => (
            <option key={key} value={key}>{SEARCH_TYPES[key].label}</option>
          ))}
        </Select>
      </Field>
      {by !== 'advanced' && <Field
        className={styles.value}
        label={type.label}
        hint={type.hint}
        validationState={touched && !parsedValue ? 'error' : 'none'}
        validationMessage={touched && !parsedValue ? type.invalid : undefined}
      >
        <Input
          value={value}
          onChange={(_, d) => setValue(d.value)}
          placeholder={type.placeholder}
          contentBefore={SEARCH_ICONS[by]}
        />
      </Field>}
      {by === 'advanced' && (
        <div className={styles.advanced}>
          <Field label="Advanced index query" hint={INDEX_HINT} validationState={advancedError && (touched || advanced.error) ? 'error' : 'none'} validationMessage={touched || advanced.error ? advancedError : undefined}>
            <AdvancedQueryBuilder root={advanced.root} onChange={(root) => setAdvanced({ ...advanced, root, error: '' })} />
          </Field>
          <Field hint="Order by ledger sequence number, not signing time. Unchecked shows newest first.">
            <Checkbox label="Oldest first" checked={advanced.oldestFirst} onChange={(_, data) => setAdvanced({ ...advanced, oldestFirst: data.checked === true })} />
          </Field>
          {preview && (
            <details>
              <summary>OData filter preview</summary>
              <pre className={styles.preview}>{preview}</pre>
            </details>
          )}
          <Text size={200}>Up to four levels of nesting. Complex queries are limited to the indexer&apos;s filter budget; results are verified only when opened.</Text>
        </div>
      )}
      <Button
        className={by === 'advanced' ? undefined : styles.submit}
        appearance="primary"
        type="submit"
        icon={<Search20Regular />}
        disabled={busy}
      >
        Look up
      </Button>
    </form>
  );
};