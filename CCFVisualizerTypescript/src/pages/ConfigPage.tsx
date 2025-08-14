import React, { useState, useEffect } from 'react';
import {
  Input,
  Field,
  Textarea,
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Settings24Regular,
} from '@fluentui/react-icons';
import defaultSystemPrompt from '../assets/defaultSystemPrompt.md?raw';


const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
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
  },
  configHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  configContent: {
    ...shorthands.padding('16px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
  },
});

interface ChatConfig {
  baseUrl: string;
  systemPrompt: string;
}

// Custom hook for managing configuration state
export const useConfig = () => {
  const [config, setConfig] = useState<ChatConfig>({
    baseUrl: localStorage.getItem('chat_base_url') || '',
    systemPrompt: localStorage.getItem('chat_system_prompt') || defaultSystemPrompt,
  });

  useEffect(() => {
    localStorage.setItem('chat_base_url', config.baseUrl);
    if (config.systemPrompt) {
      localStorage.setItem('chat_system_prompt', config.systemPrompt);
    } else {
      localStorage.setItem('chat_system_prompt', defaultSystemPrompt);
    }
  }, [config]);

  return { config, setConfig };
};

export const ConfigPage: React.FC = () => {
  const styles = useStyles();
  const { config, setConfig } = useConfig();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Card>
          <CardHeader
            header={
              <div className={styles.configHeader}>
                <Settings24Regular />
                <Text weight="semibold">Configuration</Text>
              </div>
            }
          />
          <div className={styles.configContent}>
            <Text size={200}>
              Configuration for the AI chat assistant. Set the base URL for the OpenAI API and the system prompt.
            </Text>

            <Field label="Base URL">
              <Input
                type="url"
                placeholder="https://xyz.cognitiveservices.azure.com/"
                value={config.baseUrl}
                onChange={(_, data) => setConfig(prev => ({ ...prev, baseUrl: data.value }))} />
            </Field>

            <Field label="System prompt">
              <Textarea
                resize='vertical'
                placeholder="Enter system prompt"
                value={config.systemPrompt}
                onChange={(_, data) => setConfig(prev => ({ ...prev, systemPrompt: data.value }))} />
            </Field>


          </div>
        </Card>
      </div>
    </div>
  );
};

