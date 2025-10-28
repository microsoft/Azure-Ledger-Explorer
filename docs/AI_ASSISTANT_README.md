# CCF Ledger AI Assistant

## Overview

The AI Assistant is a powerful component that allows you to query your CCF (Confidential Consortium Framework) ledger data using natural language. It leverages OpenAI's language models to understand your questions and automatically generates SQL queries to provide accurate answers from your parsed ledger data.

## Features

- **Natural Language Queries**: Ask questions about your ledger data in plain English
- **Automatic SQL Generation**: AI writes and executes SQL queries based on your questions
- **Real-time Results**: See both the generated SQL and the query results
- **Secure Execution**: Only SELECT queries are allowed for security
- **Persistent Configuration**: Your API key and model preferences are saved locally

## Setup

1. **Navigate to AI Assistant**: Click the "AI Assistant" tab in the main navigation
2. **Configure OpenAI Settings**:
   - Enter your OpenAI API key in the left panel
   - Select your preferred model (GPT-4o Mini is recommended for cost-effectiveness)
   - Your settings are automatically saved to localStorage

## Usage

### Example Questions

Ask questions like:
- "How many transactions are in the database?"
- "What are the most common map names?"
- "Show me the latest 10 transactions"
- "Find transactions that contain the key 'user'"
- "What's the average transaction size?"
- "Show me all unique table names in the CCF ledger"

### Understanding the Results

When you ask a question, the AI will:
1. Analyze your question
2. Generate appropriate SQL queries
3. Execute the queries against your database
4. Present the results in a readable format
5. Show both the SQL query and the results for transparency

### Database Schema

The AI has access to these tables:
- **ledger_files**: Uploaded ledger files metadata
- **transactions**: Parsed transaction records
- **kv_writes**: Key-value write operations
- **kv_deletes**: Key-value delete operations

## Security

- Only SELECT queries are permitted
- No data modification is possible through the AI
- Your API key is stored locally in your browser
- All queries are executed locally against your browser's database

## Tips

1. **Be Specific**: More specific questions yield better results
2. **Ask for Examples**: You can ask "Show me an example of..." to see sample data
3. **Iterative Queries**: Build on previous questions for deeper analysis
4. **Check the SQL**: Review the generated SQL to understand how your data is being queried

## Cost Considerations

- API calls to OpenAI are charged per token
- GPT-4o Mini is the most cost-effective option
- Complex queries may require more tokens
- Consider using cheaper models for simple questions

## Troubleshooting

- **No API Key**: Enter a valid OpenAI API key in the configuration panel
- **Database Not Available**: Upload and parse CCF ledger files first
- **Query Errors**: The AI will show SQL errors and suggest corrections
- **Rate Limits**: OpenAI may rate-limit requests; wait before retrying
