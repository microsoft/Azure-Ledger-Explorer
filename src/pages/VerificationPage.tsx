/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */



import React, { useCallback, useState } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Body1,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { DocumentSave24Regular } from '@fluentui/react-icons';
import { VerificationComponent } from '../components/VerificationComponent';
import { useDatabase, useEnhancedStats, useLedgerFiles } from '../hooks/use-ccf-data';
import {
  buildVerificationReport,
  type GovernanceTableSummary,
} from '../utils/verification-report';
import { buildExportFilename, mimeFor } from '../utils/export';
import { download } from '../utils/download';
import {
  trackEvent,
  trackException,
  TelemetryEvents,
} from '../services/telemetry/telemetry-service';

const APP_VERSION = (import.meta as ImportMeta & { env?: { VITE_APP_VERSION?: string } }).env
  ?.VITE_APP_VERSION;

/** Inline MST gate read until the shared feature-flag util lands on main. */
function readMstGateFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('mst') === 'true';
  } catch {
    return false;
  }
}

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
  reportSection: {
    marginTop: tokens.spacingVerticalXL,
    marginBottom: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  reportRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
    flexWrap: 'wrap',
  },
  reportError: {
    marginTop: tokens.spacingVerticalM,
  },
});

export const VerificationPage: React.FC = () => {
  const styles = useStyles();
  const { data: database } = useDatabase();
  const { data: stats } = useEnhancedStats();
  const { data: ledgerFiles } = useLedgerFiles();

  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleGenerateReport = useCallback(async () => {
    if (!database || !stats || !ledgerFiles) return;
    setReportError(null);
    setReportBusy(true);
    const startedAt = performance.now();
    try {
      // Governance summary: count of kv_writes per public:ccf.gov.* table.
      const govRows = (await database.executeQuery(
        `SELECT map_name, COUNT(*) AS write_count
           FROM kv_writes
          WHERE map_name LIKE 'public:ccf.gov.%'
          GROUP BY map_name
          ORDER BY map_name`
      )) as Array<{ map_name: string; write_count: number }>;
      const governanceSummary: GovernanceTableSummary[] = govRows.map((r) => ({
        tableName: r.map_name,
        writeCount: r.write_count,
      }));

      // Sequence number range across all transactions.
      const rangeRows = (await database.executeQuery(
        `SELECT MIN(version) AS min_v, MAX(version) AS max_v FROM transactions`
      )) as Array<{ min_v: number | null; max_v: number | null }>;
      const seqnoRange =
        rangeRows[0]?.min_v != null && rangeRows[0]?.max_v != null
          ? { min: rangeRows[0].min_v, max: rangeRows[0].max_v }
          : null;

      const md = buildVerificationReport({
        generatedAt: new Date(),
        appVersion: APP_VERSION,
        mstEnabled: readMstGateFromUrl(),
        files: ledgerFiles.map((f) => ({
          filename: f.filename,
          fileSize: f.fileSize,
          verified: f.verified,
          verifiedAt: f.verifiedAt,
          verificationError: f.verificationError,
        })),
        stats: {
          fileCount: stats.fileCount,
          transactionCount: stats.transactionCount,
          writeCount: stats.writeCount,
          deleteCount: stats.deleteCount,
          userWriteCount: stats.userWriteCount,
          tableCount: stats.tableCount,
          uniqueKeyCount: stats.uniqueKeyCount,
          totalDataSize: stats.totalDataSize,
          oldestTransaction: stats.oldestTransaction,
          newestTransaction: stats.newestTransaction,
        },
        governanceSummary,
        seqnoRange,
      });

      const filename = buildExportFilename('verification-report', null, 'md');
      const byteCount = download(filename, md, mimeFor('md'));
      const durationMs = Math.round(performance.now() - startedAt);
      trackEvent(TelemetryEvents.EXPORT_REPORT_GENERATED, {
        format: 'md',
        surface: 'verification',
        rowCount: ledgerFiles.length,
        byteCount,
        durationMs,
        success: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setReportError(message);
      if (err instanceof Error) {
        trackException(err, { surface: 'verification', flow: 'generate-report' });
      }
    } finally {
      setReportBusy(false);
    }
  }, [database, ledgerFiles, stats]);

  const reportDisabled = !database || !stats || !ledgerFiles || reportBusy;

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

        <div className={styles.reportSection}>
          <Text as="h2" size={500} weight="semibold">
            Audit report
          </Text>
          <Body1>
            Download a self-contained Markdown report of the imported files, aggregate
            statistics, governance write counts, and verification status. Open the
            file in any Markdown viewer or print it from your browser to PDF.
          </Body1>
          <div className={styles.reportRow}>
            <Button
              appearance="primary"
              icon={reportBusy ? <Spinner size="tiny" /> : <DocumentSave24Regular />}
              disabled={reportDisabled}
              onClick={handleGenerateReport}
              data-testid="verification-generate-report"
            >
              Generate report
            </Button>
            <Body1>
              {ledgerFiles?.length ? `${ledgerFiles.length} file(s) included` : 'No files imported'}
            </Body1>
          </div>
          {reportError && (
            <div className={styles.reportError}>
              <MessageBar intent="error">
                <MessageBarBody>Failed to generate report: {reportError}</MessageBarBody>
              </MessageBar>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;
