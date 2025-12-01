/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useCallback, useRef } from 'react';
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
  makeStyles,
  tokens,
  Spinner,
  CardFooter,
  Caption1,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel
} from '@fluentui/react-components';
import {
  DocumentSearch24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  Info24Regular,
  Certificate24Regular,
  ArrowUpload24Regular,
  Dismiss24Regular
} from '@fluentui/react-icons';
import { useWriteReceiptVerification } from '../hooks/write-receipt-verification';
import type { WriteReceipt } from '../types/write-receipt-types';
import { ERROR_MESSAGES, CONTENT_TEXT } from './WriteReceiptVerificationComponent.constants';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    overflow: 'hidden',
    height: '100%',
    flexDirection: 'column',
  },
  containerItem: {
    flex: 1,
    overflow: 'auto',
    height: '100%',
    minHeight: 0,
    paddingBottom: '50px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  card: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    width: '100%',
    padding: tokens.spacingVerticalM,
    boxSizing: 'border-box',
  },
  resultsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    width: '100%',
    boxSizing: 'border-box',
  },
  statusBadge: {
    minWidth: '60px',
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalM,
    width: '100%',
    boxSizing: 'border-box',
  },
  resultCard: {
    padding: tokens.spacingVerticalM,
    boxSizing: 'border-box',
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
  fileUploadCard: {
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  fileUploadCardHover: {
    border: `2px dashed #0078D4`,
    backgroundColor: tokens.colorNeutralBackground2Hover,
  },
  fileUploadCardActive: {
    border: `2px dashed #0078D4`,
    backgroundColor: 'rgba(0,120,212,0.08)',
  },
  fileUploadContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
  },
  uploadIcon: {
    fontSize: '32px',
    color: '#0078D4',
  },
  fileSelectedCard: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    boxSizing: 'border-box',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  hiddenInput: {
    display: 'none',
  },
});

export const WriteReceiptVerificationComponent: React.FC = () => {
  const classes = useStyles();
  const [receiptText, setReceiptText] = useState('');
  const [networkCertText, setNetworkCertText] = useState('');
  const [parsedReceipt, setParsedReceipt] = useState<WriteReceipt | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // File upload state
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState<string | null>(null);
  const [isDraggingReceipt, setIsDraggingReceipt] = useState(false);
  const [isDraggingCert, setIsDraggingCert] = useState(false);
  
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

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
    setReceiptFileName(null);
    setCertFileName(null);
  }, []);
  
  // File upload handlers
  const handleReceiptFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setParseError(ERROR_MESSAGES.INVALID_JSON_FILE);
      return;
    }
    
    try {
      const text = await file.text();
      setReceiptText(text);
      setReceiptFileName(file.name);
      setParseError(null);
    } catch {
      setParseError(ERROR_MESSAGES.FAILED_READ_RECEIPT);
    }
  }, []);
  
  const handleCertFileSelect = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setNetworkCertText(text);
      setCertFileName(file.name);
    } catch {
      setParseError(ERROR_MESSAGES.FAILED_READ_CERTIFICATE);
    }
  }, []);
  
  const handleReceiptInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleReceiptFileSelect(file);
    }
  }, [handleReceiptFileSelect]);
  
  const handleCertInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleCertFileSelect(file);
    }
  }, [handleCertFileSelect]);
  
  const handleReceiptDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingReceipt(true);
  }, []);
  
  const handleReceiptDragLeave = useCallback(() => {
    setIsDraggingReceipt(false);
  }, []);
  
  const handleReceiptDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingReceipt(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleReceiptFileSelect(file);
    }
  }, [handleReceiptFileSelect]);
  
  const handleCertDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCert(true);
  }, []);
  
  const handleCertDragLeave = useCallback(() => {
    setIsDraggingCert(false);
  }, []);
  
  const handleCertDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCert(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleCertFileSelect(file);
    }
  }, [handleCertFileSelect]);

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

        {/* Scope Clarification Banner */}
        <MessageBar intent="info" role="status" icon={<Info24Regular />}>
          <MessageBarBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
                <Text weight="semibold">ACL Receipt Verification</Text>
              </div>
              <Text>
                {CONTENT_TEXT.ACL_VERIFICATION_DESCRIPTION.split('Azure Confidential Ledger (ACL)')[0]}
                <strong>Azure Confidential Ledger (ACL)</strong>
                {CONTENT_TEXT.ACL_VERIFICATION_DESCRIPTION.split('Azure Confidential Ledger (ACL)')[1]}
              </Text>
            </div>
          </MessageBarBody>
        </MessageBar>

        {/* Prerequisites and Instructions */}
        <Card className={classes.card}>
          <Accordion collapsible>
            <AccordionItem value="instructions">
              <AccordionHeader>
                <Text weight="semibold">How to obtain verification files</Text>
              </AccordionHeader>
              <AccordionPanel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                  <div>
                    <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                      Prerequisites
                    </Text>
                    <ul style={{ margin: 0, paddingLeft: tokens.spacingHorizontalXL }}>
                      <li>
                        <Text>An active Azure Confidential Ledger resource</Text>
                      </li>
                      <li>
                        <Text>Azure CLI or Azure SDK installed and configured</Text>
                      </li>
                      <li>
                        <Text>Appropriate permissions to access the ledger</Text>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                      Step 1: Get the network certificate
                    </Text>
                    <Text block style={{ marginBottom: tokens.spacingVerticalXS }}>
                      Retrieve the service identity certificate for your ledger instance by accessing the identity service URL:
                    </Text>
                    <div style={{
                      backgroundColor: tokens.colorNeutralBackground2,
                      padding: tokens.spacingVerticalM,
                      borderRadius: tokens.borderRadiusMedium,
                      fontFamily: tokens.fontFamilyMonospace,
                      fontSize: tokens.fontSizeBase200,
                      overflowX: 'auto'
                    }}>
                      <Text block style={{ color: tokens.colorNeutralForeground2 }}>
                        # Example URL format:
                      </Text>
                      <Text block>
                        https://identity.confidential-ledger.core.azure.com/ledgerIdentity/YOUR_LEDGER_NAME
                      </Text>
                      <Text block style={{ marginTop: tokens.spacingVerticalS }}>
                        {' '}
                      </Text>
                      <Text block style={{ color: tokens.colorNeutralForeground2 }}>
                        # The response contains the ledgerTlsCertificate field
                      </Text>
                    </div>
                  </div>

                  <div>
                    <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                      Step 2: Get the write receipt
                    </Text>
                    <Text block style={{ marginBottom: tokens.spacingVerticalXS }}>
                      Obtain a receipt for a specific transaction using the transaction ID:
                    </Text>
                    <div style={{
                      backgroundColor: tokens.colorNeutralBackground2,
                      padding: tokens.spacingVerticalM,
                      borderRadius: tokens.borderRadiusMedium,
                      fontFamily: tokens.fontFamilyMonospace,
                      fontSize: tokens.fontSizeBase200,
                      overflowX: 'auto'
                    }}>
                      <Text block style={{ color: tokens.colorNeutralForeground2 }}>
                        # Using Python SDK
                      </Text>
                      <Text block>
                        from azure.confidentialledger import ConfidentialLedgerClient
                      </Text>
                      <Text block>
                        ledger_client = ConfidentialLedgerClient(endpoint="https://your-ledger-name.confidential-ledger.azure.com", ...)
                      </Text>
                      <Text block>
                        receipt = ledger_client.begin_get_receipt(transaction_id="2.40").result()
                      </Text>
                    </div>
                  </div>

                  <div>
                    <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                      Additional resources
                    </Text>
                    <ul style={{ margin: 0, paddingLeft: tokens.spacingHorizontalXL }}>
                      <li>
                        <a 
                          href="https://learn.microsoft.com/en-us/azure/confidential-ledger/quickstart-python" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#0078D4', textDecoration: 'none' }}
                        >
                          Quickstart: Azure Confidential Ledger Python SDK
                        </a>
                      </li>
                      <li>
                        <a 
                          href="https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/confidentialledger/azure-confidentialledger" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#0078D4', textDecoration: 'none' }}
                        >
                          Azure SDK for Python - Confidential Ledger
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
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
                hint="Upload a JSON file containing the receipt or drag and drop"
              >
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept=".json,application/json"
                  className={classes.hiddenInput}
                  onChange={handleReceiptInputChange}
                  aria-label="Upload write receipt JSON file"
                />
                
                {!receiptFileName ? (
                  <div
                    className={`${classes.fileUploadCard} ${isDraggingReceipt ? classes.fileUploadCardActive : ''}`}
                    onClick={() => receiptInputRef.current?.click()}
                    onDragOver={handleReceiptDragOver}
                    onDragLeave={handleReceiptDragLeave}
                    onDrop={handleReceiptDrop}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        receiptInputRef.current?.click();
                      }
                    }}
                  >
                    <div className={classes.fileUploadContent}>
                      <ArrowUpload24Regular className={classes.uploadIcon} />
                      <Text weight="semibold">Drop receipt JSON file here</Text>
                      <Caption1>or click to browse</Caption1>
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        Accepts .json files
                      </Caption1>
                    </div>
                  </div>
                ) : (
                  <div className={classes.fileSelectedCard}>
                    <div className={classes.fileInfo}>
                      <DocumentSearch24Regular style={{ color: '#0078D4' }} />
                      <div>
                        <Text size={300} weight="semibold">{receiptFileName}</Text>
                        <Caption1 style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>
                          Receipt file loaded
                        </Caption1>
                      </div>
                    </div>
                    <Button
                      appearance="subtle"
                      icon={<Dismiss24Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptText('');
                        setReceiptFileName(null);
                        if (receiptInputRef.current) {
                          receiptInputRef.current.value = '';
                        }
                      }}
                      aria-label="Remove receipt file"
                    />
                  </div>
                )}
              </Field>

              <Field
                label="Network Certificate (Optional)"
                hint="Upload a PEM certificate file or drag and drop"
              >
                <input
                  ref={certInputRef}
                  type="file"
                  accept=".pem,.crt,.cer,application/x-pem-file,application/x-x509-ca-cert"
                  className={classes.hiddenInput}
                  onChange={handleCertInputChange}
                  aria-label="Upload network certificate file"
                />
                
                {!certFileName ? (
                  <div
                    className={`${classes.fileUploadCard} ${isDraggingCert ? classes.fileUploadCardActive : ''}`}
                    onClick={() => certInputRef.current?.click()}
                    onDragOver={handleCertDragOver}
                    onDragLeave={handleCertDragLeave}
                    onDrop={handleCertDrop}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        certInputRef.current?.click();
                      }
                    }}
                  >
                    <div className={classes.fileUploadContent}>
                      <ArrowUpload24Regular className={classes.uploadIcon} />
                      <Text weight="semibold">Drop certificate file here</Text>
                      <Caption1>or click to browse</Caption1>
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        Accepts .pem, .crt, .cer files
                      </Caption1>
                    </div>
                  </div>
                ) : (
                  <div className={classes.fileSelectedCard}>
                    <div className={classes.fileInfo}>
                      <Certificate24Regular style={{ color: '#0078D4' }} />
                      <div>
                        <Text size={300} weight="semibold">{certFileName}</Text>
                        <Caption1 style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>
                          Certificate file loaded
                        </Caption1>
                      </div>
                    </div>
                    <Button
                      appearance="subtle"
                      icon={<Dismiss24Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNetworkCertText('');
                        setCertFileName(null);
                        if (certInputRef.current) {
                          certInputRef.current.value = '';
                        }
                      }}
                      aria-label="Remove certificate file"
                    />
                  </div>
                )}
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
                      <MessageBar 
                        intent="error"
                        role="alert"
                      >
                        <MessageBarBody>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS }}>
                            <div>
                              <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                                <ErrorCircle24Regular style={{ 
                                  verticalAlign: 'middle', 
                                  marginRight: tokens.spacingHorizontalXS,
                                  color: tokens.colorPaletteRedForeground1 
                                }} />
                                Receipt Verification Failed
                              </Text>
                              <Text block>
                                The receipt could not be verified successfully. Review the common issues below and try again.
                              </Text>
                            </div>

                            {/* Specific Error Details */}
                            {verificationResult.error && (
                              <div style={{
                                backgroundColor: tokens.colorNeutralBackground2,
                                padding: tokens.spacingVerticalS,
                                borderRadius: tokens.borderRadiusSmall,
                                borderLeft: `4px solid ${tokens.colorPaletteRedBorder1}`
                              }}>
                                <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  Error Details:
                                </Text>
                                <Text block style={{ fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 }}>
                                  {verificationResult.error}
                                </Text>
                              </div>
                            )}

                            {/* Common Issues */}
                            <div>
                              <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                                Common Issues:
                              </Text>
                              <ul style={{ margin: 0, paddingLeft: tokens.spacingHorizontalL }}>
                                {!verificationResult.rootsMatch && (
                                  <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                    <Text>
                                      <strong>Merkle root mismatch:</strong> {CONTENT_TEXT.MERKLE_ROOT_MISMATCH}
                                    </Text>
                                  </li>
                                )}
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Network certificate mismatch:</strong> {CONTENT_TEXT.CERTIFICATE_MISMATCH}
                                  </Text>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Invalid JSON format:</strong> {CONTENT_TEXT.INVALID_JSON_FORMAT}
                                  </Text>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Wrong ledger instance:</strong> {CONTENT_TEXT.WRONG_LEDGER_INSTANCE}
                                  </Text>
                                </li>
                              </ul>
                            </div>

                            {/* Troubleshooting Steps */}
                            <div>
                              <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                                Troubleshooting Steps:
                              </Text>
                              <ol style={{ margin: 0, paddingLeft: tokens.spacingHorizontalL }}>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Re-download the files:</strong> {CONTENT_TEXT.TROUBLESHOOTING_REDOWNLOAD}
                                  </Text>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Verify file integrity:</strong> {CONTENT_TEXT.TROUBLESHOOTING_VERIFY_INTEGRITY}
                                  </Text>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Check transaction ID:</strong> {CONTENT_TEXT.TROUBLESHOOTING_CHECK_TRANSACTION}
                                  </Text>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <Text>
                                    <strong>Review ledger access:</strong> {CONTENT_TEXT.TROUBLESHOOTING_REVIEW_ACCESS}
                                  </Text>
                                </li>
                              </ol>
                            </div>

                            {/* Valid File Format Example */}
                            <div>
                              <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                                Expected Receipt Format:
                              </Text>
                              <div style={{
                                backgroundColor: tokens.colorNeutralBackground2,
                                padding: tokens.spacingVerticalS,
                                borderRadius: tokens.borderRadiusSmall,
                                fontFamily: tokens.fontFamilyMonospace,
                                fontSize: tokens.fontSizeBase200,
                                overflowX: 'auto'
                              }}>
                                <Text block style={{ color: tokens.colorNeutralForeground2 }}>{'{'}</Text>
                                <Text block style={{ paddingLeft: tokens.spacingHorizontalM }}>
                                  "receipt": {'{'} "cert": "...", "leafComponents": {'{'} ... {'}'}, "proof": [...], "signature": "..." {'}'}
                                </Text>
                                <Text block>{'}'}</Text>
                              </div>
                            </div>

                            {/* Help Resources */}
                            <div>
                              <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                                Need More Help?
                              </Text>
                              <ul style={{ margin: 0, paddingLeft: tokens.spacingHorizontalL }}>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <a 
                                    href="https://learn.microsoft.com/en-us/azure/confidential-ledger/verify-write-transaction-receipts" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#0078D4', textDecoration: 'none' }}
                                  >
                                    Azure Confidential Ledger verification documentation
                                  </a>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <a 
                                    href="https://learn.microsoft.com/en-us/azure/confidential-ledger/write-transaction-receipts" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#0078D4', textDecoration: 'none' }}
                                  >
                                    Understanding write transaction receipts
                                  </a>
                                </li>
                                <li style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                  <a 
                                    href="https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/confidentialledger/azure-confidentialledger" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#0078D4', textDecoration: 'none' }}
                                  >
                                    Azure SDK examples and samples
                                  </a>
                                </li>
                                <li>
                                  <Text>
                                    Contact Azure Support if issues persist after following these steps
                                  </Text>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </MessageBarBody>
                      </MessageBar>
                    )}

                    {verificationResult.isValid && verificationResult.isCompleted && (
                      <MessageBar 
                        intent="success"
                        role="status"
                      >
                        <MessageBarBody>
                          <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalXS }}>
                            <Checkmark24Regular style={{ 
                              verticalAlign: 'middle', 
                              marginRight: tokens.spacingHorizontalXS,
                              color: tokens.colorPaletteGreenForeground1 
                            }} />
                            Receipt Successfully Verified
                          </Text>
                          <Text block style={{ marginBottom: tokens.spacingVerticalS }}>
                            The receipt is cryptographically valid. The Merkle proof successfully validates 
                            the transaction against the provided network certificate.
                          </Text>
                          <div style={{ marginTop: tokens.spacingVerticalS }}>
                            <Text block style={{ marginBottom: tokens.spacingVerticalXXS }}>
                              <strong>Node ID:</strong> {parsedReceipt.nodeId}
                            </Text>
                            {verificationResult.ledgerComparison?.transactionId !== undefined && (
                              <Text block style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                <strong>Transaction ID:</strong> {verificationResult.ledgerComparison.transactionId}
                              </Text>
                            )}
                            {verificationResult.merklePath.length > 0 && (
                              <Text block style={{ marginBottom: tokens.spacingVerticalXXS }}>
                                <strong>Proof Steps:</strong> {verificationResult.merklePath.length}
                              </Text>
                            )}
                            <Text block style={{ color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 }}>
                              Verified at {new Date().toLocaleString()}
                            </Text>
                          </div>
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