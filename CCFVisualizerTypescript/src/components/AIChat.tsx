import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Input,
  Field,
  Textarea,
  Card,
  CardHeader,
  CardFooter,
  Divider,
  Spinner,
  Text,
  Badge,
  MessageBar,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Send24Regular,
  Settings24Regular,
  Database24Regular,
  Bot24Regular,
  Person24Regular,
} from '@fluentui/react-icons';
import { CCFDatabase } from '../database/ccf-database';
import { useConfig } from '../pages/ConfigPage';


interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  responseId?: string;
  content: string;
  sqlQuery?: string;
  sqlResult?: unknown[];
  timestamp: Date;
  error?: string;
}

interface AIChatProps {
  database: CCFDatabase;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    ...shorthands.gap('16px'),
    ...shorthands.overflow('hidden'),
  },
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('16px'),
    minWidth: 0,
    maxWidth: '800px',
    overflowY: 'auto',
  },
  chatCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  messagesArea: {
    flex: 1,
    ...shorthands.padding('16px'),
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    minHeight: 0,
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
    ...shorthands.padding('0', '16px'),
  },
  inputArea: {
    display: 'flex',
    ...shorthands.gap('8px'),
    width: '100%',
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
  badgeText: {
    ...shorthands.margin('0', '0', '0', '4px'),
  },
});

export const AIChat: React.FC<AIChatProps> = ({ database }) => {
  const styles = useStyles();
  const { config } = useConfig(); 
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const callOpenAIResponseAPI = async (messages: ChatMessage[], newMessage: string): Promise<{ id: string; text: string }> => {
    if (!config.baseUrl) {
      throw new Error('Base URL is required to send the request');
    }

    let input = '';
    // collect prior conversations as history for this question
    messages.forEach(m => {
      input += `${m.role} said: ${m.content}\n`;
    });

    const previousResponseId = messages.length > 0 ? messages[messages.length - 1].responseId : null;

    input += `User asks: ${newMessage}\n`;

    const response = await fetch(config.baseUrl + '/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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

    const data = await response.json();
    let concatenatedResponse = "";
    if (data.output && data.output.length > 0) {
      for (const output of data.output) {
        if (output.type === 'message') {
          for (const messageContent of output.content) {
            if (messageContent.type === 'output_text') {
              concatenatedResponse += `${messageContent.text}\n`;
            } else {
              concatenatedResponse += `type: ${messageContent.type}\n`;
            }
          }
        } else {
          concatenatedResponse += `type: ${output.type}\n`;
        }
      }
    }
    return {
      id: data.id || '',
      text: concatenatedResponse || 'No response received'
    };
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
      const aiResponse = await callOpenAIResponseAPI(messages, userMessage.content);
      
      // Check if the response contains a SQL query
      const sqlQuery = extractSqlQuery(aiResponse.text);
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
        id: aiResponse.id || (Date.now() + 1).toString(),
        responseId: aiResponse.id,
        role: 'assistant',
        content: aiResponse.text,
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

      {/* Right Pane - Chat Interface */}
      <div className={styles.chatPane}>
        <Card className={styles.chatCard}>
          <CardHeader
            header={
              <div className={styles.chatHeader}>
                <Bot24Regular />
                <Text weight="semibold">Sage Assistant</Text>
                <Badge appearance="outline" size="small">
                  <Database24Regular />
                  <span className={styles.badgeText}>SQL Enabled</span>
                </Badge>

                { error || messages.length > 0 ? (
                  <Button onClick={clearChat} appearance="outline">
                    New conversation
                  </Button>
                ) : null }
              </div>
            }
          />

          {/* Messages Area */}
          <div className={styles.messagesArea}>
            {messages.length === 0 && (
              <div className={styles.welcomeContainer}>
                <Bot24Regular className={styles.welcomeIcon} />
                <div>
                  <Text size={400} weight="semibold">Welcome to CCF Ledger AI</Text>
                  <br />
                  <Text size={200}>
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

          {/* Error Display */}
          {error && (
            <div className={styles.errorContainer}>
              <MessageBar intent="error" onDismiss={() => setError(null)}>
                {error}
              </MessageBar>
            </div>
          )}

          {/* Input Area */}
          <CardFooter>
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
                disabled={!currentMessage.trim() || isLoading || !config.baseUrl}
              />
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
