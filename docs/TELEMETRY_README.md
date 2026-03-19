# Telemetry

CCF Ledger Explorer collects optional, anonymous usage telemetry to help improve the application. This document explains what data is collected, how to opt out, and how to configure telemetry for deployment.

## What Data is Collected

When telemetry is enabled, we collect:

| Event | Description |
|-------|-------------|
| Page views | Which pages you visit (e.g., Files, Tables, Verification) |
| File uploads | When ledger files are imported (count only, not file contents) |
| File deletions | When ledger files are removed |
| Table views | When you access table data |
| SQL queries | When queries are executed (query count only, not query content) |
| Verification events | When verification starts and completes |
| Chat messages | When chat messages are sent (count only, not message content) |

### What is NOT Collected

- **No ledger data**: File contents, transaction data, keys, or values are never collected
- **No IP addresses**: Client IP addresses are stripped before telemetry is sent
- **No query content**: We track that a query ran, not what the query was
- **No message content**: We track chat usage, not what you typed

### Platform-Level Data

Azure Application Insights collects some metadata for session analysis:

- **Session identifiers**: Anonymous session/client IDs via cookies
- **Browser/device info**: Browser type, OS, screen resolution

We explicitly strip IP addresses from telemetry using a client-side telemetry initializer before data is sent to Azure.

## Opting Out

Telemetry is enabled by default (opt-out model). To disable it:

1. Go to **Settings** (gear icon in the menu bar)
2. Find the **Telemetry** section
3. Toggle **Share anonymous usage data** to **Disabled**

Your preference is stored locally in your browser and persists across sessions.

## For Developers/Deployers

### Configuring Application Insights

Telemetry requires an Azure Application Insights resource. To enable telemetry in your deployment:

1. Create an Application Insights resource in Azure Portal
2. Copy the **Connection String** (not the Instrumentation Key)
3. Set the environment variable at build time:

```bash
VITE_APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=xxx;IngestionEndpoint=https://...
```

For Azure Static Web Apps, add this as an application setting.

### Local Development

If `VITE_APPINSIGHTS_CONNECTION_STRING` is not set, telemetry is silently disabled. This is the expected behavior for local development.

### Privacy Considerations

- The Application Insights connection string is visible in browser dev tools—this is expected and by design
- Connection strings are designed for client-side use; they cannot be used to access or modify your telemetry data
- Consider your organization's data residency requirements when choosing an Azure region for your Application Insights resource

## Implementation Details

CCF Ledger Explorer uses Microsoft's official Application Insights SDK:

- `@microsoft/applicationinsights-web`: Core web SDK
- `@microsoft/applicationinsights-react-js`: React integration

The telemetry service is located at `src/services/telemetry/` and provides:

- Automatic page view tracking on route changes
- Custom event tracking for feature usage
- Opt-out support via localStorage
- Graceful no-op when unconfigured

## Data Retention

Telemetry data is sent to Azure Application Insights and subject to your Azure subscription's data retention policies. By default, Application Insights retains data for 90 days.

## Questions?

If you have questions about telemetry, please open an issue on the [GitHub repository](https://github.com/microsoft/CCF-Ledger-Explorer).
