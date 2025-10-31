import React from 'react';
import {
  makeStyles,
  Text,
  Caption1,
  Button,
  Card,
  CardHeader,
  Badge,
  Spinner,
  tokens,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  DeleteRegular,
  InfoRegular,
} from '@fluentui/react-icons';
import { useLedgerFiles, useDeleteLedgerFile } from '../hooks/use-ccf-data';

const useStyles = makeStyles({
  container: {
    padding: '24px',
    height: '100%',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '16px',
  },
  fileCard: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: 'var(--shadow8)',
    },
  },
  fileCardContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '16px',
  },
  fileIcon: {
    fontSize: '32px',
    color: tokens.colorBrandBackground,
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  fileName: {
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    wordBreak: 'break-all',
  },
  fileDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  fileMeta: {
    color: tokens.colorNeutralForeground3,
  },
  fileActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: tokens.colorNeutralForeground3,
  },
  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptySubtext: {
    marginTop: '8px',
  },
});

interface FileListViewProps {
  onFileSelect?: (fileId: number) => void;
  selectedFileId?: number | null;
}

export const FileListView: React.FC<FileListViewProps> = ({
  onFileSelect,
  selectedFileId,
}) => {
  const styles = useStyles();
  const { data: ledgerFiles, isLoading, error } = useLedgerFiles();
  const deleteMutation = useDeleteLedgerFile();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleFileClick = (fileId: number) => {
    onFileSelect?.(fileId);
  };

  const handleDeleteFile = (fileId: number, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(fileId);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Spinner size="large" label="Loading files..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Text size={500}>Error loading files: {error.message}</Text>
        </div>
      </div>
    );
  }

  if (!ledgerFiles || ledgerFiles.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <DocumentRegular className={styles.emptyIcon} />
          <Text size={500} weight="semibold">No ledger files uploaded</Text>
          <Caption1 className={styles.emptySubtext}>
            Go to the Upload tab to add your first CCF ledger file.
          </Caption1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="semibold">
          Ledger Files ({ledgerFiles.length})
        </Text>
      </div>

      <div className={styles.fileGrid}>
        {ledgerFiles.map((file) => (
          <Card
            key={file.id}
            className={`${styles.fileCard} ${
              selectedFileId === file.id ? 'selected' : ''
            }`}
            onClick={() => handleFileClick(file.id)}
          >
            <CardHeader
              header={
                <div className={styles.fileCardContent}>
                  <DocumentRegular className={styles.fileIcon} />
                  <div className={styles.fileInfo}>
                    <Text className={styles.fileName}>{file.filename}</Text>
                    
                    <div className={styles.fileDetails}>
                      <Badge size="small" appearance="outline">
                        {formatFileSize(file.fileSize)}
                      </Badge>
                      <Caption1 className={styles.fileMeta}>
                        Uploaded {formatDate(file.createdAt)}
                      </Caption1>
                    </div>

                    <div className={styles.fileActions}>
                      <Button
                        size="small"
                        appearance="secondary"
                        icon={<InfoRegular />}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleFileClick(file.id);
                        }}
                      >
                        View Transactions
                      </Button>
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<DeleteRegular />}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id, file.filename);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              }
            />
          </Card>
        ))}
      </div>
    </div>
  );
};
