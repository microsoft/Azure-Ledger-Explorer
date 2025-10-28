Static site infrastructure to host website
========================

To create infrastructure with the default values:

```sh
az login ...
az deployment sub create --name ccfvisualizer-swa --location eastus2 --template-file CCFVisualizerTypescript/infra/staticsite.bicep
```

Create infrastructure in a different resource group:

```sh
az login ...
az deployment sub create --name ccfvisualizer-swa --location eastus2 --template-file CCFVisualizerTypescript/infra/staticsite.bicep --parameters resourceGroupName=my-existing-rg
```