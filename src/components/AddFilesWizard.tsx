import React, { useState } from 'react';
import {
  makeStyles,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  Button,
  TabList,
  Tab,
  Text,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import {
  CloudArrowUp20Regular,
  ShieldCheckmark20Regular,
  Folder20Regular,
  Dismiss24Regular,
} from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileUploadArea } from './FileUploadArea';
import { LedgerBackupView } from './LedgerBackupView';
import { MstLedgerImportView } from './MstLedgerImportView';
import azureLedgerHelp from '../assets/help/azure-confidential-ledger.md?raw';
import mstHelp from '../assets/help/microsoft-signing-transparency.md?raw';
import localFilesHelp from '../assets/help/local-files.md?raw';


const useStyles = makeStyles({
  wizardDialog: {
    minWidth: '900px',
    maxWidth: '1200px',
    width: '90vw',
    height: '80vh',
    '@media (max-width: 1024px)': {
      minWidth: '700px',
      width: '95vw',
    },
    '@media (max-width: 768px)': {
      minWidth: '400px',
      width: '98vw',
      height: '90vh',
    },
    overflow: 'hidden'
  },
  wizardContent: {
    display: 'flex',
    height: 'calc(100% - 30px)',
    gap: '0',
    padding: '0',
  },
  leftPanel: {
    flex: '2',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
  },
  rightPanel: {
    flex: '1',
    padding: '24px',
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    flexDirection: 'column',
    backgroundClip: 'padding-box',
  },
  tabList: {
    marginBottom: '24px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
  },
  helpSection: {
    height: '100%',
    overflow: 'auto',
  },
  helpContent: {
    color: tokens.colorNeutralForeground2,
  },
  emptyTabContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  comingSoonIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
});

export interface AddFilesWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AllowedOptions = 'azure' | 'mst' | 'local';

export const AddFilesWizard: React.FC<AddFilesWizardProps> = ({ open, onOpenChange }) => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<AllowedOptions>('local');

  const getHelpContent = () => {
    switch (selectedTab) {
      case 'azure':
        return azureLedgerHelp;
      case 'mst':
        return mstHelp;
      case 'local':
      default:
        return localFilesHelp;
    }
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'azure':
        return <LedgerBackupView />;
      case 'mst':
        return <MstLedgerImportView />;
      case 'local':
      default:
        return <FileUploadArea />;
    }
  };

  const helpContent = getHelpContent();

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)} >
      <DialogSurface className={styles.wizardDialog}>
        <DialogTitle action={
          <Button
            appearance="subtle"
            aria-label="Close"
            icon={<Dismiss24Regular />}
            onClick={() => onOpenChange(false)}
          />
        }>
          Add Ledger Files
        </DialogTitle>

        <DialogContent className={styles.wizardContent}>
          {/* Left Panel - Wizard Content */}
          <div className={styles.leftPanel}>
            <TabList
              selectedValue={selectedTab}
              onTabSelect={(_, data) => setSelectedTab(data.value as AllowedOptions)}
              className={styles.tabList}
            >
              <Tab value="azure" icon={<CloudArrowUp20Regular />}>
                <Tooltip content="Azure Confidential Ledger" relationship="label">
                  <Text size={200}>Azure Ledger</Text>
                </Tooltip>
              </Tab>
              <Tab value="mst" icon={<ShieldCheckmark20Regular />}>
                <Tooltip content="Microsoft's Signing Transparency" relationship="label">
                  <Text size={200}>Signing</Text>
                </Tooltip>
              </Tab>
              <Tab value="local" icon={<Folder20Regular />}>
                <Tooltip content="Upload Local Files" relationship="label">
                  <Text size={200}>Local Files</Text>
                </Tooltip>
              </Tab>
            </TabList>

            <div className={styles.tabContent}>
              {renderTabContent()}
            </div>
          </div>

          {/* Right Panel - Help Content */}
          <div className={styles.rightPanel}>
            <div className={styles.helpSection}>
              <div className={styles.helpContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {helpContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogSurface>
    </Dialog>
  );
};
