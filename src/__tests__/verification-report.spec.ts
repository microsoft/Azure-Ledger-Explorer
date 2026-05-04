/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect } from 'vitest';
import {
  buildVerificationReport,
  type VerificationReportInput,
} from '../utils/verification-report';

const baseInput = (): VerificationReportInput => ({
  generatedAt: new Date('2026-05-04T14:02:00.000Z'),
  appVersion: '1.2.3',
  mstEnabled: false,
  files: [
    {
      filename: 'ledger_1-14.committed',
      fileSize: 169_472,
      verified: true,
      verifiedAt: '2026-05-04T13:50:00.000Z',
      verificationError: null,
    },
    {
      filename: 'ledger_15-30.committed',
      fileSize: 250_000,
      verified: false,
      verifiedAt: '2026-05-04T13:55:00.000Z',
      verificationError: 'Merkle root mismatch',
    },
    {
      filename: 'ledger_31-45.committed',
      fileSize: 100_000,
      verified: null,
      verifiedAt: null,
      verificationError: null,
    },
  ],
  stats: {
    fileCount: 3,
    transactionCount: 1234,
    writeCount: 1000,
    deleteCount: 234,
    userWriteCount: 800,
    tableCount: 12,
    uniqueKeyCount: 456,
    totalDataSize: 519_472,
    oldestTransaction: new Date('2026-04-01T00:00:00.000Z'),
    newestTransaction: new Date('2026-05-04T13:00:00.000Z'),
  },
  governanceSummary: [
    { tableName: 'public:ccf.gov.members', writeCount: 5 },
    { tableName: 'public:ccf.gov.constitution', writeCount: 1 },
  ],
  seqnoRange: { min: 1, max: 45 },
});

describe('buildVerificationReport', () => {
  it('produces a valid Markdown report with title and timestamp', () => {
    const md = buildVerificationReport(baseInput());
    expect(md).toMatch(/^# Azure Ledger Explorer — Verification Report\n/);
    expect(md).toContain('**Generated:** 2026-05-04T14:02:00.000Z');
    expect(md).toContain('**App version:** 1.2.3');
  });

  it('records the MST gate state explicitly', () => {
    const off = buildVerificationReport(baseInput());
    expect(off).toContain('**MST feature gate:** disabled');
    expect(off).not.toMatch(/Microsoft Signing Transparency/);

    const on = buildVerificationReport({ ...baseInput(), mstEnabled: true });
    expect(on).toContain('**MST feature gate:** enabled');
    expect(on).toMatch(/## Microsoft Signing Transparency \(preview\)/);
  });

  it('renders the input files table with verification status icons', () => {
    const md = buildVerificationReport(baseInput());
    expect(md).toContain('| File | Size | Verification |');
    expect(md).toContain('| ledger_1-14.committed |');
    expect(md).toMatch(/✅ Passed/);
    expect(md).toMatch(/❌ Failed/);
    expect(md).toMatch(/— Not run/);
  });

  it('handles an empty file list gracefully', () => {
    const md = buildVerificationReport({
      ...baseInput(),
      files: [],
    });
    expect(md).toContain('_No files imported._');
  });

  it('summarises pass / fail / pending counts', () => {
    const md = buildVerificationReport(baseInput());
    expect(md).toContain('- **Files passing Merkle verification:** 1');
    expect(md).toContain('- **Files with verification failures:** 1');
    expect(md).toContain('- **Files not yet verified:** 1');
  });

  it('emits a governance summary table when entries are provided', () => {
    const md = buildVerificationReport(baseInput());
    expect(md).toContain('## Governance summary');
    expect(md).toContain('| `public:ccf.gov.members` | 5 |');
    expect(md).toContain('| `public:ccf.gov.constitution` | 1 |');
  });

  it('shows the empty-governance message when none are provided', () => {
    const md = buildVerificationReport({
      ...baseInput(),
      governanceSummary: [],
    });
    expect(md).toContain('_No `public:ccf.gov.*` writes recorded._');
  });

  it('always emits the scope and caveats section', () => {
    const md = buildVerificationReport(baseInput());
    expect(md).toContain('## Scope and caveats');
    expect(md).toMatch(/not[*_]* an independent cryptographic attestation/);
    expect(md).toContain('processed entirely in the user');
  });

  it('escapes pipe characters in filenames so the table stays valid', () => {
    const md = buildVerificationReport({
      ...baseInput(),
      files: [
        {
          filename: 'weird|file|name.committed',
          fileSize: 100,
          verified: null,
          verifiedAt: null,
          verificationError: null,
        },
      ],
    });
    expect(md).toContain('weird\\|file\\|name.committed');
  });

  it('omits optional stats rows when not provided', () => {
    const stripped: VerificationReportInput = {
      ...baseInput(),
      stats: { fileCount: 0, transactionCount: 0, writeCount: 0, deleteCount: 0 },
      seqnoRange: null,
      governanceSummary: undefined,
    };
    const md = buildVerificationReport(stripped);
    expect(md).not.toContain('User writes (non-governance)');
    expect(md).not.toContain('Sequence number range');
    expect(md).not.toContain('Oldest transaction');
  });
});
