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
} from '../hooks/use-blob-app';
import type { AuditBlob, AuditRecord, AuditResult } from '../types/blob-app-types';
import type { TableColumnDefinition, DataGridProps } from '@fluentui/react-components';

// ── Demo Constants ──
const DEMO_STORAGE_ACCOUNT = 'acldgdemo';
const DEMO_CONTAINER = 'dg-data';

/** Hardcoded demo audit blobs representing the DataGuardian event audit */
const DEMO_AUDIT_BLOBS: AuditBlob[] = [
  {
    name: `${DEMO_STORAGE_ACCOUNT}/${DEMO_CONTAINER}/audit_2026-03-24T10-00-00Z.json`,
    lastModified: '2026-03-24T10:05:00Z',
    contentLength: '4096',
  },
];

/** Hardcoded demo audit result with hashes for the 6 DataGuardian event files */
const DEMO_AUDIT_RESULT: AuditResult = {
  fileName: `${DEMO_STORAGE_ACCOUNT}/${DEMO_CONTAINER}/audit_2026-03-24T10-00-00Z.json`,
  lastModified: '2026-03-24T10:05:00Z',
  rawContent: JSON.stringify([
    {
      first_tracked_blob_timestamp: '2023-10-01T12:00:00Z',
      current_audit_timestamp: '2026-03-24T10:00:00Z',
    },
    {
      block_id: 'block_id_0',
      blobs_in_block: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_PrivilegedAccessGranted_1.json', insert_time: '2023-10-01T12:00:00Z' }],
      recalculated_digest: 'a3f7b2c1d8e4f56a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
      ledger_digest: 'a3f7b2c1d8e4f56a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
      is_match: true,
    },
    {
      block_id: 'block_id_1',
      blobs_in_block: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_PriviledgedAccessActivity_2.json', insert_time: '2023-10-01T13:00:00Z' }],
      recalculated_digest: 'b4e8c3d2a9f5067b8c0d1e2f3b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
      ledger_digest: 'b4e8c3d2a9f5067b8c0d1e2f3b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
      is_match: true,
    },
    {
      block_id: 'block_id_2',
      blobs_in_block: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionStarted_3.json', insert_time: '2023-10-01T14:00:00Z' }],
      recalculated_digest: 'c5f9d4e3b0a6178c9d1e2f3c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
      ledger_digest: 'c5f9d4e3b0a6178c9d1e2f3c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
      is_match: true,
    },
    {
      block_id: 'block_id_3',
      blobs_in_block: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionAccepted_4.json', insert_time: '2023-10-01T14:05:00Z' }],
      recalculated_digest: 'd6a0e5f4c1b7289d0e2f3d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
      ledger_digest: 'd6a0e5f4c1b7289d0e2f3d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
      is_match: true,
    },
    {
      block_id: 'block_id_4',
      blobs_in_block: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionTerminated_5.json', insert_time: '2023-10-01T16:05:00Z' }],
      recalculated_digest: 'e7b1f6a5d2c8390e1f3e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
      ledger_digest: 'e7b1f6a5d2c8390e1f3e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
      is_match: true,
    },
    {
      block_id: 'block_id_5',
      blobs_in_block: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_PrivilegedAccessRevoked_6.json', insert_time: '2023-10-01T17:00:00Z' }],
      recalculated_digest: 'f8c2a7b6e3d940f2a4f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
      ledger_digest: 'f8c2a7b6e3d940f2a4f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
      is_match: true,
    },
  ], null, 2),
  records: [
    {
      blockId: 'block_id_0',
      blobsInBlock: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_PrivilegedAccessGranted_1.json', insert_time: '2023-10-01T12:00:00Z' }],
      blobName: '123e4567-e89b-12d3-a456-426614174000_PrivilegedAccessGranted_1.json',
      recalculatedDigest: 'a3f7b2c1d8e4f56a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
      ledgerDigest: 'a3f7b2c1d8e4f56a7b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
      isMatch: true,
      isTampered: false,
      user: { upn: 'admin@contoso.com', oid: '123e4567-e89b-12d3-a456-426614174000' },
    },
    {
      blockId: 'block_id_1',
      blobsInBlock: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_PriviledgedAccessActivity_2.json', insert_time: '2023-10-01T13:00:00Z' }],
      blobName: '123e4567-e89b-12d3-a456-426614174000_PriviledgedAccessActivity_2.json',
      recalculatedDigest: 'b4e8c3d2a9f5067b8c0d1e2f3b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
      ledgerDigest: 'b4e8c3d2a9f5067b8c0d1e2f3b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
      isMatch: true,
      isTampered: false,
      user: { upn: 'admin@contoso.com', oid: '123e4567-e89b-12d3-a456-426614174000' },
    },
    {
      blockId: 'block_id_2',
      blobsInBlock: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionStarted_3.json', insert_time: '2023-10-01T14:00:00Z' }],
      blobName: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionStarted_3.json',
      recalculatedDigest: 'c5f9d4e3b0a6178c9d1e2f3c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
      ledgerDigest: 'c5f9d4e3b0a6178c9d1e2f3c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
      isMatch: true,
      isTampered: false,
      user: { upn: 'admin@contoso.com', oid: '123e4567-e89b-12d3-a456-426614174000' },
    },
    {
      blockId: 'block_id_3',
      blobsInBlock: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionAccepted_4.json', insert_time: '2023-10-01T14:05:00Z' }],
      blobName: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionAccepted_4.json',
      recalculatedDigest: 'd6a0e5f4c1b7289d0e2f3d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
      ledgerDigest: 'd6a0e5f4c1b7289d0e2f3d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
      isMatch: true,
      isTampered: false,
      user: { upn: 'admin@contoso.com', oid: '123e4567-e89b-12d3-a456-426614174000' },
    },
    {
      blockId: 'block_id_4',
      blobsInBlock: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionTerminated_5.json', insert_time: '2023-10-01T16:05:00Z' }],
      blobName: '123e4567-e89b-12d3-a456-426614174000_DataGuardianSessionTerminated_5.json',
      recalculatedDigest: 'e7b1f6a5d2c8390e1f3e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
      ledgerDigest: 'e7b1f6a5d2c8390e1f3e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
      isMatch: true,
      isTampered: false,
      user: { upn: 'admin@contoso.com', oid: '123e4567-e89b-12d3-a456-426614174000' },
    },
    {
      blockId: 'block_id_5',
      blobsInBlock: [{ blob_name: '123e4567-e89b-12d3-a456-426614174000_PrivilegedAccessRevoked_6.json', insert_time: '2023-10-01T17:00:00Z' }],
      blobName: '123e4567-e89b-12d3-a456-426614174000_PrivilegedAccessRevoked_6.json',
      recalculatedDigest: 'f8c2a7b6e3d940f2a4f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
      ledgerDigest: 'f8c2a7b6e3d940f2a4f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
      isMatch: true,
      isTampered: false,
      user: { upn: 'admin@contoso.com', oid: '123e4567-e89b-12d3-a456-426614174000' },
    },
  ],
  hasTamperedBlobs: false,
  validityPeriod: {
    firstTrackedBlobTimestamp: '2023-10-01T12:00:00Z',
    currentAuditTimestamp: '2026-03-24T10:00:00Z',
  },
};

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
 * BlobManagedAppExplorer – Demo-ready version with pre-populated data
 * for the DataGuardian scenario using acldgdemo / dg-data.
 */
export const BlobManagedAppExplorer: React.FC = () => {
  const styles = useStyles();
  const { config, updateConfig, validation } = useBlobAppConfig();

  // Audit trigger state — pre-populated for demo
  const [auditStorageAccount, setAuditStorageAccount] = useState(DEMO_STORAGE_ACCOUNT);
  const [auditContainer, setAuditContainer] = useState(DEMO_CONTAINER);
  const [includeUsers, setIncludeUsers] = useState(true);
  const triggerAuditMutation = useTriggerAudit(config);

  // Audit results browsing state — pre-populated for demo
  const [browseStorageAccount, setBrowseStorageAccount] = useState(DEMO_STORAGE_ACCOUNT);
  const [browseContainer, setBrowseContainer] = useState(DEMO_CONTAINER);
  const [demoBlobs, setDemoBlobs] = useState<AuditBlob[] | null>(null);
  const [selectedResult, setSelectedResult] = useState<AuditResult | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);

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

  /** Demo: simulate fetching results with hardcoded data */
  const handleFetchResults = useCallback(() => {
    setDemoBlobs(DEMO_AUDIT_BLOBS);
  }, []);

  /** Demo: simulate viewing a result with hardcoded audit data */
  const handleViewResult = useCallback((_blob: AuditBlob) => {
    setSelectedResult(DEMO_AUDIT_RESULT);
    setShowRawContent(false);
  }, []);

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
            <Badge appearance="outline" color="informative" size="small">Demo</Badge>
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
              icon={<Search24Regular />}
              onClick={handleFetchResults}
            >
              Fetch Results
            </Button>
          </div>

          {/* Demo blob list */}
          {demoBlobs && demoBlobs.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <Text size={200} weight="semibold" block style={{ marginBottom: '8px' }}>
                {demoBlobs.length} audit result{demoBlobs.length !== 1 ? 's' : ''} found
              </Text>
              {demoBlobs.map((blob) => (
                <div
                  key={blob.name}
                  className={styles.blobListItem}
                  onClick={() => handleViewResult(blob)}
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
                          handleViewResult(blob);
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
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
                        All {selectedResult.records.length} block(s) verified successfully. No tampering detected.
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
