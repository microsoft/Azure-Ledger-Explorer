/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState } from 'react';
import { Button, Field, Input, Select, makeStyles } from '@fluentui/react-components';
import {
  Fingerprint20Regular,
  NumberSymbol20Regular,
  PersonTag20Regular,
  Search20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import type { EntryRef, SearchBy } from '../types/lookup-types';
import { parseEntry, parseLedgerName } from '../utils/lookup-verdict';

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
});

const INDEX_HINT = 'Searches the MST indexer; works only for ledgers onboarded to it.';

const SEARCH_TYPES: Record<SearchBy, { label: string; placeholder: string; invalid: string; hint?: string }> = {
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
  txId: <NumberSymbol20Regular />,
  issuer: <PersonTag20Regular />,
  subject: <Tag20Regular />,
  payloadHash: <Fingerprint20Regular />,
};

interface LookupFormProps {
  initialLedger: string;
  initialEntry: EntryRef | null;
  busy: boolean;
  onSubmit: (ledger: string, entry: EntryRef) => void;
}

/**
 * The ledger, what to search by, and the value. Values are validated on
 * submit, so a user can paste a full ledger URL and have it reduced to the name.
 */
export const LookupForm: React.FC<LookupFormProps> = ({ initialLedger, initialEntry, busy, onSubmit }) => {
  const styles = useStyles();
  const [ledger, setLedger] = useState(initialLedger);
  const [by, setBy] = useState<SearchBy>(initialEntry?.by ?? 'txId');
  const [value, setValue] = useState(initialEntry?.value ?? '');
  const [touched, setTouched] = useState(false);

  const parsedLedger = parseLedgerName(ledger);
  const parsedValue = parseEntry(by, value);
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
      <Field
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
      </Field>
      <Button
        className={styles.submit}
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