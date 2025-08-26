import React from 'react';
import { AIChat } from '../components/AIChat';
import { useDatabase } from '../hooks/use-ccf-data';
import { Spinner, Text, makeStyles, tokens, shorthands } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
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
});

interface AIPageProps {
  onChatStateChange?: (hasActiveChat: boolean) => void;
  onRegisterClearChat?: (clearFn: (() => void) | null) => void;
  clearChatFunction?: (() => void) | null;
}

export const AIPage: React.FC<AIPageProps> = ({ 
  onChatStateChange, 
  onRegisterClearChat,
  clearChatFunction 
}) => {
  const { data: database, isLoading, error } = useDatabase();
  const styles = useStyles();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="large" />
          <Text>Loading...</Text>
        </div>
      </div>
    );
  }

  if (error || !database) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <Text>Error</Text>
          <Text size={200}>
            Error: {error?.message || 'Unknown error'}. Please try refreshing the page and/or clearing cookies and local storage.
          </Text>
        </div>
      </div>
    );
  }

  return (
    <AIChat 
      database={database}
      onChatStateChange={onChatStateChange}
      onRegisterClearChat={onRegisterClearChat}
      clearChatFunction={clearChatFunction}
    />
  );
};
