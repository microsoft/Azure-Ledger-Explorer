# CCF Ledger Visualizer (TypeScript)

A TypeScript/React application for visualizing and exploring CCF (Confidential Consortium Framework) ledger data with AI-powered querying capabilities.

## Features

- **Ledger File Parsing**: Import and parse CCF ledger files with full transaction details
- **Transaction Visualization**: Browse transactions with detailed information and search capabilities
- **AI Assistant**: Natural language querying using OpenAI integration with automatic SQL generation
- **Azure Integration**: Direct import from Azure File Shares using SAS tokens
- **Persistent Storage**: Client-side SQLite database using sql.js with OPFS VFS
- **Modern UI**: Built with FluentUI React components and responsive design
- **State Management**: Efficient data handling with TanStack Query and optimistic updates

## Quick Start

### Installation
```bash
npm install
npm run dev
```

### Usage
1. **Upload Files**: Drag and drop CCF ledger files or connect to Azure File Share
2. **Browse Data**: Explore transactions, key-value operations, and statistics
3. **AI Queries**: Ask natural language questions about your data
4. **Search & Filter**: Find specific transactions and analyze patterns

## 📚 Documentation

**IMPORTANT**: Before contributing to this project, you MUST read the documentation in the `/docs` folder:

### 🚨 Essential Reading
- **[📋 Documentation Index](./docs/README.md)** - Start here for navigation
- **[📜 Code Standards](./docs/CODE_STANDARDS.md)** - **MANDATORY** - Required patterns and TanStack Query usage
- **[🏗️ Architecture Overview](./docs/ARCHITECTURE_README.md)** - System design and component relationships

### 📖 Component Documentation
- **[🔧 Parser System](./docs/PARSER_README.md)** - CCF file parsing and binary data handling
- **[🗄️ Database & Persistence](./docs/DATABASE_README.md)** - SQL.js integration and storage patterns
- **[🌐 External Services](./docs/EXTERNAL_SERVICES_README.md)** - OpenAI and Azure integrations
- **[🤖 AI Assistant](./docs/AI_ASSISTANT_README.md)** - Natural language query interface

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: FluentUI React components
- **Database**: sql.js with OPFS VFS for persistent browser storage
- **State Management**: TanStack Query for server state and caching
- **Parser**: Custom CCF ledger parser (ported from C#)
- **AI Integration**: OpenAI API for natural language processing
- **Cloud Storage**: Azure File Share integration
