@description('Static Web App name.')
param staticSiteName string

@description('Location for the Static Web App resource.')
param location string

resource staticSiteResource 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticSiteName
  location: location
  tags: {
    scope: 'acl'
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'SwaCli'
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

resource staticSiteResourceBasicAuth 'Microsoft.Web/staticSites/basicAuth@2024-11-01' = {
  parent: staticSiteResource
  name: 'default'
  properties: {
    applicableEnvironmentsMode: 'SpecifiedEnvironments'
  }
}

output staticWebAppResourceId string = staticSiteResource.id
