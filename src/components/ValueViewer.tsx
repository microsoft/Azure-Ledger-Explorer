import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import {
  makeStyles,
  tokens,
  Dropdown,
  Option,
  Text,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '500px', // Fixed height to ensure proper Monaco Editor sizing
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0, // Prevent header from shrinking
  },
  keyInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  editorContainer: {
    flex: 1,
    height: '100%', // Take remaining height
    overflow: 'hidden',
  },
  keyLabel: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

export type ContentType = 'javascript' | 'json' | 'x509' | 'raw' | 'auto';

interface ValueViewerProps {
  keyName: string;
  value: Uint8Array;
  tableName?: string;
}

// Table name to content type mapping
const TABLE_CONTENT_TYPE_MAP: Record<string, ContentType> = {
  // JavaScript/TypeScript related tables
  'public:ccf.governance.modules': 'javascript',
  'public:ccf.governance.js_modules': 'javascript',
  'public:ccf.governance.constitution': 'javascript',
  'public:ccf.gov.modules': 'javascript',
  'public:ccf.gov.js_modules': 'javascript',
  'public:ccf.gov.constitution': 'javascript',
  
  // Certificate related tables
  'public:ccf.nodes.info': 'x509',
  'public:ccf.gov.tls_ca_cert_bundles': 'x509',
  'public:ccf.gov.service_certificate': 'x509',
  'public:ccf.gov.network_cert': 'x509',
  'public:ccf.nodes.endorsed_certificates': 'x509',
  'public:ccf.nodes.self_signed_node_certificate': 'x509',
  
  // JSON configuration tables
  'public:ccf.governance.service_config': 'json',
  'public:ccf.governance.jwt_issuers': 'json',
  'public:ccf.governance.recovery_shares': 'json',
  'public:ccf.gov.service_configuration': 'json',
  'public:ccf.gov.jwt_issuers': 'json',
  'public:ccf.gov.jwt_public_signing_keys': 'json',
  'public:ccf.gov.jwt_public_signing_key_issuer': 'json',
  'public:ccf.gov.nodes.info': 'json',
  'public:ccf.gov.users.info': 'json',
  'public:ccf.gov.members.info': 'json',
  'public:ccf.gov.service_info': 'json',
  'public:ccf.internal.nodes': 'json',
  'public:ccf.internal.consensus': 'json',
  
  // Add more mappings as needed
};

export const ValueViewer: React.FC<ValueViewerProps> = ({ keyName, value, tableName }) => {
  const styles = useStyles();
  const [contentType, setContentType] = useState<ContentType>('auto');
  const [displayContent, setDisplayContent] = useState<string>('');
  const [editorLanguage, setEditorLanguage] = useState<string>('plaintext');
  
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

  const detectContentType = (data: Uint8Array, tableName?: string): ContentType => {
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
  };

  const formatContent = useCallback((data: Uint8Array, type: ContentType): { content: string; language: string } => {
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
      
      case 'auto': {
        const autoType = detectContentType(data, tableName);
        return formatContent(data, autoType);
      }
      
      default: {
        return { content: formatHex(data), language: 'plaintext' };
      }
    }
  }, [tableName]);

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

  useEffect(() => {
    const { content, language } = formatContent(value, contentType);
    setDisplayContent(content);
    setEditorLanguage(language);
  }, [value, contentType, tableName, formatContent]);

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
            <Option value="javascript">JavaScript</Option>
            <Option value="json">JSON</Option>
            <Option value="x509">X.509 Certificate</Option>
            <Option value="raw">Raw/Hex</Option>
          </Dropdown>
        </div>
      </div>
      
      <div className={styles.editorContainer}>
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
      </div>
    </div>
  );
};
