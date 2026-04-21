# Contributing to Azure Ledger Explorer

Thank you for your interest in contributing to Azure Ledger Explorer! We welcome contributions from the community.

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/microsoft/CCF-Ledger-Explorer/issues) to report bugs or suggest features
- Search existing issues before creating a new one
- Provide as much detail as possible, including steps to reproduce bugs

### Submitting Changes

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our [Code Standards](docs/CODE_STANDARDS.md)
3. **Test your changes** - run `npm run lint` and `npm run build` to ensure no errors
4. **Submit a pull request** with a clear description of your changes

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/CCF-Ledger-Explorer.git
cd CCF-Ledger-Explorer

# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Run tests
npm run test
```

### Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what the PR does and why
- Ensure all CI checks pass
- Be responsive to feedback during code review

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License

By contributing to this project, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
