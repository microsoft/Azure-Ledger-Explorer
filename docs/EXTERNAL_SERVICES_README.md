# External Services Integration Guide

## Overview

Azure Ledger Explorer integrates with several external services to provide enhanced functionality. This document covers the integration patterns, authentication methods, error handling, and best practices for working with external APIs and services.

## Integrated Services

### 1. OpenAI API Integration

The AI Assistant component integrates with OpenAI's API to provide natural language querying capabilities for CCF ledger data.

#### Configuration

```typescript
interface OpenAIConfig {
  apiKey: string;
  model: string;
}

// Supported models
const SUPPORTED_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
] as const;
```

#### Authentication

- **API Key Storage**: Stored in browser localStorage
- **Security**: API key never transmitted to our servers
- **Validation**: Real-time API key validation

#### Implementation Example

```typescript
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
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: newMessage },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No response received';
};
```

#### Error Handling

- **Rate Limiting**: Graceful handling of API rate limits
- **Network Errors**: Retry logic with exponential backoff
- **Invalid Responses**: Validation of API response format
- **Cost Management**: Token usage tracking and warnings

### 2. Azure File Share Integration

Enables users to import CCF ledger files directly from Azure Storage File Shares using SAS tokens.

#### Service Implementation

```typescript
export class AzureFileShareService {
  private shareClient: ShareClient | null = null;

  async initialize(sasUrl: string): Promise<void> {
    try {
      this.shareClient = new ShareClient(sasUrl);
      // Validate connection without exposing sensitive information
      await this.validateConnection();
    } catch (error) {
      console.error('Azure initialization error:', error);
      throw new Error(
        'Failed to initialize file share client. Please ensure your SAS token is valid and has Read/List permissions.'
      );
    }
  }

  async listLedgerFiles(): Promise<LedgerFileInfo[]> {
    if (!this.shareClient) {
      throw new Error('File share client not initialized');
    }

    const directoryClient = this.shareClient.getDirectoryClient("ledger");
    const files: LedgerFileInfo[] = [];

    for await (const entity of directoryClient.listFilesAndDirectories()) {
      if (entity.kind === "file" && entity.name.endsWith('.committed')) {
        files.push({
          ...parseLedgerFilename(entity.name),
          size: entity.properties?.contentLength || 0,
        });
      }
    }

    return this.sortAndValidateFiles(files);
  }

  async downloadFile(filename: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    if (!this.shareClient) {
      throw new Error('File share client not initialized');
    }

    const fileClient = this.shareClient
      .getDirectoryClient("ledger")
      .getFileClient(filename);

    const downloadResponse = await fileClient.download();
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to get file stream');
    }

    return this.streamToArrayBuffer(downloadResponse.readableStreamBody, onProgress);
  }
}
```

#### Authentication & Security

- **SAS Token**: User-provided Shared Access Signature tokens
- **Permissions Required**: Read and List permissions on the file share
- **Scope Limitation**: Access limited to the "ledger" directory
- **Token Validation**: Connection validation without exposing token details

#### Error Handling

- **Network Timeouts**: Configurable timeout handling
- **Authorization Errors**: Clear messaging for permission issues
- **File Not Found**: Graceful handling of missing files
- **Quota Limits**: Handling of Azure storage quota limitations

## Integration Patterns

### 1. Service Factory Pattern

```typescript
// Service registry for managing external service instances
class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, any> = new Map();

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T | null {
    return this.services.get(name) || null;
  }
}

// Usage
const registry = ServiceRegistry.getInstance();
registry.register('azure', new AzureFileShareService());
registry.register('openai', new OpenAIService());
```

### 2. React Hook Integration

```typescript
// Custom hook for Azure File Share integration
export const useAzureFileShare = () => {
  const [service, setService] = useState<AzureFileShareService | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async (sasUrl: string) => {
    try {
      const azureService = new AzureFileShareService();
      await azureService.initialize(sasUrl);
      setService(azureService);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to Azure:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setService(null);
    setIsConnected(false);
  }, []);

  return {
    service,
    isConnected,
    connect,
    disconnect,
  };
};
```

### 3. Error Boundary Integration

```typescript
// Service-specific error boundary
export class ExternalServiceErrorBoundary extends React.Component<
  { children: React.ReactNode; serviceName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`${this.props.serviceName} service error:`, error, errorInfo);
    
    // Report to monitoring service
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    // Implementation for error reporting
    console.error('Service error reported:', {
      service: this.props.serviceName,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <MessageBar intent="error">
          <Text>
            {this.props.serviceName} service encountered an error. Please try again.
          </Text>
          <Button 
            appearance="outline" 
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </Button>
        </MessageBar>
      );
    }

    return this.props.children;
  }
}
```

## Configuration Management

### 1. Environment-Specific Configuration

```typescript
// Configuration based on environment
interface ServiceConfig {
  openai: {
    baseUrl: string;
    defaultModel: string;
    maxTokens: number;
    timeout: number;
  };
  azure: {
    defaultTimeout: number;
    maxRetries: number;
    chunkSize: number;
  };
}

const getServiceConfig = (): ServiceConfig => {
  const isDevelopment = import.meta.env.DEV;
  
  return {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: isDevelopment ? 'gpt-3.5-turbo' : 'gpt-4o-mini',
      maxTokens: 1000,
      timeout: 30000,
    },
    azure: {
      defaultTimeout: 60000,
      maxRetries: 3,
      chunkSize: 1024 * 1024, // 1MB chunks
    },
  };
};
```

### 2. Runtime Configuration

```typescript
// Dynamic configuration management
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Map<string, any> = new Map();

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  set(key: string, value: any): void {
    this.config.set(key, value);
    localStorage.setItem(`config_${key}`, JSON.stringify(value));
  }

  get<T>(key: string, defaultValue?: T): T {
    if (this.config.has(key)) {
      return this.config.get(key);
    }

    const stored = localStorage.getItem(`config_${key}`);
    if (stored) {
      try {
        const value = JSON.parse(stored);
        this.config.set(key, value);
        return value;
      } catch {
        // Ignore parse errors
      }
    }

    return defaultValue as T;
  }
}
```

## Monitoring and Analytics

### 1. Service Health Monitoring

```typescript
// Service health checker
export class ServiceHealthMonitor {
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();
  private healthStatus: Map<string, boolean> = new Map();

  registerHealthCheck(serviceName: string, checkFn: () => Promise<boolean>): void {
    this.healthChecks.set(serviceName, checkFn);
  }

  async checkHealth(serviceName: string): Promise<boolean> {
    const checkFn = this.healthChecks.get(serviceName);
    if (!checkFn) return false;

    try {
      const isHealthy = await checkFn();
      this.healthStatus.set(serviceName, isHealthy);
      return isHealthy;
    } catch {
      this.healthStatus.set(serviceName, false);
      return false;
    }
  }

  async checkAllServices(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [serviceName] of this.healthChecks) {
      results[serviceName] = await this.checkHealth(serviceName);
    }
    
    return results;
  }
}
```

### 2. Usage Analytics

```typescript
// Service usage tracking
export class ServiceAnalytics {
  private events: Array<{
    service: string;
    action: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }> = [];

  trackServiceUsage(
    service: string, 
    action: string, 
    metadata?: Record<string, any>
  ): void {
    this.events.push({
      service,
      action,
      timestamp: new Date(),
      metadata,
    });

    // Limit event storage
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }
  }

  getServiceStats(service: string): {
    totalCalls: number;
    successRate: number;
    averageResponseTime: number;
  } {
    const serviceEvents = this.events.filter(e => e.service === service);
    const totalCalls = serviceEvents.length;
    const successfulCalls = serviceEvents.filter(e => 
      e.metadata?.success !== false
    ).length;
    
    const responseTimes = serviceEvents
      .map(e => e.metadata?.responseTime)
      .filter((time): time is number => typeof time === 'number');
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      totalCalls,
      successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
      averageResponseTime,
    };
  }
}
```

## Rate Limiting and Throttling

### 1. Request Rate Limiter

```typescript
// Generic rate limiter for external services
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  async checkRateLimit(
    service: string, 
    maxRequests: number, 
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    const serviceRequests = this.requests.get(service) || [];
    
    // Remove expired requests
    const validRequests = serviceRequests.filter(
      timestamp => now - timestamp < windowMs
    );
    
    if (validRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = windowMs - (now - oldestRequest);
      
      throw new Error(
        `Rate limit exceeded for ${service}. Please wait ${Math.ceil(waitTime / 1000)} seconds.`
      );
    }
    
    validRequests.push(now);
    this.requests.set(service, validRequests);
    return true;
  }
}
```

### 2. Request Queue

```typescript
// Request queue for managing API calls
export class RequestQueue {
  private queues: Map<string, Array<() => Promise<any>>> = new Map();
  private processing: Map<string, boolean> = new Map();

  async enqueue<T>(service: string, requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queue = this.queues.get(service) || [];
      
      queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.queues.set(service, queue);
      this.processQueue(service);
    });
  }

  private async processQueue(service: string): Promise<void> {
    if (this.processing.get(service)) return;
    
    this.processing.set(service, true);
    const queue = this.queues.get(service) || [];
    
    while (queue.length > 0) {
      const request = queue.shift();
      if (request) {
        try {
          await request();
          // Add delay between requests if needed
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Queue processing error for ${service}:`, error);
        }
      }
    }
    
    this.processing.set(service, false);
  }
}
```

## Testing External Services

### 1. Service Mocking

```typescript
// Mock implementations for testing
export class MockOpenAIService {
  async callOpenAI(messages: any[], newMessage: string): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock response based on input
    if (newMessage.includes('transactions')) {
      return 'Mock response about transactions with SQL query';
    }
    
    return 'Mock OpenAI response';
  }
}

export class MockAzureFileShareService {
  async listLedgerFiles(): Promise<LedgerFileInfo[]> {
    return [
      {
        filename: 'ledger_0-999.committed',
        startNo: 0,
        endNo: 999,
        isValid: true,
      },
    ];
  }

  async downloadFile(filename: string): Promise<ArrayBuffer> {
    // Return mock file data
    return new ArrayBuffer(1024);
  }
}
```

### 2. Integration Tests

```typescript
// Integration test helpers
export const createTestServiceEnvironment = () => {
  const mockServices = {
    openai: new MockOpenAIService(),
    azure: new MockAzureFileShareService(),
  };

  return {
    mockServices,
    cleanup: () => {
      // Cleanup test environment
    },
  };
};

// Example integration test
describe('External Services Integration', () => {
  let testEnv: ReturnType<typeof createTestServiceEnvironment>;

  beforeEach(() => {
    testEnv = createTestServiceEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  it('should handle OpenAI API integration', async () => {
    const response = await testEnv.mockServices.openai.callOpenAI(
      [],
      'How many transactions are there?'
    );
    
    expect(response).toContain('transactions');
  });
});
```

## Security Considerations

### 1. API Key Management

- Store API keys in localStorage (never in code)
- Validate API keys before use
- Provide clear error messages for invalid keys
- Never log or expose API keys in error messages

### 2. Data Privacy

- All external API calls are initiated by user action
- No automatic data transmission to external services
- Clear disclosure of data being sent to external services
- Option to review data before transmission

### 3. Network Security

- Use HTTPS for all external API calls
- Implement proper CORS handling
- Validate SSL certificates
- Handle network errors gracefully

---

**⚠️ IMPORTANT**: When adding new external service integrations, ensure they follow the patterns established in this document. All external service integrations must include proper error handling, rate limiting, and security considerations. Update this documentation when adding new services or modifying existing integrations.
