# Deployment

## GitHub Pages Deployment

The project can be deployed to GitHub Pages as a fully static site. A GitHub Actions workflow (`.github/workflows/deploy-github-pages.yml`) automates the build and deployment on every push to `main`.

### How It Works

Since the app requires [cross-origin isolation](https://web.dev/cross-origin-isolation-guide/) (COOP/COEP headers) for OPFS-backed SQLite, and GitHub Pages does not support custom HTTP headers, the deployment uses [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) — a small MIT-licensed service worker that intercepts responses and injects the required headers client-side.

| Aspect | Azure SWA | GitHub Pages |
|--------|-----------|--------------|
| COOP/COEP headers | Server-provided | `coi-serviceworker` (client-side) |
| PWA service worker | VitePWA (Workbox) | Disabled (avoids SW scope conflict) |
| SPA routing | `staticwebapp.config.json` | `404.html` fallback |
| Base path | `/` | `/CCF-Ledger-Explorer/` |

> **Note:** On first visit, `coi-serviceworker` triggers a single page reload to activate the service worker and enable cross-origin isolation. This is expected behavior.

### Prerequisites

1. **Enable GitHub Pages** in the repository settings:
   - Go to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
2. The workflow runs automatically on push to `main`. No additional configuration is needed.

### Building Locally for GitHub Pages

To test the GitHub Pages build locally:

```bash
DEPLOY_TARGET=github-pages npm run build
```

On Windows PowerShell:

```powershell
$env:DEPLOY_TARGET = "github-pages"; npm run build; Remove-Item Env:DEPLOY_TARGET
```

The build output in `dist/` will use `/CCF-Ledger-Explorer/` as the base path and exclude VitePWA.

## Azure Static Web Apps Deployment

The project includes an automated PowerShell deployment script (`deploy-to-azure.ps1`) for deploying to Azure Static Web Apps.

### Prerequisites

- **Azure CLI**: Install from [Microsoft Docs](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Azure Subscription**: authenticate using `az login --use-device-code`
- **PowerShell**

**Using the script**

- (Windows) `./deploy-to-azure.ps1 ...` used in examples below
- (Linux) `pwsh deploy-to-azure.ps1 ...`

### Deployment Options (use pwsh on Linux)

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

**Deploy with Sage instead of CCF Ledger Chat (sets VITE_ENABLE_SAGE=true during build):**

```powershell
# Use Sage in a production build
./deploy-to-azure.ps1 -BuildFirst -EnableSage -ResourceGroupName "ccfexplorer-demo-rg"

# Use Sage in a preview build
./deploy-to-azure.ps1 -BuildFirst -DeployToPreview -EnableSage
```

> **Note:** Sage and CCF Ledger Chat are mutually exclusive. When `-EnableSage` is set,
> the build uses the Sage provider. Otherwise it defaults to CCF Ledger Chat (BYOK OpenAI).

## Telemetry Configuration (Optional)

Azure Ledger Explorer supports optional telemetry via Azure Application Insights to collect anonymous usage data (page views, feature usage). No personal data or ledger content is collected.

### Setting Up Application Insights

1. **Create an Application Insights resource** in Azure Portal:
   - Search for "Application Insights" → Click **Create**
   - Select your subscription and resource group
   - Choose a name (e.g., `ccf-ledger-explorer-insights`)
   - Select a region close to your users
   - Use **Workspace-based** mode (recommended)
   - Click **Review + Create** → **Create**

2. **Copy the Connection String**:
   - Go to your Application Insights resource
   - In the **Overview** blade, find **Connection String** on the right side
   - Copy it (format: `InstrumentationKey=xxx;IngestionEndpoint=https://...`)

3. **Add to Azure Static Web Apps**:
   - Go to your Static Web App in Azure Portal
   - Navigate to **Configuration** → **Application settings**
   - Click **+ Add** and create:
     - **Name**: `VITE_APPINSIGHTS_CONNECTION_STRING`
     - **Value**: Your connection string from step 2
   - Click **Save**
   - Redeploy the application (or wait for the next deployment)

### Viewing Telemetry Data

In your Application Insights resource:
- **Live Metrics**: Real-time view of incoming telemetry
- **Usage** → **Users/Sessions/Events**: Engagement metrics and feature usage
- **Logs**: Query raw telemetry data using KQL

### Notes

- If `VITE_APPINSIGHTS_CONNECTION_STRING` is not configured, telemetry is silently disabled
- Users can opt out of telemetry in the application's Settings page
- See [docs/TELEMETRY_README.md](./TELEMETRY_README.md) for full details on what data is collected