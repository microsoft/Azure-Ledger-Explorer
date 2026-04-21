# Static Site Infrastructure

Infrastructure for hosting Azure Ledger Explorer as an Azure Static Web App.

## Create Infrastructure

To create infrastructure with the default values:

```sh
az login ...
az deployment sub create --name ccf-ledger-explorer-swa --location eastus --template-file ./infra/staticsite.bicep
```

To create infrastructure in an existing or different resource group:

```sh
az login ...
az deployment sub create --name ccf-ledger-explorer-swa --location eastus --template-file ./infra/staticsite.bicep --parameters resourceGroupName=<my-existing-rg>
```
