# Azure Ledger Explorer

A TypeScript/React application for exploring and analyzing CCF (Confidential Consortium Framework) ledger data with querying capabilities.

## Features

- **Ledger File Parsing**: Import and parse CCF ledger files with full transaction details
- **Transaction Visualization**: Browse transactions with detailed information and search capabilities
- **Azure Integration**: Direct import from Azure File Shares using SAS tokens
- **Persistent Storage**: Client-side SQLite database with OPFS VFS
- **Progressive Web App**: Install to your device, work offline, and get automatic updates
- **Clean UI**: Built with FluentUI React components and responsive design
- **State Management**: Efficient data handling with TanStack Query and optimistic updates

## Quick Start

### Local Development

1. Clone the repository `git clone $REPOSITORY_URL ccf-ledger-explorer && cd ccf-ledger-explorer`
2. Install dependencies `npm install`
3. Start the development server `npm run dev`
4. Open `http://localhost:5173` in your browser

### Usage

1. Upload ledger files: 
    - Option 1: drag and drop CCF ledger files that you already obtained, find sample files in the `e2e` tests folder
    - Option 2: backup CCF ledger to Azure File Share and provide a SAS token in the import dialog
    - Option 3: download files from a known Microsoft's Signing Transparency ledger, i.e. provide a known domain name in the import dialog
    - Option 4: click **Load sample ledger** on the welcome screen to import a small bundled sample (`public/samples/ledger_1-14.committed`) and explore the app immediately
2. Verify ledger integrity after importing the files 
3. Explore transactions, key-value operations, and statistics. Find specific transactions and analyze patterns.

## Documentation

**IMPORTANT**: Before contributing to this project, you MUST read the documentation in the `/docs` folder:

### Essential Reading

- **[Documentation Index](./docs/README.md)**
- **[Code Standards](./docs/CODE_STANDARDS.md)**
- **[Architecture Overview](./docs/ARCHITECTURE_README.md)**

### Development Guides

- **[Testing Guide](./docs/TESTING_README.md)**
- **[Deployment Guide](./docs/DEPLOYMENT_README.md)**

### Component Documentation

- **[Parser System](./docs/PARSER_README.md)**
- **[Database & Persistence](./docs/DATABASE_README.md)**
- **[External Services](./docs/EXTERNAL_SERVICES_README.md)**
- **[AI Assistant](./docs/AI_ASSISTANT_README.md)**

## Acknowledgements

CCF Ledger Explorer is built on the shoulders of many excellent open source projects:

### Core Framework

| Project | Description |
|---------|-------------|
| [React](https://github.com/facebook/react) | JavaScript library for building user interfaces |
| [React Router](https://github.com/remix-run/react-router) | Declarative routing for React web applications |
| [TypeScript](https://github.com/microsoft/TypeScript) | Typed superset of JavaScript |

### UI Components

| Project | Description |
|---------|-------------|
| [Fluent UI React](https://github.com/microsoft/fluentui) | Microsoft's React component library |
| [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) | Familiar, friendly, and modern icon collection |
| [Monaco Editor for React](https://github.com/suren-atoyan/monaco-react) | Monaco code editor component for React |

### State Management & Data

| Project | Description |
|---------|-------------|
| [TanStack Query](https://github.com/TanStack/query) | Async state management for React |
| [SQLite WASM](https://github.com/sqlite/sqlite-wasm) | SQLite compiled to WebAssembly |

### Azure SDKs

| Project | Description |
|---------|-------------|
| [Azure SDK for JavaScript](https://github.com/Azure/azure-sdk-for-js) | Azure Confidential Ledger and Storage File Share clients |
| [Application Insights JS](https://github.com/microsoft/ApplicationInsights-JS) | Azure Application Insights telemetry SDK |

### Data Processing & Cryptography

| Project | Description |
|---------|-------------|
| [cbor2](https://github.com/hildjj/cbor2) | CBOR (Concise Binary Object Representation) encoding and decoding |
| [jsrsasign](https://github.com/kjur/jsrsasign) | Pure JavaScript cryptographic library (RSA, ECDSA, X.509) |
| [js-base64](https://github.com/dankogai/js-base64) | Base64 transcoder |
| [buffer](https://github.com/feross/buffer) | Node.js Buffer API for the browser |

### Markdown Rendering

| Project | Description |
|---------|-------------|
| [react-markdown](https://github.com/remarkjs/react-markdown) | React component to render Markdown |
| [remark-gfm](https://github.com/remarkjs/remark-gfm) | GitHub Flavored Markdown support |

### Build & Development Tools

| Project | Description |
|---------|-------------|
| [Vite](https://github.com/vitejs/vite) | Next-generation frontend build tool |
| [ESLint](https://github.com/eslint/eslint) | Pluggable linting utility for JavaScript and TypeScript |
| [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | TypeScript support for ESLint |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | Zero-config PWA plugin for Vite |
| [Workbox](https://github.com/GoogleChrome/workbox) | Service worker libraries for Progressive Web Apps |
| [sharp](https://github.com/lovell/sharp) | High-performance Node.js image processing |

### Testing

| Project | Description |
|---------|-------------|
| [Playwright](https://github.com/microsoft/playwright) | End-to-end testing framework for web apps |
| [Vitest](https://github.com/vitest-dev/vitest) | Vite-native unit testing framework |
| [Testing Library](https://github.com/testing-library/dom-testing-library) | Simple and complete DOM testing utilities |
