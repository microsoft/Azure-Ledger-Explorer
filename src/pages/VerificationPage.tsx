/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import React from 'react';
import { makeStyles, tokens, Text, Body1 } from '@fluentui/react-components';
import { VerificationComponent } from '../components/VerificationComponent';

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
  header: {
    marginBottom: tokens.spacingVerticalL,
    display: 'block',
    wordBreak: 'break-word',
  },
  description: {
    marginBottom: tokens.spacingVerticalL,
    display: 'block',
    marginTop: tokens.spacingVerticalM,
  },
  featureList: {
    marginBottom: tokens.spacingVerticalXL,
    paddingLeft: tokens.spacingHorizontalXL,
    marginTop: tokens.spacingVerticalS,
  },
});

export const VerificationPage: React.FC = () => {
  const styles = useStyles();
  
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Text as="h1" size={800} weight="semibold" className={styles.header}>
          Ledger Verification
        </Text>
        <Body1 className={styles.description}>
          Verify the integrity and authenticity of your ledger data.
        </Body1>
        <ol className={styles.featureList} aria-label="Steps to verify your ledger">
          <li>Upload your ledger files in the Files tab.</li>
          <li>Adjust the progress reporting interval if you'd like more frequent updates.</li>
          <li>Select <strong>Start Verification</strong> to begin.</li>
          <li>Watch the progress bar to track verification status.</li>
          <li>Use <strong>Pause</strong> to stop temporarily or <strong>Resume</strong> to continue.</li>
          <li>Review the results when verification completes.</li>
        </ol>
        
        <VerificationComponent />
      </div>
    </div>
  );
};

export default VerificationPage;
