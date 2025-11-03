# AI Contributor Guide
## Key References
- docs/CODE_STANDARDS.md is the contract (TanStack Query, Fluent UI, strict TS).
- docs/ARCHITECTURE_README.md + docs/DATABASE_README.md explain end-to-end flow and OPFS usage; consult before touching parser or database.
- docs/PARSER_README.md & docs/EXTERNAL_SERVICES_README.md cover LedgerChunkV2 and integrations; keep them in sync.
## Architecture
- React shell in src/App.tsx uses FluentProvider + QueryClientProvider; navigation pods live in src/pages.
- Data path: FileUploadArea -> useFileDrop (src/hooks/use-ccf-data.ts) -> CCFDatabase.insertLedgerFileWithData -> workers/database-worker.ts -> sqlite-wasm -> OPFS.
- Transactions/KV tables are keyed by sequence_no and ordered ledger_*.committed names; utils/ledger-validation.ts guards gaps.
## Data & State
- src/hooks/use-ccf-data.ts centralizes query keys and DB access; add new reads/writes there and extend queryKeys helpers.
- Mutations must update queryClient.invalidateQueries in the same file; prefer predicates for broad cache busting.
- Never call fetch/sqlite directly from components; wrap async work in hooks/services with documented error handling.
## UI Patterns
- UI components in src/components rely on @fluentui/react-components + makeStyles; reuse AppLayout grid instead of ad-hoc layouts.
- Keep view logic in src/pages (default exports) and surface loading/error states with Fluent UI Spinner/MessageBar patterns.
## Workers
- Database work must flow through DatabaseWorkerClient (src/database/worker/worker-client.ts); never instantiate @sqlite.org/sqlite-wasm on the main thread.
- workers/database-worker.ts streams LedgerChunkV2 transactions and decodes CBOR for public:scitt.entry; update DecodeCborTables when new maps need text conversion.
- Verification and write-receipt workers share typed messages via src/types/verification-types.ts; extend types before adding commands.
## Workflows
- Install/run via npm install && npm run dev; lint with npm run lint; build with npm run build.
- Playwright e2e lives in e2e/files.spec.ts using fixtures in e2e/test_files; execute with npx playwright test when touching ingestion flows.
- deploy-to-azure.ps1 handles Azure Static Web Apps deployment; on Linux use pwsh deploy-to-azure.ps1 -BuildFirst [-DisableSage|-DeployToPreview].
## Guardrails
- Mirror schema/query additions between CCFDatabase and hooks; update docs if tables or result shapes change.
- Respect QueryClient staleTime/gcTime defaults set in src/App.tsx; long-running uploads depend on them.
- Use Fluent UI components for UX-critical surfaces; avoid raw HTML for buttons/cards unless wrapped.
- Keep docs under docs/** updated alongside code changes—outdated guidance is treated as a bug.
