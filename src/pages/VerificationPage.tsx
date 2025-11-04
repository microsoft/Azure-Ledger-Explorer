// Example integration of the verification component

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
          CCF Ledger Verification
        </Text>
        <Body1 className={styles.description}>
          This tool allows you to verify CCF ledger data stored in the database using a web worker.
          The verification process includes:
        </Body1>
        <ul className={styles.featureList}>
          <li>Transaction digest validation</li>
          <li>Merkle tree verification against signature transactions</li>
          <li>Progress reporting every 50 transactions</li>
          <li>Simple resume capability using browser storage</li>
          <li>Background processing with pause/resume controls</li>
        </ul>
        
        <VerificationComponent />
      </div>
    </div>
  );
};

export default VerificationPage;
