/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
/* eslint-disable react-refresh/only-export-components */
import {
  Button,
  Input,
  Field,
  Card,
  CardHeader,
  Text,
  Body1,
  makeStyles,
  tokens,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Caption1,
  Spinner,
  Dropdown,
  Option,
  Switch,
} from '@fluentui/react-components';
import {
  Settings24Regular,
  Delete24Regular,
  DatabaseArrowDownRegular,
  DocumentAdd24Regular,
  ErrorCircle16Regular,
  Checkmark16Regular,
  Key24Regular,
  DataTrending24Regular,
} from '@fluentui/react-icons';
import { 
  useAllTransactionsCount,
  useStats, 
  useClearAllData,
  useDropDatabase,
} from '../hooks/use-ccf-data';
import { AddFilesWizard } from '../components/AddFilesWizard';
import { useApiHealth } from '../hooks/use-api-health';
import { useOpenAIKeyValidation } from '../hooks/use-openai-key-validation';
import { OPENAI_MODELS, DEFAULT_OPENAI_MODEL, OPENAI_API_KEY_STORAGE_KEY, OPENAI_MODEL_STORAGE_KEY, CHAT_ENABLED_STORAGE_KEY } from '../constants/chat';
import { 
  getLedgerDomain, 
  clearLedgerDomain 
} from '../utils/ledger-domain-storage';
import { useTelemetry } from '../services/telemetry';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardsContainer: {
    display: 'flex',
    gap: tokens.spacingVerticalXXL,
    padding: tokens.spacingVerticalXXL,
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    flexDirection: 'column',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    gap: '16px',
  },
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flexDirection: 'column',
    gap: '16px',
    color: tokens.colorPaletteRedForeground1,
  },
  content: {
    flex: 1,
    overflowX: 'hidden',
  },
  configHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  configContent: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  actionButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalM,
  },
  statusMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
  },
});

interface AppConfig {
  baseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  chatEnabled: boolean;
}

interface UseConfigResult {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
}

interface UseConfigResult {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
}

// Custom hook for managing configuration state
export const useConfig = (): UseConfigResult => {
  const [config, setConfig] = useState<AppConfig>({
    baseUrl: localStorage.getItem('chat_base_url') || '',
    openaiApiKey: localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '',
    openaiModel: localStorage.getItem(OPENAI_MODEL_STORAGE_KEY) || DEFAULT_OPENAI_MODEL,
    chatEnabled: localStorage.getItem(CHAT_ENABLED_STORAGE_KEY) === 'true',
  });

  useEffect(() => {
    localStorage.setItem('chat_base_url', config.baseUrl);
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, config.openaiApiKey);
    localStorage.setItem(OPENAI_MODEL_STORAGE_KEY, config.openaiModel);
    localStorage.setItem(CHAT_ENABLED_STORAGE_KEY, String(config.chatEnabled));
    
    // Dispatch custom event to sync config across components
    window.dispatchEvent(new CustomEvent('configChanged', { detail: config }));
  }, [config]);

  useEffect(() => {
    // Listen for config changes from other components
    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      }
    };

    window.addEventListener('configChanged', handleConfigChange);
    return () => window.removeEventListener('configChanged', handleConfigChange);
  }, []);

  return { config, setConfig };
};

export const ConfigPage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { config, setConfig } = useConfig();
  const { data: allTransactionsCount } = useAllTransactionsCount();
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);
  const [dropDbDialogOpen, setDropDbDialogOpen] = React.useState(false);
  const [ledgerInfo, setLedgerInfo] = React.useState(getLedgerDomain());
  const { data: stats } = useStats();
  const clearAllDataMutation = useClearAllData();
  const dropDatabaseMutation = useDropDatabase();
  
  // Telemetry
  const { isTelemetryEnabled, setTelemetryEnabled, trackEvent, TelemetryEvents } = useTelemetry();
  const [telemetryEnabled, setTelemetryEnabledState] = React.useState(isTelemetryEnabled());
  
  // Fetch API health status when baseUrl changes
  const { data: apiHealthData, isLoading: isLoadingApiHealth, error: apiHealthError } = useApiHealth(config.baseUrl);
  const { data: keyValidation, isLoading: isValidatingKey } = useOpenAIKeyValidation(config.openaiApiKey);

  const hasData = stats && (stats.fileCount > 0 || stats.transactionCount > 0);

  const handleChatToggle = (checked: boolean) => {
    setConfig(prev => ({ ...prev, chatEnabled: checked }));
    // If disabling chat while on chat page, navigate to files page
    if (!checked && location.pathname === '/chat') {
      navigate('/files');
    }
  };

  const handleTelemetryToggle = (checked: boolean) => {
    setTelemetryEnabled(checked);
    setTelemetryEnabledState(checked);
    trackEvent(TelemetryEvents.TELEMETRY_TOGGLED, { enabled: checked });
  };

  const handleClearAllData = async () => {
    try {
      await clearAllDataMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to clear all data:', error);
    }
  };

  const handleDropDatabase = async () => {
    try {
      await dropDatabaseMutation.mutateAsync();
      clearLedgerDomain();
      setLedgerInfo(getLedgerDomain());
      setDropDbDialogOpen(false);
    } catch (error) {
      console.error('Failed to drop database:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.cardsContainer}>
          <Card>
            <CardHeader
              header={
                <div className={styles.configHeader}>
                  <Settings24Regular />
                  <Text weight="semibold">Ledger data configuration</Text>
                </div>
              }
            />
            <div className={styles.configContent}>
              <Text size={200}>
                Ledger data gets imported and then is exposed in various pages. It can also be queried.
              </Text>

              {ledgerInfo.domain ? (
                <div style={{
                  backgroundColor: tokens.colorNeutralBackground3,
                  padding: tokens.spacingVerticalM,
                  borderRadius: tokens.borderRadiusMedium,
                  marginBottom: tokens.spacingVerticalM,
                }}>
                  <Text size={200} weight="semibold" block>
                    Imported Ledger Domain:
                  </Text>
                  <Text size={200} style={{ 
                    fontFamily: 'monospace', 
                    marginTop: tokens.spacingVerticalXS 
                  }} block>
                    {ledgerInfo.domain}
                  </Text>
                  {ledgerInfo.type && (
                    <Caption1 style={{ 
                      marginTop: tokens.spacingVerticalXS,
                      color: tokens.colorNeutralForeground3 
                    }}>
                      Source: {ledgerInfo.type}
                      {ledgerInfo.importedAt && 
                        ` • ${new Date(ledgerInfo.importedAt).toLocaleString()}`}
                    </Caption1>
                  )}
                </div>
              ) : (
                <Text size={200} style={{ 
                  color: tokens.colorNeutralForeground3,
                  marginBottom: tokens.spacingVerticalM 
                }} block>
                  No ledger domain information available (manual file import or not yet imported)
                </Text>
              )}

              { allTransactionsCount && allTransactionsCount > 0 ? <Text size={200}>Imported transactions: {allTransactionsCount}</Text> : <Text size={200}>No imported data found</Text> }
              
              <div className={styles.actionButtons}>
                <Button
                  appearance="outline"
                  icon={<DocumentAdd24Regular />}
                  onClick={() => setShowUploadDialog(true)}
                >
                  Add Files
                </Button>

                <AddFilesWizard 
                  open={showUploadDialog} 
                  onOpenChange={setShowUploadDialog}
                />

                { hasData && <Dialog>
                  <DialogTrigger disableButtonEnhancement>
                    <Button
                      appearance="outline"
                      icon={<Delete24Regular />}
                      disabled={clearAllDataMutation.isPending}
                    >
                      Clear All Data
                    </Button>
                  </DialogTrigger>
                  <DialogSurface>
                    <DialogTitle>Clear All Data</DialogTitle>
                    <DialogContent>
                      <DialogBody>
                        <Body1>
                          Are you sure you want to clear all data? This will permanently delete:
                        </Body1>
                        <ul>
                          <li>{stats.fileCount} ledger file{stats.fileCount !== 1 ? 's' : ''}</li>
                          <li>{stats.transactionCount} transaction{stats.transactionCount !== 1 ? 's' : ''}</li>
                          <li>{stats.writeCount} write operation{stats.writeCount !== 1 ? 's' : ''}</li>
                          <li>{stats.deleteCount} delete operation{stats.deleteCount !== 1 ? 's' : ''}</li>
                        </ul>
                        <Body1>This action cannot be undone.</Body1>
                      </DialogBody>
                      <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                          <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                        <Button
                          appearance="primary"
                          onClick={handleClearAllData}
                          disabled={clearAllDataMutation.isPending}
                        >
                          {clearAllDataMutation.isPending ? 'Clearing...' : 'Clear All Data'}
                        </Button>
                      </DialogActions>
                    </DialogContent>
                  </DialogSurface>
                </Dialog>
                }

                <Dialog 
                  open={dropDbDialogOpen} 
                  onOpenChange={(_, data) => setDropDbDialogOpen(data.open)}
                >
                  <DialogTrigger disableButtonEnhancement>
                    <Button
                      appearance="outline"
                      icon={<DatabaseArrowDownRegular />}
                      disabled={dropDatabaseMutation.isPending}
                      onClick={() => setDropDbDialogOpen(true)}
                    >
                      Drop DB
                    </Button>
                  </DialogTrigger>
                  <DialogSurface>
                    <DialogTitle>Drop Database</DialogTitle>
                    <DialogContent>
                      <DialogBody>
                        <Body1>
                          Are you sure you want to drop the entire database? This will:
                        </Body1>
                        <ul>
                          <li>Completely delete the OPFS database file from disk</li>
                          <li>Remove all tables, indexes, and data</li>
                          <li>Create a fresh database with a clean schema</li>
                          <li>Free up all storage space used by the database</li>
                        </ul>
                        <Body1>
                          <strong>This is the "nuclear option"</strong> - it completely wipes the database file and recreates it from scratch.
                          Use this if the database is corrupted or you want a completely fresh start.
                          This action cannot be undone.
                        </Body1>
                      </DialogBody>
                      <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                          <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                        <Button
                          appearance="primary"
                          onClick={handleDropDatabase}
                          disabled={dropDatabaseMutation.isPending}
                        >
                          {dropDatabaseMutation.isPending ? 'Dropping...' : 'Drop Database'}
                        </Button>
                      </DialogActions>
                    </DialogContent>
                  </DialogSurface>
                </Dialog>
              </div>
            </div>
          </Card>


          { import.meta.env.VITE_ENABLE_SAGE === 'true' && <Card>
            <CardHeader
              header={
                <div className={styles.configHeader}>
                  <Settings24Regular />
                  <Text weight="semibold">Sage configuration</Text>
                </div>
              }
            />
            <div className={styles.configContent}>
              <Text size={200}>
                Configuration for the Sage AI agent. Set the base URL for the Sage backend.
              </Text>

              <Field label="Sage Base URL">
                <Input
                  type="url"
                  placeholder="https://sageendpoint.com/"
                  value={config.baseUrl}
                  onChange={(_, data) => setConfig(prev => ({ ...prev, baseUrl: data.value }))} />
                
                {/* API health status */}
                {config.baseUrl && (
                  <>
                    {isLoadingApiHealth && (
                      <div className={styles.statusMessage}>
                        <Spinner size="tiny" />
                        <Caption1>Checking API health...</Caption1>
                      </div>
                    )}
                    
                    {apiHealthError && (
                      <div className={styles.statusMessage}>
                        <ErrorCircle16Regular primaryFill={tokens.colorPaletteRedForeground1} />
                        <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>
                          Failed to fetch health status: {apiHealthError.message}
                        </Caption1>
                      </div>
                    )}
                    
                    {apiHealthData?.status && (
                      <div className={styles.statusMessage}>
                        <Caption1>
                          Status: {apiHealthData.status}
                          {typeof apiHealthData.configured === 'boolean'
                            ? ` • Configured: ${apiHealthData.configured ? 'yes' : 'no'}`
                            : ''}
                        </Caption1>
                      </div>
                    )}
                  </>
                )}
              </Field>

            </div>
          </Card> }

          { import.meta.env.VITE_ENABLE_SAGE !== 'true' && <Card>
            <CardHeader
              header={
                <div className={styles.configHeader}>
                  <Key24Regular />
                  <Text weight="semibold">CCF Ledger Chat (Bring Your Own Key)</Text>
                </div>
              }
            />
            <div className={styles.configContent}>
              <Text size={200}>
                Use your own OpenAI API key to chat with your loaded ledger data.
                Questions are translated into SQL queries, executed locally, and results
                are summarized in natural language. No data leaves your browser except
                the questions themselves.
              </Text>

              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                ⚠️ Your API key is stored locally in your browser and sent directly to
                OpenAI. It is never sent to any other server.
              </Caption1>

              <Field label="Enable Chat Experience (Bring your own key)">
                <Switch
                  checked={config.chatEnabled}
                  onChange={(_, data) => handleChatToggle(data.checked)}
                  label={config.chatEnabled ? 'Enabled' : 'Disabled'}
                />
              </Field>

              {config.chatEnabled && (
                <div style={{
                  backgroundColor: tokens.colorNeutralBackground3,
                  padding: tokens.spacingVerticalM,
                  borderRadius: tokens.borderRadiusMedium,
                  marginTop: tokens.spacingVerticalS,
                }}>
                  <Text size={200} weight="semibold" block>
                    Current Settings:
                  </Text>
                  <div style={{ marginTop: tokens.spacingVerticalXS }}>
                    <Caption1 block>
                      API Key: {config.openaiApiKey ? '••••••••' + config.openaiApiKey.slice(-4) : 'Not set'}
                    </Caption1>
                    <Caption1 block>
                      Model: {OPENAI_MODELS.find(m => m.key === config.openaiModel)?.label || config.openaiModel}
                    </Caption1>
                    {keyValidation && config.openaiApiKey && (
                      <Caption1
                        block
                        style={{
                          color: keyValidation.valid
                            ? tokens.colorPaletteGreenForeground1
                            : tokens.colorPaletteRedForeground1
                        }}
                      >
                        Status: {keyValidation.valid ? 'Valid ✓' : 'Invalid ✗'}
                      </Caption1>
                    )}
                  </div>
                </div>
              )}

              <Field label="OpenAI API Key">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={config.openaiApiKey}
                  onChange={(_, data) =>
                    setConfig(prev => ({ ...prev, openaiApiKey: data.value }))
                  }
                />

                {config.openaiApiKey && (
                  <>
                    {isValidatingKey && (
                      <div className={styles.statusMessage}>
                        <Spinner size="tiny" />
                        <Caption1>Validating API key...</Caption1>
                      </div>
                    )}

                    {keyValidation && !isValidatingKey && keyValidation.valid && (
                      <div className={styles.statusMessage}>
                        <Checkmark16Regular primaryFill={tokens.colorPaletteGreenForeground1} />
                        <Caption1 style={{ color: tokens.colorPaletteGreenForeground1 }}>
                          API key is valid
                        </Caption1>
                      </div>
                    )}

                    {keyValidation && !isValidatingKey && !keyValidation.valid && (
                      <div className={styles.statusMessage}>
                        <ErrorCircle16Regular primaryFill={tokens.colorPaletteRedForeground1} />
                        <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>
                          {keyValidation.error || 'Invalid API key'}
                        </Caption1>
                      </div>
                    )}
                  </>
                )}
              </Field>

              <Field label="Model">
                <Dropdown
                  value={OPENAI_MODELS.find(m => m.key === (config.openaiModel || DEFAULT_OPENAI_MODEL))?.label || ''}
                  selectedOptions={[config.openaiModel || DEFAULT_OPENAI_MODEL]}
                  onOptionSelect={(_, data) => {
                    if (data.optionValue) {
                      setConfig(prev => ({ ...prev, openaiModel: data.optionValue as string }));
                    }
                  }}
                >
                  {OPENAI_MODELS.map(m => (
                    <Option key={m.key} value={m.key}>
                      {m.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>

            </div>
          </Card> }

          <Card>
            <CardHeader
              header={
                <div className={styles.configHeader}>
                  <DataTrending24Regular />
                  <Text weight="semibold">Telemetry</Text>
                </div>
              }
            />
            <div className={styles.configContent}>
              <Text size={200}>
                Help improve CCF Ledger Explorer by sharing anonymous usage data.
                We collect page views and feature usage to understand how the application is used.
                No personal data or ledger content is ever collected.
              </Text>

              <Field label="Share anonymous usage data">
                <Switch
                  checked={telemetryEnabled}
                  onChange={(_, data) => handleTelemetryToggle(data.checked)}
                  label={telemetryEnabled ? 'Enabled' : 'Disabled'}
                />
              </Field>

              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                Data collected: page views, feature usage (which pages/features you access).
                No ledger data, file contents, or personal information is collected.
              </Caption1>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

