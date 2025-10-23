import React, { useState, useEffect } from 'react';
/* eslint-disable react-refresh/only-export-components */
import {
  Button,
  Input,
  Field,
  Textarea,
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
} from '@fluentui/react-components';
import {
  Settings24Regular,
  Delete24Regular,
  DatabaseArrowDownRegular,
  DocumentAdd24Regular,
  ErrorCircle16Regular,
} from '@fluentui/react-icons';
import defaultSystemPrompt from '../assets/defaultSystemPrompt.md?raw';
import { 
  useAllTransactionsCount,
  useStats, 
  useClearAllData,
  useDropDatabase,
} from '../hooks/use-ccf-data';
import { AddFilesWizard } from '../components/AddFilesWizard';
import { useTools } from '../hooks/use-tools';

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
    gap: '24px',
    padding: '24px',
    width: '100%',
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
  toolsList: {
    marginTop: '8px',
    padding: '8px',
    color: tokens.colorStatusSuccessForeground1,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  toolItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginRight: '12px',
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
  systemPrompt: string;
  defaultSystemPrompt: string;
}

// Custom hook for managing configuration state
export const useConfig = () => {
  const [config, setConfig] = useState<AppConfig>({
    baseUrl: localStorage.getItem('chat_base_url') || '',
    systemPrompt: localStorage.getItem('chat_system_prompt') || defaultSystemPrompt,
    defaultSystemPrompt: defaultSystemPrompt,
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
  const { data: allTransactionsCount } = useAllTransactionsCount();
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);
  const { data: stats } = useStats();
  const clearAllDataMutation = useClearAllData();
  const dropDatabaseMutation = useDropDatabase();
  
  // Fetch tools when baseUrl changes
  const { data: toolsData, isLoading: isLoadingTools, error: toolsError } = useTools(config.baseUrl);

  const hasData = stats && (stats.fileCount > 0 || stats.transactionCount > 0);

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

              { allTransactionsCount && allTransactionsCount > 0 ? <Text size={200}>Imported transactions: {allTransactionsCount}</Text> : <Text size={200}>No imported data found</Text> }
              
              <div>
                {/* Upload Files Button */}
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

                {/* Clear All Data Button */}
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

                {/* Drop Database Button */}
                <Dialog>
                  <DialogTrigger disableButtonEnhancement>
                    <Button
                      appearance="outline"
                      icon={<DatabaseArrowDownRegular />}
                      disabled={dropDatabaseMutation.isPending}
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


          { import.meta.env.VITE_DISABLE_SAGE !== 'true' && <Card>
            <CardHeader
              header={
                <div className={styles.configHeader}>
                  <Settings24Regular />
                  <Text weight="semibold">Agent configuration</Text>
                </div>
              }
            />
            <div className={styles.configContent}>
              <Text size={200}>
                Configuration for the AI chat. Set the base URL for the OpenAI API and tweak the system prompt.
              </Text>

              <Field label="Base URL for chat integration">
                <Input
                  type="url"
                  placeholder="https://sageendpoint.com/"
                  value={config.baseUrl}
                  onChange={(_, data) => setConfig(prev => ({ ...prev, baseUrl: data.value }))} />
                
                {/* Tools status and list */}
                {config.baseUrl && (
                  <>
                    {isLoadingTools && (
                      <div className={styles.statusMessage}>
                        <Spinner size="tiny" />
                        <Caption1>Loading available tools...</Caption1>
                      </div>
                    )}
                    
                    {toolsError && (
                      <div className={styles.statusMessage}>
                        <ErrorCircle16Regular primaryFill={tokens.colorPaletteRedForeground1} />
                        <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>
                          Failed to fetch tools: {toolsError.message}
                        </Caption1>
                      </div>
                    )}
                    
                    {toolsData?.tools && toolsData.tools.length > 0 && (
                      <div className={styles.toolsList}>
                        <Caption1>
                          <span>Available tools ({toolsData.tools.length}):</span>{' '}
                          {toolsData.tools.map((tool, index) => (
                            <span key={index} className={styles.toolItem}>
                              {tool.name}
                            </span>
                          ))}
                        </Caption1>
                      </div>
                    )}
                    
                    {toolsData?.tools && toolsData.tools.length === 0 && (
                      <div className={styles.statusMessage}>
                        <Caption1>No tools available, check if server is running or can access MCP tools</Caption1>
                      </div>
                    )}
                  </>
                )}
              </Field>

              <Field label="System prompt">
                <Textarea
                  resize='vertical'
                  placeholder="Enter system prompt"
                  rows={10}
                  value={config.systemPrompt}
                  onChange={(_, data) => setConfig(prev => ({ ...prev, systemPrompt: data.value }))} />
              </Field>
              {/* add a note if systemPrompt is different from defaultSystemPrompt */}
              {config.systemPrompt !== config.defaultSystemPrompt && (
                <Text size={200} style={{ color: tokens.colorStatusWarningForeground1 }}>
                  Note: You have modified the system prompt from the default. Delete it to reset.
                </Text>
              )}
              {config.systemPrompt === config.defaultSystemPrompt && (
                <Text size={200} style={{ color: tokens.colorStatusSuccessForeground1 }}>
                  Using latest version of prompt.
                </Text>
              )}
            </div>
          </Card> }
        </div>
      </div>
    </div>
  );
};

