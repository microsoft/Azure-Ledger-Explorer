import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  Body1,
  Caption1,
  Button,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  TabList,
  Tab,
} from '@fluentui/react-components';
import {
  DocumentAdd24Regular,
  Delete24Regular,
  DatabaseArrowDownRegular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  FolderRegular,
  DatabaseRegular,
  NumberSymbolRegular,
  Bot24Regular,
  ShieldCheckmarkRegular,
} from '@fluentui/react-icons';
import { 
  useStats, 
  useClearAllData,
  useDropDatabase,
} from '../hooks/use-ccf-data';
import { AddFilesWizard } from './AddFilesWizard';
import { StorageVisualizer } from './StorageVisualizer';

const useStyles = makeStyles({
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--colorNeutralStroke2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Reduce z-index to prevent potential layering conflicts
    zIndex: 10,
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
  },
  subtitle: {
    margin: '4px 0 0 0',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  navigation: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  navigationTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
});

interface MenuBarProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({ onToggleTheme, isDarkMode }) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: stats } = useStats();
  const clearAllDataMutation = useClearAllData();
  const dropDatabaseMutation = useDropDatabase();
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);

  const hasData = stats && (stats.fileCount > 0 || stats.transactionCount > 0);

  const handleClearAllData = async () => {
    try {
      await clearAllDataMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to clear all data:', error);
    }
  };

  const handleDropDatabase = async () => {
    try {
      await dropDatabaseMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to drop database:', error);
    }
  };

  const getActiveTab = () => {
    if (location.pathname.startsWith('/tables')) {
      return 'tables';
    } else if (location.pathname.startsWith('/stats')) {
      return 'stats';
    } else if (location.pathname.startsWith('/ai')) {
      return 'ai';
    } else if (location.pathname.startsWith('/verification')) {
      return 'verification';
    }
    return 'files';
  };

  const handleTabChange = (tabValue: string) => {
    if (tabValue === 'files') {
      navigate('/');
    } else if (tabValue === 'tables') {
      navigate('/tables');
    } else if (tabValue === 'stats') {
      navigate('/stats');
    } else if (tabValue === 'ai') {
      navigate('/ai');
    } else if (tabValue === 'verification') {
      navigate('/verification');
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <h1 className={styles.title}>CCF Ledger Explorer</h1>
        <Caption1 className={styles.subtitle}>
          {hasData ? (
            `${stats.fileCount} file${stats.fileCount !== 1 ? 's' : ''} • ${stats.transactionCount} transaction${stats.transactionCount !== 1 ? 's' : ''}`
          ) : (
            'Upload and explore Confidential Consortium Framework ledger files'
          )}
        </Caption1>
      </div>

      {/* Navigation and Header Actions */}
      <div className={styles.navigation}>
        {/* Navigation Tabs */}
        <div className={styles.navigationTabs}>
          <TabList selectedValue={getActiveTab()} onTabSelect={(_, data) => handleTabChange(data.value as string)}>
            <Tab value="files" icon={<FolderRegular />}>
              Files
            </Tab>
            <Tab value="tables" icon={<DatabaseRegular />}>
              Tables
            </Tab>
            <Tab value="stats" icon={<NumberSymbolRegular />}>
              Stats
            </Tab>
            <Tab value="verification" icon={<ShieldCheckmarkRegular />}>
              Verification
            </Tab>
            <Tab value="ai" icon={<Bot24Regular />}>
              AI Assistant
            </Tab>
          </TabList>
        </div>

        {/* Header Actions */}
        <div className={styles.headerActions}>
          {/* Theme Toggle Button */}
          <Button
            appearance="subtle"
            icon={isDarkMode ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
            onClick={onToggleTheme}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          />

          {/* Upload Files Button */}
          <Button
            appearance="outline"
            icon={<DocumentAdd24Regular />}
            onClick={() => setShowUploadDialog(true)}
          >
            Add Files
          </Button>

          <AddFilesWizard 
            open={showUploadDialog} 
            onOpenChange={setShowUploadDialog}
          />
          
          {/* Clear All Data Button */}
          {hasData && (
            <Dialog>
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="outline"
                  icon={<Delete24Regular />}
                  disabled={clearAllDataMutation.isPending}
                >
                  Clear All
                </Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogTitle>Clear All Data</DialogTitle>
                <DialogContent>
                  <DialogBody>
                    <Body1>
                      Are you sure you want to clear all data? This will permanently delete:
                    </Body1>
                    <ul>
                      <li>{stats.fileCount} ledger file{stats.fileCount !== 1 ? 's' : ''}</li>
                      <li>{stats.transactionCount} transaction{stats.transactionCount !== 1 ? 's' : ''}</li>
                      <li>{stats.writeCount} write operation{stats.writeCount !== 1 ? 's' : ''}</li>
                      <li>{stats.deleteCount} delete operation{stats.deleteCount !== 1 ? 's' : ''}</li>
                    </ul>
                    <Body1>This action cannot be undone.</Body1>
                    
                    {/* Storage Status */}
                    <div style={{ marginTop: '16px' }}>
                      <StorageVisualizer 
                        title="Storage Impact" 
                        showDetails={false}
                        showRecommendations={false}
                      />
                    </div>
                  </DialogBody>
                  <DialogActions>
                    <DialogTrigger disableButtonEnhancement>
                      <Button appearance="secondary">Cancel</Button>
                    </DialogTrigger>
                    <Button
                      appearance="primary"
                      onClick={handleClearAllData}
                      disabled={clearAllDataMutation.isPending}
                    >
                      {clearAllDataMutation.isPending ? 'Clearing...' : 'Clear All Data'}
                    </Button>
                  </DialogActions>
                </DialogContent>
              </DialogSurface>
            </Dialog>
          )}

          {/* Drop Database Button */}
          <Dialog>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="outline"
                icon={<DatabaseArrowDownRegular />}
                disabled={dropDatabaseMutation.isPending}
              >
                Drop DB
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogTitle>Drop Database</DialogTitle>
              <DialogContent>
                <DialogBody>
                  <Body1>
                    Are you sure you want to drop the entire database? This will:
                  </Body1>
                  <ul>
                    <li>Remove all tables and data completely</li>
                    <li>Reset the database schema to its initial state</li>
                    <li>Free up all storage space used by the database</li>
                  </ul>
                  <Body1>
                    This is more thorough than "Clear All Data" and will completely reset the database structure.
                    This action cannot be undone.
                  </Body1>
                  
                  {/* Storage Status */}
                  <div style={{ marginTop: '16px' }}>
                    <StorageVisualizer 
                      title="Storage Recovery" 
                      showDetails={false}
                      showRecommendations={false}
                    />
                  </div>
                </DialogBody>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Cancel</Button>
                  </DialogTrigger>
                  <Button
                    appearance="primary"
                    onClick={handleDropDatabase}
                    disabled={dropDatabaseMutation.isPending}
                  >
                    {dropDatabaseMutation.isPending ? 'Dropping...' : 'Drop Database'}
                  </Button>
                </DialogActions>
              </DialogContent>
            </DialogSurface>
          </Dialog>
        </div>
      </div>
    </header>
  );
};
