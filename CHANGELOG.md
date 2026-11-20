# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.5] - 2026-11-20

### Added
- Production build system with esbuild for minified, tree-shaken distribution
- `npm run build` script to generate optimized bundle
- `npm run test:dist` script to validate distribution bundle
- Distribution test validation script (`test/dist-validation.js`)
- Source maps for production debugging (`dist/p-ipc.js.map`)

### Changed
- Refactored [index.js](index.js) for improved tree-shaking:
  - Converted `let` to `const` where appropriate for dead code elimination
  - Improved code formatting and consistency
  - Retained all JSDoc comments for documentation

### Fixed
- Error handling in the `on()` function to prevent double-parsing request objects in catch blocks

### Distribution
- Minified bundle: 3.91 KB (`dist/p-ipc.js`)
- Full test suite (21 tests) passes against distribution
- 100% backward compatibility verified

## [2.1.4] - 2026-11-20

### Added
- Comprehensive test suite with 21 tests (11 integration + 10 multiprocess)
- Multiprocess test suite demonstrating real inter-process communication
- Support for streaming messages via `onmessage` callback
- Handler context binding support via `on(channel, handler, context)`

### Tests Added
- `test/integration.js` - 11 in-process IPC tests
  - Basic request/response
  - Complex data types
  - Error handling and propagation
  - Streaming messages
- `test/multiprocess-*.js` - 10 real multiprocess scenarios
  - Basic cross-process communication
  - Client disconnect/reconnect handling
  - Server crash detection
  - Multiple concurrent clients
  - Progress reporting with streaming
  - Connection lifecycle management
  - Error propagation across processes
  - Graceful shutdown

### Configuration
- Added `--exit` flag to mocha test runner in package.json
  - Required for clean process termination when using node-ipc
  - Prevents tests from hanging after completion due to persistent IPC connections

### Documentation
- Complete API reference in README
- Usage examples for common scenarios
- Data type support documentation
- Performance considerations section
- Troubleshooting guide

## [2.1.0] - Earlier

### Features
- Promise-based IPC communication
- Request/Response pattern
- One-way messaging via `send()`
- Event handler registration via `on()`
- Automatic error serialization and propagation
- Complex data type support via BSON
- Connection pooling and reuse

## [2.0.0] - Earlier

### Initial Release
- Core IPC functionality
- node-ipc integration
- Error handling
