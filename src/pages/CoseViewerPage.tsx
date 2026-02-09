/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Text,
  MessageBar,
  MessageBarBody,
  Field,
  makeStyles,
  tokens,
  Spinner,
  Caption1,
  Link,
} from '@fluentui/react-components';
import {
  ArrowUpload24Regular,
  Dismiss24Regular,
  DocumentSearch24Regular,
  Copy24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { cborArrayToText } from '@microsoft/ccf-ledger-parser';

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
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    '@media (max-width: 768px)': {
      padding: tokens.spacingVerticalL,
    },
    '@media (max-width: 480px)': {
      padding: tokens.spacingVerticalM,
    },
  },
  card: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  headerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
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
    border: `2px dashed ${tokens.colorBrandForeground1}`,
    backgroundColor: tokens.colorNeutralBackground2Hover,
  },
  fileUploadCardActive: {
    border: `2px dashed ${tokens.colorBrandForeground1}`,
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
    color: tokens.colorBrandForeground1,
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
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  hiddenInput: {
    display: 'none',
  },
  outputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  outputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputContainer: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    overflow: 'auto',
    maxHeight: '600px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  outputText: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
  },
  infoList: {
    marginTop: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
  },
  infoListItem: {
    marginBottom: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground2,
  },
  spinnerContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalL,
  },
  link: {
    color: tokens.colorBrandForeground1,
  },
});

export const CoseViewerPage: React.FC = () => {
  const styles = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setOutput(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const result = cborArrayToText(uint8Array);
      setOutput(result);
    } catch (err) {
      setError(`Error parsing CBOR/COSE: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      processFile(file);
    }
  }, [processFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setOutput(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleCopyOutput = useCallback(async () => {
    if (output) {
      try {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, [output]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.headerSection}>
          <Text size={600} weight="semibold">COSE/CBOR Viewer</Text>
          <Text size={300}>
            Upload a CBOR or COSE file to view its decoded contents with pretty-printed IANA names.
          </Text>
        </div>

        <Card className={styles.card}>
          <CardHeader
            header={
              <Text weight="semibold">
                <DocumentSearch24Regular style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Load CBOR/COSE File
              </Text>
            }
          />
          
          <Field style={{ padding: tokens.spacingVerticalM }}>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className={styles.hiddenInput}
              accept=".cbor,.cose,.bin,*/*"
            />
            
            {!selectedFile ? (
              <div
                className={`${styles.fileUploadCard} ${isDragOver ? styles.fileUploadCardHover : ''}`}
                onClick={handleUploadClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleUploadClick()}
              >
                <div className={styles.fileUploadContent}>
                  <ArrowUpload24Regular className={styles.uploadIcon} />
                  <Text weight="semibold">Click to upload or drag and drop</Text>
                  <Caption1>CBOR/COSE files supported</Caption1>
                </div>
              </div>
            ) : (
              <div className={styles.fileSelectedCard}>
                <div className={styles.fileInfo}>
                  <DocumentSearch24Regular />
                  <Text className={styles.fileName}>{selectedFile.name}</Text>
                  <Caption1>({(selectedFile.size / 1024).toFixed(2)} KB)</Caption1>
                </div>
                <Button
                  appearance="subtle"
                  icon={<Dismiss24Regular />}
                  onClick={handleClearFile}
                  title="Clear file"
                />
              </div>
            )}
          </Field>
        </Card>

        {isProcessing && (
          <div className={styles.spinnerContainer}>
            <Spinner label="Processing file..." />
          </div>
        )}

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {output && (
          <Card className={styles.card}>
            <CardHeader
              header={
                <div className={styles.outputHeader}>
                  <Text weight="semibold">Decoded Output</Text>
                  <Button
                    appearance="subtle"
                    icon={copied ? <Checkmark24Regular /> : <Copy24Regular />}
                    onClick={handleCopyOutput}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              }
            />
            <div className={styles.outputSection} style={{ padding: tokens.spacingVerticalM }}>
              <div className={styles.outputContainer}>
                <pre className={styles.outputText}>{output}</pre>
              </div>
            </div>
          </Card>
        )}

        <Card className={styles.card}>
          <CardHeader
            header={<Text weight="semibold">About this viewer</Text>}
          />
          <ul className={styles.infoList}>
            <li className={styles.infoListItem}>
              If the file is a COSE message (tagged/untagged), its parts will be parsed separately: protected, unprotected, payload, signature.
            </li>
            <li className={styles.infoListItem}>
              If the file is CBOR, it will go through a generic pretty print CBOR function.
            </li>
            <li className={styles.infoListItem}>
              COSE header keys get converted to IANA names. See{' '}
              <Link href="https://www.iana.org/assignments/cose/cose.xhtml" target="_blank" className={styles.link}>
                IANA COSE registry
              </Link>.
            </li>
            <li className={styles.infoListItem}>
              COSE algorithms are also pretty printed using IANA names.
            </li>
            <li className={styles.infoListItem}>
              COSE CWT header value keys get pretty printed using IANA. See{' '}
              <Link href="https://www.iana.org/assignments/cwt/cwt.xhtml" target="_blank" className={styles.link}>
                IANA CWT registry
              </Link>.
            </li>
            <li className={styles.infoListItem}>
              COSE KEY keys are converted using IANA names. See{' '}
              <Link href="https://www.ietf.org/rfc/rfc9679.html" target="_blank" className={styles.link}>
                RFC 9679
              </Link>.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default CoseViewerPage;
