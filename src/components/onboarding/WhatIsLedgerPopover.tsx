/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Button,
  Text,
  tokens,
} from '@fluentui/react-components';
import {
  Info24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  trigger: {
    minWidth: 'auto',
    padding: '0 6px',
    color: tokens.colorNeutralForeground2,
  },
  surface: {
    maxWidth: '380px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1,
  },
  body: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '4px',
  },
  link: {
    color: tokens.colorBrandForegroundLink,
    fontSize: tokens.fontSizeBase200,
    textDecoration: 'none',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  formatHint: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '4px 8px',
    borderRadius: tokens.borderRadiusSmall,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
});

/**
 * Popover triggered from the welcome hero subtitle that explains what an
 * Azure Ledger is, what `.committed` files are, and links out to upstream docs.
 */
export const WhatIsLedgerPopover: React.FC = () => {
  const styles = useStyles();
  return (
    <Popover withArrow positioning="below">
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          size="small"
          icon={<Info24Regular />}
          className={styles.trigger}
          aria-label="What is an Azure Ledger?"
        >
          What is an Azure Ledger?
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <Text className={styles.title}>What is an Azure Ledger?</Text>
        <Text className={styles.body}>
          Azure Ledger is a tamper-evident, append-only record of committed
          transactions produced by an auditable confidential service. Each
          ledger captures the full history a service has acknowledged so that
          third parties can verify it independently.
        </Text>
        <Text className={styles.body}>
          Ledgers are split into <strong>chunks</strong>, named like:
        </Text>
        <code className={styles.formatHint}>ledger_&lt;start&gt;-&lt;end&gt;.committed</code>
        <Text className={styles.body}>
          This explorer parses those chunks locally in your browser and lets you
          verify the Merkle tree, browse transactions, and inspect KV writes —
          no data leaves your machine.
        </Text>
        <div className={styles.links}>
          <a className={styles.link} href="https://ccf.dev/main/architecture/ledger.html" target="_blank" rel="noreferrer">
            Azure Ledger documentation ↗
          </a>
          <a className={styles.link} href="https://ccf.dev/main/audit/receipts.html" target="_blank" rel="noreferrer">
            Azure Ledger receipts &amp; audit ↗
          </a>
        </div>
      </PopoverSurface>
    </Popover>
  );
};
