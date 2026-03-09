/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import {
  makeStyles,
  tokens,
  Dropdown,
  Option,
  Text,
} from '@fluentui/react-components';

import {
  computeCcfInternalTreeRoot,
  decodeCcfInternalTree,
  formatCcfInternalTreeSummary,
  extractCoseSignatureTimeFromCcfValue,
  CCF_GOV_TABLES,
  CCF_INTERNAL_TABLES,
  CCF_LEGACY_TABLES,
  SCITT_TABLES,
} from '@microsoft/ccf-ledger-parser';

import { MerkleTreeGraph } from './MerkleTreeGraph';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '500px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS + ' ' + tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  keyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  editorContainer: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
  keyLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    padding: tokens.spacingVerticalXXS + ' ' + tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
  },
});

export type ContentType = 'javascript' | 'json' | 'x509' | 'raw' | 'merkletree' | 'cose' | 'auto';

interface ValueViewerProps {
  keyName: string;
  value: Uint8Array;
  tableName?: string;
}

// Table name to content type mapping
const TABLE_CONTENT_TYPE_MAP: Record<string, ContentType> = {
  // JavaScript/TypeScript related tables
  [CCF_LEGACY_TABLES.GOVERNANCE_MODULES]: 'javascript',
  [CCF_LEGACY_TABLES.GOVERNANCE_JS_MODULES]: 'javascript',
  [CCF_LEGACY_TABLES.GOVERNANCE_CONSTITUTION]: 'javascript',
  [CCF_GOV_TABLES.MODULES]: 'javascript',
  [CCF_LEGACY_TABLES.GOV_JS_MODULES]: 'javascript',
  [CCF_GOV_TABLES.CONSTITUTION]: 'javascript',
  
  // Certificate related tables
  [CCF_LEGACY_TABLES.NODES_INFO]: 'x509',
  [CCF_LEGACY_TABLES.GOV_TLS_CA_CERT_BUNDLES]: 'x509',
  [CCF_LEGACY_TABLES.GOV_SERVICE_CERTIFICATE]: 'x509',
  [CCF_LEGACY_TABLES.GOV_NETWORK_CERT]: 'x509',
  [CCF_LEGACY_TABLES.NODES_ENDORSED_CERTIFICATES]: 'x509',
  [CCF_LEGACY_TABLES.NODES_SELF_SIGNED_NODE_CERTIFICATE]: 'x509',
  
  // JSON configuration tables
  [CCF_LEGACY_TABLES.GOVERNANCE_SERVICE_CONFIG]: 'json',
  [CCF_LEGACY_TABLES.GOVERNANCE_JWT_ISSUERS]: 'json',
  [CCF_LEGACY_TABLES.GOVERNANCE_RECOVERY_SHARES]: 'json',
  [CCF_LEGACY_TABLES.GOV_SERVICE_CONFIGURATION]: 'json',
  [CCF_LEGACY_TABLES.GOV_JWT_ISSUERS]: 'json',
  [CCF_LEGACY_TABLES.GOV_JWT_PUBLIC_SIGNING_KEYS]: 'json',
  [CCF_LEGACY_TABLES.GOV_JWT_PUBLIC_SIGNING_KEY_ISSUER]: 'json',
  [CCF_GOV_TABLES.NODES_INFO]: 'json',
  [CCF_GOV_TABLES.USERS_INFO]: 'json',
  [CCF_GOV_TABLES.MEMBERS_INFO]: 'json',
  [CCF_LEGACY_TABLES.GOV_SERVICE_INFO]: 'json',
  [CCF_LEGACY_TABLES.INTERNAL_NODES]: 'json',
  [CCF_LEGACY_TABLES.INTERNAL_CONSENSUS]: 'json',

  // CCF internal merkle tree
  [CCF_INTERNAL_TABLES.TREE]: 'merkletree',

  // COSE Sign1 CBOR entries
  [SCITT_TABLES.ENTRY]: 'cose',
  [CCF_GOV_TABLES.COSE_HISTORY]: 'cose',
};

const CCF_INTERNAL_TREE_TABLE = CCF_INTERNAL_TABLES.TREE;
const CCF_COSE_SIGNATURES_TABLE = CCF_INTERNAL_TABLES.COSE_SIGNATURES;

export const ValueViewer: React.FC<ValueViewerProps> = ({ keyName, value, tableName }) => {
  const styles = useStyles();
  const [contentType, setContentType] = useState<ContentType>('auto');
  const [displayContent, setDisplayContent] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('plaintext');
  const [coseSignatureTime, setCoseSignatureTime] = useState<string | null>(null);
  const [coseSignatureBase64, setCoseSignatureBase64] = useState<string | null>(null);
  
  // Detect current theme - check if dark mode is active
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const savedTheme = localStorage.getItem('ccf-visualizer-theme');
    return savedTheme === 'dark';
  });

  // Listen for theme changes
  useEffect(() => {
    const handleStorageChange = () => {
      const savedTheme = localStorage.getItem('ccf-visualizer-theme');
      setIsDarkTheme(savedTheme === 'dark');
    };

    // Listen for storage changes (when theme is changed in another tab/component)
    window.addEventListener('storage', handleStorageChange);
    
    // Also check for changes in the same tab
    const checkTheme = () => {
      const savedTheme = localStorage.getItem('ccf-visualizer-theme');
      setIsDarkTheme(savedTheme === 'dark');
    };
    
    const intervalId = setInterval(checkTheme, 1000); // Check every second
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  const detectContentType = useCallback((data: Uint8Array, tableName?: string): ContentType => {
    // First check table mapping
    if (tableName && TABLE_CONTENT_TYPE_MAP[tableName]) {
      return TABLE_CONTENT_TYPE_MAP[tableName];
    }

    // Check for partial matches in table name
    if (tableName) {
      if (tableName.includes('modules') || tableName.includes('constitution')) {
        return 'javascript';
      }
      if (tableName.includes('cert') || tableName.includes('certificate') || tableName.includes('ca_bundle')) {
        return 'x509';
      }
      if (tableName.includes('config') || tableName.includes('jwt') || tableName.includes('info') || tableName.includes('service')) {
        return 'json';
      }
    }

    // Check for CBOR/COSE data (CBOR tag 18 = COSE_Sign1 starts with 0xD2)
    if (data.length > 2 && data[0] === 0xD2) {
      return 'cose';
    }

    // Try to decode as UTF-8 text for auto-detection
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
      
      // Check for JSON (must come first to avoid false positives)
      try {
        JSON.parse(text);
        return 'json';
      } catch {
        // Not JSON, continue checking
      }

      // Check for X.509 certificate patterns
      if (
        text.includes('-----BEGIN CERTIFICATE-----') ||
        text.includes('-----END CERTIFICATE-----') ||
        text.includes('-----BEGIN PRIVATE KEY-----') ||
        text.includes('-----BEGIN PUBLIC KEY-----') ||
        text.includes('-----BEGIN RSA PRIVATE KEY-----') ||
        text.includes('-----BEGIN EC PRIVATE KEY-----')
      ) {
        return 'x509';
      }

      // Check for JavaScript/TypeScript patterns
      if (
        text.includes('function ') ||
        text.includes('const ') ||
        text.includes('let ') ||
        text.includes('var ') ||
        text.includes('export ') ||
        text.includes('import ') ||
        text.includes('=>') ||
        text.includes('class ') ||
        text.includes('interface ') ||
        text.includes('type ') ||
        text.includes('namespace ')
      ) {
        return 'javascript';
      }

      // Default to raw for other text
      return 'raw';
    } catch {
      // Not valid UTF-8, default to raw
      return 'raw';
    }
  }, []);

  useEffect(() => {
    if (tableName !== CCF_COSE_SIGNATURES_TABLE) {
      setCoseSignatureTime(null);
      setCoseSignatureBase64(null);
      return;
    }

    const extracted = extractCoseSignatureTimeFromCcfValue(value);
    if (!extracted) {
      // Still try to show the raw base64 if it's JSON-encoded without a valid timestamp.
      try {
        const valueText = new TextDecoder('utf-8', { fatal: false }).decode(value).trim();
        const parsed = valueText.startsWith('"') ? (JSON.parse(valueText) as unknown) : valueText;
        setCoseSignatureBase64(typeof parsed === 'string' ? parsed : null);
      } catch {
        setCoseSignatureBase64(null);
      }
      setCoseSignatureTime(null);
      return;
    }

    setCoseSignatureTime(extracted.isoTime);
    setCoseSignatureBase64(extracted.base64);
  }, [tableName, value]);

  const formatContent = useCallback((data: Uint8Array, type: ContentType): { content: string; language: string } => {
    if (tableName === CCF_COSE_SIGNATURES_TABLE) {
      const base64 = coseSignatureBase64;
      const ts = coseSignatureTime;
      if (base64) {
        return {
          content: `${ts ? `[${ts}] ` : ''}${base64}`,
          language: 'plaintext',
        };
      }
    }

    switch (type) {
      case 'javascript': {
        try {
          let text = new TextDecoder('utf-8').decode(data);
          
          // Remove surrounding double quotes if the entire content is wrapped in quotes
          if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
            text = text.slice(1, -1);
          }
          
          // Replace escaped newlines with actual newlines for better formatting
          text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
          return { content: text, language: 'javascript' };
        } catch {
          return { content: formatHex(data), language: 'plaintext' };
        }
      }
      
      case 'json': {
        try {
          let text = new TextDecoder('utf-8').decode(data);
          
          // Remove surrounding double quotes if the entire content is wrapped in quotes
          if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
            text = text.slice(1, -1);
            // Unescape any escaped quotes within the JSON string
            text = text.replace(/\\"/g, '"');
          }
          
          const parsed = JSON.parse(text);
          return { content: JSON.stringify(parsed, null, 2), language: 'json' };
        } catch {
          return { content: formatHex(data), language: 'plaintext' };
        }
      }
      
      case 'x509': {
        try {
          const text = new TextDecoder('utf-8').decode(data);
          return { content: decodeCertificate(text), language: 'plaintext' };
        } catch {
          return { content: formatHex(data), language: 'plaintext' };
        }
      }
      
      case 'raw': {
        return { content: formatHex(data), language: 'plaintext' };
      }
      
      case 'cose': {
        // For scitt_entry and cose_history tables, the data is already decoded
        // to JSON text in the DB (via DecodeCborTables). Just display it directly.
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
          const parsed = JSON.parse(text);
          return { content: JSON.stringify(parsed, null, 2), language: 'json' };
        } catch {
          // Fallback to hex if not valid JSON
          return { content: formatHex(data), language: 'plaintext' };
        }
      }

      case 'auto': {
        const autoType = detectContentType(data, tableName);
        return formatContent(data, autoType);
      }

      case 'merkletree': {
        // Graphical renderer handles this outside Monaco.
        // Provide a small placeholder if forced through formatter.
        return { content: 'Merkle tree viewer', language: 'plaintext' };
      }
      
      default: {
        return { content: formatHex(data), language: 'plaintext' };
      }
    }
  }, [tableName, detectContentType, coseSignatureBase64, coseSignatureTime]);

  const formatHex = (data: Uint8Array): string => {
    if (!data || data.length === 0) return '';
    
    const hexLines: string[] = [];
    const bytesPerLine = 16;
    
    for (let i = 0; i < data.length; i += bytesPerLine) {
      const chunk = data.slice(i, i + bytesPerLine);
      const hex = Array.from(chunk)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      
      const ascii = Array.from(chunk)
        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
        .join('');
      
      const offset = i.toString(16).padStart(8, '0').toUpperCase();
      hexLines.push(`${offset}  ${hex.padEnd(47, ' ')}  |${ascii}|`);
    }
    
    // Add header for better readability
    hexLines.unshift('Offset    Hex                                          ASCII');
    hexLines.unshift('========  ===============================================  ================');
    
    return hexLines.join('\n');
  };

  const decodeCertificate = (certText: string): string => {
    // Basic certificate info extraction
    // In a real implementation, you might want to use a proper certificate parsing library
    const lines = [
      '=== X.509 Certificate Information ===',
      '',
    ];
    
    // Try to extract some basic info if it's a PEM format
    if (certText.includes('-----BEGIN CERTIFICATE-----')) {
      lines.push('Format: PEM Certificate');
      
      // Extract the base64 part
      const base64Match = certText.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/);
      if (base64Match) {
        const base64Content = base64Match[1].replace(/\s/g, '');
        lines.push(`Base64 Length: ${base64Content.length} characters`);
        
        try {
          // Decode base64 to get DER bytes
          const binaryString = atob(base64Content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          lines.push(`DER Size: ${bytes.length} bytes`);
        } catch {
          lines.push('Error: Invalid base64 encoding');
        }
      }
    } else if (certText.includes('-----BEGIN PRIVATE KEY-----')) {
      lines.push('Format: PEM Private Key (PKCS#8)');
    } else if (certText.includes('-----BEGIN PUBLIC KEY-----')) {
      lines.push('Format: PEM Public Key');
    } else if (certText.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      lines.push('Format: PEM RSA Private Key (PKCS#1)');
    } else if (certText.includes('-----BEGIN EC PRIVATE KEY-----')) {
      lines.push('Format: PEM EC Private Key');
    } else {
      lines.push('Format: Unknown/DER (binary certificate data)');
    }
    
    lines.push('');
    lines.push('=== Raw Certificate Data ===');
    lines.push('');
    lines.push(certText);
    lines.push('');
    lines.push('=== Certificate Analysis ===');
    lines.push('Note: This is a basic display. For full certificate parsing,');
    lines.push('a dedicated X.509 library would be recommended.');
    lines.push('You can use tools like openssl to decode this certificate:');
    lines.push('  openssl x509 -in cert.pem -text -noout');
    
    return lines.join('\n');
  };

  const effectiveContentType: ContentType =
    contentType === 'auto' ? detectContentType(value, tableName) : contentType;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (effectiveContentType === 'merkletree' && tableName === CCF_INTERNAL_TREE_TABLE) {
        try {
          const decoded = decodeCcfInternalTree(value);
          const root = await computeCcfInternalTreeRoot(decoded);
          const summary = formatCcfInternalTreeSummary(decoded, root);
          if (!cancelled) {
            setDisplayContent(summary);
            setEditorLanguage('plaintext');
          }
        } catch (e) {
          if (!cancelled) {
            setDisplayContent(String(e));
            setEditorLanguage('plaintext');
          }
        }
        return;
      }

      const { content, language } = formatContent(value, contentType);
      if (!cancelled) {
        setDisplayContent(content);
        setEditorLanguage(language);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [value, contentType, tableName, formatContent, effectiveContentType]);

  const handleContentTypeChange = (_event: unknown, data: { optionValue?: string }) => {
    if (data.optionValue) {
      setContentType(data.optionValue as ContentType);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.keyInfo}>
          <Text className={styles.keyLabel}>Key: {keyName}</Text>
          <Text style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
            Size: {value.length} bytes
            {tableName && ` • Table: ${tableName}`}
          </Text>
          {tableName === CCF_COSE_SIGNATURES_TABLE && coseSignatureTime && (
            <Text style={{ fontSize: '11px', color: tokens.colorNeutralForeground3, fontFamily: tokens.fontFamilyMonospace }}>
              Time: [{coseSignatureTime}]
            </Text>
          )}
        </div>
        <div className={styles.controls}>
          <Text style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
            View as:
          </Text>
          <Dropdown
            placeholder="Content Type"
            value={contentType}
            onOptionSelect={handleContentTypeChange}
            size="small"
          >
            <Option value="auto">Auto Detect</Option>
            <Option value="cose">COSE / CBOR</Option>
            <Option value="merkletree">Merkle Tree</Option>
            <Option value="javascript">JavaScript</Option>
            <Option value="json">JSON</Option>
            <Option value="x509">X.509 Certificate</Option>
            <Option value="raw">Raw/Hex</Option>
          </Dropdown>
        </div>
      </div>
      
      <div className={styles.editorContainer}>
        {effectiveContentType === 'merkletree' && tableName === CCF_INTERNAL_TREE_TABLE ? (
          <MerkleTreeGraph value={value} />
        ) : (
          <Editor
            height="100%"
            language={editorLanguage}
            value={displayContent}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              fontSize: 12,
              fontFamily: 'Consolas, "Courier New", monospace',
            }}
            theme={isDarkTheme ? "vs-dark" : "vs"}
          />
        )}
      </div>
    </div>
  );
};
