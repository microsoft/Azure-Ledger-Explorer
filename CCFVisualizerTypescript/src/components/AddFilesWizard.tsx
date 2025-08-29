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
  Caption1,
  Divider,
} from '@fluentui/react-components';
import {
  CloudRegular,
  ShieldCheckmarkRegular,
  FolderRegular,
  Dismiss24Regular,
} from '@fluentui/react-icons';
import { FileUploadArea } from './FileUploadArea';
import { LedgerBackupView } from './LedgerBackupView';
import { MstLedgerImportView } from './MstLedgerImportView';


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
    borderRight: '1px solid var(--colorNeutralStroke2)',
  },
  rightPanel: {
    flex: '1',
    padding: '24px',
    backgroundColor: 'var(--colorNeutralBackground2)',
    display: 'flex',
    flexDirection: 'column',
  },
  tabList: {
    marginBottom: '24px',
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
  },
  helpSection: {
    height: '100%',
    overflow: 'auto',
  },
  helpTitle: {
    marginBottom: '16px',
    color: 'var(--colorNeutralForeground1)',
    fontWeight: '600',
  },
  helpContent: {
    color: 'var(--colorNeutralForeground2)',
    lineHeight: '1.5',
    '& h3': {
      color: 'var(--colorNeutralForeground1)',
      marginTop: '20px',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: '600',
    },
    '& p': {
      marginBottom: '12px',
    },
    '& ul': {
      marginBottom: '12px',
      paddingLeft: '20px',
    },
    '& li': {
      marginBottom: '4px',
    },
    '& code': {
      backgroundColor: 'var(--colorNeutralBackground3)',
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
    },
  },
  markdownList: {
    marginBottom: '12px',
    paddingLeft: '20px',
  },
  markdownListItem: {
    marginBottom: '4px',
  },
  markdownHeading: {
    marginBottom: '8px',
    color: 'var(--colorNeutralForeground1)',
  },
  markdownParagraph: {
    marginBottom: '12px',
    lineHeight: '1.5',
    color: 'var(--colorNeutralForeground2)',
  },
  emptyTabContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: 'var(--colorNeutralForeground3)',
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

export const AddFilesWizard: React.FC<AddFilesWizardProps> = ({ open, onOpenChange }) => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<string>('local');
  const renderMarkdownContent = (content: string) => {
    return content.split('\n\n').map((paragraph, index) => {
      if (paragraph.startsWith('### ')) {
        return (
          <Text key={index} as="h3" size={400} weight="semibold" className={styles.markdownHeading}>
            {paragraph.replace('### ', '')}
          </Text>
        );
      }
      
      if (paragraph.includes('- ') || paragraph.includes('1. ')) {
        const items = paragraph.split('\n').filter(line => line.trim().startsWith('- ') || /^\d+\./.test(line.trim()));
        return (
          <ul key={index} className={styles.markdownList}>
            {items.map((item, itemIndex) => (
              <li key={itemIndex} className={styles.markdownListItem}>
                <Caption1>{item.replace(/^- |^\d+\. /, '')}</Caption1>
              </li>
            ))}
          </ul>
        );
      }
      
      return (
        <Caption1 key={index} className={styles.markdownParagraph}>
          {paragraph.replace(/`([^`]+)`/g, (_, code) => code)}
        </Caption1>
      );
    });
  };

  const getHelpContent = () => {
    switch (selectedTab) {
      case 'azure':
        return {
          title: 'Azure Confidential Ledger',
          content: `
### About Azure Confidential Ledger

Azure Confidential Ledger is a managed service that provides a tamper-proof ledger for storing sensitive data. It's built on top of the Confidential Consortium Framework (CCF).

### Instructions

Please follow the following:
- Perform a backup of your ledger. [Learn More...](http://todo)
- Log into your storage account and generate a SAS key. [Learn More...](http://todo)
- Provide your SAS key to this tool
          `.trim(),
        };

      case 'mst':
        return {
          title: 'Microsoft\'s Signing Transparency',
          content: `
### About Microsoft\'s Signing Transparency

Microsoft\'s Signing Transparency provides transparency and auditability for software supply chain security, maintaining tamper-evident logs of software artifacts.
          `.trim(),
        };
      case 'local':
      default:
        return {
          title: 'Local Files',
          content: `
### Uploading Local Files

Upload CCF ledger files from your local system for analysis and exploration.

### Supported File Types

- **Only .committed files** - Files must have the .committed extension
- **Sequential naming required** - Files must be named: ledger_<start>-<end>.committed
- **Examples**: ledger_1-18.committed, ledger_19-25.committed, ledger_26-40.committed

### File Sequence Requirements

1. **Must start at 1**: The first file must be ledger_1-X.committed
2. **Must be contiguous**: No gaps between file ranges
3. **No overlaps**: File ranges cannot overlap
4. **Sequential order**: Files will be processed in sequence order

### How to Upload

1. **Drag and Drop**: Simply drag .committed files from your file system into the upload area
2. **Browse Files**: Click "Select .committed Files" to open a file browser
3. **Multiple Files**: You can upload multiple sequential files at once

### File Processing

After upload, the application will:
- Validate file sequence and naming
- Parse the ledger structure in sequential order
- Extract transactions and key-value pairs
- Index data for fast searching
- Store everything locally in your browser

### Validation

The system will check for:
- Correct .committed file extension
- Proper naming format (ledger_X-Y.committed)
- Sequential and contiguous ranges
- No duplicate or overlapping files
          `.trim(),
        };
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
              onTabSelect={(_, data) => setSelectedTab(data.value as string)}
              className={styles.tabList}
            >
              <Tab value="azure" icon={<CloudRegular />}>
                Azure Confidential Ledger
              </Tab>
              <Tab value="mst" icon={<ShieldCheckmarkRegular />}>
                Microsoft's Signing Transparency
              </Tab>
              <Tab value="local" icon={<FolderRegular />}>
                Local Files
              </Tab>
            </TabList>

            <div className={styles.tabContent}>
              {renderTabContent()}
            </div>
          </div>

          {/* Right Panel - Help Content */}
          <div className={styles.rightPanel}>
            <div className={styles.helpSection}>
              <Text className={styles.helpTitle} size={500}>
                {helpContent.title}
              </Text>
              <Divider style={{ marginBottom: '16px' }} />
              <div className={styles.helpContent}>
                {renderMarkdownContent(helpContent.content)}
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogSurface>
    </Dialog>
  );
};
