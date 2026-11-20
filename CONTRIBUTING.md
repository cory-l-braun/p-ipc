# Contributing to p-ipc

Thank you for your interest in contributing to p-ipc! We welcome contributions from everyone.

## How to Contribute

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** for your changes
4. **Make your changes** with clear, descriptive commit messages
5. **Run tests** to ensure everything works
6. **Submit a Pull Request** with a clear description of your changes

## Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode (requires installing nodemon)
npm install --save-dev nodemon
nodemon --exec npm test
```

## Coding Standards

- Use clear, descriptive variable and function names
- Add JSDoc comments for public APIs
- Write tests for new functionality
- Ensure all tests pass before submitting a PR
- Keep commits focused and atomic

## Testing

Please write tests for any new features or bug fixes. Run the full test suite before submitting:

```bash
npm test
```

All tests should pass, and new tests should be added to `test/integration.js`.

## Reporting Issues

When reporting issues:

1. Use the GitHub issue tracker
2. Provide a clear description of the problem
3. Include steps to reproduce the issue
4. Include your Node.js version and OS
5. Include any relevant error messages or logs

## Code Style

- Use 4-space indentation (or as defined in .editorconfig)
- Use semicolons
- Use single quotes for strings where possible
- Comment only when necessary

## License

By contributing to p-ipc, you agree that your contributions will be licensed under its ISC License.

## Questions?

Feel free to open an issue on GitHub to ask questions or discuss improvements.
