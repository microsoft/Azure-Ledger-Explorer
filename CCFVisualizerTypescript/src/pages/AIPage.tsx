import React from 'react';
import { AIChat } from '../components/AIChat';
import { useDatabase } from '../hooks/use-ccf-data';
import { Spinner, Text, makeStyles, tokens, shorthands } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    minHeight: 0, // Critical for flex child to shrink
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
  },
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    color: tokens.colorPaletteRedForeground1,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0, // Critical for flex child to shrink
    height: '100%',
  },
});

export const AIPage: React.FC = () => {
  const { data: database, isLoading, error } = useDatabase();
  const styles = useStyles();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="large" />
          <Text>Initializing database...</Text>
        </div>
      </div>
    );
  }

  if (error || !database) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <Text>Database not available</Text>
          <Text size={200}>
            Please upload and parse some CCF ledger files first. Error: {error?.message || 'Unknown error'}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <AIChat database={database} />
      </div>
    </div>
  );
};
