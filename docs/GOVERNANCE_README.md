# Governance Timeline

The Governance page (`/governance`) presents a timeline of CCF governance
activity recorded in the imported ledger files. It groups events by
sequence number and category so reviewers can quickly understand who joined,
what proposals were submitted, when the constitution changed, and so on.

## What counts as a "governance event"?

Any KV write or delete in one of the following table prefixes:

- `public:ccf.gov.*` — current (CCF 5.0+) governance namespace.
- `public:ccf.governance.*` — legacy pre-5.0 governance namespace.
- `public:ccf.nodes.*` — legacy node namespace (kept for backward-compat).

Internal book-keeping tables (`public:ccf.internal.*`) and SCITT entry tables
(`public:scitt.*`) are **not** included.

## Categories

Events are bucketed into stable categories for filtering and colour coding:

| Category | Tables (examples) |
|---|---|
| `service` | `public:ccf.gov.service.info`, `public:ccf.gov.service.config` |
| `constitution` | `public:ccf.gov.constitution`, `public:ccf.governance.constitution` |
| `proposals` | `public:ccf.gov.proposals`, `public:ccf.gov.proposals_info`, `public:ccf.gov.cose_recent_proposals` |
| `members` | `public:ccf.gov.members.*` |
| `users` | `public:ccf.gov.users.*` |
| `nodes` | `public:ccf.gov.nodes.*`, `public:ccf.nodes.*` |
| `jwt` | `public:ccf.gov.jwt.*`, `public:ccf.gov.jwt_*` |
| `tls` | `public:ccf.gov.tls.*`, `public:ccf.gov.tls_*` |
| `recovery` | `public:ccf.gov.recovery*` |
| `scitt` | `public:ccf.gov.scitt.*` |
| `modules` | `public:ccf.gov.modules*`, `public:ccf.gov.js_runtime_options`, `public:ccf.gov.interpreter.flush` |
| `history` | `public:ccf.gov.history`, `public:ccf.gov.cose_history` |
| `other` | anything else under the governance prefixes |

Tables flagged as **noisy** (large, high-frequency, low-signal) are hidden by
default and require the **Show noisy tables** toggle to surface. Today this
includes:

- `public:ccf.gov.cose_history`
- `public:ccf.gov.cose_recent_proposals`
- `public:ccf.gov.history`
- `public:ccf.gov.modules_quickjs_bytecode`
- `public:ccf.gov.modules_quickjs_version`

## Architecture

- **Decoder** — `src/utils/governance-events.ts` (pure, fully unit-tested)
  - `classifyGovEvent({ mapName, keyName, isDelete })` — metadata-only
    classification used by the timeline view.
  - `decodeGovValue({ mapName, keyName, valueText, valueBytes, isDelete })` —
    drill-down decoder. Detects JSON, PEM, plain text, binary, or empty
    payloads; returns a structured `{ rawKind, parsed, summary, … }`.
- **Hooks** — `src/hooks/use-ccf-data.ts`
  - `useGovernanceEvents()` — phase-1 query: lightweight metadata-only fetch.
  - `useGovernanceEventDetail(meta, enabled)` — phase-2 lazy fetch on
    drill-down via `kv.getKvWriteValueAt(seqno, mapName, keyName)`.
- **UI** — `src/components/governance/GovernanceTimeline.tsx`
  - Density strip, horizontal seqno axis, colour-coded markers, click
    drill-down panel, filter chips, `Show deletes` / `Show noisy tables`
    toggles. Soft cap of 5 000 rendered events.

## Limitations (v1)

- **No wall-clock axis.** The schema's `created_at` column on `kv_writes` /
  `kv_deletes` defaults to `CURRENT_TIMESTAMP` at insert time — it is the
  *import* time, not the parser-derived ledger time. The timeline therefore
  uses **sequence number** as the only axis. A future migration can backfill
  parser-derived timestamps and add the wall-clock axis.
- **No before/after diffs.** The timeline shows the events but does not
  reconstruct the previous KV state to render diffs. The Tables page
  (`/tables`) covers state inspection.
- **No proposal lifecycle correlation.** A `kv_writes` row in
  `public:ccf.gov.proposals_info` is the canonical source of proposal state;
  `public:ccf.gov.proposals` deletes are labelled "proposal body removed"
  rather than "proposal closed" because the body table is just storage.
- **No PEM cert validity dates** in the inline summary. Parsing X.509 in the
  browser is feasible but out of scope for v1.

## Telemetry

The page emits the following events:

- `GovernancePageOpened { eventCount, categoriesPresent }`
- `GovernanceFilterApplied { categories, eventCount, includeDeletes, includeNoisy }`
- `GovernanceEventClicked { kind, category, seqno }`
