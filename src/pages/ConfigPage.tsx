/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useEffect } from 'react';
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
} from '@fluentui/react-components';
import {
  Settings24Regular,
  Delete24Regular,
  DatabaseArrowDownRegular,
  DocumentAdd24Regular,
  ErrorCircle16Regular,
} from '@fluentui/react-icons';
import { 
  useAllTransactionsCount,
  useStats, 
  useClearAllData,
  useDropDatabase,
} from '../hooks/use-ccf-data';
import { AddFilesWizard } from '../components/AddFilesWizard';
import { useApiHealth } from '../hooks/use-tools';
import { 
  getLedgerDomain, 
  clearLedgerDomain 
} from '../utils/ledger-domain-storage';

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
}

// Custom hook for managing configuration state
export const useConfig = () => {
  const [config, setConfig] = useState<AppConfig>({
    baseUrl: localStorage.getItem('chat_base_url') || '',
  });

  useEffect(() => {
    localStorage.setItem('chat_base_url', config.baseUrl);
  }, [config]);

  return { config, setConfig };
};

export const ConfigPage: React.FC = () => {
  const styles = useStyles();
  const { config, setConfig } = useConfig();
  const { data: allTransactionsCount } = useAllTransactionsCount();
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);
  const [dropDbDialogOpen, setDropDbDialogOpen] = React.useState(false);
  const [ledgerInfo, setLedgerInfo] = React.useState(getLedgerDomain());
  const { data: stats } = useStats();
  const clearAllDataMutation = useClearAllData();
  const dropDatabaseMutation = useDropDatabase();
  
  // Fetch API health status when baseUrl changes
  const { data: apiHealthData, isLoading: isLoadingApiHealth, error: apiHealthError } = useApiHealth(config.baseUrl);

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
                Configuration for the AI chat. Set the base URL for the OpenAI API.
              </Text>

              <Field label="Base URL for chat integration">
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
        </div>
      </div>
    </div>
  );
};

