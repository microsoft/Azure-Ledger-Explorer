/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  makeStyles,
  Text,
  Caption1,
  Card,
  CardHeader,
  Spinner,
  tokens,
} from '@fluentui/react-components';
import {
  DocumentMultiple24Regular,
  DataBarHorizontal24Regular,
  DocumentEdit24Regular,
  Delete24Regular,
} from '@fluentui/react-icons';
import { useStats } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
  container: {
    padding: '24px',
    height: '100%',
    overflow: 'auto',
  },
  header: {
    marginBottom: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  statCard: {
    padding: '20px',
  },
  statContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  statIcon: {
    fontSize: '32px',
    color: tokens.colorBrandBackground,
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  statLabel: {
    color: tokens.colorNeutralForeground3,
  },
  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: tokens.colorNeutralForeground3,
  },
  additionalMetrics: {
    marginTop: '24px',
  },
  metricsHeader: {
    marginBottom: '12px',
    display: 'block',
  },
  emptySubtext: {
    marginTop: '8px',
  },
});

export const StatsView: React.FC = () => {
  const styles = useStyles();
  const { data: stats, isLoading, error } = useStats();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Spinner size="large" label="Loading statistics..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={500}>Error loading statistics: {error.message}</Text>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={500}>No statistics available</Text>
          <Caption1 className={styles.emptySubtext}>
            Upload some ledger files to see statistics.
          </Caption1>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={700} weight="semibold">
          Database Statistics
        </Text>
        <Caption1 className={styles.emptySubtext}>
          Overview of your CCF ledger data
        </Caption1>
      </div>

      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <CardHeader
            header={
              <div className={styles.statContent}>
                <DocumentMultiple24Regular className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <Text className={styles.statValue}>
                    {formatNumber(stats.fileCount)}
                  </Text>
                  <Caption1 className={styles.statLabel}>
                    Ledger Files
                  </Caption1>
                </div>
              </div>
            }
          />
        </Card>

        <Card className={styles.statCard}>
          <CardHeader
            header={
              <div className={styles.statContent}>
                <DataBarHorizontal24Regular className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <Text className={styles.statValue}>
                    {formatNumber(stats.transactionCount)}
                  </Text>
                  <Caption1 className={styles.statLabel}>
                    Transactions
                  </Caption1>
                </div>
              </div>
            }
          />
        </Card>

        <Card className={styles.statCard}>
          <CardHeader
            header={
              <div className={styles.statContent}>
                <DocumentEdit24Regular className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <Text className={styles.statValue}>
                    {formatNumber(stats.writeCount)}
                  </Text>
                  <Caption1 className={styles.statLabel}>
                    Write Operations
                  </Caption1>
                </div>
              </div>
            }
          />
        </Card>

        <Card className={styles.statCard}>
          <CardHeader
            header={
              <div className={styles.statContent}>
                <Delete24Regular className={styles.statIcon} />
                <div className={styles.statInfo}>
                  <Text className={styles.statValue}>
                    {formatNumber(stats.deleteCount)}
                  </Text>
                  <Caption1 className={styles.statLabel}>
                    Delete Operations
                  </Caption1>
                </div>
              </div>
            }
          />
        </Card>
      </div>

      {stats.transactionCount > 0 && (
        <div className={styles.additionalMetrics}>
          <Text size={500} weight="semibold" className={styles.metricsHeader}>
            Additional Metrics
          </Text>
          <div className={styles.statsGrid}>
            <Card className={styles.statCard}>
              <CardHeader
                header={
                  <div className={styles.statInfo}>
                    <Text className={styles.statValue}>
                      {((stats.writeCount / stats.transactionCount) * 100).toFixed(1)}%
                    </Text>
                    <Caption1 className={styles.statLabel}>
                      Write Rate
                    </Caption1>
                  </div>
                }
              />
            </Card>

            <Card className={styles.statCard}>
              <CardHeader
                header={
                  <div className={styles.statInfo}>
                    <Text className={styles.statValue}>
                      {((stats.deleteCount / stats.transactionCount) * 100).toFixed(1)}%
                    </Text>
                    <Caption1 className={styles.statLabel}>
                      Delete Rate
                    </Caption1>
                  </div>
                }
              />
            </Card>

            <Card className={styles.statCard}>
              <CardHeader
                header={
                  <div className={styles.statInfo}>
                    <Text className={styles.statValue}>
                      {stats.fileCount > 0 ? Math.round(stats.transactionCount / stats.fileCount) : 0}
                    </Text>
                    <Caption1 className={styles.statLabel}>
                      Avg Transactions per File
                    </Caption1>
                  </div>
                }
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
