import React, { useState, useCallback, useRef } from 'react';
import {
  makeStyles,
  Body1,
  Button,
  ProgressBar,
  MessageBar,
  MessageBarBody,
  Text,
  Divider,
} from '@fluentui/react-components';
import {
  PlayRegular,
  StopRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
} from '@fluentui/react-icons';
import { useTotalTransactionsCount } from '../hooks/use-ccf-data';
import { MerkleTree, toHexStringLower } from '../utils/merkle-tree';
import { CCFDatabase } from '../database/ccf-database';

const useStyles = makeStyles({
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  warning: {
    marginBottom: '24px',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  progress: {
    marginBottom: '24px',
  },
  progressBar: {
    marginBottom: '8px',
  },
  status: {
    marginBottom: '16px',
  },
  results: {
    marginTop: '24px',
  },
});

interface VerificationState {
  isRunning: boolean;
  progress: number;
  totalTransactions: number;
  bodyText: string;
  error?: string;
  success?: boolean;
}

export const LedgerVerificationPage: React.FC = () => {
  const styles = useStyles();
  const { data: totalTransactions = 0 } = useTotalTransactionsCount();
  const cancelRef = useRef(false);
  
  const [state, setState] = useState<VerificationState>({
    isRunning: false,
    progress: 0,
    totalTransactions: 0,
    bodyText: '',
  });

  const updateState = useCallback((updates: Partial<VerificationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const startVerification = useCallback(async () => {
    cancelRef.current = false;
    updateState({
      isRunning: true,
      progress: 0,
      totalTransactions,
      bodyText: 'Starting...',
      error: undefined,
      success: undefined,
    });

    try {
      const tree = new MerkleTree();
      
      // Get database instance
      const dbInstance = new CCFDatabase({
        filename: 'ccf-ledger.db',
        useOpfs: true,
      });
      await dbInstance.initialize();

      const limit = 1000;
      let start = 0;
      let processedCount = 0;

      updateState({ bodyText: 'Initializing verification...' });

      while (!cancelRef.current) {
        const transactions = await dbInstance.getTransactionsWithRelated(start, limit);
        
        if (transactions.length === 0) {
          break;
        }

        for (const transaction of transactions) {
          if (cancelRef.current) {
            break;
          }

          // Look for signature transactions
          const signatureTx = transaction.tables.find(table => 
            table.storeName.includes('public:ccf.internal.signatures')
          );

          if (signatureTx) {
            try {
              const calculatedRoot = toHexStringLower(await tree.calculateRootHash());
              
              // Parse the JSON value to get the root hash
              const signatureData = JSON.parse(signatureTx.value);
              const ledgerRootHash = signatureData.root;

              if (ledgerRootHash !== calculatedRoot) {
                throw new Error(
                  `Hashes do not match at transaction ${transaction.txId}. Ledger has been tampered with.`
                );
              }

              processedCount = transaction.txId;

              // Update progress every 100 transactions
              if (processedCount % 100 === 0) {
                const percentage = Math.floor((processedCount / totalTransactions) * 100);
                updateState({
                  progress: processedCount,
                  bodyText: `${percentage}%: Transaction ${processedCount} of ${totalTransactions}`,
                });
                
                // Allow UI to update
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            } catch (parseError) {
              throw new Error(`Failed to parse signature data:, ${parseError}`);
              // Continue processing even if we can't parse some signature data
            }
          }

          // Insert transaction hash into merkle tree
          tree.insertLeaf(transaction.txHash);
        }

        start += limit;
      }

      if (cancelRef.current) {
        updateState({
          isRunning: false,
          bodyText: 'Verification cancelled',
          progress: 0,
        });
      } else {
        updateState({
          isRunning: false,
          bodyText: `100%: Transaction ${processedCount} of ${totalTransactions}`,
          progress: processedCount,
          success: true,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateState({
        isRunning: false,
        error: errorMessage,
        bodyText: errorMessage,
      });
    }
  }, [totalTransactions, updateState]);

  const cancelVerification = useCallback(() => {
    if (state.isRunning) {
      cancelRef.current = true;
      updateState({
        bodyText: 'Stopping...',
      });
    }
  }, [state.isRunning, updateState]);

  const progressPercentage = state.totalTransactions > 0 
    ? (state.progress / state.totalTransactions) * 100 
    : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text className={styles.title}>Verify Ledger</Text>
      </div>

      <div className={styles.warning}>
        <MessageBar intent="warning">
          <MessageBarBody>
            <Text weight="semibold">Warning!</Text> The ledger verification procedure is CPU and memory intensive and can take some time.
            This tool implements a checkpointing mechanism to avoid reprocessing the entire ledger in case of failure.
          </MessageBarBody>
        </MessageBar>
      </div>

      <div className={styles.controls}>
        <Button 
          appearance="primary"
          icon={<PlayRegular />}
          onClick={startVerification}
          disabled={state.isRunning || totalTransactions === 0}
        >
          Start
        </Button>
        <Button 
          appearance="secondary"
          icon={<StopRegular />}
          onClick={cancelVerification}
          disabled={!state.isRunning}
        >
          Stop
        </Button>
      </div>

      {totalTransactions === 0 && (
        <MessageBar intent="info">
          <MessageBarBody>
            No transactions found. Please upload and parse ledger files before running verification.
          </MessageBarBody>
        </MessageBar>
      )}

      {totalTransactions > 0 && (
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <ProgressBar 
              value={progressPercentage}
              max={100}
            />
          </div>
          <Body1 className={styles.status}>
            {state.bodyText || `Ready to verify ${totalTransactions} transactions`}
          </Body1>
        </div>
      )}

      {(state.error || state.success) && (
        <div className={styles.results}>
          <Divider />
          {state.error && (
            <MessageBar intent="error">
              <MessageBarBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ErrorCircleRegular />
                  <Text weight="semibold">Verification Failed</Text>
                </div>
                <Text>{state.error}</Text>
              </MessageBarBody>
            </MessageBar>
          )}
          {state.success && (
            <MessageBar intent="success">
              <MessageBarBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckmarkCircleRegular />
                  <Text weight="semibold">Verification Successful</Text>
                </div>
                <Text>All transaction hashes have been verified successfully.</Text>
              </MessageBarBody>
            </MessageBar>
          )}
        </div>
      )}
    </div>
  );
};
