import React from 'react';
import {
  makeStyles,
  tokens,
  Card,
  CardHeader,
  Caption1,
  Text,
  ProgressBar,
  Badge,
  MessageBar,
  Tooltip,
  Button,
} from '@fluentui/react-components';
import {
  Storage24Regular,
  Warning24Regular,
  ErrorCircle24Regular,
  Checkmark24Regular,
  ArrowClockwise24Regular,
} from '@fluentui/react-icons';
import { useStorageQuota } from '../hooks/use-ccf-data';
import { formatBytes, calculateStorageMetrics, getStorageRecommendations } from '../utils/storage-quota';

const useStyles = makeStyles({
  card: {
    minWidth: '300px',
    maxWidth: '500px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  content: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  progressBar: {
    width: '100%',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricLabel: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: tokens.colorNeutralForeground1,
  },
  recommendations: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  recommendationItem: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
  statusIcon: {
    fontSize: '20px',
  },
  errorMessage: {
    fontSize: '13px',
  },
  refreshButton: {
    alignSelf: 'flex-start',
  },
});

export interface StorageVisualizerProps {
  /**
   * Whether to show detailed metrics (default: true)
   */
  showDetails?: boolean;
  /**
   * Whether to show recommendations (default: true)
   */
  showRecommendations?: boolean;
  /**
   * Additional required space to check against (in bytes)
   */
  requiredSpace?: number;
  /**
   * Custom title for the card
   */
  title?: string;
  /**
   * Whether to show refresh button
   */
  showRefreshButton?: boolean;
}

export const StorageVisualizer: React.FC<StorageVisualizerProps> = ({
  showDetails = true,
  showRecommendations = true,
  requiredSpace = 0,
  title = 'Storage Usage',
  showRefreshButton = false,
}) => {
  const styles = useStyles();
  const { data: storageStatus, isLoading, error, refetch } = useStorageQuota();

  const handleRefresh = () => {
    refetch();
  };

  // Show error state
  if (error) {
    return (
      <Card className={styles.card}>
        <CardHeader
          header={
            <div className={styles.header}>
              <ErrorCircle24Regular className={styles.statusIcon} style={{ color: tokens.colorPaletteRedForeground1 }} />
              <Text weight="semibold">{title}</Text>
            </div>
          }
        />
        <div className={styles.content}>
          <MessageBar intent="error">
            <div className={styles.errorMessage}>
              Failed to load storage information: {error.message}
            </div>
          </MessageBar>
          {showRefreshButton && (
            <Button
              appearance="outline"
              size="small"
              icon={<ArrowClockwise24Regular />}
              onClick={handleRefresh}
              className={styles.refreshButton}
            >
              Retry
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Show loading state
  if (isLoading || !storageStatus) {
    return (
      <Card className={styles.card}>
        <CardHeader
          header={
            <div className={styles.header}>
              <Storage24Regular className={styles.statusIcon} />
              <Text weight="semibold">{title}</Text>
            </div>
          }
        />
        <div className={styles.content}>
          <Caption1>Loading storage information...</Caption1>
        </div>
      </Card>
    );
  }

  // Show unsupported state
  if (!storageStatus.supportsQuota || !storageStatus.quota) {
    return (
      <Card className={styles.card}>
        <CardHeader
          header={
            <div className={styles.header}>
              <Warning24Regular className={styles.statusIcon} style={{ color: tokens.colorPaletteYellowForeground1 }} />
              <Text weight="semibold">{title}</Text>
            </div>
          }
        />
        <div className={styles.content}>
          <MessageBar intent="warning">
            <div className={styles.errorMessage}>
              Storage quota API not supported in this browser. Storage monitoring unavailable.
            </div>
          </MessageBar>
        </div>
      </Card>
    );
  }

  const quota = storageStatus.quota;
  const metrics = calculateStorageMetrics(quota);
  const recommendations = getStorageRecommendations(quota);
  
  // Check if required space would exceed available storage
  const wouldExceedStorage = requiredSpace > 0 && requiredSpace > quota.available;
  const hasCapacityIssues = metrics.isLowSpace || wouldExceedStorage;

  // Determine status icon and color
  const getStatusIcon = () => {
    if (wouldExceedStorage) {
      return <ErrorCircle24Regular className={styles.statusIcon} style={{ color: tokens.colorPaletteRedForeground1 }} />;
    } else if (metrics.isCriticalSpace) {
      return <Warning24Regular className={styles.statusIcon} style={{ color: tokens.colorPaletteRedForeground1 }} />;
    } else if (metrics.isLowSpace) {
      return <Warning24Regular className={styles.statusIcon} style={{ color: tokens.colorPaletteYellowForeground1 }} />;
    } else {
      return <Checkmark24Regular className={styles.statusIcon} style={{ color: tokens.colorPaletteGreenForeground1 }} />;
    }
  };

  // Determine progress bar color
  const getProgressColor = (): 'success' | 'warning' | 'error' => {
    if (metrics.isCriticalSpace || wouldExceedStorage) return 'error';
    if (metrics.isLowSpace) return 'warning';
    return 'success';
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <div className={styles.header}>
            {getStatusIcon()}
            <Text weight="semibold">{title}</Text>
            {showRefreshButton && (
              <Button
                appearance="subtle"
                size="small"
                icon={<ArrowClockwise24Regular />}
                onClick={handleRefresh}
              />
            )}
          </div>
        }
      />
      <div className={styles.content}>
        {/* Storage capacity warning */}
        {wouldExceedStorage && (
          <MessageBar intent="error">
            <Text size={200}>
              Insufficient storage space. Required: {formatBytes(requiredSpace)}, Available: {formatBytes(quota.available)}
            </Text>
          </MessageBar>
        )}

        {/* Progress bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressLabels}>
            <Caption1>Storage Usage</Caption1>
            <Badge appearance="outline">
              {metrics.usagePercentage}%
            </Badge>
          </div>
          <Tooltip
            content={`${metrics.usedSpace} of ${metrics.totalCapacity} used`}
            relationship="description"
          >
            <ProgressBar
              value={quota.usagePercentage}
              max={100}
              color={getProgressColor()}
              className={styles.progressBar}
            />
          </Tooltip>
        </div>

        {/* Detailed metrics */}
        {showDetails && (
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <Caption1 className={styles.metricLabel}>Total Capacity</Caption1>
              <Text className={styles.metricValue}>{metrics.totalCapacity}</Text>
            </div>
            <div className={styles.metric}>
              <Caption1 className={styles.metricLabel}>Used Space</Caption1>
              <Text className={styles.metricValue}>{metrics.usedSpace}</Text>
            </div>
            <div className={styles.metric}>
              <Caption1 className={styles.metricLabel}>Available Space</Caption1>
              <Text className={styles.metricValue}>{metrics.availableSpace}</Text>
            </div>
            {requiredSpace > 0 && (
              <div className={styles.metric}>
                <Caption1 className={styles.metricLabel}>Required Space</Caption1>
                <Text className={styles.metricValue} style={{ 
                  color: wouldExceedStorage ? tokens.colorPaletteRedForeground1 : tokens.colorNeutralForeground1 
                }}>
                  {formatBytes(requiredSpace)}
                </Text>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {showRecommendations && (recommendations.length > 0 || hasCapacityIssues) && (
          <div className={styles.recommendations}>
            <Caption1 style={{ fontWeight: '600' }}>Recommendations:</Caption1>
            {recommendations.map((recommendation, index) => (
              <Caption1 key={index} className={styles.recommendationItem}>
                • {recommendation}
              </Caption1>
            ))}
            {wouldExceedStorage && (
              <Caption1 className={styles.recommendationItem} style={{ color: tokens.colorPaletteRedForeground1 }}>
                • Clear existing data before proceeding with this operation.
              </Caption1>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
