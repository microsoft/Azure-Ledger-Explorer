/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';

import {
  UserInfo,
  getUserInfo,
  openContextPane
} from '@microsoft/azureportal-reactview/Az';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  DetailsListLayoutMode,
  IColumn,
  PrimaryButton,
  DetailsList,
  DetailsRow,
  IDetailsRowProps,
  CommandBar,
  ICommandBarItemProps,
  Link,
  MessageBar,
  MessageBarType,
  Stack,
  Text
} from '@fluentui/react';

import {
  Auditing_CommandBar_Keys,
  Auditing_CommandBar_Names,
  Auditing_Header,
  Auditing_ColumnKeys,
  Auditing_ColumnNames,
  Auditing_InProgress,
  Auditing_Values
} from '../ClientResources.resjson';
import { useCheckAclUserRole } from '../Hooks/LedgerHooks';
import {
  useManagedAppResources,
  useFetchAuditTableData,
  useDownloadAuditResults
} from '../Hooks/ManagedAppHooks';
import { PortalExtensionName } from '../Utilities/Constants';

import { stackSpacingTokens } from './Auditing.ReactView.Styles';


const determineEventType = (data: { value?: { AuditResult: string }[] } | undefined) => {
  const inProgressItems = data?.value?.filter((item) => item.AuditResult === Auditing_InProgress.text);
  return inProgressItems?.length ? Auditing_Values.performAudit : null;
};

// Define or import the DxToReactProps type
type DxToReactProps = {
  parameters: {
    id: string;
  };
};

const AclManageUsersInternal = (props: DxToReactProps) => {
  const downloadMutation = useDownloadAuditResults();
  const { id } = props.parameters;
  const [userData, setUserData] = React.useState<UserInfo>();
  useCheckAclUserRole(id, userData?.objectId);
  const { mutate: fetchManagedAppResources, data, isLoading }: { mutate: (params: { armResourceId: string }) => void; data: { isManagedApp?: boolean } | undefined; isLoading: boolean } = useManagedAppResources();
  const fetchAuditDataHook = useFetchAuditTableData();
  const fetchAuditData = fetchAuditDataHook.mutateAsync;
  const tableData = fetchAuditDataHook.data as { value?: { AuditResult: string }[] | undefined };
  const [eventType, setEventType] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchManagedAppResources({ armResourceId: id });
  }, [fetchManagedAppResources, id]);

  React.useEffect(() => {
    fetchAuditData({ armResourceId: id, tableName: Auditing_Values.auditTable }).catch((error) => {
      console.error('Failed to fetch audit data:', error);
    });
  }, [fetchAuditData, id]);

  React.useEffect(() => {
    if (tableData && typeof tableData === 'object' && 'value' in tableData) {
      setEventType(determineEventType(tableData as { value?: { AuditResult: string }[] | undefined }));
    } else {
      setEventType(null);
    }
  }, [tableData]);

  const isManagedApp = data?.isManagedApp ?? false;

  React.useEffect(() => {
    void (async () => {
      if (!userData) {
        const user = await getUserInfo();
        if (user) {
          setUserData(user);
        }
      }
    })();
  }, [userData]);

  const addStorageAccountHandler = React.useCallback(async () => {
    return await openContextPane({
      bladeName: 'ConnectStorage.ReactView',
      extensionName: PortalExtensionName,
      parameters: { id }
    });
  }, [id]);

  const storageAccountRowHandler = React.useCallback(
    async (item: {
      storageAccount: string;
      containerName: string;
      latestAudit: string;
      auditResults: string;
    }) => {
      return await openContextPane({
        bladeName: 'StorageTableActions.ReactView',
        extensionName: PortalExtensionName,
        parameters: {
          storageAccount: item.storageAccount,
          containerName: item.containerName,
          latestAudit: item.latestAudit,
          auditResults: item.auditResults,
          serviceBusResourceId: id,
          eventType: eventType
        }
      });
    },
    [eventType, id]
  );

  const refreshDataHandler = React.useCallback(async () => {
    try {
      await fetchAuditData({
        armResourceId: id,
        tableName: Auditing_Values.auditTable,
      });
  
      if (tableData && typeof tableData === 'object' && 'value' in tableData) {
        setEventType(
          determineEventType(
            tableData as { value?: { AuditResult: string }[] | undefined }
          )
        );
      } else {
        console.error('Unexpected tableData format:', tableData);
      }

    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [fetchAuditData, id, tableData]);  

  const userDisplayData: Array<{
    storageAccount: string;
    containerName: string;
    latestAudit: string;
    auditResults: string;
  }> = React.useMemo(() => {
    if (!tableData || typeof tableData !== 'object' || !('value' in tableData)) return [];
    return ((tableData as { value: Array<{ PartitionKey: string; RowKey: string; LastAudit: string; AuditResult: string }> }).value).map((item) => ({
      storageAccount: item.PartitionKey,
      containerName: item.RowKey,
      latestAudit: item.LastAudit,
      auditResults: item.AuditResult
    }));
  }, [tableData]);

  const columns: IColumn[] = [
    {
      key: Auditing_ColumnKeys.storageAccount,
      name: Auditing_ColumnNames.storageAccount,
      fieldName: Auditing_ColumnKeys.storageAccount,
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
    },
    {
      key: Auditing_ColumnKeys.containerName,
      name: Auditing_ColumnNames.containerName,
      fieldName: Auditing_ColumnKeys.containerName,
      minWidth: 200,
      isResizable: true,
    },
    {
      key: Auditing_ColumnKeys.latestAudit,
      name: Auditing_ColumnNames.latestAudit,
      fieldName: Auditing_ColumnKeys.latestAudit,
      minWidth: 200,
      isResizable: true,
    },
    {
      key: Auditing_ColumnKeys.auditResults,
      name: Auditing_ColumnNames.auditResults,
      fieldName: Auditing_ColumnKeys.auditResults,
      minWidth: 200,
      isResizable: true,
      onRender: (item: {
        auditResults: string;
        storageAccount: string;
        containerName: string;
      }) =>
        item.auditResults ? (
          item.auditResults !== Auditing_InProgress.text ? (
            <Link
              onClick={() =>
                downloadMutation.mutate({
                  storageAccount: item.storageAccount,
                  containerName: item.containerName,
                  resourceId: id,
                })
              }
              style={{ fontWeight: "bold", color: "blue", cursor: "pointer" }}
            >
              {item.auditResults}
            </Link>
          ) : (
            <span>{item.auditResults}</span>
          )
        ) : (
          <span>No Results</span>
        ),
    }    
  ];

  const commandBarItems = React.useMemo(
    () => [
      {
        key: Auditing_CommandBar_Keys.connectStorage,
        text: Auditing_CommandBar_Names.connectStorage,
        cacheKey: Auditing_CommandBar_Keys.connectStorage,
        iconProps: { iconName: 'CloudAdd' },
        disabled: isLoading || !isManagedApp,
        onClick: () => { void addStorageAccountHandler(); }
      },
      {
        key: Auditing_CommandBar_Keys.refresh,
        text: Auditing_CommandBar_Names.refresh,
        cacheKey: Auditing_CommandBar_Keys.refresh,
        iconProps: { iconName: 'Refresh' },
        onClick: () => { void refreshDataHandler(); }
      }
    ],
    [addStorageAccountHandler, isLoading, isManagedApp, refreshDataHandler]
  );

  return (
    <Stack tokens={stackSpacingTokens}>
      {!isLoading && !isManagedApp && (
        <MessageBar dismissButtonAriaLabel="Close" messageBarType={MessageBarType.error}>
          {Auditing_Header.incorrectAccess}
          <PrimaryButton
            text={Auditing_Header.deployText}
            href={Auditing_Header.deployLink}
            target="_blank"
            styles={{ root: { marginLeft: 10 } }}
          />
        </MessageBar>
      )}

      {eventType === Auditing_Values.performAudit && (
        <MessageBar dismissButtonAriaLabel="Close" messageBarType={MessageBarType.warning}>
          {Auditing_InProgress.message}
        </MessageBar>
      )}

      <Stack.Item>
        <CommandBar items={commandBarItems as ICommandBarItemProps[]} />
      </Stack.Item>

      <Stack.Item>
        <Text>{Auditing_Header.headerText} </Text>
        <Link
          href={Auditing_Header.learnMoreLink}
          target="_blank"
          rel="noopener noreferrer"
          styles={{ root: { marginTop: 5 } }}
        >
          Learn more...
        </Link>
      </Stack.Item>

      <Stack.Item>
        <DetailsList
          items={userDisplayData}
          columns={columns}
          setKey="set"
          layoutMode={DetailsListLayoutMode.fixedColumns}
          selectionMode={0}
          onItemInvoked={storageAccountRowHandler}
          onRenderRow={(props: IDetailsRowProps | undefined) => {
            if (!props) return null;
            return (
              <DetailsRow
                {...props}
                styles={{
                  root: { cursor: 'pointer', ':hover': { backgroundColor: '#f3f2f1' } }
                }}
              />
            );
          }}
        />
      </Stack.Item>
    </Stack>
  );
};

const AclManageUsers = (props: DxToReactProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5
      }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AclManageUsersInternal {...props} />
    </QueryClientProvider>
  );
};

export default AclManageUsers;
