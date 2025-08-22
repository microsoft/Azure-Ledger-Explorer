# Azure Deployment Script for CCFVisualizerTypescript
# This script deploys the built application to Azure Static Web Apps
#
# Examples:
#   # Deploy to production
#   ./deploy-to-azure.ps1 -CreateResources -BuildFirst
#
#   # Deploy to a preview environment
#   ./deploy-to-azure.ps1 -DeployToPreview -PreviewEnvironment "feature-testing" -BuildFirst
#
#   # Deploy to auto-generated preview environment
#   ./deploy-to-azure.ps1 -DeployToPreview -BuildFirst

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "sage-transparency-demo-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$StaticWebAppName = "ccfvisualizer",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US 2",
    
    [Parameter(Mandatory=$false)]
    [switch]$CreateResources = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$BuildFirst,
    
    [Parameter(Mandatory=$false)]
    [string]$PreviewEnvironment = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$DeployToPreview = $false
)

# Parameter validation
if ($DeployToPreview -and $PreviewEnvironment) {
    # Validate preview environment name (Azure Static Web Apps naming requirements)
    if ($PreviewEnvironment -notmatch "^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$") {
        Write-Error "Preview environment name '$PreviewEnvironment' is invalid. It must be 2-63 characters long, start and end with alphanumeric characters, and contain only letters, numbers, and hyphens."
        exit 1
    }
}

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

function Write-Info {
    param($Message)
    Write-Host $Message -ForegroundColor $InfoColor
}

function Write-Success {
    param($Message)
    Write-Host $Message -ForegroundColor $SuccessColor
}

function Write-Warning {
    param($Message)
    Write-Host $Message -ForegroundColor $WarningColor
}

function Write-Error {
    param($Message)
    Write-Host $Message -ForegroundColor $ErrorColor
}

# Check if Azure CLI is installed
Write-Info "Checking if Azure CLI is installed..."
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Success "Azure CLI version $($azVersion.'azure-cli') found"
} catch {
    Write-Error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
}

# Check if Static Web Apps extension is installed
Write-Info "Checking Azure Static Web Apps CLI extension..."
$extensions = az extension list --output json | ConvertFrom-Json
if (-not ($extensions | Where-Object { $_.name -eq "staticwebapp" })) {
    Write-Info "Installing Azure Static Web Apps CLI extension..."
    az extension add --name staticwebapp
} else {
    Write-Success "Azure Static Web Apps CLI extension is already installed"
}

# Login to Azure if not already logged in
Write-Info "Checking Azure login status..."
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Success "Logged in as: $($account.user.name)"
    Write-Success "Subscription: $($account.name) ($($account.id))"
} catch {
    Write-Info "Not logged in to Azure. Starting login process..."
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to login to Azure"
        exit 1
    }
}

# Build the application if requested
if ($BuildFirst -or (-not (Test-Path "dist"))) {
    Write-Info "Building the application..."
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Info "Installing npm dependencies..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install npm dependencies"
            exit 1
        }
    }
    
    # Build the project
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build the application"
        exit 1
    }
    
    Write-Success "Application built successfully"
}

# Check if dist folder exists
if (-not (Test-Path "dist")) {
    Write-Error "dist folder not found. Please run 'npm run build' first or use -BuildFirst parameter"
    exit 1
}

# Create Azure resources if requested
if ($CreateResources) {
    Write-Info "Creating Azure resources..."
    
    # Create resource group
    Write-Info "Creating resource group: $ResourceGroupName"
    az group create --name $ResourceGroupName --location $Location --output table
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create resource group"
        exit 1
    }
    
    # Create Static Web App
    Write-Info "Creating Static Web App: $StaticWebAppName"
    $swa = az staticwebapp create `
        --name $StaticWebAppName `
        --resource-group $ResourceGroupName `
        --location $Location `
        --output json | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create Static Web App"
        exit 1
    }
    
    Write-Success "Static Web App created successfully"
    Write-Success "Default hostname: $($swa.defaultHostname)"
    
    # Get the deployment token
    $deploymentToken = az staticwebapp secrets list --name $StaticWebAppName --resource-group $ResourceGroupName --query "properties.apiKey" --output tsv
} else {
    # Check if Static Web App exists
    Write-Info "Checking if Static Web App exists: $StaticWebAppName"
    try {
        $swa = az staticwebapp show --name $StaticWebAppName --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        Write-Success "Found existing Static Web App: $($swa.defaultHostname)"
        
        # Get the deployment token
        $deploymentToken = az staticwebapp secrets list --name $StaticWebAppName --resource-group $ResourceGroupName --query "properties.apiKey" --output tsv
    } catch {
        Write-Error "Static Web App '$StaticWebAppName' not found in resource group '$ResourceGroupName'"
        Write-Info "Use -CreateResources parameter to create the resources automatically"
        exit 1
    }
}

# Deploy to Static Web App
Write-Info "Deploying application to Static Web App..."

# Check if Static Web Apps CLI is installed globally
try {
    $swaCliVersion = swa --version
    Write-Success "Static Web Apps CLI found: $swaCliVersion"
} catch {
    Write-Info "Installing Static Web Apps CLI globally..."
    npm install -g @azure/static-web-apps-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install Static Web Apps CLI"
        exit 1
    }
}

# Determine deployment environment and URL
$deploymentEnvironment = "production"
$deploymentUrl = "https://$($swa.defaultHostname)"

if ($DeployToPreview) {
    if (-not $PreviewEnvironment) {
        # Generate a preview environment name if not provided
        $timestamp = Get-Date -Format "yyyyMMdd-HHmm"
        $PreviewEnvironment = "preview-$timestamp"
    }
    $deploymentEnvironment = $PreviewEnvironment
    # Preview URLs follow the pattern: https://[environment-name].[static-web-app-name].azurestaticapps.net
    $previewUrl = "https://$PreviewEnvironment.$($StaticWebAppName).azurestaticapps.net"
    $deploymentUrl = $previewUrl
    Write-Info "Deploying to preview environment: $PreviewEnvironment"
    Write-Info "Preview URL will be: $deploymentUrl"
}

# Deploy using SWA CLI
Write-Info "Starting deployment to $deploymentEnvironment environment..."
swa deploy ./dist --deployment-token $deploymentToken --env $deploymentEnvironment

Write-Success "Deployment script completed!"
