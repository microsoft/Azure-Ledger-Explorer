/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowLeft24Regular } from '@fluentui/react-icons';
import { TransactionViewer } from '../components/TransactionViewer';
import { useTransactionById } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100% - 20px)',
    overflow: 'hidden',
    margin: 0,
    padding: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  emptyState: {
    padding: tokens.spacingVerticalL,
    textAlign: 'center',
  },
});

export const TransactionDetailsPage: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const styles = useStyles();
  const { data: transaction, isLoading, error } = useTransactionById(
    transactionId ? parseInt(transactionId) : 0
  );

  const handleBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Button
            icon={<ArrowLeft24Regular />}
            onClick={handleBack}
            appearance="subtle"
          >
            Back
          </Button>
          <div className={styles.title}>Transaction Details</div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>
            Loading transaction...
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Button
            icon={<ArrowLeft24Regular />}
            onClick={handleBack}
            appearance="subtle"
          >
            Back
          </Button>
          <div className={styles.title}>Transaction Details</div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>
            {transactionId ? 'Transaction not found' : 'No transaction ID provided'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          icon={<ArrowLeft24Regular />}
          onClick={handleBack}
          appearance="subtle"
        >
          Back
        </Button>
        <div className={styles.title}>Transaction Details - {transaction.txId}</div>
      </div>
      <div className={styles.content}>
        <TransactionViewer 
          fileId={transaction.fileId} 
          fileName={transaction.fileName}
          transactionId={transaction.id}
        />
      </div>
    </div>
  );
};
