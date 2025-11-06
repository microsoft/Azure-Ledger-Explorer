import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  Button,
  TabList,
  Tab,
  tokens,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
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
  Wrench24Regular,
  ChevronDown20Regular,
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
  toolsButton: {
    minWidth: 'auto',
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
    } else if (tabValue === 'config') {
      navigate('/config');
    }
  };

  // TODO: Refactor to use dictionary mapping if more tools are added
  const handleToolsMenuSelect = (toolValue: string) => {
    if (toolValue === 'ledger-verification') {
      navigate('/verification');
    } else if (toolValue === 'acl-receipt-verification') {
      navigate('/write-receipt');
    } else if (toolValue === 'mst-receipt-verification') {
      navigate('/mst-receipt');
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
          <TabList onTabSelect={(_, data) => handleTabChange(data.value as string)} >
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
            </>)}
            <Tab value="config" icon={<Settings24Regular />}>
              Configuration
            </Tab>
          </TabList>

        {/* Tools Dropdown Menu */}
        { hasData && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button 
                appearance="subtle" 
                icon={<Wrench24Regular />}
                iconPosition="before"
                className={styles.toolsButton}
                aria-label="Tools menu"
              >
                Tools
                <ChevronDown20Regular />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem 
                  icon={<ShieldCheckmarkRegular />}
                  onClick={() => handleToolsMenuSelect('ledger-verification')}
                >
                  Ledger Verification
                </MenuItem>
                <MenuItem 
                  icon={<DocumentSearch24Regular />}
                  onClick={() => handleToolsMenuSelect('acl-receipt-verification')}
                >
                  ACL Receipt Verification
                </MenuItem>
                <MenuItem 
                  icon={<DocumentSearch24Regular />}
                  onClick={() => handleToolsMenuSelect('mst-receipt-verification')}
                >
                  MST Receipt Verification
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}

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
