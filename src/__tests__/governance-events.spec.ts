/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, expect, it } from 'vitest';
import {
  buildGovernanceEventMeta,
  CATEGORY_ORDER,
  categoryDisplayName,
  classifyGovEvent,
  decodeGovValue,
  getGovernanceLikePatterns,
  getGovernancePrefixes,
  getKnownGovernanceTableNames,
} from '../utils/governance-events';

describe('classifyGovEvent', () => {
  it('classifies member cert writes', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'abc123',
      isDelete: false,
    });
    expect(r.category).toBe('members');
    expect(r.kind).toBe('members:write');
    expect(r.label).toMatch(/Member added or updated/);
    expect(r.noisy).toBe(false);
  });

  it('classifies member cert deletes as removals', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'abc123',
      isDelete: true,
    });
    expect(r.kind).toBe('members:delete');
    expect(r.label).toMatch(/Member removed/);
  });

  it('labels member ack rows distinctly from cert rows', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.members.acks',
      keyName: 'mem1',
      isDelete: false,
    });
    expect(r.label).toMatch(/Member ack/);
  });

  it('classifies user cert writes', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.users.certs',
      keyName: 'user1',
      isDelete: false,
    });
    expect(r.category).toBe('users');
    expect(r.label).toMatch(/User added/);
  });

  it('handles legacy node table prefix (public:ccf.nodes.info)', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.nodes.info',
      keyName: 'node1',
      isDelete: false,
    });
    expect(r.category).toBe('nodes');
    expect(r.label).toMatch(/Node added or updated/);
  });

  it('handles current node code_ids', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.nodes.code_ids',
      keyName: 'mrenclave-hex',
      isDelete: false,
    });
    expect(r.label).toMatch(/Code ID added/);
  });

  it('classifies constitution writes', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.constitution',
      keyName: '0',
      isDelete: false,
    });
    expect(r.category).toBe('constitution');
    expect(r.label).toBe('Constitution updated');
  });

  it('labels proposal body deletes as "removed", not "closed"', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.proposals',
      keyName: 'proposal-id-xyz',
      isDelete: true,
    });
    expect(r.category).toBe('proposals');
    expect(r.label).toMatch(/Proposal body removed/);
    expect(r.label).not.toMatch(/closed/i);
  });

  it('labels proposal_info writes as "info updated"', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.proposals_info',
      keyName: 'proposal-id-xyz',
      isDelete: false,
    });
    expect(r.label).toMatch(/Proposal info updated/);
  });

  it('marks cose_history as noisy', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.cose_history',
      keyName: 'k',
      isDelete: false,
    });
    expect(r.noisy).toBe(true);
    expect(r.category).toBe('history');
  });

  it('marks modules_quickjs_bytecode as noisy', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.modules_quickjs_bytecode',
      keyName: 'm',
      isDelete: false,
    });
    expect(r.noisy).toBe(true);
    expect(r.category).toBe('modules');
  });

  it('falls back to "other" for unknown gov-prefixed tables', () => {
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.totally_new_thing',
      keyName: 'k',
      isDelete: false,
    });
    expect(r.category).toBe('other');
  });

  it('matches case-insensitively', () => {
    const r = classifyGovEvent({
      mapName: 'PUBLIC:CCF.GOV.MEMBERS.CERTS',
      keyName: 'abc',
      isDelete: false,
    });
    expect(r.category).toBe('members');
  });

  it('truncates long key names in labels', () => {
    const long = 'x'.repeat(200);
    const r = classifyGovEvent({
      mapName: 'public:ccf.gov.users.certs',
      keyName: long,
      isDelete: false,
    });
    expect(r.label.length).toBeLessThan(80);
    expect(r.label).toContain('…');
  });
});

describe('buildGovernanceEventMeta', () => {
  it('round-trips category/kind/label from raw row', () => {
    const meta = buildGovernanceEventMeta({
      seqno: 17,
      transactionId: '2.17',
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'mem1',
      op: 'write',
    });
    expect(meta.category).toBe('members');
    expect(meta.kind).toBe('members:write');
    expect(meta.seqno).toBe(17);
    expect(meta.transactionId).toBe('2.17');
  });
});

describe('decodeGovValue', () => {
  it('returns empty for delete ops', () => {
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'mem1',
      valueText: null,
      valueBytes: null,
      isDelete: true,
    });
    expect(d.rawKind).toBe('empty');
    expect(d.summary).toMatch(/Deleted/);
  });

  it('decodes JSON values with key/value summary', () => {
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.members.info',
      keyName: 'mem1',
      valueText: JSON.stringify({ status: 'ACTIVE', recovery_role: 'NonParticipant' }),
      valueBytes: null,
      isDelete: false,
    });
    expect(d.rawKind).toBe('json');
    expect(d.parsed).toMatchObject({ status: 'ACTIVE' });
    expect(d.summary).toMatch(/status=ACTIVE/);
  });

  it('detects PEM certificates', () => {
    const pem = `-----BEGIN CERTIFICATE-----\nMIIBcDCCARagAwIBAgIUI9wO=\n-----END CERTIFICATE-----`;
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'mem1',
      valueText: pem,
      valueBytes: null,
      isDelete: false,
    });
    expect(d.rawKind).toBe('pem');
    expect(d.summary).toContain('CERTIFICATE');
    // No NotBefore/NotAfter claim in v1.
    expect(d.summary).not.toMatch(/NotBefore|NotAfter/);
  });

  it('falls back to text when payload is non-JSON, non-PEM', () => {
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.modules',
      keyName: 'mod.js',
      valueText: 'console.log("hello")',
      valueBytes: null,
      isDelete: false,
    });
    expect(d.rawKind).toBe('text');
  });

  it('reports binary when no text view is available', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.modules_quickjs_bytecode',
      keyName: 'm',
      valueText: null,
      valueBytes: bytes,
      isDelete: false,
    });
    expect(d.rawKind).toBe('binary');
    expect(d.hexPreview).toBe('deadbeef');
  });

  it('trims hex preview and marks ellipsis when payload exceeds limit', () => {
    const bytes = new Uint8Array(300).fill(0xab);
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.modules_quickjs_bytecode',
      keyName: 'm',
      valueText: null,
      valueBytes: bytes,
      isDelete: false,
    });
    expect(d.hexPreview?.endsWith('…')).toBe(true);
  });

  it('returns empty placeholder for missing payload on writes', () => {
    const d = decodeGovValue({
      mapName: 'public:ccf.gov.members.certs',
      keyName: 'mem1',
      valueText: null,
      valueBytes: null,
      isDelete: false,
    });
    expect(d.rawKind).toBe('empty');
  });
});

describe('scope helpers', () => {
  it('returns three governance prefixes', () => {
    expect(getGovernancePrefixes()).toEqual([
      'public:ccf.gov.',
      'public:ccf.governance.',
      'public:ccf.nodes.',
    ]);
  });

  it('builds matching LIKE patterns', () => {
    expect(getGovernanceLikePatterns()).toEqual([
      'public:ccf.gov.%',
      'public:ccf.governance.%',
      'public:ccf.nodes.%',
    ]);
  });

  it('lists all known governance table names from constants', () => {
    const names = getKnownGovernanceTableNames();
    expect(names).toContain('public:ccf.gov.members.certs');
    expect(names).toContain('public:ccf.gov.proposals_info');
    expect(names).toContain('public:ccf.governance.constitution');
    expect(names.length).toBeGreaterThan(20);
  });
});

describe('category presentation', () => {
  it('orders categories for stable rendering', () => {
    expect(CATEGORY_ORDER[0]).toBe('service');
    expect(CATEGORY_ORDER).toContain('proposals');
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('other');
  });

  it('returns presentation names with acronyms upper-cased', () => {
    expect(categoryDisplayName('jwt')).toBe('JWT');
    expect(categoryDisplayName('tls')).toBe('TLS');
    expect(categoryDisplayName('scitt')).toBe('SCITT');
    expect(categoryDisplayName('members')).toBe('Members');
  });
});
