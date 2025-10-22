import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  Button,
  TabList,
  Tab,
  tokens,
} from '@fluentui/react-components';
import {
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  FolderRegular,
  DatabaseRegular,
  NumberSymbolRegular,
  Bot24Regular,
  ShieldCheckmarkRegular,
  DocumentSearch24Regular,
  Settings24Regular,
} from '@fluentui/react-icons';
import { 
  useStats,
} from '../hooks/use-ccf-data';
import ccfLogo from '../assets/ccf.svg';

const useStyles = makeStyles({
  header: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2BrandHover,
    padding: '8px 24px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
  logo: {
    fontSize: '40px',
    fontWeight: 600,
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

});

interface MenuBarProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({ 
  onToggleTheme, 
  isDarkMode, 
}) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { data: stats } = useStats();

  const hasData = stats && (stats.fileCount > 0 || stats.transactionCount > 0);

  const handleTabChange = (tabValue: string) => {
    if (tabValue === 'files') {
      navigate('/files');
    } else if (tabValue === 'tables') {
      navigate('/tables');
    } else if (tabValue === 'stats') {
      navigate('/stats');
    } else if (tabValue === 'chat') {
      navigate('/chat');
    } else if (tabValue === 'verification') {
      navigate('/verification');
    } else if (tabValue === 'write-receipt') {
      navigate('/write-receipt');
    } else if (tabValue === 'config') {
      navigate('/config');
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <a className={styles.logo} href="/" title='Sage'>
          <img height={30} src={ccfLogo} alt="Sage Logo" />
        </a>
      </div>

      {/* Navigation and Header Actions */}
      <div className={styles.navigation}>
        {/* Navigation Tabs */}
          <TabList onTabSelect={(_, data) => handleTabChange(data.value as string)} className={styles.navigationTabs}>
            { import.meta.env.VITE_DISABLE_SAGE !== 'true' && <Tab value="chat" icon={<Bot24Regular />}>
              Chat
            </Tab> }
            <Tab value="files" icon={<FolderRegular />}>
              Files
            </Tab>
            { hasData && (<>
              <Tab value="tables" icon={<DatabaseRegular />}>
                Tables
              </Tab>
              <Tab value="stats" icon={<NumberSymbolRegular />}>
                Stats
              </Tab>
              <Tab value="verification" icon={<ShieldCheckmarkRegular />}>
                Ledger Verification
              </Tab>
              <Tab value="write-receipt" icon={<DocumentSearch24Regular />}>
                Receipt Verification
              </Tab>
            </>)}
            <Tab value="config" icon={<Settings24Regular />}>
              Configuration
            </Tab>
          </TabList>

        {/* Header Actions */}
        <div className={styles.headerActions}>
          {/* Theme Toggle Button */}
          <Button
            appearance="subtle"
            icon={isDarkMode ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
            onClick={onToggleTheme}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          />
        </div>
      </div>
    </header>
  );
};
