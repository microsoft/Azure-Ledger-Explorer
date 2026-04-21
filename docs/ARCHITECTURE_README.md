# Azure Ledger Explorer Architecture Overview

## System Architecture

Azure Ledger Explorer is a modern, client-side React application built with TypeScript that enables users to parse, store, and analyze CCF (Confidential Consortium Framework) ledger data entirely within their browser. The application follows a layered architecture pattern with clear separation of concerns.

The project is organized as an **npm workspaces monorepo** with two internal packages:

- **`packages/ledger-parser`** (`@microsoft/ccf-ledger-parser`): Binary parser for the CCF LedgerChunkV2 format, Merkle tree utilities, CBOR decoding, and ledger validation logic.
- **`packages/ccf-database`** (`@microsoft/ccf-database`): Browser SQLite database facade backed by `@sqlite.org/sqlite-wasm` and OPFS, exposing typed repositories and a dedicated database Web Worker.

The main application (`src/`) consumes these packages as workspace dependencies.

## High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[React Components]
        PAGES[Pages / React Router v7]
        FLUENT[Fluent UI v9]
        PWA[PWA / Service Worker]
    end

    subgraph "State Management Layer"
        QUERY[TanStack Query v5]
        HOOKS[Custom React Hooks]
        CACHE[Query Cache]
    end

    subgraph "Business Logic Layer"
        PARSER["@microsoft/ccf-ledger-parser\n(LedgerChunkV2, MerkleTree,\nCBOR utils, validation)"]
        VSVC[VerificationService]
        AZURE[AzureFileShareService]
        MST[MstFilesService]
        CHAT[Chat Services\n(Sage API / OpenAI BYOK)]
    end

    subgraph "Worker Layer"
        DBWORKER[database-worker\n(@sqlite.org/sqlite-wasm)]
        VWORKER[verification-worker\n(MerkleTree)]
    end

    subgraph "Data Layer"
        DATABASE["@microsoft/ccf-database\n(CCFDatabase facade\n+ Repository pattern)"]
        OPFS[OPFS Storage]
    end

    subgraph "External Services"
        OPENAI[OpenAI API]
        SAGEAPI[Sage Chat API]
        AZURESHARE[Azure File Share]
        MSTSERVER[MST / NGINX Server]
    end

    UI --> HOOKS
    PAGES --> UI
    FLUENT --> UI

    HOOKS --> QUERY
    QUERY --> CACHE
    HOOKS --> DATABASE
    HOOKS --> VSVC

    VSVC --> VWORKER
    DATABASE --> DBWORKER
    DBWORKER --> OPFS
    DBWORKER --> PARSER

    PARSER --> AZURE
    PARSER --> MST

    CHAT --> OPENAI
    CHAT --> SAGEAPI
    AZURE --> AZURESHARE
    MST --> MSTSERVER

    classDef ui fill:#e1f5fe
    classDef state fill:#f3e5f5
    classDef business fill:#e8f5e8
    classDef worker fill:#fffde7
    classDef data fill:#fff3e0
    classDef external fill:#ffebee

    class UI,PAGES,FLUENT,PWA ui
    class QUERY,HOOKS,CACHE state
    class PARSER,VSVC,AZURE,MST,CHAT business
    class DBWORKER,VWORKER worker
    class DATABASE,OPFS data
    class OPENAI,SAGEAPI,AZURESHARE,MSTSERVER external
```

## Monorepo Package Structure

```
CCF-Ledger-Explorer/
├── packages/
│   ├── ledger-parser/          # @microsoft/ccf-ledger-parser
│   │   └── src/
│   │       ├── ledger-chunk.ts       # LedgerChunkV2 binary parser
│   │       ├── merkle-tree.ts        # Merkle tree verification
│   │       ├── ledger-validation.ts  # Sequence-gap detection
│   │       ├── cbor-utils.ts         # CBOR decoding helpers
│   │       ├── ccf-internal-tree.ts  # CCF internal tree utilities
│   │       ├── cose-signature-time.ts # COSE signature parsing
│   │       ├── table-names.ts        # CCF table name constants
│   │       └── types.ts              # Shared types
│   └── ccf-database/           # @microsoft/ccf-database
│       └── src/
│           ├── ccf-database.ts       # Public CCFDatabase facade
│           ├── constants.ts          # DATABASE_FILENAME etc.
│           ├── migrations/           # SQLite schema migrations
│           ├── repositories/         # FileRepository, TransactionRepository,
│           │                         # KVRepository, StatsRepository
│           ├── types/                # DatabaseConfig, query/repository types
│           ├── utilities/            # decode-cbor-tables.ts
│           └── worker/
│               ├── database-worker.ts        # sqlite-wasm Web Worker
│               └── database-worker-client.ts # Message-passing client
└── src/                        # Main React application
    ├── App.tsx                  # Root: FluentProvider + QueryClientProvider + Router
    ├── components/              # Reusable UI components
    ├── pages/                   # Route-level page components
    ├── hooks/                   # Custom React hooks
    ├── services/                # External-service clients
    ├── workers/                 # verification-worker.ts
    ├── types/                   # Shared TypeScript types
    ├── utils/                   # Pure utility functions
    └── constants/               # Application-wide constants
```

## Core Components

### 1. User Interface Layer

#### Application Shell (`src/App.tsx`)

`App.tsx` is the root component. It:

1. Shows a `SplashScreen` while the SQLite database initialises via OPFS.
2. Wraps the entire tree in `QueryClientProvider` (TanStack Query) and `FluentProvider`.
3. Sets up `BrowserRouter` with all application routes.
4. Renders the persistent `MenuBar`, `PWAPrompt`, and `VerificationStatusIndicator`.

#### React Components (`src/components/`)

General components:

| Component | Purpose |
|---|---|
| **AppLayout.tsx** | CSS Grid–based shell (top bar + main area) |
| **MenuBar.tsx** | Navigation, theme toggle, and app-level controls |
| **CCFVisualizerApp.tsx** | File list, drag-and-drop import, and per-file transaction view |
| **TransactionViewer.tsx** | Paginated transaction browser and chunk selector |
| **TransactionDataGrid.tsx** | Virtualized data grid for transaction records |
| **AIChat.tsx** | AI chat orchestrator (delegates state to `useChat`) |
| **FileUploadArea.tsx** | Drag-and-drop / file-picker upload surface |
| **AddFilesWizard.tsx** | Multi-source import wizard (local / Azure / MST) |
| **ChunkSelector.tsx** | File/chunk selection control |
| **ConversationHistory.tsx** | Saved conversation history sidebar panel |
| **LedgerVisualization.tsx** | Timeline visualization of transaction types |
| **LedgerBackupView.tsx** | Database export / backup management |
| **MerkleTreeGraph.tsx** | Visual Merkle tree graph for a transaction |
| **MstLedgerImportView.tsx** | MST-source import flow UI |
| **PageTransition.tsx** | Animated page transition wrapper |
| **PWAPrompt.tsx** | Progressive Web App install prompt |
| **ReplaceDataConfirmDialog.tsx** | Confirmation dialog for data replacement |
| **SchemaViewerDialog.tsx** | Displays the current SQLite database schema |
| **Sidebar.tsx** | Collapsible navigation sidebar |
| **SplashScreen.tsx** | Startup screen shown during database initialisation |
| **StorageVisualizer.tsx** | OPFS storage quota usage display |
| **ValueViewer.tsx** | Formatted viewer for raw transaction values |
| **VerificationComponent.tsx** | Chunk-based Merkle verification UI |
| **VerificationSidebarControls.tsx** | Compact verification controls for sidebar |
| **VerificationStatusIndicator.tsx** | Global persistent verification status badge |
| **WriteReceiptVerificationComponent.tsx** | Write-receipt signature verification UI |

#### Chat Sub-components (`src/components/chat/`)

The AI chat UI is split into single-responsibility components:

| Component | Purpose |
|---|---|
| **ChatInput.tsx** | Text input with send / stop buttons |
| **ChatMessageList.tsx** | Scrollable message list with auto-scroll |
| **ChatMessageBubble.tsx** | Individual message bubble (user / assistant) |
| **ChatActionResult.tsx** | Expandable action-result card |
| **ChatAnnotations.tsx** | File reference annotation links |
| **ChatStarterTemplates.tsx** | Suggested starter prompts |
| **chat.styles.ts** | Shared `makeStyles` definitions |

#### Page Components (`src/pages/`)

| Page | Route | Purpose |
|---|---|---|
| **StartPage.tsx** | `/` (SAGE mode only) | Landing page with mode selection cards |
| **CCFVisualizerApp** | `/files` | Default start page; file list and upload |
| **TablesPage.tsx** | `/tables`, `/tables/:tableName` | CCF KV table explorer |
| **StatsPage.tsx** | `/stats` | Analytics and database statistics |
| **AIPage.tsx** | `/chat` | AI assistant (Sage API or OpenAI BYOK) |
| **VerificationPage.tsx** | `/verification` | Chunk-based Merkle tree verification |
| **WriteReceiptVerificationPage.tsx** | `/write-receipt` | Write-receipt signature verification |
| **MstReceiptVerificationPage.tsx** | `/mst-receipt` | MST receipt verification guidance |
| **CoseViewerPage.tsx** | `/cose-viewer` | COSE signature / envelope viewer |
| **TransactionDetailsPage.tsx** | `/transaction/:id` | Single-transaction deep dive |
| **ConfigPage.tsx** | `/config` | Settings: API keys, models, data management |
| **VisualizationPage.tsx** | `/visualization` | Interactive ledger-timeline visualization |

#### Design System

- **Fluent UI React v9** (`@fluentui/react-components`): Microsoft's design system — tokens, `makeStyles`, and component primitives throughout.
- **Dark / Light Themes**: Stored in `localStorage` under `ccf-visualizer-theme`; toggled from `MenuBar`.
- **Responsive Design**: Media query breakpoints in `makeStyles` for mobile/tablet/desktop.
- **Progressive Web App**: Installable via `vite-plugin-pwa` + Workbox service worker; manifested as a standalone app.

### 2. State Management Layer

#### Chat State (`src/hooks/use-chat.ts`)

`useChat` centralises all chat state and supports two providers:

```typescript
const {
  messages,           // ChatMessage[]
  isLoading,          // streaming in progress
  error,              // error string | null
  hasMessages,
  sendMessage,        // (content: string) => Promise<void>
  stopResponse,       // abort SSE stream
  clearChat,          // reset conversation
  saveConversation,   // persist to localStorage
} = useChat({
  baseUrl,            // Sage API endpoint
  openaiApiKey,       // BYOK mode
  openaiModel,        // e.g. "gpt-4o"
  databaseSchema,     // injected for OpenAI system prompt
  provider,           // 'sage' | 'openai'
  initialMessages,
  actionContext,
});
```

#### Chat Services (`src/services/chat/`)

| File | Purpose |
|---|---|
| **chat-service.ts** | SSE-based API client for the Sage chat endpoint |
| **openai-chat-service.ts** | Direct OpenAI API client for BYOK mode |
| **sse-parser.ts** | Server-Sent Events stream parser |
| **actions/action-registry.ts** | Extensible action registration and execution |
| **actions/sql-action.ts** | Executes AI-generated SQL against the local database |
| **actions/verify-action.ts** | Triggers chunk-based Merkle verification |
| **actions/mst-action.ts** | Imports ledger files from an MST/NGINX source |

##### Action Registry Pattern

```typescript
// 1. Create handler in src/services/chat/actions/my-action.ts
export const myActionHandler: ActionHandler = async (content, context) => {
  // Execute action logic using context.database, etc.
  return { result: 'Success' };
};

// 2. Register in src/services/chat/actions/index.ts
registerAction(UIActionName.MyAction, myActionHandler);

// 3. The AI can now emit:  ```action:myaction\n<parameters>```
```

Built-in registered actions (see `UIActionName` in `src/types/chat-types.ts`):

| Action name | Handler | Effect |
|---|---|---|
| `runsql` | `sqlActionHandler` | Runs SELECT query, returns result table |
| `verifyledger` | `verifyActionHandler` | Starts Merkle tree verification |
| `importmst` | `mstActionHandler` | Downloads files from an MST server |

#### TanStack Query v5 (`@tanstack/react-query`)

Configured in `src/App.tsx` with:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      gcTime:   10 * 60 * 1000,  // 10 minutes
    },
  },
});
```

All query keys are centralised in the exported `queryKeys` object in `src/hooks/use-ccf-data.ts`. Mutations always call `queryClient.invalidateQueries` (or `resetQueries`) in `onSuccess`.

#### Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| **use-ccf-data.ts** | All database query and mutation hooks; `initializeDatabase` / `resetDatabase` exports |
| **use-chat.ts** | Chat state management |
| **use-verification.ts** | Merkle verification state (wraps `VerificationService`) |
| **use-api-health.ts** | Polls the Sage API health endpoint |
| **use-openai-key-validation.ts** | Validates an OpenAI API key against the API |
| **write-receipt-verification.ts** | Write-receipt signature verification logic |

Key hooks exported from `use-ccf-data.ts`:

```typescript
// Query hooks
useLedgerFiles()
useTransactions(fileId, limit, offset)
useTransactionDetails(transactionId)
useAllTransactions(limit, offset, searchQuery)
useSearchByKeyOrValue(query, limit)
useStats()
useEnhancedStats()
useCCFTables()
useTableKeyValues(mapName, limit, offset, searchQuery)
useTableLatestState(mapName, limit, offset, searchQuery, sortColumn, sortDirection)
useStorageQuota()

// Mutation hooks
useUploadLedgerFile()
useDeleteLedgerFile()
useClearAllData()
useDropDatabase()

// File-drop with shared progress state
useFileDrop()
```

### 3. Business Logic Layer

#### CCF Ledger Parser (`packages/ledger-parser`)

The `@microsoft/ccf-ledger-parser` package provides:

- **`LedgerChunkV2`** (`ledger-chunk.ts`): Async generator–based binary parser for the CCF LedgerChunkV2 file format. Reads transactions in a streaming fashion; each transaction carries a GCM header, public-domain key-value writes/deletes, and cryptographic metadata.
- **`MerkleTree`** (`merkle-tree.ts`): Incremental Merkle tree used both during import (inline verification) and in the dedicated verification worker.
- **`ledger-validation.ts`**: Detects sequence-number gaps between uploaded ledger chunks.
- **`cbor-utils.ts`**: CBOR decoding for `public:scitt.entry` and other binary table values.
- **`ccf-internal-tree.ts`**: Decodes and summarises the CCF internal tree structure stored inside signature transactions.
- **`cose-signature-time.ts`**: Extracts signing time from COSE envelopes.

#### File Validation (`packages/ledger-parser/src/ledger-validation.ts`)

- **Sequence Validation**: Ensures ledger chunks are uploaded in order without gaps.
- **Format Checking**: Validates CCF LedgerChunkV2 magic bytes / header fields.
- **Gap Detection**: Identifies missing sequence-number ranges across files.

#### Verification Architecture

Merkle tree verification runs **off the main thread** in a dedicated Web Worker:

```
useVerification hook
      │
      ▼
VerificationService          (src/services/verification-service.ts)
  ├── spawns Worker ────────▶ verification-worker.ts
  │                              (src/workers/verification-worker.ts)
  │                              • MerkleTree from @microsoft/ccf-ledger-parser
  │                              • Verifies once per chunk at last signature tx
  └── bridges data requests ◀──▶ database-worker via CCFDatabase
```

- The worker requests chunk lists and per-chunk transactions from the main thread via typed message-passing (`WorkerInMessage` / `WorkerOutMessage` in `src/types/verification-types.ts`).
- Verification is chunk-based: only the **last signature transaction** in each chunk is verified against the accumulated Merkle root, dramatically reducing verification time.
- Supports **pause / resume / stop** with progress saved to `localStorage`.
- Results (per-chunk `verified` flag + error) are persisted back to the database via the `VerificationService`.

#### Azure Integration (`src/services/AzureFileShareService.ts`)

- **SAS Token Authentication**: Secure access to Azure File Shares.
- **File Enumeration**: Discovery of ledger files in cloud storage.
- **Download Management**: Streams ledger files into the browser for parsing.

#### MST Integration (`src/services/MstFilesService.ts`)

Supports downloading ledger files from a CCF MST (Managed Service for Transactions) node that exposes files via an **NGINX directory listing** endpoint:

- Constructs the target URL as `https://ledger-files-<domain>`.
- Paginates through the NGINX JSON directory index.
- Filters for valid ledger filenames using `parseLedgerFilename` from the parser package.
- Exposes a progress callback (`DownloadProgress`) for UI feedback.

### 4. Data Layer

#### CCFDatabase Facade (`packages/ccf-database/src/ccf-database.ts`)

`CCFDatabase` is a thin facade that:

1. Instantiates `DatabaseWorkerClient` and waits for the worker to signal readiness.
2. Creates four typed repositories backed by the worker's `exec` / `execBatch` functions:
   - **`FileRepository`**: CRUD for ledger file metadata and verification status.
   - **`TransactionRepository`**: Insert and query transactions, writes, and deletes.
   - **`KVRepository`**: Key-value table queries (latest state, history).
   - **`StatsRepository`**: Aggregate statistics and enhanced analytics.
3. Exposes `insertLedgerFileWithData(name, size, buffer, options)` which transfers the raw `ArrayBuffer` to the database worker for parsing and insertion in one atomic call.
4. Exposes `resetMerkleState()` to reset the worker's in-memory Merkle tree before a new import sequence.
5. Exposes `deleteAndRecreateDatabase()` for a nuclear reset.

#### Database Worker (`packages/ccf-database/src/worker/database-worker.ts`)

Runs entirely in a **dedicated Web Worker** thread:

- Initialises `@sqlite.org/sqlite-wasm` (not `sql.js`) with the `OpfsDb` backend (OPFS).
- Falls back to `OpfsDb` in **read-only mode** on `SQLITE_BUSY`, then to a transient in-memory `DB` if OPFS is unavailable.
- Runs schema migrations on startup (`migrations/001_initial.ts`).
- Receives `insertLedgerFile` commands: calls `LedgerChunkV2` from the parser package to stream transactions and inserts them in batches.
- Decodes CBOR table values for known tables via `decode-cbor-tables.ts` before storage.
- All SQL execution is routed through `exec` / `execBatch` message types; the worker holds the only reference to the SQLite database instance.

#### DatabaseWorkerClient (`packages/ccf-database/src/worker/database-worker-client.ts`)

Provides a Promise-based API over `postMessage`:

```typescript
const client = new DatabaseWorkerClient();
await client.waitForReady();

// All calls return Promises; all database I/O stays in the worker thread
await client.exec(sql, bind);
await client.execBatch(statements);
await client.insertLedgerFile(name, size, buffer, { shouldVerify });
```

#### Storage Technologies

| Technology | Role |
|---|---|
| **`@sqlite.org/sqlite-wasm`** | WebAssembly SQLite engine (replaces the older `sql.js`) |
| **OPFS (Origin Private File System)** | Persistent browser storage for the SQLite database file |
| **In-memory fallback** | Used when OPFS is unavailable (e.g., some Safari versions) |
| **`localStorage`** | Theme preference, OpenAI API key/model, verification progress, conversation history |

## Data Flow Architecture

### 1. File Upload / Import Flow

```
User drops file(s) / selects Azure / MST
          │
          ▼
useFileDrop (src/hooks/use-ccf-data.ts)
  ├── Resets Merkle state in database-worker
  └── For each file:
        ├── useUploadLedgerFile mutation
        └── CCFDatabase.insertLedgerFileWithData(name, size, buffer)
                │
                ▼
        DatabaseWorkerClient (postMessage)
                │
                ▼
        database-worker.ts
          ├── LedgerChunkV2.readAllTransactions() [streaming parser]
          ├── Inline Merkle tree verification (if shouldVerify=true)
          ├── CBOR decoding for known tables
          └── SQLite batch INSERT → OPFS
                │
                ▼
        TanStack Query cache invalidation → UI refresh
```

### 2. Query Flow

```
Component renders → useXxx() hook
  → TanStack Query (cache hit? return cached)
  → getDatabase() → CCFDatabase repository method
  → DatabaseWorkerClient.exec(sql)
  → database-worker SELECT → OPFS (sqlite-wasm)
  → Result returned to hook → UI re-renders
```

### 3. AI Assistant Flow (Sage API mode)

```
User types message
  → useChat.sendMessage()
  → chat-service.ts streams SSE from Sage API
  → sse-parser.ts extracts deltas and action blocks
  → extractActions() detects ```action:runsql``` blocks
  → executeActions() dispatches to registered handler (sqlActionHandler)
  → sqlActionHandler runs SELECT via CCFDatabase
  → Result rendered in ChatActionResult component
```

### 4. AI Assistant Flow (OpenAI BYOK mode)

```
User types message (provider = 'openai')
  → useChat.sendMessage()
  → openai-chat-service.ts sends request to api.openai.com with
    database schema injected into system prompt
  → Same SSE parsing and action execution pipeline as above
```

### 5. Verification Flow

```
User clicks "Verify Ledger"
  → useVerification.start()
  → VerificationService.startVerification()
  → Spawns verification-worker (Web Worker)
  → Worker requests chunk list from main thread
  → For each chunk:
      ├── Worker requests transactions + last signature
      ├── Builds/extends Merkle tree in worker thread
      ├── Compares calculated root with signature root
      └── Reports result back (chunkVerified event)
  → VerificationService updates DB verification status
  → useVerification invalidates ledgerFiles query → UI updates
```

## Key Architectural Decisions

### 1. Client-Side Processing

**Decision**: Process all data client-side without server dependencies.

**Benefits**:
- No server infrastructure required
- Complete data privacy — ledger data never leaves the browser
- Offline capability (PWA)
- Reduced latency for queries

**Trade-offs**:
- Limited by browser memory and storage quota
- Initial parsing time for large files
- Browser compatibility constraints (OPFS, SharedArrayBuffer/COOP/COEP)

### 2. `@sqlite.org/sqlite-wasm` for Database

**Decision**: Use the official `@sqlite.org/sqlite-wasm` package with OPFS persistence, **not** the older `sql.js`.

**Benefits**:
- Full SQL query capability with durable OPFS storage
- WAL mode support for concurrent reads
- Official SQLite WASM port — closely tracks upstream SQLite releases
- Maintained OPFS VFS for true file-system persistence

**Trade-offs**:
- Requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` HTTP headers (configured in `vite.config.ts` and `staticwebapp.config.json`)
- OPFS not available in all browsers; in-memory fallback loses data on page reload

### 3. Dedicated Database Web Worker

**Decision**: Run all SQLite operations in a dedicated Web Worker (`database-worker.ts`), never on the main thread.

**Benefits**:
- UI remains responsive during heavy import and query operations
- The worker holds the sole `db` reference, eliminating concurrent-access issues
- `ArrayBuffer` for file data is **transferred** (zero-copy) to the worker via `postMessage`

**Trade-offs**:
- Asynchronous message-passing adds latency for simple queries
- Debugging worker code requires browser DevTools worker inspection

### 4. Separate Verification Worker

**Decision**: Run Merkle tree verification in a second dedicated Web Worker (`verification-worker.ts`).

**Benefits**:
- Verification never blocks the UI or the database worker
- Worker can be paused, resumed, or stopped cleanly
- Long verification runs survive navigation between pages

**Trade-offs**:
- Worker communicates with the database via the main thread (request/response pattern), adding round-trip overhead

### 5. TanStack Query v5 for State Management

**Decision**: Use TanStack Query instead of Redux or Zustand for server/async state.

**Benefits**:
- Built-in caching, background refetch, and stale-while-revalidate
- Excellent loading and error states
- `invalidateQueries` with predicates for fine-grained cache invalidation
- Perfect fit for the async, database-backed data model

**Trade-offs**:
- Query key management complexity (`queryKeys` object in `use-ccf-data.ts`)
- Limited global (non-async) state management — supplemented by `useSyncExternalStore` for upload progress

### 6. Monorepo Package Structure

**Decision**: Extract the parser and database layers into separate npm workspace packages.

**Benefits**:
- Parser and database can be tested and versioned independently
- Clear contract boundary between parsing logic and storage logic
- The parser package ships its own test suite (`vitest`)

**Trade-offs**:
- Build step required (`npm run build:packages`) before running the app
- Cross-package TypeScript type resolution must be configured in `tsconfig`

### 7. TypeScript Throughout

**Decision**: Full TypeScript implementation with strict type checking across all packages.

**Benefits**:
- Compile-time error detection
- Self-documenting API contracts between packages
- Refactoring safety across a large codebase

**Trade-offs**:
- Build complexity (multiple `tsconfig` files)
- Some `@sqlite.org/sqlite-wasm` types require augmentation

## Performance Considerations

### Memory Management

- **Streaming Parser**: `LedgerChunkV2` uses an async generator — only one transaction is materialised in memory at a time.
- **ArrayBuffer Transfer**: File data is transferred (not copied) to the database worker via `postMessage` structured clone with transfer list.
- **Batch Inserts**: Transactions are inserted via `execBatch` in a single SQLite transaction to minimise I/O round-trips.
- **Component Memoization**: `React.memo` and `useMemo` guard expensive list renders.

### Bundle Optimisation

- **Vite + Tree Shaking**: Dead code is eliminated at build time.
- **`@sqlite.org/sqlite-wasm` excluded from pre-bundle**: Configured in `vite.config.ts` `optimizeDeps.exclude` to avoid Vite pre-bundling the WASM module.
- **PWA Asset Caching**: Workbox pre-caches all static assets; API calls (`openai.com`, Azure Blob) are network-only.

### Browser Performance

- **Background Workers**: Parsing, SQLite I/O, and Merkle verification all run off the main thread.
- **Paginated Queries**: Transaction lists use `limit` / `offset` pagination; large result sets are never loaded at once.
- **TanStack Query Cache**: Repeated identical queries are served from the in-memory cache within the `staleTime` window (5 minutes by default).

## Security Architecture

### Data Security

- **Local Storage**: All ledger data remains in the user's OPFS storage — never transmitted to a server.
- **No Server Transmission**: Even in AI mode, only queries and schema metadata are sent to external APIs; raw ledger bytes stay local.
- **HTTPS-Only External APIs**: `openai.com` and Azure endpoints are network-only (no SW caching).

### Query Security

- **SQL Injection Protection**: AI-generated SQL is restricted to `SELECT` statements; the `sql-action` handler rejects DML/DDL.
- **Parameter Binding**: Repositories use `bind` arrays (prepared-statement style) for all user-supplied values.
- **Error Sanitisation**: Worker errors are caught and returned as generic messages; raw SQLite stack traces are not exposed to the UI.

### External Integrations

- **OpenAI API Key**: Stored in `localStorage` under a namespaced key; never hardcoded or committed.
- **SAS Tokens**: Azure SAS tokens are supplied by the user at runtime and held only in component state for the duration of the import.
- **COOP / COEP Headers**: Required for `SharedArrayBuffer` (used by sqlite-wasm); configured in `vite.config.ts` dev server and `staticwebapp.config.json` for production.

## Browser Compatibility

### Target Browsers

- **Chrome / Edge 80+** (OPFS + WASM, full feature support)
- **Firefox 111+** (OPFS support; earlier versions fall back to in-memory SQLite)
- **Safari 15.2+** (OPFS behind a flag until 16.4; in-memory fallback otherwise)

### Technology Requirements

| Technology | Purpose | Fallback |
|---|---|---|
| **WebAssembly** | `@sqlite.org/sqlite-wasm` | None — required |
| **OPFS** | Persistent SQLite storage | In-memory transient DB |
| **Web Workers** | Database & verification off-thread | None — required |
| **SharedArrayBuffer** | sqlite-wasm internal use | Requires COOP/COEP headers |
| **Service Worker** | PWA offline support | App still works online-only |

## Development Workflow

### Build System

```bash
npm install           # Install all workspace dependencies
npm run build:packages # Build @microsoft/ccf-ledger-parser and @microsoft/ccf-database
npm run dev            # Start Vite dev server (auto-builds packages first)
npm run build          # Production build
npm run lint           # ESLint across all packages and src
npm run test           # Run Vitest unit/integration tests
```

### Testing Strategy

- **Unit Tests** (`src/__tests__/`): Action registry, SSE parser, and AI chat component tests using Vitest + Testing Library.
- **Parser Tests** (`packages/ledger-parser/src/__tests__/`): Pure unit tests for the binary parser and Merkle tree; no browser dependencies.
- **E2E Tests** (`e2e/`): Playwright tests for the full file-ingestion workflow; requires a browser with OPFS support.

### PWA

The application is configured as a Progressive Web App via `vite-plugin-pwa`:

- **Manifest**: Defined in `vite.config.ts`; name, icons, `display: standalone`.
- **Service Worker**: Auto-update strategy via Workbox; pre-caches all static assets.
- **Install Prompt**: `PWAPrompt.tsx` shows a custom install prompt on compatible browsers.

## Deployment Architecture

### Azure Static Web Apps

- Deployed via `deploy-to-azure.ps1` (PowerShell; also works with `pwsh` on Linux).
- `staticwebapp.config.json` sets the required `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers for production.
- Optional Sage AI backend toggle controlled by the `VITE_ENABLE_SAGE` environment variable; when disabled, the app navigates directly to `/files` on startup.

### Static Hosting

- **CDN Distribution**: All assets are static; suitable for any CDN-backed host.
- **No Server Required**: The application is entirely client-side; no backend API is needed for core ledger exploration.

---

**⚠️ IMPORTANT**: This architecture documentation should be updated whenever significant architectural changes are made to the system. Any modifications to the core architectural patterns, technology choices, or data flow should be reflected in this document and communicated to the development team.
