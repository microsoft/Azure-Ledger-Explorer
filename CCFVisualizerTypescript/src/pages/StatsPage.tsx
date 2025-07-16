import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  tokens,
  makeStyles,
  shorthands,
  Text,
  Card,
  CardHeader,
  Spinner,
  MessageBar,
  Badge,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbButton,
  BreadcrumbDivider,
} from '@fluentui/react-components';
import {
  NumberSymbolRegular,
  DocumentRegular,
  EditRegular,
  DeleteRegular,
  DatabaseRegular,
  KeyRegular,
  ClockRegular,
  DataUsageRegular,
  PersonRegular,
  CalendarRegular,
  ChevronRightRegular,
} from '@fluentui/react-icons';
import { useEnhancedStats } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    ...shorthands.padding('16px', '24px'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  breadcrumb: {
    marginBottom: '12px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    ...shorthands.padding('24px'),
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    ...shorthands.gap('16px'),
    marginBottom: '24px',
  },
  statCard: {
    cursor: 'default',
    height: '120px',
  },
  statCardHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  statIcon: {
    fontSize: '24px',
    color: tokens.colorBrandBackground,
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: tokens.colorNeutralForeground1,
    lineHeight: '1',
  },
  statLabel: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground2,
    marginTop: '4px',
  },
  statDescription: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    marginTop: '8px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  sectionIcon: {
    fontSize: '20px',
    color: tokens.colorBrandBackground,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    ...shorthands.gap('16px'),
  },
  detailCard: {
    cursor: 'default',
    height: '100px',
  },
  detailValue: {
    fontSize: '24px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  timelineValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
  },
  detailLabel: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    marginTop: '4px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
  },
  actionButtons: {
    display: 'flex',
    ...shorthands.gap('12px'),
    marginTop: '24px',
  },
  highlight: {
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.padding('2px', '6px'),
    ...shorthands.borderRadius('4px'),
    fontSize: '12px',
    fontWeight: '600',
  },
});

const StatsPage: React.FC = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useEnhancedStats();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const calculateUserWritePercentage = (): number => {
    if (!stats || stats.writeCount === 0) return 0;
    return Math.round((stats.userWriteCount / stats.writeCount) * 100);
  };

  if (isLoading) {
    return (
      <div className={classes.container}>
        <div className={classes.header}>
          <div className={classes.breadcrumb}>
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbButton onClick={() => navigate('/')}>
                  Home
                </BreadcrumbButton>
              </BreadcrumbItem>
              <BreadcrumbDivider />
              <BreadcrumbItem>
                <BreadcrumbButton current>
                  Statistics
                </BreadcrumbButton>
              </BreadcrumbItem>
            </Breadcrumb>
          </div>
          <Text size={800} weight="semibold">
            Database Statistics
          </Text>
          <Text size={400} style={{ marginTop: '4px' }}>
            Comprehensive analytics of your CCF ledger data
          </Text>
        </div>
        <div className={classes.loadingContainer}>
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={classes.container}>
        <div className={classes.header}>
          <div className={classes.breadcrumb}>
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbButton onClick={() => navigate('/')}>
                  Home
                </BreadcrumbButton>
              </BreadcrumbItem>
              <BreadcrumbDivider />
              <BreadcrumbItem>
                <BreadcrumbButton current>
                  Statistics
                </BreadcrumbButton>
              </BreadcrumbItem>
            </Breadcrumb>
          </div>
          <Text size={800} weight="semibold">
            Database Statistics
          </Text>
        </div>
        <div className={classes.content}>
          <MessageBar intent="error">
            Error loading statistics: {error.message}
          </MessageBar>
        </div>
      </div>
    );
  }

  if (!stats || stats.transactionCount === 0) {
    return (
      <div className={classes.container}>
        <div className={classes.header}>
          <div className={classes.breadcrumb}>
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbButton onClick={() => navigate('/')}>
                  Home
                </BreadcrumbButton>
              </BreadcrumbItem>
              <BreadcrumbDivider />
              <BreadcrumbItem>
                <BreadcrumbButton current>
                  Statistics
                </BreadcrumbButton>
              </BreadcrumbItem>
            </Breadcrumb>
          </div>
          <Text size={800} weight="semibold">
            Database Statistics
          </Text>
        </div>
        <div className={classes.emptyState}>
          <NumberSymbolRegular style={{ fontSize: '64px', marginBottom: '16px' }} />
          <Text size={600} weight="semibold">No data available</Text>
          <Text size={400}>
            Upload some ledger files to see statistics
          </Text>
          <div className={classes.actionButtons}>
            <Button
              appearance="primary"
              onClick={() => navigate('/')}
              icon={<DocumentRegular />}
            >
              Upload Files
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <div className={classes.breadcrumb}>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbButton onClick={() => navigate('/')}>
                Home
              </BreadcrumbButton>
            </BreadcrumbItem>
            <BreadcrumbDivider />
            <BreadcrumbItem>
              <BreadcrumbButton current>
                Statistics
              </BreadcrumbButton>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>
        <Text size={800} weight="semibold">
          Database Statistics
        </Text>
        <Text size={400} style={{ marginTop: '4px' }}>
          Comprehensive analytics of your CCF ledger data
        </Text>
      </div>

      <div className={classes.content}>
        {/* Main Statistics */}
        <Text className={classes.sectionTitle}>
          <NumberSymbolRegular className={classes.sectionIcon} />
          Overview
        </Text>
        <div className={classes.statsGrid}>
          <Card className={classes.statCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DocumentRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.statValue}>{formatNumber(stats.fileCount)}</div>
                    <div className={classes.statLabel}>Ledger Files</div>
                    <div className={classes.statDescription}>
                      Total size: {formatBytes(stats.totalDataSize)}
                    </div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.statCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <EditRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.statValue}>{formatNumber(stats.transactionCount)}</div>
                    <div className={classes.statLabel}>Transactions</div>
                    <div className={classes.statDescription}>
                      Avg size: {formatBytes(stats.averageTransactionSize)}
                    </div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.statCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <PersonRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.statValue}>{formatNumber(stats.userWriteCount)}</div>
                    <div className={classes.statLabel}>User Writes</div>
                    <div className={classes.statDescription}>
                      <Badge appearance="filled" color="brand" className={classes.highlight}>
                        {calculateUserWritePercentage()}%
                      </Badge> of all writes
                    </div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.statCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DatabaseRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.statValue}>{formatNumber(stats.tableCount)}</div>
                    <div className={classes.statLabel}>CCF Tables</div>
                    <div className={classes.statDescription}>
                      {formatNumber(stats.uniqueKeyCount)} unique keys
                    </div>
                  </div>
                </div>
              }
            />
          </Card>
        </div>

        {/* Operations Statistics */}
        <Text className={classes.sectionTitle}>
          <EditRegular className={classes.sectionIcon} />
          Operations
        </Text>
        <div className={classes.detailsGrid}>
          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <EditRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatNumber(stats.writeCount)}</div>
                    <div className={classes.detailLabel}>Total Writes</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DeleteRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatNumber(stats.deleteCount)}</div>
                    <div className={classes.detailLabel}>Total Deletes</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <KeyRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatNumber(stats.uniqueKeyCount)}</div>
                    <div className={classes.detailLabel}>Unique Keys</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <PersonRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatNumber(stats.userWriteCount)}</div>
                    <div className={classes.detailLabel}>User Writes</div>
                  </div>
                </div>
              }
            />
          </Card>
        </div>

        {/* Transaction Size Statistics */}
        <Text className={classes.sectionTitle}>
          <DataUsageRegular className={classes.sectionIcon} />
          Transaction Sizes
        </Text>
        <div className={classes.detailsGrid}>
          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DataUsageRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatBytes(stats.averageTransactionSize)}</div>
                    <div className={classes.detailLabel}>Average Size</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DataUsageRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatBytes(stats.largestTransactionSize)}</div>
                    <div className={classes.detailLabel}>Largest Transaction</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DataUsageRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatBytes(stats.smallestTransactionSize)}</div>
                    <div className={classes.detailLabel}>Smallest Transaction</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <DataUsageRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.detailValue}>{formatBytes(stats.totalDataSize)}</div>
                    <div className={classes.detailLabel}>Total Data Size</div>
                  </div>
                </div>
              }
            />
          </Card>
        </div>

        {/* Timeline Statistics */}
        <Text className={classes.sectionTitle}>
          <CalendarRegular className={classes.sectionIcon} />
          Timeline
        </Text>
        <div className={classes.detailsGrid}>
          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <ClockRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.timelineValue}>
                      {formatDate(stats.oldestTransaction)}
                    </div>
                    <div className={classes.detailLabel}>Oldest Transaction</div>
                  </div>
                </div>
              }
            />
          </Card>

          <Card className={classes.detailCard}>
            <CardHeader
              header={
                <div className={classes.statCardHeader}>
                  <ClockRegular className={classes.statIcon} />
                  <div>
                    <div className={classes.timelineValue}>
                      {formatDate(stats.newestTransaction)}
                    </div>
                    <div className={classes.detailLabel}>Newest Transaction</div>
                  </div>
                </div>
              }
            />
          </Card>
        </div>

        {/* Quick Actions */}
        <Text className={classes.sectionTitle}>
          <ChevronRightRegular className={classes.sectionIcon} />
          Quick Actions
        </Text>
        <div className={classes.actionButtons}>
          <Button
            appearance="primary"
            onClick={() => navigate('/')}
            icon={<DocumentRegular />}
          >
            View Files
          </Button>
          <Button
            appearance="outline"
            onClick={() => navigate('/tables')}
            icon={<DatabaseRegular />}
          >
            Browse Tables
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
