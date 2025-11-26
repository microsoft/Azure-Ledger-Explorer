# CCF Ledger Explorer

A TypeScript/React application for exploring and analyzing CCF (Confidential Consortium Framework) ledger data with AI-powered querying capabilities.

## Features

- **Ledger File Parsing**: Import and parse CCF ledger files with full transaction details
- **Transaction Visualization**: Browse transactions with detailed information and search capabilities
- **Sage AI Assistant**: Natural language querying using OpenAI integration with automatic SQL generation
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

## 🚀 Deployment

### Azure Static Web Apps Deployment

The project includes an automated PowerShell deployment script (`deploy-to-azure.ps1`) for deploying to Azure Static Web Apps.

#### Prerequisites

- **Azure CLI**: Install from [Microsoft Docs](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Azure Subscription**: authenticate using `az login --use-device-code`
- **PowerShell**

**Using the script**

- (Windows) `./deploy-to-azure.ps1 ...` used in examples below
- (Linux) `pwsh deploy-to-azure.ps1 ...`

#### Deployment Options (on Linux use pwsh)

**First-time deployment (creates resources and deploys):**

```powershell
./deploy-to-azure.ps1 -CreateResources -BuildFirst
```

**Deploy to existing Static Web App:**

```powershell
./deploy-to-azure.ps1 -BuildFirst
```

**Deploy to preview environment:**

```powershell
# Deploy to auto-generated preview environment
./deploy-to-azure.ps1 -DeployToPreview -BuildFirst

# Deploy to named preview environment
./deploy-to-azure.ps1 -DeployToPreview -PreviewEnvironment "feature-testing" -BuildFirst
```

**Deploy with Sage features disabled (sets VITE_DISABLE_SAGE=true during build):**

```powershell
# Disable Sage in a production build
./deploy-to-azure.ps1 -BuildFirst -DisableSage -ResourceGroupName "ccfexplorer-demo-rg"

# Disable Sage in a preview build
./deploy-to-azure.ps1 -BuildFirst -DeployToPreview -DisableSage
```

#### Script Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-ResourceGroupName` | Azure resource group name | `sage-transparency-demo-rg` |
| `-StaticWebAppName` | Static Web App name | `ccf-ledger-explorer` |
| `-Location` | Azure region | `East US 2` |
| `-CreateResources` | Create Azure resources if they don't exist | `false` |
| `-BuildFirst` | Build the application before deployment | `false` |
| `-DisableSage` | Temporarily set VITE_DISABLE_SAGE=true for the build (requires -BuildFirst) | `false` |
| `-DeployToPreview` | Deploy to preview environment | `false` |
| `-PreviewEnvironment` | Custom preview environment name | Auto-generated |

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
