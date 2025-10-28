# CCF Ledger Visualizer - Documentation Index

## 📚 Documentation Overview

This directory contains comprehensive documentation for the CCF Ledger Visualizer TypeScript application. Each document covers a specific aspect of the system and should be consulted before making changes to the related components.

## 📋 Documentation Files

### 🏗️ [Architecture Overview](./ARCHITECTURE_README.md)
**High-level system architecture and component relationships**
- System architecture diagram with component flow
- Technology stack and architectural decisions
- Data flow patterns and integration points
- Performance and scalability considerations
- Browser compatibility and deployment architecture

### 🔧 [Parser System](./PARSER_README.md)
**CCF ledger file parsing and processing**
- LedgerChunkV2 class implementation details
- Binary file format handling and data extraction
- Transaction parsing and cryptographic verification
- Performance optimization and error handling
- Integration with database layer

### 🗄️ [Database & Persistence](./DATABASE_README.md)
**SQL.js database layer and OPFS storage**
- Database schema and table structures
- SQL.js integration with OPFS persistence
- Query optimization and indexing strategies
- Memory management and performance tuning
- Data integrity and backup procedures

### 📜 [Code Standards](./CODE_STANDARDS.md)
**Mandatory coding patterns and requirements**
- **CRITICAL**: TanStack Query usage requirements
- TypeScript strict mode compliance
- Component architecture standards
- Error handling and loading state patterns
- Performance optimization guidelines

### 🌐 [External Services](./EXTERNAL_SERVICES_README.md)
**Integration with OpenAI and Azure services**
- OpenAI API integration for AI assistant
- Azure File Share service integration
- Authentication and security patterns
- Rate limiting and error handling
- Service monitoring and analytics

### 🤖 [AI Assistant](./AI_ASSISTANT_README.md)
**Natural language querying interface**
- OpenAI integration and prompt engineering
- SQL query generation and execution
- Security measures and query validation
- Usage examples and troubleshooting
- Cost considerations and model selection

## 🚨 Critical Reading Order

For new developers joining the project:

1. **START HERE**: [Code Standards](./CODE_STANDARDS.md) - **MANDATORY READING**
2. [Architecture Overview](./ARCHITECTURE_README.md) - Understand the big picture
3. [Database & Persistence](./DATABASE_README.md) - Core data handling
4. [Parser System](./PARSER_README.md) - CCF file processing
5. [External Services](./EXTERNAL_SERVICES_README.md) - Third-party integrations
6. [AI Assistant](./AI_ASSISTANT_README.md) - AI functionality

## 📝 Documentation Maintenance

### ⚠️ CRITICAL RESPONSIBILITY

**Every developer MUST keep these documentation files up to date when making changes to the codebase.**

#### When to Update Documentation

- **Code Standards**: When adding new patterns or changing existing requirements
- **Architecture**: When modifying component relationships or adding new layers
- **Database**: When changing schema, indexes, or query patterns
- **Parser**: When updating parsing logic or supporting new formats
- **External Services**: When adding new integrations or changing existing ones
- **AI Assistant**: When modifying prompts, models, or functionality

#### How to Update Documentation

1. **Before** implementing changes, review relevant documentation
2. **During** development, note what documentation needs updates
3. **After** implementation, update documentation in the same PR
4. **Test** documentation accuracy with another team member

#### Documentation Review Process

- All PRs with functional changes MUST include documentation updates
- Documentation changes should be reviewed for clarity and accuracy
- Outdated documentation is considered a bug and should be fixed immediately
- Regular documentation audits should be conducted quarterly

## 🔍 Finding Information

### Quick Reference

| Need to... | Check this document |
|------------|-------------------|
| Use TanStack Query correctly | [Code Standards](./CODE_STANDARDS.md) |
| Understand component relationships | [Architecture Overview](./ARCHITECTURE_README.md) |
| Work with database queries | [Database & Persistence](./DATABASE_README.md) |
| Modify CCF file parsing | [Parser System](./PARSER_README.md) |
| Add external API integration | [External Services](./EXTERNAL_SERVICES_README.md) |
| Enhance AI functionality | [AI Assistant](./AI_ASSISTANT_README.md) |

### Search Tips

- Use Ctrl+F to search within documents
- Look for code examples in each document
- Check the "IMPORTANT" sections for critical information
- Review error handling patterns for robust implementations

## 🛠️ Development Workflow

### Before Starting Work

1. Read the [Code Standards](./CODE_STANDARDS.md) - **NON-NEGOTIABLE**
2. Review relevant architectural documentation
3. Check for existing patterns in the codebase
4. Plan documentation updates alongside code changes

### During Development

1. Follow established patterns from documentation
2. Reference type definitions and interfaces
3. Implement proper error handling as documented
4. Note any deviations that need documentation updates

### Before Submitting PR

1. Update relevant documentation files
2. Add code examples to documentation if introducing new patterns
3. Review documentation for clarity and completeness
4. Ensure documentation reflects actual implementation

## 📊 Documentation Metrics

### Quality Indicators

- **Accuracy**: Documentation matches actual implementation
- **Completeness**: All major features and patterns are documented
- **Clarity**: Examples and explanations are easy to follow
- **Currency**: Documentation is updated with code changes
- **Consistency**: Similar patterns are documented similarly

### Regular Reviews

- **Weekly**: Check for outdated code examples
- **Monthly**: Review for missing documentation
- **Quarterly**: Comprehensive documentation audit
- **Release**: Update version-specific information

## 🆘 Getting Help

### Documentation Issues

If you find:
- Outdated information
- Missing examples
- Unclear explanations
- Broken links or formatting

**Immediately** create an issue or fix it yourself - documentation bugs affect everyone.

### Questions About Patterns

1. Check the relevant documentation first
2. Look for similar implementations in the codebase
3. Ask in team channels with specific questions
4. When in doubt, follow the strictest interpretation of standards

## 🔄 Version History

### Documentation Versioning

- Documentation should be versioned with the application
- Major architectural changes require documentation review
- Breaking changes must be clearly documented
- Migration guides should be provided for significant changes

---

**⚠️ FINAL REMINDER**: These documentation files are not optional reading material - they are **REQUIRED SPECIFICATIONS** for working on this codebase. Failing to follow documented patterns will result in code review rejection and potential system issues. When in doubt, ask questions rather than guessing at implementation details.
