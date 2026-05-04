/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

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
import { isMstEnabled } from '../utils/feature-flags';
import azureLedgerHelp from '../assets/help/azure-confidential-ledger.md?raw';
import mstHelp from '../assets/help/microsoft-signing-transparency.md?raw';
import localFilesHelp from '../assets/help/local-files.md?raw';


const useStyles = makeStyles({
  wizardDialog: {
    minWidth: '900px',
    maxWidth: '95vw',
    width: '95vw',
    height: '85vh',
    '@media (max-width: 1024px)': {
      minWidth: '700px',
      width: '98vw',
    },
    '@media (max-width: 768px)': {
      minWidth: '400px',
      width: '98vw',
      height: '90vh',
    },
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  wizardContent: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    gap: '0',
    padding: '0',
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '2',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    minHeight: 0,
    overflow: 'hidden',
  },
  rightPanel: {
    flex: '1',
    padding: '24px',
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    flexDirection: 'column',
    backgroundClip: 'padding-box',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  tabList: {
    marginBottom: '24px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
  dialogHeader: {
    position: 'relative',
    paddingRight: '40px',
    flexShrink: 0,
  },
  closeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
  },
});

export interface AddFilesWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional initial tab to select when the wizard is opened.
   * If omitted, defaults to 'local'. Note: this only seeds the initial state;
   * users can still switch tabs after the wizard opens.
   */
  initialTab?: AllowedOptions;
}

type AllowedOptions = 'azure' | 'mst' | 'local';

export const AddFilesWizard: React.FC<AddFilesWizardProps> = ({ open, onOpenChange, initialTab }) => {
  const styles = useStyles();
  const mstEnabled = isMstEnabled();

  // Resolve a requested initial tab against the feature gate. If the caller
  // asks for the MST tab while the flag is off (defensive — the entry point
  // that supplies 'mst' should also be hidden), fall back to 'local'.
  const resolveInitialTab = React.useCallback(
    (requested: AllowedOptions | undefined): AllowedOptions => {
      if (requested === 'mst' && !mstEnabled) return 'local';
      return requested ?? 'local';
    },
    [mstEnabled]
  );

  const [selectedTab, setSelectedTab] = useState<AllowedOptions>(resolveInitialTab(initialTab));

  // When the wizard is (re)opened, sync the selected tab from `initialTab`,
  // falling back to the default 'local'. This avoids "stickiness" where
  // re-opening the wizard from a generic entry point (sidebar `+` button)
  // after picking a deep-link card keeps the previously selected tab.
  React.useEffect(() => {
    if (open) {
      setSelectedTab(resolveInitialTab(initialTab));
    }
  }, [open, initialTab, resolveInitialTab]);

  // Callback to close the dialog when import completes
  const handleImportComplete = () => {
    onOpenChange(false);
  };

  const getHelpContent = () => {
    switch (selectedTab) {
      case 'azure':
        return azureLedgerHelp;
      case 'mst':
        return mstEnabled ? mstHelp : localFilesHelp;
      case 'local':
      default:
        return localFilesHelp;
    }
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'azure':
        return <LedgerBackupView onImportComplete={handleImportComplete} />;
      case 'mst':
        // Defensive: if the gate is off the tab itself isn't rendered, but
        // fall back to the local view rather than instantiating the MST one.
        return mstEnabled
          ? <MstLedgerImportView onImportComplete={handleImportComplete} />
          : <FileUploadArea onImportComplete={handleImportComplete} />;
      case 'local':
      default:
        return <FileUploadArea onImportComplete={handleImportComplete} />;
    }
  };

  const helpContent = getHelpContent();

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)} >
      <DialogSurface className={styles.wizardDialog}>
        <DialogTitle
          className={styles.dialogHeader}
          action={
          <Button
            className={styles.closeButton}
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
                <Tooltip content="Azure Confidential Ledger Backup" relationship="label">
                  <Text size={200}>Azure Ledger Backup</Text>
                </Tooltip>
              </Tab>
              <Tab value="local" icon={<Folder20Regular />}>
                <Tooltip content="Upload Audit Ledger Files" relationship="label">
                  <Text size={200}>Audit Ledger Files</Text>
                </Tooltip>
              </Tab>
              {mstEnabled && (
                <Tab value="mst" icon={<ShieldCheckmark20Regular />}>
                  <Tooltip content="Microsoft's Signing Transparency" relationship="label">
                    <Text size={200}>Signing Transparency</Text>
                  </Tooltip>
                </Tab>
              )}
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
