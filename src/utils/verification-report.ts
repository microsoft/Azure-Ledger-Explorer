/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */


/** A single ledger file entry as seen by the report. */
export interface VerificationReportFileEntry {
  filename: string;
  fileSize: number;
  /** null = not run, true = passed, false = failed. */
  verified: boolean | null;
  verifiedAt: string | null;
  verificationError: string | null;
}

/** Aggregate database stats used by the report. */
export interface VerificationReportStats {
  fileCount: number;
  transactionCount: number;
  writeCount: number;
  deleteCount: number;
  userWriteCount?: number;
  tableCount?: number;
  uniqueKeyCount?: number;
  totalDataSize?: number;
  oldestTransaction?: Date | null;
  newestTransaction?: Date | null;
}

/** One row of the governance summary table. */
export interface GovernanceTableSummary {
  tableName: string;
  writeCount: number;
}

/** Input to {@link buildVerificationReport}. */
export interface VerificationReportInput {
  /** Generation timestamp. */
  generatedAt: Date;
  /** App version (from package.json or similar). Optional. */
  appVersion?: string;
  /** Whether the MST gate is on at generation time. */
  mstEnabled: boolean;
  /** Ledger files included in the explorer. */
  files: ReadonlyArray<VerificationReportFileEntry>;
  /** Aggregate stats. */
  stats: VerificationReportStats;
  /** Optional list of `public:ccf.gov.*` table write counts. */
  governanceSummary?: ReadonlyArray<GovernanceTableSummary>;
  /** Optional [min, max] sequence number range across all files. */
  seqnoRange?: { min: number; max: number } | null;
}

const REPORT_TITLE = 'Azure Ledger Explorer — Verification Report';

/**
 * Build a self-contained Markdown verification report.
 *
 * The output is plain Markdown (no embedded HTML) and prints cleanly via the
 * browser's "Print > Save as PDF" pipeline.
 */
export function buildVerificationReport(input: VerificationReportInput): string {
  const lines: string[] = [];

  // ── Title and metadata ──────────────────────────────────────────────────
  lines.push(`# ${REPORT_TITLE}`);
  lines.push('');
  lines.push(`**Generated:** ${input.generatedAt.toISOString()}`);
  if (input.appVersion) {
    lines.push(`**App version:** ${escapeMd(input.appVersion)}`);
  }
  lines.push(`**MST feature gate:** ${input.mstEnabled ? 'enabled' : 'disabled'}`);
  lines.push('');

  // ── Input files inventory ───────────────────────────────────────────────
  lines.push('## Input files');
  lines.push('');
  if (input.files.length === 0) {
    lines.push('_No files imported._');
  } else {
    lines.push('| File | Size | Verification | Verified at | Error |');
    lines.push('|---|---:|---|---|---|');
    for (const f of input.files) {
      lines.push(
        `| ${escapeMdCell(f.filename)} | ${formatBytes(f.fileSize)} | ${formatVerified(
          f.verified
        )} | ${escapeMdCell(f.verifiedAt ?? '—')} | ${escapeMdCell(
          f.verificationError ?? '—'
        )} |`
      );
    }
  }
  lines.push('');

  // ── Aggregate stats ─────────────────────────────────────────────────────
  lines.push('## Aggregate statistics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| File count | ${input.stats.fileCount.toLocaleString('en-US')} |`);
  lines.push(`| Transaction count | ${input.stats.transactionCount.toLocaleString('en-US')} |`);
  lines.push(`| Writes | ${input.stats.writeCount.toLocaleString('en-US')} |`);
  lines.push(`| Deletes | ${input.stats.deleteCount.toLocaleString('en-US')} |`);
  if (input.stats.userWriteCount != null) {
    lines.push(`| User writes (non-governance) | ${input.stats.userWriteCount.toLocaleString('en-US')} |`);
  }
  if (input.stats.tableCount != null) {
    lines.push(`| Distinct CCF tables | ${input.stats.tableCount.toLocaleString('en-US')} |`);
  }
  if (input.stats.uniqueKeyCount != null) {
    lines.push(`| Distinct keys | ${input.stats.uniqueKeyCount.toLocaleString('en-US')} |`);
  }
  if (input.stats.totalDataSize != null) {
    lines.push(`| Total data size | ${formatBytes(input.stats.totalDataSize)} |`);
  }
  if (input.seqnoRange) {
    lines.push(
      `| Sequence number range | ${input.seqnoRange.min.toLocaleString('en-US')} – ${input.seqnoRange.max.toLocaleString('en-US')} |`
    );
  }
  if (input.stats.oldestTransaction) {
    lines.push(`| Oldest transaction | ${input.stats.oldestTransaction.toISOString()} |`);
  }
  if (input.stats.newestTransaction) {
    lines.push(`| Newest transaction | ${input.stats.newestTransaction.toISOString()} |`);
  }
  lines.push('');

  // ── Verification summary ────────────────────────────────────────────────
  lines.push('## Verification summary');
  lines.push('');
  const verifiedCount = input.files.filter((f) => f.verified === true).length;
  const failedCount = input.files.filter((f) => f.verified === false).length;
  const pendingCount = input.files.filter((f) => f.verified == null).length;
  lines.push(`- **Files passing Merkle verification:** ${verifiedCount}`);
  lines.push(`- **Files with verification failures:** ${failedCount}`);
  lines.push(`- **Files not yet verified:** ${pendingCount}`);
  lines.push('');

  // ── Governance summary ──────────────────────────────────────────────────
  lines.push('## Governance summary');
  lines.push('');
  const gov = input.governanceSummary ?? [];
  if (gov.length === 0) {
    lines.push('_No `public:ccf.gov.*` writes recorded._');
  } else {
    lines.push('Writes per CCF governance table (read-only enumeration; no semantic decoding in this PR — see Governance page in a future release).');
    lines.push('');
    lines.push('| Table | Writes |');
    lines.push('|---|---:|');
    for (const g of gov) {
      lines.push(`| \`${escapeMdCell(g.tableName)}\` | ${g.writeCount.toLocaleString('en-US')} |`);
    }
  }
  lines.push('');

  // ── MST section (gated) ─────────────────────────────────────────────────
  if (input.mstEnabled) {
    lines.push('## Microsoft Signing Transparency (preview)');
    lines.push('');
    lines.push(
      '_The MST feature gate is enabled in this report. MST receipts are a preview feature; this section is reserved for future structured MST verification artifacts._'
    );
    lines.push('');
  }

  // ── Scope and caveats ───────────────────────────────────────────────────
  lines.push('## Scope and caveats');
  lines.push('');
  lines.push(
    '- This report enumerates the local Azure Ledger Explorer\'s view of the imported ledger files. It is **not** an independent cryptographic attestation.'
  );
  lines.push(
    '- Per-file `verification` columns reflect the result of the Merkle-tree integrity check that ran in the Verification page. Re-run that check in the app to refresh results.'
  );
  lines.push(
    '- Write-receipt and MST-receipt validations are not yet emitted as structured artifacts; this report omits them. They will be added in a follow-up release.'
  );
  lines.push(
    '- All data shown was processed entirely in the user\'s browser; no ledger contents left the device to generate this report.'
  );
  lines.push('');

  return lines.join('\n');
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function formatVerified(verified: boolean | null): string {
  if (verified === true) return '✅ Passed';
  if (verified === false) return '❌ Failed';
  return '— Not run';
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const i = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const decimals = i === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${BYTE_UNITS[i]}`;
}

/** Escape characters that would break a Markdown table cell. */
function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Escape characters that would break Markdown inline. */
function escapeMd(s: string): string {
  return s.replace(/[`*_]/g, (c) => `\\${c}`);
}
