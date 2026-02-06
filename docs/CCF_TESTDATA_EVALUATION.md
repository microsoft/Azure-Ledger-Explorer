# CCF Testdata Evaluation for Ledger Parser Regression Tests

> **Purpose:** Evaluate the test ledger files in [`CCF/tests/testdata`](https://github.com/microsoft/CCF/tree/main/tests/testdata) for use as regression tests in `@ccf/ledger-parser`.
>
> **Date:** February 2026  
> **Status:** Proposal — pending review with CCF repo owners

---

## Background

The `@ccf/ledger-parser` package (`packages/ledger-parser`) parses CCF `LedgerChunkV2` binary files. Its existing test suite uses only two committed ledger files from `e2e/test_files/` (originating from a single service configuration). The CCF repository ships a richer set of test data under `tests/testdata/` covering multiple service types, entry formats, and lifecycle scenarios.

This document summarises the results of running our parser against that data and proposes which files to adopt as regression fixtures.

---

## Evaluation Summary

We ran `LedgerChunkV2.readAllTransactions()` against every ledger file in `CCF/tests/testdata`. **All 1,263 transactions across 107 files parsed successfully with zero errors.**

| Service | Committed Files | Uncommitted | Transactions | Seq Range | Views |
|---------|:-:|:-:|--:|--:|--:|
| `acme_containing_service` | 3 | 1 | 20 | 1–20 | 2 |
| `cose_flipflop_service` | 2 | 0 | 46 | 1–46 | 2 |
| `double_sealed_service` | 32 | 1 | 505 | 1–505 | 2, 4, 5 |
| `eol_service` | 48 | 1 | 493 | 1–493 | 2, 4, 6, 8, 10 |
| `expired_service` | 7 | 1 | 61 | 1–61 | 2, 4 |
| `sgx_service` | 10 | 1 | 138 | 1–138 | 2, 4, 6, 8 |

---

## Entry Type Coverage Gap

The existing tests only exercise `WriteSetWithCommitEvidenceAndClaims` (entry type 4). The CCF testdata covers two additional entry types that our parser already handles but lacks test coverage for:

| Entry Type | Enum | Txn Count | Found In |
|-----------|:----:|----------:|----------|
| `WriteSet` | 0 | 72 | `eol_service`, `sgx_service` |
| `WriteSetWithCommitEvidence` | 3 | 26 | `expired_service` |
| `WriteSetWithCommitEvidenceAndClaims` | 4 | 1,165 | All services (already covered) |

> `Snapshot` (1) and `WriteSetWithClaims` (2) are not present in any testdata service.

---

## Recommended Files to Adopt

### Priority 1 — New entry-type coverage

| Source | File(s) | Why |
|--------|---------|-----|
| `eol_service` | `ledger_1-2.committed`, `ledger_3-11.committed` | `WriteSet` entry type (no claims or commit evidence); earliest CCF format |
| `expired_service` | `ledger_1-4.committed`, `ledger_5-15.committed` | `WriteSetWithCommitEvidence` entry type |
| `expired_service` | `ledger_16-26.committed` | Mid-ledger transition from `WriteSetWithCommitEvidence` → `WriteSetWithCommitEvidenceAndClaims` |

### Priority 2 — Multi-view / recovery scenarios

| Source | File(s) | Why |
|--------|---------|-----|
| `double_sealed_service` | `ledger_484-485.committed` … `ledger_503-505.committed` | Re-seal boundary; service identity transition (view 4→5) |
| `eol_service` | `ledger_34-35.committed`, `ledger_36-37.committed` | View transition from `WriteSet` → `WriteSetWithCommitEvidenceAndClaims` after recovery |

### Priority 3 — Scale / stress

| Source | File(s) | Why |
|--------|---------|-----|
| `double_sealed_service` | Full 32-file sequence | 505 transactions; validates long contiguous multi-chunk parsing |
| `sgx_service` | `ledger_1-37.committed` | Largest single chunk with `WriteSet` (37 tx, 145 KB), includes SGX attestation maps |

---

## Proposed Regression Tests

| Test | Validates |
|------|-----------|
| Parse `WriteSet` transactions end-to-end | Entry type 0 — no claims digest, no commit evidence digest |
| Parse `WriteSetWithCommitEvidence` transactions | Entry type 3 — commit evidence digest present, no claims |
| Detect entry-type transition within a service | Parser handles mixed entry types across consecutive chunks |
| Multi-chunk contiguous parsing | Sequence numbers are contiguous across 32 files; no gaps |
| View transition / re-seal boundary | Parser handles view number changes without errors |
| Uncommitted file handling | Parser returns 0 transactions for files without `.committed` suffix |
| Merkle verification across chunks | `verifyTransactions()` succeeds for multi-chunk sequences with different entry types |
| Map name diversity | All 42 discovered CCF map names are correctly extracted |

---

## CCF Map Names Discovered (42 unique)

<details>
<summary>Full list</summary>

| Category | Maps |
|----------|------|
| **Governance** | `public:ccf.gov.constitution`, `public:ccf.gov.history`, `public:ccf.gov.proposals`, `public:ccf.gov.proposals_info`, `public:ccf.gov.cose_history`, `public:ccf.gov.cose_recent_proposals`, `public:ccf.gov.endpoints`, `public:ccf.gov.modules`, `public:ccf.gov.modules_quickjs_bytecode`, `public:ccf.gov.modules_quickjs_version`, `public:ccf.gov.interpreter.flush` |
| **Members** | `public:ccf.gov.members.acks`, `public:ccf.gov.members.certs`, `public:ccf.gov.members.encryption_public_keys`, `public:ccf.gov.members.info` |
| **Users** | `public:ccf.gov.users.certs`, `public:ccf.gov.users.info` |
| **Nodes** | `public:ccf.gov.nodes.code_ids`, `public:ccf.gov.nodes.endorsed_certificates`, `public:ccf.gov.nodes.info`, `public:ccf.gov.nodes.virtual.host_data`, `public:ccf.gov.nodes.virtual.measurements` |
| **Service** | `public:ccf.gov.service.config`, `public:ccf.gov.service.info`, `public:ccf.gov.service.previous_service_identity` |
| **JWT** | `public:ccf.gov.jwt.issuers`, `public:ccf.gov.jwt.public_signing_key_issuer`, `public:ccf.gov.jwt.public_signing_keys`, `public:ccf.gov.jwt.public_signing_keys_metadata` |
| **TLS** | `public:ccf.gov.tls.ca_cert_bundles` |
| **Internal** | `public:ccf.internal.cose_signatures`, `public:ccf.internal.encrypted_ledger_secrets`, `public:ccf.internal.encrypted_submitted_shares`, `public:ccf.internal.historical_encrypted_ledger_secret`, `public:ccf.internal.previous_service_identity_endorsement`, `public:ccf.internal.previous_service_last_signed_root`, `public:ccf.internal.recovery_shares`, `public:ccf.internal.signatures`, `public:ccf.internal.snapshot_evidence`, `public:ccf.internal.tree`, `public:ccf.internal.values` |
| **Application** | `public:records` |

</details>

---

## Open Questions for CCF Repo Owners

1. **Licensing / redistribution** — Can we copy a subset of `tests/testdata` ledger files into the Ledger Explorer repo as test fixtures, or should we reference them via a git submodule / CI fetch?
2. **Stability** — Are these testdata files considered stable across CCF releases, or might their binary format change?
3. **Snapshot support** — The parser currently throws on `EntryType.Snapshot` (type 1). Are there test ledgers with snapshot entries we should plan for?
4. **Private domain** — Our parser only reads the public domain. Do any of these test ledgers contain non-empty private domains that we should be aware of?
5. **Additional testdata** — Are there test ledgers with `WriteSetWithClaims` (type 2) that we could use for full entry-type coverage?
