import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  Divider,
  Spinner,
  Text,
  MessageBar,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Send24Regular,
  Settings24Regular,
  Bot24Regular,
  Person24Regular,
} from '@fluentui/react-icons';
import { CCFDatabase } from '../database/ccf-database';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sqlQuery?: string;
  sqlResult?: unknown[];
  timestamp: Date;
  error?: string;
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
}

interface AIChatProps {
  database: CCFDatabase;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    minHeight: 0, // Critical for flex children to shrink
    ...shorthands.gap('16px'),
    ...shorthands.overflow('hidden'),
  },
  leftPane: {
    width: '280px',
    ...shorthands.borderRight('1px', 'solid', tokens.colorNeutralStroke2),
    flexShrink: 0,
    ...shorthands.padding('16px'),
    backgroundColor: tokens.colorNeutralBackground2,
    overflowY: 'auto', // Allow left pane to scroll if content is too long
  },
  configHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  configContent: {
    ...shorthands.padding('16px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
  },
  rightPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0, // Critical for flex child to shrink
    overflow: 'hidden', // Ensure no overflow from the right pane
    height: '100%', // Explicit height
  },
  chatCard: {
    flex: 1,
    display: 'grid',
    gridTemplateRows: '1fr auto', // Messages area takes remaining space, input area is auto-sized
    overflow: 'hidden', // Critical for proper layout
    minHeight: 0, // Allow flex child to shrink
    height: '100%', // Explicit height
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius('8px'),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  messagesArea: {
    ...shorthands.padding('24px', '16px', '16px', '16px'),
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    minHeight: 0, // Critical for scrolling to work properly
    height: '100%', // Take full available height in grid row
    position: 'relative', // Ensure proper positioning context
  },
  welcomeContainer: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding('32px'),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  welcomeIcon: {
    fontSize: '48px',
    opacity: 0.5,
  },
  welcomeExamples: {
    textAlign: 'left',
    fontSize: '12px',
    opacity: 0.7,
  },
  messageContainer: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'flex-start',
  },
  messageAvatar: {
    width: '32px',
    height: '32px',
    ...shorthands.borderRadius('50%'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '16px',
    flexShrink: 0,
  },
  userAvatar: {
    backgroundColor: tokens.colorBrandBackground,
  },
  assistantAvatar: {
    backgroundColor: tokens.colorNeutralForeground3,
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  messageBubble: {
    ...shorthands.padding('12px'),
    ...shorthands.borderRadius('8px'),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  },
  userBubble: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  messageText: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
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
    display: 'flex',
    ...shorthands.gap('8px'),
    width: '100%',
    ...shorthands.padding('16px'),
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  inputTextarea: {
    flex: 1,
    minHeight: '40px',
    maxHeight: '120px',
  },
  helpText: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
  },
});

export const AIChat: React.FC<AIChatProps> = ({ database }) => {
  const styles = useStyles();
  const [config, setConfig] = useState<OpenAIConfig>({
    apiKey: localStorage.getItem('openai_api_key') || '',
    model: localStorage.getItem('openai_model') || 'gpt-4o-mini',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save config to localStorage when it changes
  useEffect(() => {
    if (config.apiKey) {
      localStorage.setItem('openai_api_key', config.apiKey);
    }
    localStorage.setItem('openai_model', config.model);
  }, [config]);

  const getSystemPrompt = () => {
    return `You are an AI assistant specialized in analyzing CCF (Confidential Consortium Framework) ledger data. You have access to a SQLite database with the following schema:

TABLES:
- ledger_files: Contains uploaded ledger files (id, filename, file_size, created_at, updated_at)
- transactions: Contains parsed transactions (id, file_id, version, flags, size, entry_type, tx_version, max_conflict_version, tx_digest, created_at)
- kv_writes: Contains key-value write operations (id, transaction_id, map_name, key_name, value_text, version, created_at)
- kv_deletes: Contains key-value delete operations (id, transaction_id, map_name, key_name, version, created_at)

IMPORTANT GUIDELINES:
1. When answering questions about the data, you MUST write SQL queries to get accurate information
2. Always use SELECT queries only - never INSERT, UPDATE, DELETE, or DDL statements
3. Use appropriate JOINs to get comprehensive information
4. Format SQL queries clearly and explain what they do
5. If you need to execute a SQL query, include it in your response with the format: \`\`\`sql\n[query]\n\`\`\`
6. Explain your findings in a user-friendly way
7. The map_name field typically contains CCF table names like 'public:ccf.gov.nodes', 'public:ccf.internal.consensus', etc.
8. The value_text field contains UTF-8 decoded values from the ledger
9. CCF transactions can contain multiple key-value operations

You can answer questions about:
- Transaction counts and statistics
- Key-value operations and their content
- File information and ledger structure
- Data analysis and patterns
- Specific searches within the ledger data

Always be helpful and provide detailed explanations of your SQL queries and results.`;
  };

  const executeQuery = async (sqlQuery: string): Promise<unknown[]> => {
    try {
      return await database.executeQuery(sqlQuery);
    } catch (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
  };

  const callOpenAI = async (messages: ChatMessage[], newMessage: string): Promise<string> => {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: getSystemPrompt() },
          ...messages.map(m => ({
            role: m.role,
            content: m.content + (m.sqlResult ? `\n\nSQL Query Result: ${JSON.stringify(m.sqlResult, null, 2)}` : ''),
          })),
          { role: 'user', content: newMessage },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response received';
  };

  const extractSqlQuery = (content: string): string | null => {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
    return sqlMatch ? sqlMatch[1].trim() : null;
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Get AI response
      const aiResponse = await callOpenAI(messages, userMessage.content);
      
      // Check if the response contains a SQL query
      const sqlQuery = extractSqlQuery(aiResponse);
      let sqlResult: unknown[] | undefined;
      let executionError: string | undefined;

      if (sqlQuery) {
        try {
          sqlResult = await executeQuery(sqlQuery);
        } catch (err) {
          executionError = err instanceof Error ? err.message : 'SQL execution failed';
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        sqlQuery: sqlQuery || undefined,
        sqlResult,
        error: executionError,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
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

  const clearChat = () => {
    setMessages([]);
    setError(null);
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
    <div className={styles.container}>
      {/* Left Pane - Configuration */}
      <div className={styles.leftPane}>
        <div>
          <div className={styles.configHeader}>
            <Settings24Regular />
            <Text weight="semibold">Configuration</Text>
          </div>
          <div className={styles.configContent}>
            <div>
              <Label htmlFor="api-key">OpenAI API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={config.apiKey}
                onChange={(_, data) => setConfig(prev => ({ ...prev, apiKey: data.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="model">Model</Label>
              <Select
                id="model"
                value={config.model}
                onChange={(_, data) => setConfig(prev => ({ ...prev, model: data.value }))}
              >
                {[
                  { value: 'gpt-4o', label: 'GPT-4o' },
                  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                ].map(model => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </div>

            <Divider />

            <div>
              <Text size={200} className={styles.helpText}>
                The AI can query your CCF database to answer questions about transactions, 
                key-value operations, and ledger statistics.
              </Text>
            </div>

            <Button onClick={clearChat} appearance="outline">
              Clear Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Right Pane - Chat Interface */}
      <div className={styles.rightPane}>
        <div className={styles.chatCard}>
          {/* Messages Area */}
          <div className={styles.messagesArea}>
            {messages.length === 0 && (
              <div className={styles.welcomeContainer}>
                <Bot24Regular className={styles.welcomeIcon} />
                <div>
                  <Text size={500} weight="semibold">CCF Ledger AI Assistant</Text>
                  <br />
                  <Text size={300}>
                    Ask me anything about your CCF ledger data. I can write SQL queries to analyze 
                    transactions, key-value operations, and provide insights.
                  </Text>
                </div>
                <div className={styles.welcomeExamples}>
                  <p><strong>Example questions:</strong></p>
                  <ul>
                    <li>How many transactions are in the database?</li>
                    <li>What are the most common map names?</li>
                    <li>Show me recent transactions</li>
                    <li>Find transactions with specific keys</li>
                  </ul>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={styles.messageContainer}>
                <div className={`${styles.messageAvatar} ${message.role === 'user' ? styles.userAvatar : styles.assistantAvatar}`}>
                  {message.role === 'user' ? <Person24Regular /> : <Bot24Regular />}
                </div>
                
                <div className={styles.messageContent}>
                  <div className={`${styles.messageBubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                    <Text className={styles.messageText}>
                      {message.content}
                    </Text>
                    
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
                    
                    {message.error && (
                      <div className={styles.errorSection}>
                        <MessageBar intent="error">
                          <Text size={200}>SQL Error: {message.error}</Text>
                        </MessageBar>
                      </div>
                    )}
                  </div>
                  
                  <Text size={100} className={styles.messageTimestamp}>
                    {message.timestamp.toLocaleTimeString()}
                  </Text>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className={styles.loadingContainer}>
                <Spinner size="tiny" />
                <Text size={200}>AI is thinking...</Text>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area with optional error display above it */}
          <div style={{ position: 'relative' }}>
            {error && (
              <div className={styles.errorContainer}>
                <MessageBar intent="error">
                  {error}
                </MessageBar>
              </div>
            )}

            <div className={styles.inputArea}>
              <Textarea
                placeholder="Ask me about your CCF ledger data..."
                value={currentMessage}
                onChange={(_, data) => setCurrentMessage(data.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                resize="none"
                className={styles.inputTextarea}
              />
              <Button
                appearance="primary"
                icon={<Send24Regular />}
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isLoading || !config.apiKey}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
