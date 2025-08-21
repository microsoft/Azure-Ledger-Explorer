import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Spinner,
  Text,
  CompoundButton,
  MessageBar,
  makeStyles,
  tokens,
  shorthands,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Body1,
} from '@fluentui/react-components';
import {
  Send24Regular,
  ChatAddRegular,
  Add24Regular,
  DocumentAdd24Regular,
  DatabaseArrowDownRegular,
  Edit24Regular,
} from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AddFilesWizard } from './AddFilesWizard';
import { CCFDatabase } from '../database/ccf-database';
import { useAllTransactionsCount } from '../hooks/use-ccf-data';
import { useConfig } from '../pages/ConfigPage';
import { useVerification } from '../hooks/use-verification';
import type { WriteReceipt } from '../types/write-receipt-types';

// Direct IndexedDB check function
const checkIndexedDBForCheckpoints = async (): Promise<any[]> => {
  return new Promise((resolve) => {
    const request = indexedDB.open('CCFVerificationCheckpoints', 1);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      resolve([]);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains('checkpoints')) {
        console.log('No checkpoints store found');
        resolve([]);
        return;
      }
      
      const transaction = db.transaction(['checkpoints'], 'readonly');
      const store = transaction.objectStore('checkpoints');
      const getAllRequest = store.getAll();
      
      getAllRequest.onerror = () => {
        console.error('Failed to get checkpoints:', getAllRequest.error);
        resolve([]);
      };
      
      getAllRequest.onsuccess = () => {
        const checkpoints = getAllRequest.result;
        console.log('Direct IndexedDB check found checkpoints:', checkpoints);
        resolve(checkpoints);
      };
    };
  });
};

interface ChatMessage {
  id: string;
  state: 'initial' | 'streaming' | 'finished';
  role: 'user' | 'assistant';
  responseId?: string;
  content: string;
  sqlQuery?: string;
  sqlResult?: unknown[];
  timestamp: Date;
  error?: string;
  // New verification action fields
  verificationAction?: 'ledger' | 'receipt';
  verificationResult?: unknown;
  receiptData?: {
    receipt: WriteReceipt;
    networkCert: string;
  };
}

interface AIChatProps {
  database: CCFDatabase;
  onChatStateChange?: (hasActiveChat: boolean) => void;
  onRegisterClearChat?: (clearFn: (() => void) | null) => void;
  clearChatFunction?: (() => void) | null;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100vh',
    minHeight: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.5s ease-in-out',
  },
  containerWithMessages: {
    display: 'flex',
    height: '100vh',
    minHeight: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    transition: 'all 0.5s ease-in-out',
  },
  sageTitle: {
    fontSize: '48px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    marginBottom: '32px',
    textAlign: 'center',
    opacity: 1,
    transform: 'translateY(0)',
    transition: 'all 0.5s ease-in-out',
  },
  sageTitleHidden: {
    fontSize: '48px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    marginBottom: '32px',
    textAlign: 'center',
    opacity: 0,
    transform: 'translateY(-50px)',
    transition: 'all 0.5s ease-in-out',
    pointerEvents: 'none',
  },
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    maxWidth: '830px',
    height: '100vh',
  },
  chatCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  messagesArea: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    minHeight: '0', // Changed from 100vh to prevent initial page scroll
  },
  messageContainer: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  userMessageContent: {
    maxWidth: '70%',
    minWidth: 0,
  },
  messageBubble: {
    ...shorthands.padding('12px'),
    ...shorthands.borderRadius('8px'),
  },
  userBubble: {
    backgroundColor: tokens.colorNeutralBackground4,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  messageText: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '16px',
  },
  markdownContent: {
    fontSize: '16px',
    lineHeight: '1.5',
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      marginTop: '16px',
      marginBottom: '8px',
      fontWeight: '600',
      color: tokens.colorNeutralForeground1,
    },
    '& h1': { fontSize: '20px' },
    '& h2': { fontSize: '18px' },
    '& h3': { fontSize: '16px' },
    '& p': {
      margin: '8px 0',
      lineHeight: '1.5',
    },
    '& ul, & ol': {
      margin: '8px 0',
      paddingLeft: '24px',
    },
    '& li': {
      margin: '4px 0',
    },
    '& blockquote': {
      margin: '12px 0',
      padding: '8px 16px',
      borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
      backgroundColor: tokens.colorNeutralBackground2,
      fontStyle: 'italic',
    },
    '& code': {
      backgroundColor: tokens.colorNeutralBackground3,
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '14px',
      fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
    },
    '& pre': {
      margin: '12px 0',
      padding: '12px',
      backgroundColor: tokens.colorNeutralBackground6,
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '14px',
      lineHeight: '1.4',
    },
    '& pre code': {
      backgroundColor: 'transparent',
      padding: '0',
    },
    '& a': {
      color: tokens.colorBrandForeground1,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      margin: '12px 0',
    },
    '& th, & td': {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: '8px 12px',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: tokens.colorNeutralBackground2,
      fontWeight: '600',
    },
  },
  sqlSection: {
    ...shorthands.margin('12px', '0', '0', '0'),
  },
  sqlHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorBrandForeground1,
  },
  sqlResultHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorPaletteGreenForeground1,
  },
  sqlQuery: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding('8px'),
    ...shorthands.borderRadius('4px'),
    fontSize: '12px',
    ...shorthands.overflow('auto'),
    ...shorthands.margin('4px', '0'),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
  },
  sqlResult: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    ...shorthands.padding('8px'),
    ...shorthands.borderRadius('4px'),
    fontSize: '12px',
    ...shorthands.overflow('auto'),
    ...shorthands.margin('4px', '0'),
    ...shorthands.border('1px', 'solid', tokens.colorPaletteGreenBorder1),
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
  },
  errorSection: {
    ...shorthands.margin('8px', '0', '0', '0'),
  },
  messageTimestamp: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    ...shorthands.margin('4px', '0', '0', '0'),
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    color: tokens.colorNeutralForeground3,
  },
  errorContainer: {
    ...shorthands.padding('8px', '16px', '0', '16px'),
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 10, // Ensure it appears above other content
  },
  inputArea: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('10px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('0px', 'solid', tokens.colorNeutralStroke2),
    transition: 'all 0.5s ease-in-out',
  },
  inputAreaCentered: {
    position: 'relative',
    bottom: 'auto',
    left: 'auto',
    transform: 'none',
    width: '100%',
    maxWidth: '830px',
    zIndex: 'auto',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('10px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('0px', 'solid', tokens.colorNeutralStroke2),
    transition: 'all 0.5s ease-in-out',
    marginBottom: '24px',
  },

  //ending area
  inputAreaAnimating: {
    position: 'absolute',
    left: 'auto',
    top: '47%',
    bottom: '20px',
    transform: 'translateY(-50%)',
    width: '100%',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('10px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('0px', 'solid', tokens.colorNeutralStroke2),
    transition: 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },

  inputAreaAnimatingToBottom: {
    position: 'fixed', 
    left: 'auto',
    top: 'calc(100vh - 230px)',
    transform: 'translateY(80%)',
    width: '100%',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('10px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('0px', 'solid', tokens.colorNeutralStroke2),
    transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },

  // Reverse animation classes (bottom to center)
  inputAreaAnimatingToCenter: {
    position: 'fixed',
    left: 'auto',
    top: '47%',
    //transform: 'translateY(70%)',
    width: '100%',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('10px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('0px', 'solid', tokens.colorNeutralStroke2),
    transition: 'all .8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },

  inputAreaAnimatingToCenterFinal: {
    position: 'fixed',
    left: 'auto',
    top: '47%',
    bottom: 0,
    transform: 'translateY(-11%)',
    width: '100%',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('10px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderTop('0px', 'solid', tokens.colorNeutralStroke2),
    transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  
  starterTemplates: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    ...shorthands.gap('12px'),
    width: '100%',
    maxWidth: '830px',
    opacity: 1,
    transform: 'translateY(0)',
    transition: 'all 0.5s ease-in-out',
    justifyContent: 'center',
  },
  starterTemplatesHidden: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    ...shorthands.gap('12px'),
    width: '100%',
    maxWidth: '830px',
    opacity: 0,
    transform: 'translateY(50px)',
    transition: 'all 0.5s ease-in-out',
    pointerEvents: 'none',
  },
  chatInputContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
    ...shorthands.padding('10px', '10px', '5px', '10px'),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius('28px'),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    '&:focus-within': {
      ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
    },
  },
  inputTextareaContainer: {
    width: '100%',
    ...shorthands.padding('8px', '20px', '8px', '8px'),
    minHeight: '24px',
  },
  buttonsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    ...shorthands.padding('0px'),
  },
  plusButton: {
    minWidth: '32px',
    height: '32px',
    ...shorthands.borderRadius('50%'),
    backgroundColor: 'transparent',
    ...shorthands.border('none'),
    color: tokens.colorNeutralForeground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2,
      color: tokens.colorNeutralForeground1,
    },
  },
  inputTextarea: {
    flex: 1,
    width: '100%',
    minHeight: '24px',
    maxHeight: '72px', // 3 lines at 24px line height
    ...shorthands.border('none'),
    backgroundColor: 'transparent',
    resize: 'none',
    fontSize: '16px',
    lineHeight: '24px',
    ...shorthands.padding('0'),
    fontFamily: 'inherit',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    overflowY: 'auto',
    '&:focus': {
      outline: 'none',
    },
    '&::placeholder': {
      color: tokens.colorNeutralForeground3,
    },
  },
  sendButton: {
    minWidth: '32px',
    height: '32px',
    ...shorthands.borderRadius('50%'),
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.border('none'),
    color: tokens.colorNeutralForegroundInverted,
    '&:disabled': {
      backgroundColor: tokens.colorNeutralBackground4,
      color: tokens.colorNeutralForeground4,
    },
    '&:hover:not(:disabled)': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  newConversationButton: {
    minWidth: '32px',
    height: '32px',
    ...shorthands.borderRadius('50%'),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    color: tokens.colorNeutralForeground1,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1Hover),
    },
  },
  helpText: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
  },
});

// Custom markdown components for syntax highlighting
const markdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    return !inline && match ? (
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: '12px 0',
          borderRadius: '8px',
          fontSize: '14px',
        }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre({ children }: any) {
    // If the pre contains a code block with syntax highlighting, don't add extra styling
    return <>{children}</>;
  },
};

export const AIChat: React.FC<AIChatProps> = ({ 
  database, 
  onChatStateChange, 
  onRegisterClearChat,
  clearChatFunction 
}) => {
  const styles = useStyles();
  const { config } = useConfig();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const { data: allTransactionsCount } = useAllTransactionsCount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Add state for Plus button dropdown and dialogs
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDropDbDialog, setShowDropDbDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add verification hooks
  const verification = useVerification();
  const hasMessages = messages.length > 0;
  
  // Animation state for input area transition
  const [inputAnimationClass, setInputAnimationClass] = useState('');
  
  // State to control when to show initial UI elements during clear animation
  const [showInitialUI, setShowInitialUI] = useState(true);
  
  // Force refresh checkpoints when component mounts
  useEffect(() => {
    const refreshCheckpointsOnMount = async () => {
      try {
        console.log('AI: Refreshing checkpoints on component mount...');
        await verification.refreshCheckpoints();
        console.log('AI: Mount refresh completed, checkpoints:', verification.checkpoints?.length || 0);
      } catch (error) {
        console.error('AI: Failed to refresh checkpoints on mount:', error);
      }
    };
    
    // Add a small delay to ensure everything is initialized
    setTimeout(refreshCheckpointsOnMount, 1000);
  }, [verification.refreshCheckpoints]);

  useEffect(() => {
    onChatStateChange?.(hasMessages);
  }, [hasMessages, onChatStateChange]);

  // Ensure page starts at the top on initial load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Auto-scroll to always keep the most recent user message at the top of the screen
  useEffect(() => {
    if (messages.length > 0) {
      // Use a small delay to ensure DOM is updated
      setTimeout(() => {
        // Find the most recent user message and keep it at the top
        const userMessages = messages.filter(m => m.role === 'user');
        
        if (userMessages.length > 0) {
          const lastUserMessage = userMessages[userMessages.length - 1];
          const messageElements = document.querySelectorAll('[data-message-role]');
          const userMessageElement = Array.from(messageElements).find(el => 
            el.getAttribute('data-message-id') === lastUserMessage.id
          ) as HTMLElement;
          
          if (userMessageElement) {
            // Always scroll to show the most recent user message at the top
            userMessageElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }
      }, 150); // Slightly longer delay to ensure content is fully rendered
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to calculate scrollHeight properly
      textarea.style.height = '24px'; // 1 line
      
      // Calculate the required height
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24;
      const minHeight = lineHeight; // 1 line
      const maxHeight = lineHeight * 3; // 3 lines
      
      // Set height between min and max, allow scrolling beyond max
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = newHeight + 'px';
      
      // Show scrollbar if content exceeds 3 lines
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [currentMessage]);

  const getSystemPrompt = () => {
    return config.systemPrompt;
  };

  const executeQuery = async (sqlQuery: string): Promise<unknown[]> => {
    try {
      return await database.executeQuery(sqlQuery);
    } catch (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
  };

  const executeLedgerVerification = async (): Promise<unknown> => {
    try {
      console.log('AI: Checking verification status...');
      console.log('AI: verification.isRunning:', verification.isRunning);
      console.log('AI: verification.progress:', verification.progress);
      console.log('AI: verification.checkpoints:', verification.checkpoints);
      console.log('AI: verification.checkpoints.length:', verification.checkpoints?.length || 0);

      // First check if there's an active verification running
      if (verification.isRunning && verification.progress) {
        console.log('AI: Found active verification');
        const isComplete = verification.progress.status === 'completed';
        const hasError = !!verification.error;
        const progress = verification.progress.totalTransactions > 0 
          ? (verification.progress.currentTransaction / verification.progress.totalTransactions) * 100 
          : 0;
        
        return {
          status: verification.progress.status,
          progress: progress,
          currentTransaction: verification.progress.currentTransaction,
          totalTransactions: verification.progress.totalTransactions,
          processedFiles: verification.progress.processedFiles,
          totalFiles: verification.progress.totalFiles,
          currentFileName: verification.progress.currentFileName,
          isComplete,
          isVerified: isComplete && !hasError,
          error: verification.error,
          message: isComplete 
            ? (hasError ? 'Ledger verification failed' : 'Ledger verification completed successfully')
            : `Verification in progress: ${progress.toFixed(1)}% (${verification.progress.currentTransaction}/${verification.progress.totalTransactions} transactions)`
        };
      }

      // Check for any completed checkpoints from previous sessions
      if (verification.checkpoints && verification.checkpoints.length > 0) {
        console.log('AI: Found checkpoints, count:', verification.checkpoints.length);
        console.log('AI: Checkpoints:', verification.checkpoints);
        
        // Find the most recent checkpoint
        const latestCheckpoint = verification.checkpoints
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        console.log('AI: Latest checkpoint:', latestCheckpoint);
        
        if (latestCheckpoint) {
          const isCompleted = latestCheckpoint.status === 'pass';
          const hasError = latestCheckpoint.status === 'fail';
          const isStopped = latestCheckpoint.status === 'stopped';
          
          return {
            status: isCompleted ? 'completed' : hasError ? 'failed' : 'stopped',
            lastVerifiedTransaction: latestCheckpoint.lastVerifiedTransaction,
            totalTransactionsProcessed: latestCheckpoint.totalTransactionsProcessed,
            currentFileIndex: latestCheckpoint.currentFileIndex,
            lastVerifiedFile: latestCheckpoint.lastVerifiedFile,
            isComplete: isCompleted,
            isVerified: isCompleted && !hasError,
            sessionId: latestCheckpoint.id,
            timestamp: new Date(latestCheckpoint.timestamp).toLocaleString(),
            failureDetails: latestCheckpoint.failureDetails,
            message: isCompleted 
              ? 'Ledger verification completed successfully'
              : hasError 
                ? `Ledger verification failed: ${latestCheckpoint.failureDetails?.errorMessage || 'Unknown error'}`
                : isStopped 
                  ? `Verification was stopped after processing ${latestCheckpoint.totalTransactionsProcessed} transactions. Use resume to continue.`
                  : `Previous verification processed ${latestCheckpoint.totalTransactionsProcessed} transactions`,
            debugInfo: {
              checkpointStatus: latestCheckpoint.status,
              checkpointTimestamp: latestCheckpoint.timestamp,
              isCompleted,
              hasError,
              isStopped
            }
          };
        }
      }

      console.log('AI: No verification or checkpoints found');
      
      // No verification found - but let's try to refresh checkpoints and check again
      console.log('AI: Attempting to refresh checkpoints...');
      try {
        await verification.refreshCheckpoints();
        console.log('AI: Checkpoints refreshed, new count:', verification.checkpoints?.length || 0);
        
        if (verification.checkpoints && verification.checkpoints.length > 0) {
          console.log('AI: Found checkpoints after refresh!');
          const latestCheckpoint = verification.checkpoints
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          
          const isCompleted = latestCheckpoint.status === 'pass';
          const hasError = latestCheckpoint.status === 'fail';
          
          return {
            status: isCompleted ? 'completed' : hasError ? 'failed' : 'stopped',
            lastVerifiedTransaction: latestCheckpoint.lastVerifiedTransaction,
            totalTransactionsProcessed: latestCheckpoint.totalTransactionsProcessed,
            message: isCompleted 
              ? 'Ledger verification completed successfully (found after refresh)'
              : hasError 
                ? `Ledger verification failed: ${latestCheckpoint.failureDetails?.errorMessage || 'Unknown error'}`
                : `Verification was stopped after processing ${latestCheckpoint.totalTransactionsProcessed} transactions`,
            refreshedCheckpoints: true
          };
        }
      } catch (refreshError) {
        console.error('AI: Failed to refresh checkpoints:', refreshError);
      }
      
      // Direct IndexedDB check as a last resort
      console.log('AI: Trying direct IndexedDB check...');
      try {
        const directCheckpoints = await checkIndexedDBForCheckpoints();
        console.log('AI: Direct IndexedDB found:', directCheckpoints.length, 'checkpoints');
        
        if (directCheckpoints.length > 0) {
          const latestCheckpoint = directCheckpoints
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          
          console.log('AI: Latest checkpoint from direct check:', latestCheckpoint);
          
          const isCompleted = latestCheckpoint.status === 'pass';
          const hasError = latestCheckpoint.status === 'fail';
          
          return {
            status: isCompleted ? 'completed' : hasError ? 'failed' : 'stopped',
            lastVerifiedTransaction: latestCheckpoint.lastVerifiedTransaction,
            totalTransactionsProcessed: latestCheckpoint.totalTransactionsProcessed,
            message: isCompleted 
              ? 'Ledger verification completed successfully (found via direct IndexedDB check)'
              : hasError 
                ? `Ledger verification failed: ${latestCheckpoint.failureDetails?.errorMessage || 'Unknown error'}`
                : `Verification was stopped after processing ${latestCheckpoint.totalTransactionsProcessed} transactions`,
            foundViaDirectCheck: true,
            hookCheckpointsCount: verification.checkpoints?.length || 0
          };
        }
      } catch (directError) {
        console.error('AI: Direct IndexedDB check failed:', directError);
      }

      return {
        status: 'not_started',
        message: 'No ledger verification has been started. Please start verification manually from the verification page.',
        isRunning: verification.isRunning,
        hasProgress: !!verification.progress,
        availableCheckpoints: verification.checkpoints?.length || 0,
        debugInfo: {
          hookState: {
            isRunning: verification.isRunning,
            hasProgress: !!verification.progress,
            checkpointsLength: verification.checkpoints?.length || 0,
            currentSessionId: verification.currentSessionId
          }
        }
      };
    } catch (error) {
      console.error('Ledger verification error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown verification error',
        message: 'Failed to execute ledger verification'
      };
    }
  };

  const executeReceiptVerification = async (receiptJson?: string, networkCert?: string): Promise<unknown> => {
    try {
      if (!receiptJson || !networkCert) {
        return {
          status: 'error',
          error: 'Both receipt JSON and network certificate are required for verification',
          message: 'Please provide both the write receipt JSON and network certificate'
        };
      }

      // Parse the receipt
      let receipt: WriteReceipt;
      try {
        receipt = JSON.parse(receiptJson);
      } catch (error) {
        return {
          status: 'error',
          error: 'Invalid receipt JSON format',
          message: 'The provided receipt JSON is not valid'
        };
      }

      // For now, return a message that receipt verification needs to be implemented
      // with proper database integration
      return {
        status: 'not_implemented',
        message: 'Receipt verification against ledger database is not yet implemented in the AI assistant. Please use the Write Receipt Verification page for full verification.',
        receiptStructure: {
          cert: !!receipt.cert,
          nodeId: receipt.nodeId,
          signature: !!receipt.signature,
          proof: receipt.proof?.length || 0,
          leafComponents: !!receipt.leafComponents
        }
      };
    } catch (error) {
      console.error('Receipt verification error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown verification error',
        message: 'Failed to execute receipt verification'
      };
    }
  };

  const callOpenAIResponseAPI = async (messages: ChatMessage[], newMessage: string): Promise<Response> => {
    if (!config.baseUrl) {
      throw new Error('Base URL is required to send the request');
    }

    // FIXME: limit the messages to not hit the context limit
    let input = '';
    // collect prior conversations as history for this question
    messages.forEach(m => {
      input += `${m.role} said: ${m.content}\n`;
      if (m.sqlResult) {
        input += `\nSQL Query Result: ${JSON.stringify(m.sqlResult, null, 2)}\n`;
      }
    });

    const previousResponseId = messages.length > 0 ? messages[messages.length - 1].responseId : null;

    input += `User asks: ${newMessage}\n`;

    const response = await fetch(config.baseUrl + '/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stream: true,
        input: input,
        instructions: getSystemPrompt(),
        previous_response_id: previousResponseId,
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    return response;
  };

  const extractSqlQuery = (content: string): string | null => {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
    const query = sqlMatch ? sqlMatch[1].trim() : null;
    
    // Don't treat verification commands as SQL queries
    if (query && (query.includes('VERIFY_LEDGER') || query.includes('VERIFY_RECEIPT'))) {
      return null;
    }
    
    return query;
  };

  const extractVerificationCommand = (content: string): 'ledger' | 'receipt' | null => {
    if (content.includes('VERIFY_LEDGER')) {
      return 'ledger';
    }
    if (content.includes('VERIFY_RECEIPT')) {
      return 'receipt';
    }
    return null;
  };

  const processResponse = async (response: Response) => {
    if (!response.body) {
      throw new Error('Response body is empty');
    }
    // Put blank message which is in progress and periodically update it
    let message: ChatMessage = {
      id: (Date.now() + 1).toString(),
      state: 'streaming',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);

    // Append response to the message as it gets streamed
    // ------------------

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const sseDataPrefix = 'data: ';
    let fullResponseText = '';
    let responseId: string;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
              last.state = 'finished';
            }
            return updated;
          });
          console.log('Stream finished');
          break;
        }
        
        // Handle SSE value
        const chunk = decoder.decode(value);
        // split by new lines
        const lines = chunk.split('\n');

        let textDelta = '';
        for (const line of lines) {
          if (!line.startsWith(sseDataPrefix)) {
            continue;
          }
          const dataString = line.slice(sseDataPrefix.length).trim();
          if (dataString && dataString !== '[DONE]') {
            try {
              const data = JSON.parse(dataString);
              console.log(data.type, data);
              if (data.type === 'response.output_text.delta') {
                textDelta += data.delta || '';
              } else if (data.type === 'response.output_item.added') {
                if (data.item.type === 'mcp_list_tools' || data.item.type === 'message') {
                  continue;
                } else if (data.item.type === 'file_search_call') {
                  textDelta += '\n> Searching for files ...\n\n';
                } else if (data.item.type === 'mcp_call') {
                  textDelta += '\n> Calling: ' + data.item.server_label + ':' + data.item.name + (data.item.arguments ? ' with: ' + JSON.stringify(data.item.arguments) : '') + '\n\n';
                } else {
                  textDelta += '\n> Using: ' + data.item.type + '\n\n';
                }
              } else if (data.type === 'response.completed') {
                responseId = data.response.id;
              }
            } catch (error) {
              console.error('Error parsing SSE data:', dataString, 'error is:', error);
            }
          }
        }
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last) {
            last.content += textDelta;
            fullResponseText += textDelta;
            if (responseId != null) {
              last.responseId = responseId;
            }
          }
          return updated;
        });
      }
    } finally {
      reader.releaseLock();
    }
      
    // Once finished perform other actions
    // ------------------

    // Check if the response contains a SQL query
    const sqlQuery = extractSqlQuery(fullResponseText);
    
    // Check if the response contains a verification command
    const verificationCommand = extractVerificationCommand(fullResponseText);
    
    let sqlResult: unknown[] | undefined;
    let verificationResult: unknown | undefined;
    let executionError: string | undefined;

    // Execute SQL query if present
    if (sqlQuery) {
      try {
        sqlResult = await executeQuery(sqlQuery);
      } catch (err) {
        executionError = err instanceof Error ? err.message : 'SQL execution failed';
      }
    }

    // Execute verification command if present
    if (verificationCommand) {
      try {
        if (verificationCommand === 'ledger') {
          verificationResult = await executeLedgerVerification();
        } else if (verificationCommand === 'receipt') {
          verificationResult = await executeReceiptVerification();
        }
      } catch (err) {
        executionError = err instanceof Error ? err.message : 'Verification execution failed';
      }
    }

    setMessages(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last) {
        last.sqlQuery = sqlQuery || undefined;
        last.sqlResult = sqlResult;
        last.verificationAction = verificationCommand || undefined;
        last.verificationResult = verificationResult;
        last.error = executionError;
        last.timestamp = new Date();
      }
      return updated;
    });
  }

  const handleSendMessage = async (optionalMessage?: string) => {
    if (isLoading || (!optionalMessage && !currentMessage.trim())) return;

    // Start animation if this is the first message
    if (messages.length === 0) {
      setShowInitialUI(false); // Hide initial UI when starting conversation
      setInputAnimationClass('animating');
      // After a brief moment, transition to the bottom position
      setTimeout(() => {
        setInputAnimationClass('animatingToBottom');
      }, 50); // Small delay to allow initial state to render
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      state: 'finished',
      role: 'user',
      content: optionalMessage || currentMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Get AI response
      const aiResponse = await callOpenAIResponseAPI(messages, userMessage.content);
      await processResponse(aiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startFromExample = (example: string) => {
    setMessages([]);
    setError(null);
    setCurrentMessage(example);
    handleSendMessage(example);
  };

  const clearChat = () => {      
      // Clear messages immediately and hide initial UI during animation
      setMessages([]);
      setShowInitialUI(false);
      
      // After a brief moment, transition to center position
      setTimeout(() => {
        setInputAnimationClass('animatingToCenterFinal');
        // After animation completes, show initial UI and reset animation state
        setTimeout(() => {
          setShowInitialUI(true);
          setError(null);
          setInputAnimationClass('');
        }, 800); // Match the CSS transition duration
      }, 50);
  };

  // Register clearChat function with parent component
  useEffect(() => {
    onRegisterClearChat?.(() => clearChat);
    return () => onRegisterClearChat?.(null);
  }, [onRegisterClearChat]);

  const handleDropDatabase = async () => {
    try {
      // For now, this is a simple implementation
      // In a real scenario, you'd want to properly clear the database
      if (database) {
        console.log('Dropping database...');
        // Since we don't have a built-in drop method, we could:
        // 1. Reload the page to reset the database
        // 2. Clear localStorage
        // 3. Implement a proper database reset
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to drop database:', error);
      setError('Failed to drop database');
    }
  };

  const formatSqlResult = (result: unknown[]): string => {
    if (!result || result.length === 0) {
      return 'No results found';
    }

    if (result.length === 1 && typeof result[0] === 'object') {
      const obj = result[0] as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 1) {
        return `${keys[0]}: ${obj[keys[0]]}`;
      }
    }

    return JSON.stringify(result, null, 2);
  };

  return (
    <>
      <div className={hasMessages ? styles.containerWithMessages : styles.container}>
        {/* Sage Title - visible when no messages and showing initial UI */}
        {!hasMessages && showInitialUI && (
          <div className={styles.sageTitle}>
            Sage
          </div>
        )}

        {/* Input Area - animated transition from center to bottom and back */}
        <div className={
          inputAnimationClass === 'animating' ? styles.inputAreaAnimating :
          inputAnimationClass === 'animatingToBottom' ? styles.inputAreaAnimatingToBottom :
          inputAnimationClass === 'animatingToCenter' ? styles.inputAreaAnimatingToCenter :
          inputAnimationClass === 'animatingToCenterFinal' ? styles.inputAreaAnimatingToCenterFinal :
          hasMessages ? styles.inputArea : styles.inputAreaCentered
        }>
          {error && (
            <div className={styles.errorContainer}>
              <MessageBar intent="error">
                {error}
              </MessageBar>
            </div>
          )}
          
          <div className={styles.chatInputContainer}>
            {/* Text input on top */}
            <div className={styles.inputTextareaContainer}>
              <textarea
                ref={textareaRef}
                placeholder="Message Sage..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className={styles.inputTextarea}
                rows={1}
              />
            </div>

            {/* Buttons row below */}
            <div className={styles.buttonsRow}>
              {/* Plus button with dropdown on left */}
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button
                    appearance="subtle"
                    icon={<Add24Regular />}
                    className={styles.plusButton}
                  />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<DocumentAdd24Regular />}
                      onClick={() => setShowUploadDialog(true)}
                    >
                      Add Files
                    </MenuItem>
                    <MenuItem
                      icon={<DatabaseArrowDownRegular />}
                      onClick={() => setShowDropDbDialog(true)}
                    >
                      Drop DB
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>

              {/* Right side buttons group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* New Conversation button - only show when there are messages */}
                {hasMessages && (
                  <Button
                    appearance="subtle"
                    icon={<Edit24Regular />}
                    onClick={() => clearChatFunction?.()}
                    className={styles.newConversationButton}
                    title="New Conversation"
                  />
                )}

                {/* Send button on right */}
                <Button
                  appearance="primary"
                  icon={<Send24Regular />}
                  onClick={() => handleSendMessage()}
                  disabled={!currentMessage.trim() || isLoading || !config.baseUrl}
                  className={styles.sendButton}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Starter templates - visible when no messages and showing initial UI, positioned under input area */}
        {!hasMessages && showInitialUI && (
          <div className={styles.starterTemplates}>
            <CompoundButton
              icon={<ChatAddRegular />}
              secondaryContent="How does MAA's attestation work?"
              appearance="transparent"
              onClick={() => startFromExample("How does MAA's attestation work?")}
            >
              Azure Attestation
            </CompoundButton>

            <CompoundButton
              icon={<ChatAddRegular />}
              secondaryContent="How can I trust MAA?"
              appearance="transparent"
              onClick={() => startFromExample("How can I trust MAA?")}
            >
              Azure Attestation
            </CompoundButton>

            <CompoundButton
              icon={<ChatAddRegular />}
              secondaryContent="Can you verify that MAA is transparent right now?"
              appearance="transparent"
              onClick={() => startFromExample("Can you verify that MAA is transparent right now?")}
            >
              Transparency
            </CompoundButton>

            {allTransactionsCount && allTransactionsCount > 0 ? (
              <>
                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="Can you show me the history of MAA builds?"
                  appearance="transparent"
                  onClick={() => startFromExample("Can you show me the history of MAA builds?")}
                >
                  Transparency
                </CompoundButton>
                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="How many transactions are in the database?"
                  appearance="transparent"
                  onClick={() => startFromExample("How many transactions are in the database?")}
                >
                  Ledger
                </CompoundButton>
                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="Show me recent transactions"
                  appearance="transparent"
                  onClick={() => startFromExample("Show me recent transactions")}
                >
                  Ledger
                </CompoundButton>
                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="Find transactions with specific keys"
                  appearance="transparent"
                  onClick={() => startFromExample("Find transactions with specific keys")}
                >
                  Ledger
                </CompoundButton>
              </>
            ) : null}
          </div>
        )}

        {/* Chat Area with Messages - only visible when there are messages */}
        {hasMessages && (
          <div className={styles.chatPane}>
            {/* Messages Area */}
            <div 
              className={styles.messagesArea}
              style={{
                paddingTop: '20px' // Always add padding when messages exist
              }}
            >

            {/* Starter templates when no conversation is present */}
            {messages.length === 0 && (
              <div className={styles.starterTemplates}>
                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="How does MAA’s attestation work?"
                  appearance="transparent"
                  onClick={() => startFromExample("How does MAA’s attestation work?")}
                >
                  Azure Attestation
                </CompoundButton>

                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="How can I trust MAA?"
                  appearance="transparent"
                  onClick={() => startFromExample("How can I trust MAA?")}
                >
                  Azure Attestation
                </CompoundButton>

                <CompoundButton
                  icon={<ChatAddRegular />}
                  secondaryContent="Can you verify that MAA is transparent right now?"
                  appearance="transparent"
                  onClick={() => startFromExample("Can you verify that MAA is transparent right now?")}
                >
                  Transparency
                </CompoundButton>

                { allTransactionsCount && allTransactionsCount > 0 ? (<>
                  <CompoundButton
                    icon={<ChatAddRegular />}
                    secondaryContent="Can you show me the history of MAA builds?"
                    appearance="transparent"
                    onClick={() => startFromExample("Can you show me the history of MAA builds?")}
                  >
                    Transparency
                  </CompoundButton>
                  <CompoundButton
                    icon={<ChatAddRegular />}
                    secondaryContent="How many transactions are in the database?"
                    appearance="transparent"
                    onClick={() => startFromExample("How many transactions are in the database?")}
                  >
                    Ledger
                  </CompoundButton>
                  <CompoundButton
                    icon={<ChatAddRegular />}
                    secondaryContent="Show me recent transactions"
                    appearance="transparent"
                    onClick={() => startFromExample("Show me recent transactions")}
                  >
                    Ledger
                  </CompoundButton>
                  <CompoundButton
                    icon={<ChatAddRegular />}
                    secondaryContent="Find transactions with specific keys"
                    appearance="transparent"
                    onClick={() => startFromExample("Find transactions with specific keys")}
                  >
                    Ledger
                  </CompoundButton>
                </>) : null }
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={message.role === 'user' ? styles.userMessageContainer : styles.messageContainer} data-message-role={message.role} data-message-id={message.id}>
                
                <div className={message.role === 'user' ? styles.userMessageContent : styles.messageContent}>
                  <div className={`${styles.messageBubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                    {message.role === 'user' ? (
                      <Text className={styles.messageText}>
                        {message.content}
                      </Text>
                    ) : (
                      <div className={styles.markdownContent}>
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    
                    {message.sqlQuery && (
                      <div className={styles.sqlSection}>
                        <Text size={200} weight="semibold" className={styles.sqlHeader}>
                          SQL Query:
                        </Text>
                        <pre className={styles.sqlQuery}>
                          {message.sqlQuery}
                        </pre>
                      </div>
                    )}
                    
                    {message.sqlResult && (
                      <div className={styles.sqlSection}>
                        <Text size={200} weight="semibold" className={styles.sqlResultHeader}>
                          Result:
                        </Text>
                        <pre className={styles.sqlResult}>
                          {formatSqlResult(message.sqlResult)}
                        </pre>
                      </div>
                    )}
                    
                    {(message.verificationResult !== undefined && message.verificationResult !== null) && (
                      <div className={styles.sqlSection}>
                        <Text size={200} weight="semibold" className={styles.sqlResultHeader}>
                          {message.verificationAction === 'ledger' ? 'Ledger Verification:' : 'Receipt Verification:'}
                        </Text>
                        <pre className={styles.sqlResult}>
                          {typeof message.verificationResult === 'string' 
                            ? message.verificationResult 
                            : JSON.stringify(message.verificationResult, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {message.error && (
                      <div className={styles.errorSection}>
                        <MessageBar intent="error">
                          <Text size={200}>Error: {message.error}</Text>
                        </MessageBar>
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className={styles.messageContainer}>
                <div className={styles.messageContent}>
                  <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                    <div className={styles.loadingContainer}>
                      <Spinner size="tiny" />
                      <Text size={200}>AI is thinking...</Text>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddFilesWizard 
        open={showUploadDialog} 
        onOpenChange={setShowUploadDialog}
      />

      <Dialog open={showDropDbDialog} onOpenChange={(_, data) => setShowDropDbDialog(data.open)}>
        <DialogSurface>
          <DialogTitle>Drop Database</DialogTitle>
          <DialogContent>
            <DialogBody>
              <Body1>
                Are you sure you want to drop the entire database? This will:
              </Body1>
              <ul>
                <li>Remove all tables and data completely</li>
                <li>Reset the database schema to its initial state</li>
                <li>Free up all storage space used by the database</li>
              </ul>
              <Body1>
                This action cannot be undone and will reload the page.
              </Body1>
            </DialogBody>
            <DialogActions>
              <Button 
                appearance="secondary"
                onClick={() => setShowDropDbDialog(false)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setShowDropDbDialog(false);
                  handleDropDatabase();
                }}
              >
                Drop Database
              </Button>
            </DialogActions>
          </DialogContent>
        </DialogSurface>
      </Dialog>
    </>
  );
};
