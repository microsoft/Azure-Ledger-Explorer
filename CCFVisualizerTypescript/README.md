# CCF Ledger Visualizer (TypeScript)

A TypeScript/React application for visualizing and exploring CCF (Confidential Consortium Framework) ledger data.

## Features

- **Ledger File Parsing**: Import and parse CCF ledger files
- **Transaction Visualization**: Browse transactions with detailed information  
- **Search Functionality**: Search transactions by key names
- **Persistent Storage**: Client-side database using sql.js with OPFS VFS
- **Modern UI**: Built with FluentUI React components
- **State Management**: Efficient data handling with TanStack Query

## Getting Started

### Installation
```bash
npm install
npm run dev
```

### Usage
1. Upload CCF ledger files
2. Browse transactions with pagination
3. Search by key names
4. View statistics

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + FluentUI
- **Database**: sql.js with OPFS VFS for persistent storage
- **State**: TanStack Query for efficient data management
- **Parser**: Custom CCF ledger parser ported from C#
