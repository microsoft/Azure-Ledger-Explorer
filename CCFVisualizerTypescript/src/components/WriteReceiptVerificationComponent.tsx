import React, { useState, useCallback } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardPreview,
  Text,
  MessageBar,
  MessageBarBody,
  Badge,
  Field,
  Textarea,
  makeStyles,
  tokens,
  Spinner,
  CardFooter
} from '@fluentui/react-components';
import {
  DocumentSearch24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  Info24Regular,
  Certificate24Regular
} from '@fluentui/react-icons';
import { useWriteReceiptVerification } from '../hooks/write-receipt-verification';
import type { WriteReceipt } from '../types/write-receipt-types';

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    overflow: 'hidden',
    height: '100%',
    flexDirection: 'column',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  containerItem: {
    flex: 1,
    overflow: 'auto',
    height: '100%',
    minHeight: 0,
    paddingBottom: '50px',
  },
  card: {
    width: '100%',
  },
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    width: '100%',
    padding: tokens.spacingVerticalM,
  },
  resultsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  statusBadge: {
    minWidth: '60px',
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  resultCard: {
    padding: tokens.spacingVerticalM,
  },
  hashText: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-all',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
  },
  controlsSection: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});

export const WriteReceiptVerificationComponent: React.FC = () => {
  const classes = useStyles();
  const [receiptText, setReceiptText] = useState('');
  const [networkCertText, setNetworkCertText] = useState('');
  const [parsedReceipt, setParsedReceipt] = useState<WriteReceipt | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const { verificationResult, isLoading, error } = useWriteReceiptVerification(
    networkCertText || undefined,
    parsedReceipt || undefined
  );

  const parseReceipt = useCallback(() => {
    if (!receiptText.trim()) {
      setParseError('Please enter a receipt');
      setParsedReceipt(null);
      return;
    }

    try {
      const parsed = JSON.parse(receiptText) as WriteReceipt;
      
      // Validate required fields
      if (!parsed.cert || !parsed.leafComponents || !parsed.nodeId || !parsed.proof || !parsed.signature) {
        setParseError('Invalid receipt format: missing required fields');
        setParsedReceipt(null);
        return;
      }

      if (!parsed.leafComponents.claimsDigest || !parsed.leafComponents.commitEvidence || !parsed.leafComponents.writeSetDigest) {
        setParseError('Invalid receipt format: missing leafComponents fields');
        setParsedReceipt(null);
        return;
      }

      setParseError(null);
      setParsedReceipt(parsed);
    } catch {
      setParseError('Invalid JSON format');
      setParsedReceipt(null);
    }
  }, [receiptText]);

  const clearAll = useCallback(() => {
    setReceiptText('');
    setNetworkCertText('');
    setParsedReceipt(null);
    setParseError(null);
  }, []);

  const getStatusIcon = (isValid: boolean, isCompleted: boolean) => {
    if (!isCompleted) return <Info24Regular />;
    return isValid 
      ? <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
      : <ErrorCircle24Regular style={{ color: tokens.colorPaletteRedForeground1 }} />;
  };

  const getStatusBadge = (isValid: boolean, isCompleted: boolean) => {
    if (!isCompleted) {
      return <Badge className={classes.statusBadge}>PENDING</Badge>;
    }
    
    const color = isValid ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteRedForeground1;
    return (
      <Badge className={classes.statusBadge} style={{ color }}>
        {isValid ? 'VALID' : 'INVALID'}
      </Badge>
    );
  };

  const exampleReceipt = `{
    "cert": "-----BEGIN CERTIFICATE-----\\nMIICOjCCAeCgAwIBAgIQOFPtEfZJthBhwTYj2kYnQjAKBggqhkjOPQQDAjAWMRQw\\nEgYDVQQDDAtDQ0YgU2VydmljZTAeFw0yNTA1MjIxODM3MjlaFw0yNTA4MjAxODM3\\nMjhaMBMxETAPBgNVBAMMCENDRiBOb2RlMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcD\\nQgAEdbvxbxdDDEU/NXqhGE6VI1NvvvQlYSk9TAdLRHelGQ1fd3AyIKegZg5AI+KI\\n++iDkiEHWMKrWzreKjAj9Cd4taOCAREwggENMAwGA1UdEwEB/wQCMAAwHQYDVR0O\\nBBYEFJuP+HBZpc2z36JvTzt1nbxucHb5MB8GA1UdIwQYMBaAFG3PYWNt9D8LQBYC\\nXNvu8GC2vIOBMIG8BgNVHREEgbQwgbGCNXdyaXRlLmFjbC1kZWVwZmFrZS1kZW1v\\nLmNvbmZpZGVudGlhbC1sZWRnZXIuYXp1cmUuY29tghFhY2wtZGVlcGZha2UtZGVt\\nb4IuYWNsLWRlZXBmYWtlLWRlbW8ucHJvZC5wcml2YXRlLmF6dXJlbGVkZ2VyLmNv\\nbYcECvAOR4IvYWNsLWRlZXBmYWtlLWRlbW8uY29uZmlkZW50aWFsLWxlZGdlci5h\\nenVyZS5jb20wCgYIKoZIzj0EAwIDSAAwRQIhAI36pmdT83l6Oy2GMPAlnhggh903\\nCOYxHZjYfNCdI/oSAiBz8rakQI7cAbORpKVkpBOQU/P2XhxPdsYtdwZE6msWig==\\n-----END CERTIFICATE-----\\n",
    "leafComponents": {
        "claimsDigest": "0000000000000000000000000000000000000000000000000000000000000000",
        "commitEvidence": "ce:10.675:c4dcf8d815740f94b3bdc3b76bc4d7463987ce036d4e8b612f104838d6c09a84",
        "writeSetDigest": "d1727ca306bdf12a0893242f46cc5cef5bcb2e5a5412f6de6e6312d140d9f674"
    },
    "nodeId": "4d4748c36fc12087239d4874a5d5321bb114cfaf79dad3a35ff988ea2dfb4845",
    "proof": [
        {
            "left": "1cc81b1b9499d0f6263bdd837756d2da01be2f5e16da3f0813ab071923946fd4"
        },
        {
            "left": "f27a83514d3c8304f402bdee81af019844bb5a00ad7c729cf55db694ce3e0a1b"
        },
        {
            "left": "0d7364e8d4770cc04c2ba869d88212b53b6f92acfd224e2e0c4c5fd1dbfb3170"
        },
        {
            "left": "4e5002773497d470db9891e7142104354c9fc5c43df63e4a86998c834a22a818"
        },
        {
            "left": "586e3fcdbdd3a118ebb2a3085ca4d65ca36ff9e53a1b5b7689f25d0690fa2cfc"
        }
    ],
    "signature": "MEQCIFNuV44YbhXPGtw8OCd64LJkuHG57tnUMXO83Lv2ZW8xAiAIZ+k2blOxD/M3a0Jq61M2R1OVenEg9Yoqcia/y7sTrQ=="
}`;

  return (
    <div className={classes.container}>
      <div className={classes.containerItem}>
        {/* Header */}
        <Card className={classes.card}>
          <CardHeader
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                <DocumentSearch24Regular />
                <Text weight="semibold" size={500}>ACL Receipt Verification</Text>
              </div>
            }
            description={
              <Text>
                Verify Azure Confidential Ledger receipt matches the data in the ledger by validating the Merkle tree proof.
              </Text>
            }
            />
        </Card>

        {/* Input Section */}
        <Card className={classes.card}>
          <CardHeader
            header={<Text weight="semibold">Receipt Input</Text>}
          />
          <CardPreview>
            <div className={classes.inputSection}>
              <Field
                label="Write Receipt JSON"
                hint="Paste the complete write receipt JSON here"
              >
                <Textarea
                  value={receiptText}
                  onChange={(_, data) => setReceiptText(data.value)}
                  placeholder={`Paste your receipt JSON here or try this example:\\n\\n${exampleReceipt}`}
                  rows={8}
                  style={{ fontFamily: tokens.fontFamilyMonospace, width: '100%' }}
                />
              </Field>

              <Field
                label="Network Certificate"
                hint="Paste the network certificate (PEM format)"
              >
                <Textarea
                  value={networkCertText}
                  onChange={(_, data) => setNetworkCertText(data.value)}
                  placeholder="-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----"
                  rows={8}
                  style={{ fontFamily: tokens.fontFamilyMonospace, width: '100%' }}
                />
              </Field>

              {parseError && (
                <MessageBar intent="error">
                  <MessageBarBody>{parseError}</MessageBarBody>
                </MessageBar>
              )}

              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>Verification Error: {error}</MessageBarBody>
                </MessageBar>
              )}
            </div>
          </CardPreview>
          <CardFooter>
            <Button
              appearance="primary"
              icon={<DocumentSearch24Regular />}
              onClick={parseReceipt}
              disabled={!receiptText.trim()}
            >
              Parse & Verify Receipt
            </Button>

            <Button
              appearance="secondary"
              onClick={clearAll}
            >
              Clear All
            </Button>

            {isLoading && <Spinner size="tiny" />}
          </CardFooter>
        </Card>

        {/* Results Section */}
        {parsedReceipt && (
          <Card className={classes.card}>
            <CardHeader
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                  <Certificate24Regular />
                  <Text weight="semibold">Verification Results</Text>
                  {verificationResult && getStatusIcon(verificationResult.isValid, verificationResult.isCompleted)}
                </div>
              }
            />
            <CardPreview>
              <div className={classes.resultsSection}>
                {verificationResult && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
                      <Text weight="semibold">Status:</Text>
                      {getStatusBadge(verificationResult.isValid, verificationResult.isCompleted)}
                    </div>

                    <div className={classes.resultGrid}>
                      <Card className={classes.resultCard}>
                        <Text weight="semibold" block>Transaction Digest</Text>
                        <div className={classes.hashText}>
                          {verificationResult.txDigest || 'Not calculated'}
                        </div>
                      </Card>

                      <Card className={classes.resultCard}>
                        <Text weight="semibold" block>Calculated Root</Text>
                        <div className={classes.hashText}>
                          {verificationResult.calculatedRoot || 'Not calculated'}
                        </div>
                      </Card>

                      <Card className={classes.resultCard}>
                        <Text weight="semibold" block>Merkle Path Length</Text>
                        <Text size={400}>{verificationResult.merklePath.length} steps</Text>
                      </Card>

                      <Card className={classes.resultCard}>
                        <Text weight="semibold" block>Root Match</Text>
                        <Badge style={{ 
                          color: verificationResult.rootsMatch 
                            ? tokens.colorPaletteGreenForeground1 
                            : tokens.colorPaletteRedForeground1 
                        }}>
                          {verificationResult.rootsMatch ? 'MATCH' : 'NO MATCH'}
                        </Badge>
                      </Card>

                      {verificationResult.ledgerComparison && (
                        <Card className={classes.resultCard}>
                          <Text weight="semibold" block>Ledger Status</Text>
                          <Badge style={{ 
                            color: verificationResult.ledgerComparison.foundInLedger 
                              ? tokens.colorPaletteGreenForeground1 
                              : tokens.colorPaletteRedForeground1 
                          }}>
                            {verificationResult.ledgerComparison.foundInLedger ? 'FOUND' : 'NOT FOUND'}
                          </Badge>
                        </Card>
                      )}
                    </div>

                    {verificationResult.merklePath.length > 0 && (
                      <div>
                        <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalS }}>
                          Merkle Path
                        </Text>
                        {verificationResult.merklePath.map((hash, index) => (
                          <div key={index} style={{ marginBottom: tokens.spacingVerticalXS }}>
                            <Text size={300}>Step {index + 1}:</Text>
                            <div className={classes.hashText}>{hash}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!verificationResult.isValid && verificationResult.isCompleted && (
                      <MessageBar intent="warning">
                        <MessageBarBody>
                          The receipt verification failed. This could mean the receipt is invalid, 
                          the network certificate is incorrect, or the transaction was not properly recorded.
                        </MessageBarBody>
                      </MessageBar>
                    )}

                    {verificationResult.isValid && verificationResult.isCompleted && (
                      <MessageBar intent="success">
                        <MessageBarBody>
                          The receipt is cryptographically valid! The Merkle proof successfully validates 
                          the transaction against the provided certificate.
                        </MessageBarBody>
                      </MessageBar>
                    )}
                  </>
                )}
              </div>
            </CardPreview>
          </Card>
        )}
      </div>
    </div>
  );
};