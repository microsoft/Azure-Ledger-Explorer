targetScope = 'subscription'

@description('Existing resource group name to deploy the Static Web App into.')
param resourceGroupName string = 'ccfexplorer-demo-rg'

@description('Static Web App name.')
param staticSiteName string = 'ccfledgerexplorer'

@description('Azure region for the Static Web App resource.')
param location string = 'eastus'

// Reference existing RG (will fail if it does not exist)
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' existing = {
  name: resourceGroupName
}

module staticSite 'staticSite.module.bicep' = {
  name: 'staticSiteDeployment'
  scope: rg
  params: {
    staticSiteName: staticSiteName
    location: location
  }
}

output staticWebAppName string = staticSiteName
