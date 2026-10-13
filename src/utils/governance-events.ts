/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Pure decoder + classifier for CCF governance KV events.
 *
 * Two-phase API:
 *  - {@link classifyGovEvent} runs on metadata only (`map_name`, `key_name`,
 *    `is_delete`) so it can power the timeline view without paying the cost of
 *    loading the value payload for every row.
 *  - {@link decodeGovValue} is called lazily on drill-down and accepts both the
 *    decoded text view and the raw bytes view, returning a structured summary.
 *
 * No React or DB dependencies — keep it pure for unit-testability.
 */

import { CCF_GOV_TABLES, CCF_LEGACY_TABLES } from '@microsoft/ccf-database';

export type GovernanceCategory =
  | 'members'
  | 'users'
  | 'nodes'
  | 'service'
  | 'constitution'
  | 'proposals'
  | 'jwt'
  | 'tls'
  | 'recovery'
  | 'scitt'
  | 'modules'
  | 'history'
  | 'other';

export type GovernanceEventOp = 'write' | 'delete';

export interface GovernanceEventMeta {
  /** Sequence number from the ledger; primary timeline axis. */
  seqno: number;
  /** Original transaction ID (string) — used for drill-down navigation. */
  transactionId: string;
  /** Fully-qualified KV table name. */
  mapName: string;
  /** Key name within the table. */
  keyName: string;
  /** Whether this row came from `kv_writes` or `kv_deletes`. */
  op: GovernanceEventOp;
  /** Logical category (used for filter chips and lane assignment). */
  category: GovernanceCategory;
  /** Stable kind identifier, e.g. `members:write`, `proposals:delete`. */
  kind: string;
  /** Short human-readable label for timeline tooltips and the drill-down. */
  label: string;
  /**
   * True if the row's table is high-volume / spammy and should be hidden
   * unless the user explicitly opts in (cose history, quickjs bytecode, …).
   */
  noisy: boolean;
}

export type GovernanceRawKind = 'json' | 'pem' | 'text' | 'binary' | 'empty';

export interface GovernanceEventDetail {
  /** What kind of payload we actually saw on the wire. */
  rawKind: GovernanceRawKind;
  /** Decoded text view, when available (UTF-8 from `value_text`). */
  text: string | null;
  /** Hex preview of `value_bytes` (first 256 bytes). */
  hexPreview: string | null;
  /** Parsed JSON, when `rawKind === 'json'`. */
  parsed: unknown;
  /** Multi-line summary built from the payload (or a placeholder string). */
  summary: string;
}

interface CategoryRule {
  category: GovernanceCategory;
  /** Tables under this category (case-insensitive prefix match). */
  prefixes: readonly string[];
  /** Tables under this category that should default to hidden. */
  noisyPrefixes?: readonly string[];
}

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: 'members',
    prefixes: ['public:ccf.gov.members.'],
  },
  {
    category: 'users',
    prefixes: ['public:ccf.gov.users.'],
  },
  {
    category: 'nodes',
    prefixes: ['public:ccf.gov.nodes.', 'public:ccf.nodes.'],
  },
  {
    category: 'service',
    prefixes: ['public:ccf.gov.service.', 'public:ccf.governance.service'],
  },
  {
    category: 'constitution',
    prefixes: [
      'public:ccf.gov.constitution',
      'public:ccf.governance.constitution',
    ],
  },
  {
    category: 'proposals',
    prefixes: [
      'public:ccf.gov.proposals',
      'public:ccf.gov.proposals_info',
      'public:ccf.gov.cose_recent_proposals',
    ],
    noisyPrefixes: ['public:ccf.gov.cose_recent_proposals'],
  },
  {
    category: 'jwt',
    prefixes: [
      'public:ccf.gov.jwt.',
      'public:ccf.gov.jwt_',
      'public:ccf.governance.jwt',
    ],
  },
  {
    category: 'tls',
    prefixes: [
      'public:ccf.gov.tls.',
      'public:ccf.gov.tls_',
    ],
  },
  {
    category: 'recovery',
    prefixes: [
      'public:ccf.gov.recovery',
      'public:ccf.governance.recovery',
    ],
  },
  {
    category: 'scitt',
    prefixes: ['public:ccf.gov.scitt.'],
  },
  {
    category: 'modules',
    prefixes: [
      'public:ccf.gov.modules',
      'public:ccf.governance.modules',
      'public:ccf.governance.js_modules',
      'public:ccf.gov.js_modules',
      'public:ccf.gov.js_runtime_options',
      'public:ccf.gov.interpreter.flush',
    ],
    noisyPrefixes: [
      'public:ccf.gov.modules_quickjs_bytecode',
      'public:ccf.gov.modules_quickjs_version',
    ],
  },
  {
    category: 'history',
    prefixes: [
      'public:ccf.gov.history',
      'public:ccf.gov.cose_history',
    ],
    noisyPrefixes: [
      'public:ccf.gov.history',
      'public:ccf.gov.cose_history',
    ],
  },
];

/** Build the union of governance-table prefixes used to scope SQL queries. */
export function getGovernancePrefixes(): readonly string[] {
  return [
    'public:ccf.gov.',
    'public:ccf.governance.',
    'public:ccf.nodes.',
  ];
}

/**
 * Build a list of `LIKE` patterns suitable for SQL `WHERE map_name LIKE ?`
 * binding. Returned in a stable order.
 */
export function getGovernanceLikePatterns(): string[] {
  return getGovernancePrefixes().map((p) => `${p}%`);
}

/** All non-prefix governance table names from the constants module, for tests / completeness. */
export function getKnownGovernanceTableNames(): readonly string[] {
  return [
    ...Object.values(CCF_GOV_TABLES),
    ...Object.values(CCF_LEGACY_TABLES),
  ];
}

function lowercasePrefixMatches(name: string, prefixes: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return prefixes.some((p) => lower.startsWith(p.toLowerCase()));
}

function findCategory(mapName: string): {
  category: GovernanceCategory;
  noisy: boolean;
} {
  for (const rule of CATEGORY_RULES) {
    if (lowercasePrefixMatches(mapName, rule.prefixes)) {
      const noisy = rule.noisyPrefixes
        ? lowercasePrefixMatches(mapName, rule.noisyPrefixes)
        : false;
      return { category: rule.category, noisy };
    }
  }
  return { category: 'other', noisy: false };
}

function shortKey(keyName: string, max = 24): string {
  if (keyName.length <= max) return keyName;
  return `${keyName.slice(0, max)}…`;
}

interface ClassifyInput {
  mapName: string;
  keyName: string;
  isDelete: boolean;
}

/**
 * Classify a governance KV event using only its metadata.
 *
 * No payload access is required, which keeps the timeline query small.
 */
export function classifyGovEvent(input: ClassifyInput): {
  category: GovernanceCategory;
  kind: string;
  label: string;
  noisy: boolean;
} {
  const { mapName, keyName, isDelete } = input;
  const { category, noisy } = findCategory(mapName);
  const op = isDelete ? 'delete' : 'write';
  const kind = `${category}:${op}`;

  const tail = mapName.split('.').pop() ?? mapName;
  const niceTable = tail
    .replace(/_/g, ' ')
    .replace(/^./, (ch) => ch.toUpperCase());
  const niceKey = shortKey(keyName);

  let label: string;
  if (category === 'proposals') {
    if (mapName.endsWith('proposals_info')) {
      label = isDelete
        ? `Proposal info removed (${niceKey})`
        : `Proposal info updated (${niceKey})`;
    } else if (
      mapName === CCF_GOV_TABLES.PROPOSALS ||
      mapName.endsWith('.proposals')
    ) {
      label = isDelete
        ? `Proposal body removed (${niceKey})`
        : `Proposal submitted (${niceKey})`;
    } else {
      label = isDelete
        ? `${niceTable} removed (${niceKey})`
        : `${niceTable} updated (${niceKey})`;
    }
  } else if (category === 'members') {
    if (mapName.endsWith('certs')) {
      label = isDelete
        ? `Member removed (${niceKey})`
        : `Member added or updated (${niceKey})`;
    } else if (mapName.endsWith('acks')) {
      label = `Member ack (${niceKey})`;
    } else {
      label = isDelete
        ? `Members ${niceTable.toLowerCase()} removed (${niceKey})`
        : `Members ${niceTable.toLowerCase()} updated (${niceKey})`;
    }
  } else if (category === 'users') {
    if (mapName.endsWith('certs')) {
      label = isDelete ? `User removed (${niceKey})` : `User added (${niceKey})`;
    } else {
      label = isDelete
        ? `User ${niceTable.toLowerCase()} removed (${niceKey})`
        : `User ${niceTable.toLowerCase()} updated (${niceKey})`;
    }
  } else if (category === 'nodes') {
    if (mapName.endsWith('info')) {
      label = isDelete
        ? `Node removed (${niceKey})`
        : `Node added or updated (${niceKey})`;
    } else if (mapName.endsWith('code_ids')) {
      label = isDelete
        ? `Code ID removed (${niceKey})`
        : `Code ID added (${niceKey})`;
    } else {
      label = isDelete
        ? `Node ${niceTable.toLowerCase()} removed (${niceKey})`
        : `Node ${niceTable.toLowerCase()} updated (${niceKey})`;
    }
  } else if (category === 'constitution') {
    label = isDelete ? 'Constitution cleared' : 'Constitution updated';
  } else if (category === 'service') {
    label = isDelete
      ? `Service ${niceTable.toLowerCase()} cleared`
      : `Service ${niceTable.toLowerCase()} updated`;
  } else if (category === 'jwt' || category === 'tls' || category === 'modules') {
    label = isDelete
      ? `${niceTable} removed (${niceKey})`
      : `${niceTable} updated (${niceKey})`;
  } else if (category === 'recovery') {
    label = `Recovery ${niceTable.toLowerCase()} ${isDelete ? 'cleared' : 'updated'} (${niceKey})`;
  } else if (category === 'scitt') {
    label = `SCITT ${niceTable.toLowerCase()} ${isDelete ? 'cleared' : 'updated'}`;
  } else if (category === 'history') {
    label = isDelete ? `${niceTable} pruned` : `${niceTable} appended`;
  } else {
    label = isDelete
      ? `${mapName} key ${niceKey} removed`
      : `${mapName} key ${niceKey} updated`;
  }

  return { category, kind, label, noisy };
}

/** Build a `GovernanceEventMeta` from a raw row payload. */
export function buildGovernanceEventMeta(row: {
  seqno: number;
  transactionId: string;
  mapName: string;
  keyName: string;
  op: GovernanceEventOp;
}): GovernanceEventMeta {
  const cls = classifyGovEvent({
    mapName: row.mapName,
    keyName: row.keyName,
    isDelete: row.op === 'delete',
  });
  return {
    seqno: row.seqno,
    transactionId: row.transactionId,
    mapName: row.mapName,
    keyName: row.keyName,
    op: row.op,
    category: cls.category,
    kind: cls.kind,
    label: cls.label,
    noisy: cls.noisy,
  };
}

const PEM_OPENER = /^-----BEGIN [A-Z ]+-----/;

function bytesToHexPreview(
  bytes: Uint8Array | null | undefined,
  max = 256
): string | null {
  if (!bytes || bytes.length === 0) return null;
  const slice = bytes.subarray(0, max);
  let out = '';
  for (let i = 0; i < slice.length; i++) {
    out += slice[i].toString(16).padStart(2, '0');
  }
  return bytes.length > max ? `${out}…` : out;
}

function tryParseJson(text: string | null): { parsed: unknown; ok: boolean } {
  if (!text) return { parsed: undefined, ok: false };
  const trimmed = text.trim();
  if (
    !trimmed ||
    !(
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed.startsWith('"')
    )
  ) {
    return { parsed: undefined, ok: false };
  }
  try {
    return { parsed: JSON.parse(trimmed), ok: true };
  } catch {
    return { parsed: undefined, ok: false };
  }
}

function describePem(text: string): string {
  const certMatch = /-----BEGIN ([A-Z ]+)-----/.exec(text);
  const kind = certMatch?.[1] ?? 'PEM';
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith('-----'));
  const body = lines.join('').trim();
  const prefix = body.slice(0, 16);
  return `${kind} (${body.length} base64 chars, prefix=${prefix}…)`;
}

interface DecodeInput {
  mapName: string;
  keyName: string;
  valueText: string | null | undefined;
  valueBytes: Uint8Array | null | undefined;
  isDelete: boolean;
}

/**
 * Decode a governance KV value into a structured summary.
 *
 * Called lazily on drill-down — it is fine to do JSON parsing and PEM detection
 * here.
 */
export function decodeGovValue(input: DecodeInput): GovernanceEventDetail {
  const { mapName, keyName, valueText, valueBytes, isDelete } = input;

  if (isDelete) {
    return {
      rawKind: 'empty',
      text: null,
      hexPreview: null,
      parsed: null,
      summary: `Deleted ${mapName} ▸ ${keyName}`,
    };
  }

  const text = valueText ?? null;
  const hexPreview = bytesToHexPreview(valueBytes ?? null);

  if (!text && !hexPreview) {
    return {
      rawKind: 'empty',
      text: null,
      hexPreview: null,
      parsed: null,
      summary: `${mapName} ▸ ${keyName}: <empty>`,
    };
  }

  if (text && PEM_OPENER.test(text.trim())) {
    return {
      rawKind: 'pem',
      text,
      hexPreview,
      parsed: null,
      summary: `${mapName} ▸ ${keyName}: ${describePem(text)}`,
    };
  }

  if (text) {
    const json = tryParseJson(text);
    if (json.ok) {
      return {
        rawKind: 'json',
        text,
        hexPreview,
        parsed: json.parsed,
        summary: buildJsonSummary(mapName, keyName, json.parsed),
      };
    }
    return {
      rawKind: 'text',
      text,
      hexPreview,
      parsed: null,
      summary: `${mapName} ▸ ${keyName}: ${shortKey(text, 96)}`,
    };
  }

  return {
    rawKind: 'binary',
    text: null,
    hexPreview,
    parsed: null,
    summary: `${mapName} ▸ ${keyName}: binary, ${valueBytes?.length ?? 0} bytes`,
  };
}

function buildJsonSummary(
  mapName: string,
  keyName: string,
  parsed: unknown
): string {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const fields: string[] = [];
    for (const key of ['status', 'state', 'name', 'kind', 'role']) {
      const v = obj[key];
      if (typeof v === 'string') {
        fields.push(`${key}=${v}`);
      }
    }
    if (fields.length > 0) {
      return `${mapName} ▸ ${keyName}: ${fields.join(', ')}`;
    }
    const keys = Object.keys(obj).slice(0, 4).join(', ');
    return `${mapName} ▸ ${keyName}: { ${keys}${
      Object.keys(obj).length > 4 ? ', …' : ''
    } }`;
  }
  return `${mapName} ▸ ${keyName}: ${JSON.stringify(parsed)}`;
}

/** Stable, presentation-friendly ordering of categories for filter chips & lanes. */
export const CATEGORY_ORDER: readonly GovernanceCategory[] = [
  'service',
  'constitution',
  'proposals',
  'members',
  'users',
  'nodes',
  'jwt',
  'tls',
  'recovery',
  'scitt',
  'modules',
  'history',
  'other',
];

export function categoryDisplayName(category: GovernanceCategory): string {
  switch (category) {
    case 'jwt':
      return 'JWT';
    case 'tls':
      return 'TLS';
    case 'scitt':
      return 'SCITT';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/**
 * Build seqno-bucketed counts for the density strip above the timeline.
 *
 * Pure helper exported here so the timeline component (which uses
 * `react-refresh` and may only export components) can stay clean.
 */
export function buildDensityBuckets(
  events: readonly GovernanceEventMeta[],
  bucketCount = 50
): { counts: number[]; min: number; max: number } {
  if (events.length === 0) return { counts: [], min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const ev of events) {
    if (ev.seqno < min) min = ev.seqno;
    if (ev.seqno > max) max = ev.seqno;
  }
  if (max === min) return { counts: [events.length], min, max };
  const buckets = Math.min(bucketCount, Math.max(1, max - min + 1));
  const counts = new Array<number>(buckets).fill(0);
  const span = max - min;
  for (const ev of events) {
    const ratio = (ev.seqno - min) / span;
    const idx = Math.min(buckets - 1, Math.floor(ratio * buckets));
    counts[idx] += 1;
  }
  return { counts, min, max };
}
