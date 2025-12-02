/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { WriteReceiptVerificationComponent } from '../components/WriteReceiptVerificationComponent';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
  },
  content: {
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    '@media (max-width: 768px)': {
      padding: tokens.spacingVerticalL,
    },
    '@media (max-width: 480px)': {
      padding: tokens.spacingVerticalM,
    },
  },
});

export const WriteReceiptVerificationPage: React.FC = () => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <WriteReceiptVerificationComponent />
      </div>
    </div>
  );
};
