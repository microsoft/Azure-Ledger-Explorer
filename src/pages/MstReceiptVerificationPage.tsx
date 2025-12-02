/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { 
  makeStyles, 
  tokens,
  Card,
  Text,
  MessageBar,
  MessageBarBody,
  Link,
  Badge,
} from '@fluentui/react-components';
import {
  Info24Regular,
  ShieldCheckmark24Regular,
  Code24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
  },
  content: {
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    '@media (max-width: 768px)': {
      padding: tokens.spacingVerticalL,
    },
    '@media (max-width: 480px)': {
      padding: tokens.spacingVerticalM,
    },
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  icon: {
    fontSize: '32px',
    color: tokens.colorBrandForeground1,
  },
  title: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
  },
  badge: {
    marginLeft: tokens.spacingHorizontalS,
  },
  description: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
  },
  infoCard: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXL,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  sectionIcon: {
    color: tokens.colorBrandForeground1,
  },
  bulletList: {
    paddingLeft: tokens.spacingHorizontalXXL,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  bulletItem: {
    lineHeight: tokens.lineHeightBase400,
  },
  codeBlock: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: tokens.fontSizeBase300,
    overflowX: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  link: {
    color: '#0078D4',
    fontWeight: tokens.fontWeightSemibold,
    textDecorationLine: 'none',
    ':hover': {
      textDecorationLine: 'underline',
    },
  },
  messageBar: {
    marginBottom: tokens.spacingVerticalXXL,
  },
});

export const MstReceiptVerificationPage: React.FC = () => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <ShieldCheckmark24Regular className={styles.icon} />
            <Text className={styles.title}>Signing Transparency Receipt Verification</Text>
            <Badge 
              appearance="tint" 
              color="informative"
              className={styles.badge}
            >
              Coming Soon
            </Badge>
          </div>
          <Text className={styles.description}>
            Verify transparent statements from Microsoft Signing Transparency (MST) using the Azure SDK for .NET
          </Text>
        </div>

        {/* Info Banner */}
        <MessageBar 
          intent="info" 
          className={styles.messageBar}
          icon={<Info24Regular />}
        >
          <MessageBarBody>
            <Text weight="semibold">Feature Under Development:</Text> Signing transparency receipt verification 
            is not yet available in this web interface. Please use the Azure SDK for .NET to verify 
            transparent statements programmatically.
          </MessageBarBody>
        </MessageBar>

        {/* Main Content Card */}
        <Card className={styles.infoCard}>
          <div className={styles.cardContent}>
            {/* SDK Reference Section */}
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>
                <Code24Regular className={styles.sectionIcon} />
                Verification with Azure SDK for .NET
              </Text>
              <Text>
                To verify signing transparency statements (transparent statements with COSE signature envelopes), 
                please refer to the official Azure SDK for .NET documentation:
              </Text>
              <div style={{ marginTop: tokens.spacingVerticalM }}>
                <Link 
                  href="https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/confidentialledger/Azure.Security.CodeTransparency/README.md" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  Azure.Security.CodeTransparency SDK Documentation
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MstReceiptVerificationPage;
