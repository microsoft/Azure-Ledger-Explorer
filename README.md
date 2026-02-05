# CCF Ledger Explorer

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
