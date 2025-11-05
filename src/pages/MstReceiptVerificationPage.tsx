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
            <Text className={styles.title}>MST Receipt Verification</Text>
            <Badge 
              appearance="tint" 
              color="informative"
              className={styles.badge}
            >
              Coming Soon
            </Badge>
          </div>
          <Text className={styles.description}>
            Verify write receipts from MST (Merkle Service Tree) ledgers using the CCF .NET SDK
          </Text>
        </div>

        {/* Info Banner */}
        <MessageBar 
          intent="info" 
          className={styles.messageBar}
          icon={<Info24Regular />}
        >
          <MessageBarBody>
            <Text weight="semibold">Feature Under Development:</Text> MST receipt verification 
            is not yet available in this web interface. Please use the CCF .NET SDK for programmatic 
            verification of MST ledger receipts.
          </MessageBarBody>
        </MessageBar>

        {/* Main Content Card */}
        <Card className={styles.infoCard}>
          <div className={styles.cardContent}>
            {/* About MST Section */}
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>
                <Info24Regular className={styles.sectionIcon} />
                About MST Ledgers
              </Text>
              <Text>
                MST (Merkle Service Tree) is a ledger structure used in Azure Confidential Ledger 
                that provides enhanced performance and scalability for high-throughput scenarios. 
                Unlike ACL (Azure Confidential Ledger) receipts, MST receipts require specialized 
                verification logic provided by the Confidential Consortium Framework (CCF) SDK.
              </Text>
            </div>

            {/* Verification Requirements */}
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>
                <ShieldCheckmark24Regular className={styles.sectionIcon} />
                Verification Requirements
              </Text>
              <Text>
                To verify MST ledger receipts, you will need:
              </Text>
              <ul className={styles.bulletList}>
                <li className={styles.bulletItem}>
                  <Text weight="semibold">CCF .NET SDK:</Text> The official SDK provides native 
                  support for MST receipt verification
                </li>
                <li className={styles.bulletItem}>
                  <Text weight="semibold">Service Certificate:</Text> The network certificate 
                  from your Azure Confidential Ledger instance
                </li>
                <li className={styles.bulletItem}>
                  <Text weight="semibold">Write Receipt:</Text> The JSON receipt returned from 
                  the MST ledger transaction
                </li>
                <li className={styles.bulletItem}>
                  <Text weight="semibold">Transaction ID:</Text> The unique identifier for the 
                  transaction you want to verify
                </li>
              </ul>
            </div>

            {/* SDK Usage Section */}
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>
                <Code24Regular className={styles.sectionIcon} />
                Using the CCF .NET SDK
              </Text>
              <Text>
                Here's a basic example of verifying an MST receipt using the CCF .NET SDK:
              </Text>
              <div className={styles.codeBlock}>
                <pre style={{ margin: 0 }}>
{`using CCF.ReceiptVerification;

// Load your service certificate
var serviceCert = new X509Certificate2("path/to/service_cert.pem");

// Parse the receipt JSON
var receipt = ReceiptParser.ParseReceipt(receiptJson);

// Verify the receipt
var verifier = new ReceiptVerifier(serviceCert);
var result = verifier.VerifyReceipt(receipt, transactionId);

if (result.IsValid)
{
    Console.WriteLine("Receipt verified successfully!");
    Console.WriteLine($"Node ID: {result.NodeId}");
    Console.WriteLine($"Sequence Number: {result.SequenceNumber}");
}
else
{
    Console.WriteLine($"Verification failed: {result.ErrorMessage}");
}`}
                </pre>
              </div>
            </div>

            {/* Resources Section */}
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>
                Additional Resources
              </Text>
              <ul className={styles.bulletList}>
                <li className={styles.bulletItem}>
                  <Link 
                    href="https://microsoft.github.io/CCF/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    CCF Documentation
                  </Link> - Official Confidential Consortium Framework documentation
                </li>
                <li className={styles.bulletItem}>
                  <Link 
                    href="https://github.com/microsoft/CCF" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    CCF GitHub Repository
                  </Link> - Source code and examples
                </li>
                <li className={styles.bulletItem}>
                  <Link 
                    href="https://learn.microsoft.com/azure/confidential-ledger/overview" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    Azure Confidential Ledger Overview
                  </Link> - Understanding ACL and MST ledgers
                </li>
                <li className={styles.bulletItem}>
                  <Link 
                    href="https://learn.microsoft.com/azure/confidential-ledger/write-transaction-receipts" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    Write Transaction Receipts
                  </Link> - Learn about receipt structures and verification
                </li>
              </ul>
            </div>

            {/* Future Plans */}
            <div className={styles.section}>
              <MessageBar intent="info">
                <MessageBarBody>
                  <Text weight="semibold">Future Enhancement:</Text> We're planning to integrate 
                  MST receipt verification directly into this web interface. In the meantime, 
                  please use the CCF .NET SDK for production verification workflows. For ACL 
                  receipt verification, visit the{' '}
                  <Link href="/write-receipt" className={styles.link}>
                    ACL Receipt Verification
                  </Link>{' '}
                  page.
                </MessageBarBody>
              </MessageBar>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MstReceiptVerificationPage;
