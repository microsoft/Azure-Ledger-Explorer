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

1. **Configure API**: provide a base URL for OpenAI capable API which will be used to call `/v1/responses`.
2. **Update your system prompt**: make sure to include the correct table names and schema in the system prompt for accurate SQL generation.

## GitHub Copilot Coding Agent

This repository is configured with Copilot coding agent instructions in [`.github/copilot-instructions.md`](../.github/copilot-instructions.md). These instructions guide the agent on repository conventions, architecture, build/test workflows, security requirements, and documentation standards. Consult that file when using Copilot to contribute to this codebase.

