/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Stack, PrimaryButton, Text } from '@fluentui/react';

import { Auditing_ColumnNames, Auditing_Values } from '../ClientResources.resjson';
import { useSendEventToQueue } from '../Hooks/ManagedAppHooks';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

interface Parameters {
  storageAccount: string;
  containerName: string;
  latestAudit?: string;
  auditResults?: string;
  serviceBusResourceId: string;
  eventType: string;
}

const StorageDetailsBladeInternal = ({ parameters }: { parameters: Parameters }) => {
  const sendEventMutation = useSendEventToQueue();
  const [isProcessingLocal, setIsProcessingLocal] = React.useState(false);

  const isProcessing = React.useMemo(() => {
    return isProcessingLocal || parameters?.eventType === Auditing_Values.performAudit;
  }, [isProcessingLocal, parameters?.eventType]);

  if (!parameters) {
    console.error("No parameters received in blade.");
    return <p>Error: No parameters found.</p>;
  }

  const { storageAccount, containerName, latestAudit, auditResults, serviceBusResourceId } = parameters;

  const onRunAudit = async () => {
    try {
      setIsProcessingLocal(true);
      await sendEventMutation.mutateAsync({
        resourceId: serviceBusResourceId,
        eventType: Auditing_Values.performAudit,
        storageAccount,
        container: containerName,
      });
    } catch (error) {
      console.error("Audit failed:", error);
    } finally {
      setIsProcessingLocal(false);
    }
  };

  return (
    <Stack
      tokens={{ childrenGap: 20, padding: 24 }}
      styles={{ root: { maxWidth: 500, margin: '0 auto' } }}
    >
      <Text variant="xLargePlus">Storage Account Details</Text>

      <Stack tokens={{ childrenGap: 8 }}>
        <Text><b>{Auditing_ColumnNames.storageAccount}:</b> {storageAccount}</Text>
        <Text><b>{Auditing_ColumnNames.containerName}:</b> {containerName}</Text>
        <Text><b>{Auditing_ColumnNames.latestAudit}:</b> {latestAudit || 'Not available'}</Text>
        <Text><b>{Auditing_ColumnNames.auditResults}:</b> {auditResults || 'N/A'}</Text>
      </Stack>

      <PrimaryButton
        text={Auditing_Values.runAudit}
        onClick={onRunAudit}
        disabled={isProcessing}
        styles={{
          root: { width: 150 },
        }}
      />
    </Stack>
  );
};

const StorageDetailsBlade = (props: { parameters: Parameters }) => (
  <QueryClientProvider client={queryClient}>
    <StorageDetailsBladeInternal {...props} />
  </QueryClientProvider>
);

export default StorageDetailsBlade;
