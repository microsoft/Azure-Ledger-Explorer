/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { getAuthorizationToken } from "@microsoft/azureportal-reactview/Az";
/**
 * Truncates a string to a maximum length by preserving the beginning and end, 
 * and inserting a hyphen in the middle if the string exceeds the specified length.
 *
 * The resulting format is: `<prefix>-<suffix>`, where the total length does not exceed `maxLen`.
 * The prefix is trimmed to `maxLen - 8` characters, and the suffix includes the last 7 characters.
 *
 * @param {string} str - The input string to truncate.
 * @param {number} maxLen - The maximum allowed length of the result.
 * @returns {string} The truncated string, or the original if its length is within `maxLen`.
 *
 * @example
 * truncate("thisisaverylongstringvalue", 20); // "thisisaveryl-tringvalue"
 * truncate("short", 10);                      // "short"
 */
export const truncate = (str: string, maxLen: number) =>
  str.length > maxLen ? str.substring(0, maxLen - 8) + "-" + str.slice(-7) : str;
import { ArmId } from '@microsoft/azureportal-reactview/ResourceManagement';
import { useMutation, useQuery } from "@tanstack/react-query";

/**
 * Custom React hook to fetch resources associated with a managed Azure application.
 * 
 * This hook uses a mutation to:
 * - Parse the ARM resource ID to get subscription and resource group.
 * - Retrieve the `managedBy` property from the resource group.
 * - If the resource group is managed, it fetches details about associated resources such as
 *   Service Bus, Storage, Function App, and Confidential Ledger.
 *
 * @returns A mutation object that allows you to fetch managed application resources
 *          by passing an object with an `armResourceId` string.
 *
 * @example
 * const mutation = useManagedAppResources();
 * mutation.mutateAsync({ armResourceId: "/subscriptions/xxx/resourceGroups/yyy/..." });
 */
export const useManagedAppResources = () => {
  return useMutation({
    mutationFn: async ({ armResourceId }: { armResourceId: string }) => {
      if (!armResourceId) throw new Error("Resource ID is required.");

      // Extract subscription and resource group
      const match = armResourceId.match(/\/subscriptions\/([^\/]+)\/resourceGroups\/([^\/]+)/);
      if (!match) throw new Error("Invalid resource ID format.");

      const [_, subscriptionId, resourceGroupName] = match;
      const baseResourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}`;

      // Fetch Azure authorization token
      const token = await getAuthorizationToken({ resourceName: '' });

      // Get managedBy property of the resource group
      const rgUrl = `https://management.azure.com${baseResourceId}?api-version=2021-04-01`;
      const rgResponse = await fetch(rgUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!rgResponse.ok) {
        throw new Error(`Failed to fetch resource group data: ${await rgResponse.text()}`);
      }

      const rgData = await rgResponse.json() as { managedBy?: string };
      const managedBy = rgData.managedBy;
      if (!managedBy) return { isManagedApp: false, resources: {} };

      // Fetch managed app resources
      const managedResourcesUrl = `https://management.azure.com${managedBy}?api-version=2019-07-01`;
      const resourcesResponse = await fetch(managedResourcesUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!resourcesResponse.ok) {
        throw new Error(`Failed to fetch managed app resources: ${await resourcesResponse.text()}`);
      }

      const resourcesData = await resourcesResponse.json() as { properties?: { parameters?: Record<string, { value: string }> } };
      const parameters = resourcesData.properties?.parameters || {};

      // Extract specific resource names safely
      const serviceBusNamespaceName = parameters.serviceBusNamespaceName?.value || "";
      const storageName = parameters.storageName?.value || "";
      const functionName = parameters.functionName?.value || "";
      const ledgerName = parameters.ledgerName?.value || "";
      const appName = parameters.appName?.value || "";

      return {
        isManagedApp: true,
        resources: {
          serviceBusNamespaceId: serviceBusNamespaceName
            ? `${baseResourceId}/providers/Microsoft.ServiceBus/namespaces/${serviceBusNamespaceName}`
            : undefined,
          storageAccountId: storageName
            ? `${baseResourceId}/providers/Microsoft.Storage/storageAccounts/${storageName}`
            : null,
          functionAppId: functionName
            ? `${baseResourceId}/providers/Microsoft.Web/sites/${functionName}`
            : null,
          ledgerId: ledgerName
            ? `${baseResourceId}/providers/Microsoft.ConfidentialLedger/ledgers/${ledgerName}`
            : null,
          appName: appName,
          storageName: storageName
        },
      };
    },
  });
};

/**
 * Custom React hook to fetch data from an Azure Table Storage table. This table contains information about
 * the audit results for a managed application.
 *
 * This hook uses a mutation to:
 * - Authenticate against the Table Storage REST API.
 * - Build a properly formatted request with the current UTC date.
 * - Fetch and return the table's data in JSON format.
 *
 * @returns A mutation object that fetches table data when called with a storage account name and table name.
 *
 * @example
 * const mutation = useFetchTableStorageData();
 * mutation.mutateAsync({ storageAccountName: 'myaccount', tableName: 'AuditTable' });
 */
export const useFetchTableStorageData = () => {
  return useMutation({
    mutationFn: async ({
      storageAccountName,
      tableName,
    }: {
      storageAccountName: string;
      tableName: string;
    }) => {
    if (!storageAccountName) throw new Error("Storage Account Name not provided");

    const token = await getAuthorizationToken({ resourceName: 'storage' });
    const dateUtc = new Date().toUTCString(); // Ensure RFC1123 format for Azure Table Storage API

    const queryParams = new URLSearchParams({ "api-version": "2020-12-06" });
    const tableStorageUrl = `https://${storageAccountName}.table.core.windows.net/${tableName}()?${queryParams.toString()}`;

    const response = await fetch(tableStorageUrl, {
      method: "GET",
      headers: {
        "Authorization": token.header,
        "x-ms-version": "2020-12-06",
        "x-ms-date": dateUtc,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch table storage data: ${errorText}`);
    }

    interface ResponseData {
      [key: string]: unknown; // Replace `unknown` with the actual expected type if known
    }

    const responseData = await response.json() as ResponseData;
    return responseData;
  }
});
};

/**
 * Custom React hook to fetch audit-related table data from Azure Table Storage via a managed app.
 *
 * This hook performs the following steps:
 * 1. Uses the ARM resource ID to retrieve Managed App resources.
 * 2. Extracts the associated storage account name from those resources.
 * 3. Fetches the table data using the extracted storage account and given table name.
 *
 * @returns A mutation object that returns the audit table data when called with `armResourceId` and `tableName`.
 *
 * @example
 * const mutation = useFetchAuditTableData();
 * mutation.mutateAsync({ armResourceId: '/subscriptions/...', tableName: 'AuditEvents' });
 */
export const useFetchAuditTableData = () => {
  const fetchManagedAppResources = useManagedAppResources();
  const fetchTableStorageData = useFetchTableStorageData();

  return useMutation({
    mutationFn: async ({
      armResourceId,
      tableName,
    }: {
      armResourceId: string;
      tableName: string;
    }) => {
    const managedAppData: { resources?: { storageName?: string } } = await fetchManagedAppResources.mutateAsync({ armResourceId });

    if (!managedAppData || !managedAppData.resources?.storageName) {
      throw new Error("Storage Account Name not found in Managed App Resources.");
    }

    const storageAccountName = managedAppData.resources.storageName;

    const result: Record<string, any> = await fetchTableStorageData.mutateAsync({ storageAccountName, tableName });
    return result;
  }
});
};

/**
 * Custom React hook to download the latest audit result file from an Azure Blob Storage container.
 *
 * This hook performs the following steps:
 * 1. Fetches managed application resources using the provided ARM resource ID.
 * 2. Uses the `appName` from the managed resources to locate the audit records container.
 * 3. Lists all blobs in the specified directory (based on storageAccount/containerName).
 * 4. Identifies the most recently modified audit blob file.
 * 5. Downloads that blob file via a signed OAuth request and triggers a browser download.
 *
 * @returns A mutation object that triggers the audit result download when called.
 *
 * @param {string} storageAccount - The name of the Azure Storage Account.
 * @param {string} containerName - The name of the logical container used as a prefix to search within blobs.
 * @param {string} resourceId - The full ARM resource ID used to identify the managed app and extract its `appName`.
 *
 * @example
 * const downloadAudit = useDownloadAuditResults();
 * downloadAudit.mutateAsync({
 *   storageAccount: 'mystorageacct',
 *   containerName: 'target-container',
 *   resourceId: '/subscriptions/.../resourceGroups/.../providers/Microsoft.Solutions/applications/...'
 * });
 */
export const useDownloadAuditResults = () => {
  const fetchManagedAppResources = useManagedAppResources();

  return useMutation({
  mutationFn: async ({
    storageAccount,
    containerName,
    resourceId,
  }: {
    storageAccount: string;
    containerName: string;
    resourceId: string;
  }) => {
    try {
      const managedAppData = await fetchManagedAppResources.mutateAsync({ armResourceId: resourceId });

      if (!managedAppData.resources || !managedAppData.resources.appName) {
        throw new Error("❌ App name not found in managed resources.");
      }

      const appName = managedAppData.resources.appName;

      const blobServiceUrl = `https://${storageAccount}.blob.core.windows.net/${appName}-audit-records`;

      const token = await getAuthorizationToken({ resourceName: 'storage' });

      const response = await fetch(
        `${blobServiceUrl}?restype=container&comp=list&prefix=${storageAccount}/${containerName}/&include=metadata`,
        {
          method: "GET",
          headers: {
            "x-ms-version": "2020-08-04",
            "Authorization": token.header,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list files: ${errorText}`);
      }

      const textResponse = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(textResponse, "text/xml");
      const blobs = Array.from(xmlDoc.getElementsByTagName("Blob")).map((blob) => ({
        name: blob.getElementsByTagName("Name")[0]?.textContent || "",
        lastModified: blob.getElementsByTagName("Last-Modified")[0]?.textContent || "",
      }));

      if (blobs.length === 0) throw new Error("No audit files found in storage.");

      const latestFile = blobs.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())[0];

      const fileUrl = `${blobServiceUrl}/${latestFile.name}`;

      const fileResponse = await fetch(fileUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "x-ms-version": "2020-08-04",
        },
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        throw new Error(`Failed to download file: ${errorText}`);
      }

      const blob = await fileResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = latestFile.name;
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error("❌ Failed to download audit results:", error);
    }
  }
  });
};
  
/**
 * React hook to list all Azure Storage Accounts under a given subscription using Azure Resource Manager (ARM) APIs.
 *
 * This hook:
 * - Extracts the subscription ID from the given ARM resource ID.
 * - Authenticates with Azure using an OAuth token.
 * - Queries the Azure Management API to retrieve storage accounts for that subscription.
 * - Returns an array of formatted objects with `key`, `text`, and `resourceId` for each storage account.
 *
 * Uses React Query (`useQuery`) internally and supports retries and conditional fetching.
 *
 * @param {string} [resourceId] - Optional full ARM resource ID to extract the subscription from (e.g. `/subscriptions/<id>/resourceGroups/...`).
 * @returns A React Query result object containing the list of storage accounts and metadata (loading, error, etc).
 *
 * @example
 * const { data, isLoading } = useListStorageAccounts("/subscriptions/abc123/resourceGroups/my-rg");
 */
export const useListStorageAccounts = (resourceId?: string) => {
  const subscriptionId = resourceId ? ArmId.parse(resourceId).subscription : undefined;

  return useQuery({
    queryKey: ["storageAccounts", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) throw new Error("Subscription ID not provided");

      const token = await getAuthorizationToken({ resourceName: '' });
      const storageAccountsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Storage/storageAccounts?api-version=2021-09-01`;

      const response = await fetch(storageAccountsUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch storage accounts: ${errorText}`);
      }

      const fetchData = await response.json() as { value?: { id: string; name: string }[] };
      if (!fetchData.value || fetchData.value.length === 0) {
        throw new Error('No storage accounts found');
      }

      return fetchData.value.map(item => ({
        key: item.id,
        text: item.name,
        resourceId: item.id,
      }));
    },
    retry: 3,
    enabled: !!subscriptionId,
  });
};

/**
 * Custom React hook that performs a sequence of Azure operations to assign necessary roles and 
 * set up event subscriptions for a managed application.
 *
 * This hook encapsulates the following steps:
 * 1. Extracts the subscription ID and resource group from the provided resource ID.
 * 2. Creates an Azure Event Grid System Topic for the target storage account.
 * 3. Assigns the "Storage Queue Data Message Sender" role to the system topic principal.
 * 4. Fetches managed app resources to retrieve the target storage account and function app.
 * 5. Creates an Event Subscription to forward blob events to the storage queue.
 * 6. Assigns the "Storage Blob Data Owner" role to the function app (via its OID).
 *
 * All operations are authenticated via Azure AD and performed using ARM APIs.
 *
 * @returns A mutation object that can be triggered to execute the full setup process.
 *
 * @param {string} resourceId - The ARM resource ID for the managed application (used to extract subscription and group).
 * @param {string} storageAccount - The name of the Azure Storage Account.
 * @param {string} storageResourceId - The ARM ID of the target Storage resource to assign roles on.
 *
 * @example
 * const setup = useFetchAndAssignRole();
 * setup.mutateAsync({
 *   resourceId: "/subscriptions/abc123/resourceGroups/rg1/providers/Microsoft.Solutions/applications/app1",
 *   storageAccount: "myaccount",
 *   storageResourceId: "/subscriptions/abc123/resourceGroups/rg1/providers/Microsoft.Storage/storageAccounts/myaccount"
 * });
 */
export const useFetchAndAssignRole = () => {
  const fetchManagedAppResources = useManagedAppResources();
  const fetchRoleDefinitionId = useFetchRoleDefinitionId();
  const fetchFunctionAppOID = useFetchFunctionAppOID();
  const assignRole = useAssignRole();
  const getStorageLocation = useFetchStorageLocation();
  const createSystemTopic = useCreateSystemTopic();
  const createEventSubscription = useCreateEventSubscription();
  const getQueueId = useFetchServiceBusQueue().mutateAsync;

  return useMutation({
    mutationFn: async ({
      resourceId,
      storageAccount,
      storageResourceId,
    }: {
      resourceId: string;
      storageAccount: string;
      storageResourceId: string;
    }) => {
    const subscriptionId = ArmId.parse(resourceId).subscription;
    if (!subscriptionId) {
      throw new Error("Subscription ID extraction failed.");
    }

    const resourceGroupId = ArmId.parse(resourceId).resourceGroup;
    if (!resourceGroupId) {
      throw new Error("Resource Group ID extraction failed.");
    }

    const storageLocation = await getStorageLocation.mutateAsync({ storageResourceId });

    if (!storageLocation) {
      throw new Error("Storage location is required but was null.");
    }
    const { principalId: systemTopicPrincipalId, systemTopicName: systemTopicName } = await createSystemTopic.mutateAsync({ mrgName: resourceGroupId, storageAccount, storageResourceId, storageLocation });
    if (!systemTopicPrincipalId) {
      throw new Error("Failed to retrieve System Topic Principal ID.");
    }
    if (!systemTopicName) {
      throw new Error("Failed to retrieve System Topic Name.");
    }

    const roleDefinitionIdsb = await fetchRoleDefinitionId.mutateAsync({ subscriptionId, roleName: "Azure Service Bus Data Sender" });
    if (!roleDefinitionIdsb) {
      throw new Error("Failed to retrieve Role Definition ID.");
    }

    const managedAppResources = await fetchManagedAppResources.mutateAsync({ armResourceId: resourceId });
    if (!managedAppResources || !managedAppResources.resources) {
      throw new Error("Failed to fetch Managed App Resources.");
    }

    const sbId = managedAppResources.resources.serviceBusNamespaceId;
    if (!sbId) {
      throw new Error("Service Bus Namespace ID not found.");
    }

    const roleAssignmentResult = await assignRole.mutateAsync({
      storageResourceId: sbId,
      principalId: systemTopicPrincipalId,
      roleDefinitionId: roleDefinitionIdsb,
    });
    if (!roleAssignmentResult) {
      throw new Error("Failed to assign role to System Topic.");
    }

    if (!getQueueId || typeof getQueueId !== "function") {
      throw new Error("getQueueId is not properly initialized or is not a valid mutation hook.");
    }

    const queueId = await getQueueId({ armResourceId: sbId });
    if (!queueId) {
      throw new Error("Service Bus Queue ID not found.");
    }

    const eventSubscriptionResult = await createEventSubscription.mutateAsync({
      mrgName: resourceGroupId,
      storageAccount,
      storageResourceId,
      systemTopicName,
      queueId: queueId
    });

    if (!eventSubscriptionResult) {
      throw new Error("Failed to create Event Subscription.");
    }

    const functionAppId = managedAppResources.resources.functionAppId;
    if (!functionAppId) {
      throw new Error("Function App ID not found.");
    }

    const principalId = await fetchFunctionAppOID.mutateAsync({ armResourceId: functionAppId });
    if (!principalId) {
      throw new Error("Function App OID is not available yet.");
    }

    const roleDefinitionId = await fetchRoleDefinitionId.mutateAsync({ subscriptionId, roleName: "Storage Blob Data Owner" });
    if (!roleDefinitionId) {
      throw new Error("Failed to retrieve Role Definition ID.");
    }

    return assignRole.mutateAsync({
      storageResourceId,
      principalId,
      roleDefinitionId,
    });
  },
});
};

/**
 * Custom React hook to fetch the Role Definition ID for a given role name within a specified Azure subscription.
 *
 * This hook:
 * - Authenticates against the Azure Management API.
 * - Queries the `roleDefinitions` endpoint for the given subscription.
 * - Searches the returned role definitions for the specified `roleName`.
 * - Returns the Role Definition ID (`role.id`) if found, or `null` otherwise.
 *
 * Typically used when assigning roles via Azure RBAC (e.g., assigning `Storage Blob Data Owner` or 
 * `Storage Queue Data Message Sender` roles).
 *
 * @returns A mutation object that can be triggered to fetch a Role Definition ID.
 *
 * @param {string} subscriptionId - The Azure Subscription ID under which to search for the role definition.
 * @param {string} roleName - The display name of the Azure built-in role (e.g., "Storage Blob Data Owner").
 * @returns {string | null} The role definition ID if found, or `null` if no match was found.
 *
 * @example
 * const fetchRoleId = useFetchRoleDefinitionId();
 * const roleId = await fetchRoleId.mutateAsync({
 *   subscriptionId: "abc123",
 *   roleName: "Storage Blob Data Owner"
 * });
 */
export const useFetchRoleDefinitionId = () => {
  return useMutation({
    mutationFn: async ({ subscriptionId, roleName }: { subscriptionId: string; roleName: string }) => {
      if (!subscriptionId || !roleName) throw new Error("Subscription ID and Role Name must be provided");

      const token = await getAuthorizationToken({ resourceName: '' });

      const roleDefinitionsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions?api-version=2022-04-01`;

      const response = await fetch(roleDefinitionsUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch role definitions: ${errorText}`);
      }

      const data = await response.json() as { value?: { id?: string; name?: string; properties?: { roleName: string } }[] };
      const role = data.value?.find((role) => role.properties?.roleName === roleName);

      return role?.id || null;
    },
  });
};

/**
 * Custom React hook to fetch the Object ID (OID) of a managed identity assigned to an Azure Function App.
 *
 * This hook:
 * - Authenticates against the Azure Management API.
 * - Sends a GET request to the specified Function App resource ID.
 * - Extracts and returns the `principalId` (OID) from the `identity` property.
 *
 * This OID is typically used to assign roles to the Function App's managed identity (e.g., for accessing storage).
 *
 * @returns A mutation object that can be used to retrieve the Function App's Object ID.
 *
 * @param {{ armResourceId: string }} param - An object containing the full ARM resource ID of the Function App (e.g., `/subscriptions/.../resourceGroups/.../providers/Microsoft.Web/sites/my-function-app`).
 * @returns {string | null} The Function App's Object ID (`identity.principalId`) or `null` if not available.
 *
 * @example
 * const fetchOID = useFetchFunctionAppOID();
 * const oid = await fetchOID.mutateAsync({
 *   armResourceId: "/subscriptions/abc123/resourceGroups/my-rg/providers/Microsoft.Web/sites/myapp"
 * });
 */
export const useFetchFunctionAppOID = () => {
  return useMutation({
    mutationFn: async ({ armResourceId }: { armResourceId: string }) => {
      if (!armResourceId) throw new Error("Function App Resource ID is required");

      const token = await getAuthorizationToken({ resourceName: '' });

      const functionAppUrl = `https://management.azure.com${armResourceId}?api-version=2022-03-01`;

      const response = await fetch(functionAppUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Function App OID: ${errorText}`);
      }

      const responseData = await response.json() as { identity?: { principalId?: string } };
      const principalId = responseData.identity?.principalId;
      if (!principalId || typeof principalId !== 'string') {
        throw new Error('Principal ID not found');
      }

      return principalId || null;
    },
  });
};

/**
 * Custom React hook to assign a role to a service principal (e.g., managed identity) on a given Azure resource.
 *
 * This hook:
 * - Authenticates with Azure using an OAuth token.
 * - Generates a unique role assignment ID.
 * - Calls the Azure Management API to assign the specified role to the provided principal on the target resource.
 * - Handles the "RoleAssignmentExists" case gracefully by returning success instead of failing.
 *
 * Commonly used to assign roles such as "Storage Blob Data Owner" or "Storage Queue Data Message Sender"
 * to managed identities like Function Apps or Event Grid system topics.
 *
 * @returns A mutation object that performs the role assignment when triggered.
 *
 * @param {string} storageResourceId - The full ARM resource ID of the resource to assign the role on (e.g., a storage account).
 * @param {string} principalId - The object ID (OID) of the service principal or managed identity to which the role is assigned.
 * @param {string} roleDefinitionId - The ID of the role definition to assign (retrieved via `useFetchRoleDefinitionId`).
 * @returns A JSON response from the Azure API or a success message if the role already exists.
 *
 * @example
 * const assignRole = useAssignRole();
 * await assignRole.mutateAsync({
 *   storageResourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.Storage/storageAccounts/myaccount",
 *   principalId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
 *   roleDefinitionId: "/subscriptions/.../providers/Microsoft.Authorization/roleDefinitions/..."
 * });
 */
export const useAssignRole = () => {
  return useMutation({
    mutationFn: async ({
      storageResourceId,
      principalId,
      roleDefinitionId,
    }: {
      storageResourceId: string;
      principalId: string;
      roleDefinitionId: string;
    }) => {
      const token = await getAuthorizationToken({ resourceName: '' });
      const roleAssignmentId = crypto.randomUUID();

      const roleAssignmentUrl = `https://management.azure.com${storageResourceId}/providers/Microsoft.Authorization/roleAssignments/${roleAssignmentId}?api-version=2022-04-01`;

      const response = await fetch(roleAssignmentUrl, {
        method: "PUT",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            roleDefinitionId: roleDefinitionId,
            principalId: principalId,
            principalType: "ServicePrincipal",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorJson = JSON.parse(errorText) as { error?: { code?: string } };

        if (errorJson.error?.code === "RoleAssignmentExists") {
          console.warn(`Role assignment already exists for principal ${principalId} on ${storageResourceId}`);
          return { success: true, message: "Role assignment already exists" };
        }

        throw new Error(`Failed to assign role: ${errorText}`);
      }

      const responseData = await response.json() as { success?: boolean; message?: string };
      return responseData;
    },
  });
};

/**
 * Custom React hook that fetches the Azure region (location) of a given Storage Account.
 *
 * This hook:
 * - Parses the subscription ID, resource group, and storage account name from a full ARM resource ID.
 * - Uses the Azure Resource Manager API to fetch the storage account metadata.
 * - Extracts and returns the `location` (e.g., "eastus").
 *
 * @returns A mutation object that returns the location when called.
 *
 * @example
 * const fetchLocation = useFetchStorageLocation();
 * const location = await fetchLocation.mutateAsync({ storageResourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.Storage/storageAccounts/acldocuments" });
 */
export const useFetchStorageLocation = () => {
  return useMutation({
    mutationFn: async ({ storageResourceId }: { storageResourceId: string }) => {
    if (!storageResourceId) {
      throw new Error("Storage resource ID is required");
    }

    const parts = storageResourceId.split('/');
    const subscriptionId = parts[2];
    const resourceGroup = parts[4];
    const storageAccountName = parts[8];

    if (!subscriptionId || !resourceGroup || !storageAccountName) {
      throw new Error("Invalid ARM resource ID format");
    }

    const token = await getAuthorizationToken({ resourceName: '' });

    const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}?api-version=2022-09-01`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token.header,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch storage account location: ${errorText}`);
    }

    let data: { location?: string };
    try {
        data = await response.json() as { location?: string };
    } catch (error) {
        throw new Error(`Failed to parse response JSON: ${String(error)}`);
    }
    const location = data.location || null;

    return location;
    }
  });
};

/**
 * Custom React hook to create an Azure Event Grid System Topic for a given storage account.
 *
 * This hook:
 * - Extracts the subscription ID and resource group from the provided storage resource ID.
 * - Constructs a unique system topic name using the managed resource group name and storage account.
 * - Sends a PUT request to the Azure Management API to create the system topic with a system-assigned identity.
 * - Returns the principal ID of the system-assigned managed identity on success.
 * - Outputs the name of the system topic.
 *
 * This system topic is typically used to subscribe to blob storage events (e.g., creation, deletion).
 *
 * @returns A mutation object that triggers system topic creation when called.
 *
 * @param {string} mrgName - The managed resource group name (used as part of the topic name).
 * @param {string} storageAccount - The name of the storage account the topic will monitor.
 * @param {string} storageResourceId - The full ARM resource ID of the storage account.
 * @returns {Promise<{ principalId: string, systemTopicName: string }>} The principal ID of the system-assigned identity and the system topic name.
 *
 * @example
 * const createSystemTopic = useCreateSystemTopic();
 * const { principalId, systemTopicName } = await createSystemTopic.mutateAsync({
 *   mrgName: "my-managed-rg",
 *   storageAccount: "mystorageacct",
 *   storageResourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.Storage/storageAccounts/mystorageacct"
 * });
 */
export const useCreateSystemTopic = () => {
  type CreateSystemTopicParams = {
    storageResourceId: string;
    mrgName: string;
    storageAccount: string;
    storageLocation: string;
  };

  return useMutation({
    mutationFn: async ({ storageResourceId, mrgName, storageAccount, storageLocation }: CreateSystemTopicParams) => {
      const parsedArmId = ArmId.parse(storageResourceId);
      const subscriptionId = parsedArmId.subscription;
      const resourceGroupName = parsedArmId.resourceGroup;

      if (!subscriptionId || !resourceGroupName || !storageResourceId) {
        throw new Error("Missing required parameters for system topic creation");
      }

      const token = await getAuthorizationToken({ resourceName: "" });

      const listSystemTopicsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.EventGrid/systemTopics?api-version=2022-06-15`;

      const response = await fetch(listSystemTopicsUrl, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list system topics: ${errorText}`);
      }

      const responseJson = await response.json() as { value?: { name?: string; identity?: { principalId?: string }; properties?: { source?: string } }[] };

      const matchingTopic = responseJson.value?.find(topic =>
        topic.properties?.source?.toLowerCase() === storageResourceId.toLowerCase()
      );

      if (matchingTopic && matchingTopic.identity?.principalId && matchingTopic.name) {
        return {
          principalId: matchingTopic.identity.principalId,
          systemTopicName: matchingTopic.name,
        };
      }

      const systemTopicName = truncate(`${mrgName}-${storageAccount}-topic`, 64);
      const createSystemTopicUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.EventGrid/systemTopics/${systemTopicName}?api-version=2022-06-15`;

      const createResponse = await fetch(createSystemTopicUrl, {
        method: "PUT",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: storageLocation,
          properties: {
            source: storageResourceId,
            topicType: "Microsoft.Storage.StorageAccounts",
          },
          identity: {
            type: "SystemAssigned",
          },
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create system topic: ${errorText}`);
      }

      const createResponseJson = await createResponse.json() as { identity?: { principalId?: string }; name?: string };

      if (!createResponseJson.identity?.principalId || !createResponseJson.name) {
        throw new Error("Failed to retrieve the principal ID or name of the newly created system topic.");
      }

      return {
        principalId: createResponseJson.identity.principalId,
        systemTopicName: createResponseJson.name,
      };
    },
  });
};
  
/**
 * Custom React hook to create an Azure Event Grid Event Subscription for a system topic
 * that delivers blob events to a specified Service Bus queue using a system-assigned identity.
 *
 * This version enables session-based delivery by setting `requiresSession` to true.
 *
 * @returns A mutation object that creates the event subscription when called.
 *
 * @example
 * const createSubscription = useCreateEventSubscription();
 * await createSubscription.mutateAsync({
 *   mrgName: "managed-rg",
 *   storageAccount: "mystorage",
 *   storageResourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.Storage/storageAccounts/mystorage",
 *   queueId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.ServiceBus/namespaces/ns/queues/myqueue"
 * });
 */
export const useCreateEventSubscription = () => {
  return useMutation({
    mutationFn: async ({ mrgName, storageAccount, storageResourceId, queueId, systemTopicName }: {
      mrgName: string;
      storageAccount: string;
      storageResourceId: string;
      systemTopicName: string;
      queueId: string; // Full ARM ID of the Service Bus queue
    }) => {
      const subscriptionId = ArmId.parse(storageResourceId).subscription;
      const resourceGroupName = ArmId.parse(storageResourceId).resourceGroup;

      if (!subscriptionId || !resourceGroupName || !queueId) {
        throw new Error("Missing required parameters for event subscription");
      }

      const token = await getAuthorizationToken({ resourceName: '' });
      const eventSubscriptionName = truncate(`${mrgName}-${storageAccount}-event`, 64);

      const eventSubscriptionUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.EventGrid/systemTopics/${systemTopicName}/eventSubscriptions/${eventSubscriptionName}?api-version=2022-06-15`;

      const response = await fetch(eventSubscriptionUrl, {
        method: "PUT",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            filter: {
              includedEventTypes: ["Microsoft.Storage.BlobCreated", "Microsoft.Storage.BlobDeleted"]
            },
            deliveryWithResourceIdentity: {
              destination: {
                endpointType: "ServiceBusQueue",
                properties: {
                  resourceId: queueId,
                  deliveryAttributeMappings: [
                    {
                      name: "sessionId",
                      type: "Static",
                      properties: {
                        value: "session0",
                        isSecret: false,
                      },
                    },
                  ],
                },
              },
              identity: {
                type: "SystemAssigned",
              },
            },
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create event subscription: ${errorText}`);
      }

      return response.status;
    },
  });
};

/**
 * Custom React Query mutation hook to fetch the first available Service Bus queue
 * under a given Service Bus namespace ARM resource ID.
 *
 * @returns {UseMutationResult<string | null>} A React Query mutation result containing the queue resource ID or `null`.
 * @throws {Error} If `armResourceId` is not provided or if the API call fails.
 */
export const useFetchServiceBusQueue = () => {
  return useMutation({
    mutationFn: async ({ armResourceId }: { armResourceId: string | null | undefined }) => {
      if (!armResourceId) {
        throw new Error("ARM Resource ID for the Service Bus namespace is required");
      }

      // Fetch Azure authorization token for Management API
      const token = await getAuthorizationToken({ resourceName: '' });

      // Construct the URL to list queues under the namespace
      const url = `https://management.azure.com${armResourceId}/queues?api-version=2021-11-01`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": token.header,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Service Bus queues: ${errorText}`);
      }

      interface ServiceBusQueueResponse {
        value?: { id?: string }[];
      }
      const data = await response.json() as ServiceBusQueueResponse;

      const firstQueueId = (data as { value?: { id?: string }[] })?.value?.[0]?.id ?? null;

      if (!firstQueueId) {
        console.error("No Service Bus queues found.");
        throw new Error("No Service Bus queues available in the namespace.");
      }

      return firstQueueId as string | null;
    },
  });
};

/**
 * Custom React hook that sends a hardcoded audit event message to an Azure Service Bus queue.
 *
 * This hook:
 * - Constructs a JSON payload with audit event details.
 * - Includes Service Bus `BrokerProperties` (e.g., TTL and session ID).
 * - Sends a POST request to the Service Bus queue endpoint using a pre-defined bearer token.
 * - Returns the HTTP status code if successful, or throws an error if the request fails.
 *
 * @returns A mutation object that sends the audit event when triggered.
 *
 * @example
 * const sendAuditEvent = useSendAuditEventToQueue();
 * await sendAuditEvent.mutateAsync(); // Sends a hardcoded audit message to Service Bus
 */
/**
 * Custom React hook that sends an audit event message to an Azure Service Bus queue.
 *
 * @returns A mutation object that sends the audit event when triggered.
 */
export const useSendAuditEventToQueue = () => {
  return useMutation({
    mutationFn: async ({ eventType, storageAccount, blobContainer, queueId }: {
      eventType: string;
      storageAccount: string;
      blobContainer: string;
      queueId: string; // Full ARM ID of the target queue
    }) => {
      if (!queueId) throw new Error("Queue ARM ID is required");

    // Example queueId:
    // /subscriptions/.../resourceGroups/.../providers/Microsoft.ServiceBus/namespaces/<NAMESPACE>/queues/<QUEUE_NAME>

    const parts = queueId.split('/');
    const namespaceIndex = parts.findIndex(p => p === 'namespaces');
    const queueIndex = parts.findIndex(p => p === 'queues');

    if (namespaceIndex === -1 || queueIndex === -1 || !parts[namespaceIndex + 1] || !parts[queueIndex + 1]) {
      throw new Error("Invalid Service Bus queue ARM ID format");
    }

    const namespaceName = parts[namespaceIndex + 1];
    const queueName = parts[queueIndex + 1];
    const queueUrl = `https://${namespaceName}.servicebus.windows.net/${queueName}/messages`;

    const messageBody = JSON.stringify({
      eventType,
      storageAccount,
      blobContainer,
    });

    const brokerProperties = JSON.stringify({
      TimeToLive: 60,
      SessionId: "portal-session",
    });

    // Get bearer token scoped to the queue's namespace
    const token = await getAuthorizationToken({
      resourceName: 'servicebus',
    });

    const response = await fetch(queueUrl, {
      method: "POST",
      headers: {
        Authorization: token.header,
        "Content-Type": "application/atom+xml;type=entry;charset=utf-8",
        BrokerProperties: brokerProperties,
      },
      body: messageBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send message to Service Bus: ${errorText}`);
    }

    return response.status;
  },
});
};

/**
 * Composable mutation function that sends an audit-related event to an Azure Service Bus queue.
 *
 * This function orchestrates three operations:
 * 1. Fetches managed application resources to retrieve the Service Bus namespace ID.
 * 2. Retrieves the name of the target Service Bus queue using the namespace ID.
 * 3. Sends the event to the resolved queue using `useSendAuditEventToQueue`.
 *
 * This is used to trigger audit or backfill operations by delivering a message to a Service Bus queue
 * from a managed Azure environment.
 *
 * @returns A mutation object that sends the event when executed.
 *
 * @param {string} resourceId - The ARM resource ID of the managed application instance.
 * @param {string} eventType - The event type (e.g., "PerformAudit" or "PerformBackfill").
 * @param {string} storageAccount - The name of the associated storage account.
 * @param {string} container - The name of the blob container being audited.
 *
 * @example
 * const sendEvent = sendEventToQueue();
 * await sendEvent.mutateAsync({
 *   resourceId: "/subscriptions/.../resourceGroups/.../providers/Microsoft.Solutions/applications/...",
 *   eventType: "PerformAudit",
 *   storageAccount: "mystorageacct",
 *   container: "mycontainer"
 * });
 */
export const useSendEventToQueue = () => {
  const getQueueId = useFetchServiceBusQueue();
  const sendAuditEventToQueue = useSendAuditEventToQueue();
  const fetchManagedAppResources = useManagedAppResources();

  return useMutation({
    mutationFn: async ({ resourceId, eventType, storageAccount, container }: {
      resourceId: string;
      eventType: string;
      storageAccount: string;
      container: string;
    }) => {
    const managedAppResources: { resources?: { serviceBusNamespaceId?: string } } = await fetchManagedAppResources.mutateAsync({ armResourceId: resourceId });

    if (managedAppResources.resources) {
      managedAppResources.resources.serviceBusNamespaceId = managedAppResources.resources.serviceBusNamespaceId ?? undefined;
    }

    if (managedAppResources.resources) {
      managedAppResources.resources.serviceBusNamespaceId = managedAppResources.resources.serviceBusNamespaceId ?? undefined;
    }
    if (!managedAppResources || !managedAppResources.resources || !managedAppResources.resources.serviceBusNamespaceId) {
      throw new Error("Service Bus Namespace ID not found in Managed App Resources.");
    }

    const queueId: string | null = await getQueueId.mutateAsync({ armResourceId: managedAppResources.resources.serviceBusNamespaceId });
    if (!queueId) {
      throw new Error("Service Bus Queue ID not found.");
    }

    return sendAuditEventToQueue.mutateAsync({
      eventType,
      storageAccount,
      blobContainer: container,
      queueId: queueId,
    });
  },
});
}