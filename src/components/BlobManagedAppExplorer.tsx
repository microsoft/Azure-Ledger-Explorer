/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  Text,
  Caption1,
  Button,
  Input,
  Field,
  Spinner,
  Badge,
  makeStyles,
  tokens,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Divider,
  Tooltip,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  createTableColumn,
} from '@fluentui/react-components';
import {
  CloudArrowUp24Regular,
  Search24Regular,
  ArrowSync24Regular,
  Shield24Regular,
  ShieldCheckmark24Regular,
  Warning24Regular,
  ErrorCircle24Regular,
  Checkmark16Regular,
  Dismiss16Regular,
  ArrowDownload24Regular,
  Info16Regular,
  Eye24Regular,
} from '@fluentui/react-icons';
import {
  useBlobAppConfig,
  useTriggerAudit,
  useAuditBlobs,
  useDownloadAuditResult,
} from '../hooks/use-blob-app';
import type { AuditBlob, AuditRecord, AuditResult } from '../types/blob-app-types';
import type { TableColumnDefinition, DataGridProps } from '@fluentui/react-components';

const useStyles = makeStyles({
  configContent: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  configHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  auditActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  auditInputs: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    flex: 1,
  },
  resultCard: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: '8px',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  blobListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    marginBottom: '4px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  blobInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  blobName: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  digestText: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  rawContent: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '12px',
    borderRadius: tokens.borderRadiusMedium,
    maxHeight: '400px',
    overflow: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  summaryBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: '12px',
  },
  summaryOk: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  summaryTampered: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
  },
});

/**
 * BlobManagedAppExplorer – a self-contained Card component that provides
 * configuration, audit triggering, and audit result viewing for
 * the Azure Blob Storage digest managed application.
 */
export const BlobManagedAppExplorer: React.FC = () => {
  const styles = useStyles();
  const { config, updateConfig, validation } = useBlobAppConfig();

  // Audit trigger state
  const [auditStorageAccount, setAuditStorageAccount] = useState('');
  const [auditContainer, setAuditContainer] = useState('');
  const [includeUsers, setIncludeUsers] = useState(false);
  const triggerAuditMutation = useTriggerAudit(config);

  // Audit results browsing state
  const [browseStorageAccount, setBrowseStorageAccount] = useState('');
  const [browseContainer, setBrowseContainer] = useState('');
  const [shouldFetchBlobs, setShouldFetchBlobs] = useState(false);
  const [selectedResult, setSelectedResult] = useState<AuditResult | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);

  const {
    data: auditBlobs,
    isLoading: isLoadingBlobs,
    error: blobsError,
    refetch: refetchBlobs,
  } = useAuditBlobs(config, browseStorageAccount || undefined, browseContainer || undefined, shouldFetchBlobs);

  const downloadAuditResultMutation = useDownloadAuditResult(config);

  const handleTriggerAudit = useCallback(async () => {
    try {
      await triggerAuditMutation.mutateAsync({
        storageAccount: auditStorageAccount,
        blobContainer: auditContainer,
        getUsers: includeUsers,
      });
    } catch {
      // error is available in triggerAuditMutation.error
    }
  }, [triggerAuditMutation, auditStorageAccount, auditContainer, includeUsers]);

  const handleFetchResults = useCallback(() => {
    setShouldFetchBlobs(true);
    void refetchBlobs();
  }, [refetchBlobs]);

  const handleViewResult = useCallback(
    async (blob: AuditBlob) => {
      try {
        const result = await downloadAuditResultMutation.mutateAsync(blob.name);
        result.lastModified = blob.lastModified;
        setSelectedResult(result);
        setShowRawContent(false);
      } catch {
        // error is available in downloadAuditResultMutation.error
      }
    },
    [downloadAuditResultMutation],
  );

  const handleDownloadResult = useCallback(() => {
    if (!selectedResult) return;
    const blob = new Blob([selectedResult.rawContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedResult.fileName.split('/').pop() || 'audit-result.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedResult]);

  // DataGrid columns for audit records
  const recordColumns: TableColumnDefinition<AuditRecord>[] = [
    createTableColumn<AuditRecord>({
      columnId: 'status',
      renderHeaderCell: () => 'Status',
      renderCell: (item) => (
        <div className={styles.statusBadge}>
          {item.isTampered ? (
            <Badge appearance="filled" color="danger" icon={<Dismiss16Regular />}>
              Tampered
            </Badge>
          ) : (
            <Badge appearance="filled" color="success" icon={<Checkmark16Regular />}>
              OK
            </Badge>
          )}
        </div>
      ),
    }),
    createTableColumn<AuditRecord>({
      columnId: 'blockId',
      renderHeaderCell: () => 'Block',
      renderCell: (item) => (
        <span>{item.blockId.replace('block_id_', '#')}</span>
      ),
    }),
    createTableColumn<AuditRecord>({
      columnId: 'blobName',
      renderHeaderCell: () => 'Blob(s)',
      renderCell: (item) => (
        <Tooltip content={item.blobName} relationship="description">
          <span className={styles.blobName}>{item.blobName || '—'}</span>
        </Tooltip>
      ),
    }),
    createTableColumn<AuditRecord>({
      columnId: 'recalculatedDigest',
      renderHeaderCell: () => 'Computed Hash',
      renderCell: (item) => (
        <Tooltip content={item.recalculatedDigest} relationship="description">
          <span className={styles.digestText}>{item.recalculatedDigest || '—'}</span>
        </Tooltip>
      ),
    }),
    createTableColumn<AuditRecord>({
      columnId: 'ledgerDigest',
      renderHeaderCell: () => 'ACL Stored Hash',
      renderCell: (item) => (
        <Tooltip content={item.ledgerDigest} relationship="description">
          <span className={styles.digestText}>{item.ledgerDigest || '—'}</span>
        </Tooltip>
      ),
    }),
    createTableColumn<AuditRecord>({
      columnId: 'user',
      renderHeaderCell: () => 'User',
      renderCell: (item) => (
        <span>{item.user?.upn || '—'}</span>
      ),
    }),
  ];

  const defaultSortState = React.useMemo<DataGridProps['defaultSortState']>(
    () => ({ sortColumn: 'status', sortDirection: 'ascending' }),
    [],
  );

  return (
    <Card>
      <CardHeader
        header={
          <div className={styles.configHeader}>
            <Shield24Regular />
            <Text weight="semibold">Blob Managed App Explorer</Text>
          </div>
        }
      />
      <div className={styles.configContent}>
        <Text size={200}>
          Connect to your Azure Blob Storage digest managed application to perform audits and
          view results. This tool sends audit messages to your Service Bus queue and reads
          audit records from blob storage. All credentials stay in your browser.
        </Text>

        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          Learn more about the{' '}
          <a
            href="https://learn.microsoft.com/en-us/azure/confidential-ledger/create-blob-managed-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Blob Storage digests backed by confidential ledger
          </a>
          .
        </Caption1>

        {/* ── Configuration Section ── */}
        <Accordion collapsible defaultOpenItems={validation.valid ? [] : ['config']}>
          <AccordionItem value="config">
            <AccordionHeader>
              <div className={styles.sectionTitle}>
                <Text weight="semibold">Connection Settings</Text>
                {validation.valid ? (
                  <Badge appearance="filled" color="success" size="small">
                    Configured
                  </Badge>
                ) : (
                  <Badge appearance="filled" color="warning" size="small">
                    {validation.errors.length} missing
                  </Badge>
                )}
              </div>
            </AccordionHeader>
            <AccordionPanel>
              <Text weight="semibold" block style={{ marginBottom: '8px' }}>
                Service Bus (for triggering audits)
              </Text>
              <div className={styles.formGrid}>
                <Field label="Namespace" required>
                  <Input
                    placeholder="my-servicebus-namespace"
                    value={config.serviceBusNamespace}
                    onChange={(_, data) => updateConfig({ serviceBusNamespace: data.value })}
                  />
                </Field>
                <Field label="Queue Name" required>
                  <Input
                    placeholder="audit-queue"
                    value={config.serviceBusQueueName}
                    onChange={(_, data) => updateConfig({ serviceBusQueueName: data.value })}
                  />
                </Field>
                <Field label="SAS Policy Name" required>
                  <Input
                    placeholder="RootManageSharedAccessKey"
                    value={config.serviceBusSasKeyName}
                    onChange={(_, data) => updateConfig({ serviceBusSasKeyName: data.value })}
                  />
                </Field>
                <Field label="SAS Key" required>
                  <Input
                    type="password"
                    placeholder="Base64 encoded key..."
                    value={config.serviceBusSasKey}
                    onChange={(_, data) => updateConfig({ serviceBusSasKey: data.value })}
                  />
                </Field>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <Text weight="semibold" block style={{ marginBottom: '8px' }}>
                Storage Account (for reading audit results)
              </Text>
              <div className={styles.formGrid}>
                <Field label="Storage Account Name" required>
                  <Input
                    placeholder="mystorageaccount"
                    value={config.storageAccountName}
                    onChange={(_, data) => updateConfig({ storageAccountName: data.value })}
                  />
                </Field>
                <Field label="Managed App Name" required>
                  <Input
                    placeholder="my-managed-app"
                    value={config.managedAppName}
                    onChange={(_, data) => updateConfig({ managedAppName: data.value })}
                  />
                </Field>
                <Field
                  label="SAS Token"
                  required
                  style={{ gridColumn: '1 / -1' }}
                >
                  <Input
                    type="password"
                    placeholder="?sv=2022-11-02&ss=b&srt=sco&sp=rl..."
                    value={config.storageSasToken}
                    onChange={(_, data) => updateConfig({ storageSasToken: data.value })}
                  />
                </Field>
              </div>

              <Caption1
                style={{
                  color: tokens.colorNeutralForeground3,
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Info16Regular />
                Credentials are stored in browser localStorage only and are sent directly
                to your Azure endpoints. They are never sent to any other server.
              </Caption1>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        {/* ── Trigger Audit Section ── */}
        <Divider />
        <div>
          <div className={styles.sectionTitle}>
            <CloudArrowUp24Regular />
            <Text weight="semibold">Trigger Audit</Text>
          </div>
          <Text size={200} block style={{ marginBottom: '12px' }}>
            Send an audit message to the Service Bus queue. The managed application will
            replay blob creation events, recalculate digests, and compare them against
            the confidential ledger.
          </Text>

          <div className={styles.auditActions}>
            <div className={styles.auditInputs}>
              <Field label="Storage Account" style={{ flex: 1, minWidth: '180px' }}>
                <Input
                  placeholder="Storage account to audit"
                  value={auditStorageAccount}
                  onChange={(_, data) => setAuditStorageAccount(data.value)}
                />
              </Field>
              <Field label="Blob Container" style={{ flex: 1, minWidth: '180px' }}>
                <Input
                  placeholder="Container to audit"
                  value={auditContainer}
                  onChange={(_, data) => setAuditContainer(data.value)}
                />
              </Field>
              <Field label="Include Users">
                <Button
                  appearance={includeUsers ? 'primary' : 'outline'}
                  size="small"
                  onClick={() => setIncludeUsers(!includeUsers)}
                >
                  {includeUsers ? 'Yes' : 'No'}
                </Button>
              </Field>
            </div>
            <Button
              appearance="primary"
              icon={<CloudArrowUp24Regular />}
              disabled={
                !validation.valid ||
                !auditStorageAccount ||
                !auditContainer ||
                triggerAuditMutation.isPending
              }
              onClick={handleTriggerAudit}
            >
              {triggerAuditMutation.isPending ? 'Sending...' : 'Run Audit'}
            </Button>
          </div>

          {triggerAuditMutation.isSuccess && (
            <MessageBar intent="success" style={{ marginTop: '8px' }}>
              <MessageBarBody>
                <MessageBarTitle>Audit Triggered</MessageBarTitle>
                Audit message sent successfully (HTTP {triggerAuditMutation.data}). The
                managed application will process it. Check results below after processing
                completes.
              </MessageBarBody>
            </MessageBar>
          )}

          {triggerAuditMutation.isError && (
            <MessageBar intent="error" style={{ marginTop: '8px' }}>
              <MessageBarBody>
                <MessageBarTitle>Audit Failed</MessageBarTitle>
                {triggerAuditMutation.error?.message || 'Failed to send audit message.'}
              </MessageBarBody>
            </MessageBar>
          )}
        </div>

        {/* ── View Audit Results Section ── */}
        <Divider />
        <div>
          <div className={styles.sectionTitle}>
            <Search24Regular />
            <Text weight="semibold">View Audit Results</Text>
          </div>
          <Text size={200} block style={{ marginBottom: '12px' }}>
            Browse audit results from the{' '}
            <code>{config.managedAppName || '<app-name>'}-audit-records</code> container.
            You can filter by storage account and container, or list all results.
          </Text>

          <div className={styles.auditActions}>
            <div className={styles.auditInputs}>
              <Field label="Storage Account (optional)" style={{ flex: 1, minWidth: '180px' }}>
                <Input
                  placeholder="Filter by storage account"
                  value={browseStorageAccount}
                  onChange={(_, data) => setBrowseStorageAccount(data.value)}
                />
              </Field>
              <Field label="Container (optional)" style={{ flex: 1, minWidth: '180px' }}>
                <Input
                  placeholder="Filter by container"
                  value={browseContainer}
                  onChange={(_, data) => setBrowseContainer(data.value)}
                />
              </Field>
            </div>
            <Button
              appearance="primary"
              icon={isLoadingBlobs ? <ArrowSync24Regular /> : <Search24Regular />}
              disabled={!validation.valid || isLoadingBlobs}
              onClick={handleFetchResults}
            >
              {isLoadingBlobs ? 'Loading...' : 'Fetch Results'}
            </Button>
          </div>

          {blobsError && (
            <MessageBar intent="error" style={{ marginTop: '8px' }}>
              <MessageBarBody>
                <MessageBarTitle>Error</MessageBarTitle>
                {(blobsError as Error).message || 'Failed to list audit blobs.'}
              </MessageBarBody>
            </MessageBar>
          )}

          {/* Blob list */}
          {auditBlobs && auditBlobs.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <Text size={200} weight="semibold" block style={{ marginBottom: '8px' }}>
                {auditBlobs.length} audit result{auditBlobs.length !== 1 ? 's' : ''} found
              </Text>
              {auditBlobs.map((blob) => (
                <div
                  key={blob.name}
                  className={styles.blobListItem}
                  onClick={() => void handleViewResult(blob)}
                >
                  <div className={styles.blobInfo}>
                    <span className={styles.blobName}>{blob.name}</span>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {blob.lastModified
                        ? new Date(blob.lastModified).toLocaleString()
                        : 'Unknown date'}
                      {blob.contentLength ? ` • ${formatBytes(parseInt(blob.contentLength))}` : ''}
                    </Caption1>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Tooltip content="View result" relationship="label">
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<Eye24Regular />}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleViewResult(blob);
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          {shouldFetchBlobs && auditBlobs && auditBlobs.length === 0 && !isLoadingBlobs && (
            <MessageBar intent="info" style={{ marginTop: '8px' }}>
              <MessageBarBody>
                No audit results found. Trigger an audit first, then wait for the managed
                application to complete processing.
              </MessageBarBody>
            </MessageBar>
          )}

          {downloadAuditResultMutation.isPending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <Spinner size="tiny" />
              <Caption1>Loading audit result...</Caption1>
            </div>
          )}

          {downloadAuditResultMutation.isError && (
            <MessageBar intent="error" style={{ marginTop: '8px' }}>
              <MessageBarBody>
                <MessageBarTitle>Download Error</MessageBarTitle>
                {downloadAuditResultMutation.error?.message || 'Failed to download audit result.'}
              </MessageBarBody>
            </MessageBar>
          )}
        </div>

        {/* ── Selected Audit Result Details ── */}
        {selectedResult && (
          <>
            <Divider />
            <div>
              <div className={styles.sectionTitle}>
                {selectedResult.hasTamperedBlobs ? (
                  <ErrorCircle24Regular primaryFill={tokens.colorPaletteRedForeground1} />
                ) : (
                  <ShieldCheckmark24Regular primaryFill={tokens.colorPaletteGreenForeground1} />
                )}
                <Text weight="semibold">Audit Result Details</Text>
              </div>

              {/* Summary banner */}
              <div
                className={`${styles.summaryBanner} ${
                  selectedResult.hasTamperedBlobs ? styles.summaryTampered : styles.summaryOk
                }`}
              >
                {selectedResult.hasTamperedBlobs ? (
                  <>
                    <Warning24Regular
                      primaryFill={tokens.colorPaletteRedForeground1}
                    />
                    <div>
                      <Text weight="semibold" block>
                        Tampering Detected!
                      </Text>
                      <Text size={200}>
                        {selectedResult.records.filter((r) => r.isTampered).length} of{' '}
                        {selectedResult.records.length} block(s) have mismatched digests.
                        The blob container may have been compromised.
                      </Text>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldCheckmark24Regular
                      primaryFill={tokens.colorPaletteGreenForeground1}
                    />
                    <div>
                      <Text weight="semibold" block>
                        All Digests Match
                      </Text>
                      <Text size={200}>
                        {selectedResult.records.length > 0
                          ? `All ${selectedResult.records.length} block(s) verified successfully. No tampering detected.`
                          : 'Audit completed. See raw content for details.'}
                      </Text>
                    </div>
                  </>
                )}
              </div>

              <Caption1 block style={{ marginBottom: '8px' }}>
                File: <code>{selectedResult.fileName}</code>
                {selectedResult.lastModified &&
                  ` • ${new Date(selectedResult.lastModified).toLocaleString()}`}
              </Caption1>

              {selectedResult.validityPeriod && (
                <Caption1 block style={{ marginBottom: '8px', color: tokens.colorNeutralForeground3 }}>
                  Audit period: {selectedResult.validityPeriod.firstTrackedBlobTimestamp}
                  {' → '}
                  {selectedResult.validityPeriod.currentAuditTimestamp}
                </Caption1>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <Button
                  size="small"
                  appearance="outline"
                  icon={<ArrowDownload24Regular />}
                  onClick={handleDownloadResult}
                >
                  Download JSON
                </Button>
                <Button
                  size="small"
                  appearance={showRawContent ? 'primary' : 'outline'}
                  onClick={() => setShowRawContent(!showRawContent)}
                >
                  {showRawContent ? 'Hide Raw JSON' : 'Show Raw JSON'}
                </Button>
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={() => setSelectedResult(null)}
                >
                  Close
                </Button>
              </div>

              {/* Records DataGrid */}
              {selectedResult.records.length > 0 && (
                <DataGrid
                  items={selectedResult.records}
                  columns={recordColumns}
                  sortable
                  defaultSortState={defaultSortState}
                  getRowId={(item: AuditRecord) => item.blockId}
                  style={{ marginBottom: '12px' }}
                >
                  <DataGridHeader>
                    <DataGridRow>
                      {({ renderHeaderCell }) => (
                        <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                      )}
                    </DataGridRow>
                  </DataGridHeader>
                  <DataGridBody<AuditRecord>>
                    {({ item, rowId }) => (
                      <DataGridRow<AuditRecord> key={rowId}>
                        {({ renderCell }) => (
                          <DataGridCell>{renderCell(item)}</DataGridCell>
                        )}
                      </DataGridRow>
                    )}
                  </DataGridBody>
                </DataGrid>
              )}

              {/* Raw content */}
              {showRawContent && (
                <div className={styles.rawContent}>{selectedResult.rawContent}</div>
              )}
            </div>
          </>
        )}

        {/* Validation errors */}
        {!validation.valid && (
          <Caption1
            style={{
              color: tokens.colorPaletteRedForeground1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Warning24Regular />
            Configure all connection settings above to enable audit operations.
          </Caption1>
        )}
      </div>
    </Card>
  );
};

/** Format bytes to a human-readable size */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
