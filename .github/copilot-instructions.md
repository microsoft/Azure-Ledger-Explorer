# AI Contributor Guide
## Project Overview
Azure Ledger Explorer is a client-side React + TypeScript application for parsing, storing, and querying CCF (Confidential Consortium Framework) ledger files entirely within the browser. All data processing is local—no backend server is required. Key technologies: React, TanStack Query, Fluent UI v9, @sqlite.org/sqlite-wasm (OPFS-backed), Vite.
## Key References
- docs/CODE_STANDARDS.md is the contract (TanStack Query, Fluent UI, strict TS).
- docs/ARCHITECTURE_README.md + docs/DATABASE_README.md explain end-to-end flow and OPFS usage; consult before touching parser or database.
- docs/PARSER_README.md & docs/EXTERNAL_SERVICES_README.md cover LedgerChunkV2 and integrations; keep them in sync.
- docs/TESTING_README.md explains unit (Vitest) and e2e (Playwright) test infrastructure.
## Architecture
- React shell in src/App.tsx uses FluentProvider + QueryClientProvider; navigation pods live in src/pages.
- Data path: FileUploadArea -> useFileDrop (src/hooks/use-ccf-data.ts) -> CCFDatabase.insertLedgerFileWithData -> workers/database-worker.ts -> sqlite-wasm -> OPFS.
- Transactions/KV tables are keyed by sequence_no and ordered ledger_*.committed names; utils/ledger-validation.ts guards gaps.
## Chat Architecture
- AIChat.tsx is an orchestrator; UI is split into src/components/chat/ sub-components (ChatInput, ChatMessageList, ChatMessageBubble, etc.).
- State lives in src/hooks/use-chat.ts (messages, loading, error, streaming); never manage chat state in components directly.
- API calls go through src/services/chat/chat-service.ts; SSE parsing in sse-parser.ts.
- Actions use registry pattern in src/services/chat/actions/; add new actions by creating handler + calling registerAction().
- Types live in src/types/chat-types.ts; constants in src/constants/chat.ts.
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
- Unit tests live in src/__tests__/; run with npm test (Vitest).
- Playwright e2e lives in e2e/files.spec.ts using fixtures in e2e/test_files; execute with npx playwright test when touching ingestion flows.
- deploy-to-azure.ps1 handles Azure Static Web Apps deployment; on Linux use pwsh deploy-to-azure.ps1 -BuildFirst [-DisableSage|-DeployToPreview].
## Security
- Only SELECT and WITH queries are permitted through CCFDatabase.executeQuery; never relax this constraint.
- Never store API keys or SAS tokens in source code; they must come from user input at runtime and remain in browser memory only.
- Validate all user-provided SQL with the existing whitelist check before executing; extend the whitelist carefully and document the reason.
## Guardrails
- Mirror schema/query additions between CCFDatabase and hooks; update docs if tables or result shapes change.
- Respect QueryClient staleTime/gcTime defaults set in src/App.tsx; long-running uploads depend on them.
- Use Fluent UI components for UX-critical surfaces; avoid raw HTML for buttons/cards unless wrapped.
- Keep docs under docs/** updated alongside code changes—outdated guidance is treated as a bug.
- When adding a new open source dependency to any package.json (root or workspace), also add it to the Acknowledgements section in README.md with its GitHub repo link, license, and a short description. Verify the license is compatible with Apache-2.0 (MIT, BSD, Apache-2.0 are OK; GPL/LGPL/AGPL are not).
