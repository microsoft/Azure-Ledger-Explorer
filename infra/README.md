# Static Site Infrastructure

Infrastructure for hosting CCF Ledger Explorer as an Azure Static Web App.

## Create Infrastructure

To create infrastructure with the default values:

```sh
az login ...
az deployment sub create --name ccf-ledger-explorer-swa --location eastus2 --template-file CCF-Ledger-Explorer/infra/staticsite.bicep
```

Create infrastructure in a different resource group:

```sh
az login ...
az deployment sub create --name ccf-ledger-explorer-swa --location eastus2 --template-file CCF-Ledger-Explorer/infra/staticsite.bicep --parameters resourceGroupName=my-existing-rg
```
