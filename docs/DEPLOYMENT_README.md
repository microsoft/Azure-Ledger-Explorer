# Deployment

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

**Deploy with AI chat features disabled (sets VITE_DISABLE_SAGE=true during build):**

```powershell
# Disable Sage in a production build
./deploy-to-azure.ps1 -BuildFirst -DisableSage -ResourceGroupName "ccfexplorer-demo-rg"

# Disable Sage in a preview build
./deploy-to-azure.ps1 -BuildFirst -DeployToPreview -DisableSage
```