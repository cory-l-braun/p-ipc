# p-ipc

[![npm version](https://badge.fury.io/js/p-ipc.svg)](https://badge.fury.io/js/p-ipc)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**p-ipc** is a promise-based Inter-Process Communication (IPC) library for Node.js that simplifies communication between processes using an intuitive request/response pattern. Perfect for building multi-process applications, worker pools, and distributed Node.js architectures.

## Features

- 🔄 **Promise-based API** - Use async/await for clean, readable IPC code
- 📡 **Bidirectional Communication** - Both request/response and one-way messaging
- 🔁 **Streaming Messages** - Send multiple intermediate messages before final response
- ✅ **Error Propagation** - Errors thrown in handlers are automatically sent to requesters
- 🔗 **Connection Pooling** - Automatic connection management and reuse
- 📦 **Complex Data Types** - Seamlessly serialize/deserialize objects, arrays, Dates, and more via BSON
- 🎯 **Simple API** - Minimal setup, easy to use
- 🚀 **Multi-Process Ready** - Built for real IPC scenarios with separate node processes
- ✅ **Fully Tested** - Comprehensive test suite with 21 integration and multiprocess tests

## Installation

```bash
npm install p-ipc
```

## Quick Start - Single Process Demo

```javascript
const pIpc = require('p-ipc');

// Create a server instance
const server = new pIpc('my-server', {
    appid: 'com.myapp.example',
});

// Start the server
await server.start();

// Register a handler
server.on('greet', (name) => {
    return `Hello, ${name}!`;
});

// Create a client instance
const client = new pIpc('my-client', {
    appid: 'com.myapp.example',
});

// Start the client
await client.start();

// Send a request and wait for response
const response = await client.request('my-server', 'greet', 'World');
console.log(response); // "Hello, World!"

// Cleanup
await client.stop();
await server.stop();
```

## Best Practices

### 1. Always Use Proper Cleanup

Always ensure both client and server are stopped cleanly, even if errors occur:

```javascript
const server = new pIpc('server', { appid: 'com.example' });
const client = new pIpc('client', { appid: 'com.example' });

try {
    await server.start();
    server.on('work', (data) => processData(data));
    
    await client.start();
    const result = await client.request('server', 'work', 'data');
    console.log(result);
} finally {
    // Always cleanup in finally block
    await client.stop().catch(err => console.error('Client stop error:', err));
    await server.stop().catch(err => console.error('Server stop error:', err));
}
```

### 2. Handle Errors Gracefully

Errors thrown in handlers are automatically sent to requesters. Always use try/catch:

```javascript
server.on('divide', (a, b) => {
    if (b === 0) {
        throw new Error('Division by zero');
    }
    return a / b;
});

// Client side
try {
    const result = await client.request('server', 'divide', 10, 0);
} catch (err) {
    console.error('Operation failed:', err.message);
    // Handle error appropriately
}
```

### 3. Use Unique AppIDs for Each Application

Using the same `appid` for different applications causes socket collisions. Always use unique, descriptive appids:

```javascript
// Good: Unique appid for each service
const userService = new pIpc('users', { appid: 'com.mycompany.user-service' });
const productService = new pIpc('products', { appid: 'com.mycompany.product-service' });

// Bad: Same appid for different services
const service1 = new pIpc('svc1', { appid: 'com.example.app' });
const service2 = new pIpc('svc2', { appid: 'com.example.app' }); // Collision risk!
```

### 4. Add Timeouts for Multi-Process Communication

When spawning child processes, add timeouts to avoid hanging indefinitely:

```javascript
const { spawn } = require('child_process');
const pIpc = require('p-ipc');

async function startWorker() {
    const workerProcess = spawn('node', ['worker.js']);
    const client = new pIpc('main', { appid: 'com.example.worker' });
    
    try {
        await client.start();
        
        // Add timeout to request
        const result = await Promise.race([
            client.request('worker', 'process', data),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Worker timeout')), 5000)
            )
        ]);
        
        return result;
    } finally {
        await client.stop().catch(() => {});
        workerProcess.kill('SIGTERM');
    }
}
```

### 5. Wait for Server Ready Before Sending Messages

In separate processes, the server may not be immediately ready. Wait before sending:

```javascript
// server-process.js
const server = new pIpc('server', { appid: 'com.example' });
await server.start();
server.on('work', (data) => doWork(data));
console.log('SERVER_READY');  // Signal that server is ready

// main-process.js
const serverProcess = spawn('node', ['server-process.js']);

// Wait for ready signal
await new Promise(resolve => {
    serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('SERVER_READY')) {
            resolve();
        }
    });
});

// Now safe to send requests
const client = new pIpc('client', { appid: 'com.example' });
await client.start();
const result = await client.request('server', 'work', 'data');
```

### 6. Handle Process Exits Gracefully

Child processes should handle termination signals properly:

```javascript
// worker.js
const pIpc = require('p-ipc');
const server = new pIpc('worker', { appid: 'com.example' });

await server.start();
server.on('process', (data) => {
    // ... work ...
});

process.on('SIGTERM', async () => {
    console.log('Worker shutting down...');
    try {
        await server.stop();
    } catch (err) {
        console.error('Stop error:', err);
    }
    process.exit(0);
});

console.log('Worker ready');
```

## Multi-Process Examples

The real power of p-ipc shines when you have **separate Node.js processes** communicating with each other:

### Example 1: Worker Process Pattern

**main.js** - Main process that delegates work to workers
```javascript
const pIpc = require('p-ipc');
const { spawn } = require('child_process');

async function main() {
    // Start a worker process
    const workerProcess = spawn('node', ['worker.js']);
    
    // Create IPC client
    const client = new pIpc('main', {
        appid: 'com.example.worker-pool',
    });
    await client.start();
    
    // Give worker time to start
    await new Promise(r => setTimeout(r, 1000));
    
    // Send work to the worker
    console.log('Sending task to worker...');
    const result = await client.request('worker', 'process-data', {
        numbers: [1, 2, 3, 4, 5],
        operation: 'sum'
    });
    
    console.log('Worker result:', result); // { total: 15 }
    
    // Cleanup
    await client.stop();
    workerProcess.kill();
}

main();
```

**worker.js** - Worker process handling requests
```javascript
const pIpc = require('p-ipc');

async function main() {
    const worker = new pIpc('worker', {
        appid: 'com.example.worker-pool',
    });
    await worker.start();
    
    // Register handler for data processing
    worker.on('process-data', (data) => {
        if (data.operation === 'sum') {
            const total = data.numbers.reduce((a, b) => a + b, 0);
            return { total };
        }
        throw new Error('Unknown operation');
    });
    
    console.log('Worker ready, waiting for tasks...');
}

main().catch(console.error);
```

### Example 2: Microservices Pattern

**api-server.js** - REST API that delegates to microservices
```javascript
const pIpc = require('p-ipc');
const http = require('http');

async function main() {
    const api = new pIpc('api-server', {
        appid: 'com.example.microservices',
    });
    await api.start();
    
    // Create HTTP server that uses IPC
    const server = http.createServer(async (req, res) => {
        try {
            if (req.url === '/users' && req.method === 'GET') {
                // Delegate to user-service
                const users = await api.request('user-service', 'get-all-users');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(users));
            } else if (req.url.startsWith('/products') && req.method === 'GET') {
                // Delegate to product-service
                const products = await api.request('product-service', 'get-all-products');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(products));
            }
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    });
    
    server.listen(3000);
    console.log('API server listening on port 3000');
}

main().catch(console.error);
```

**user-service.js** - User microservice
```javascript
const pIpc = require('p-ipc');

async function main() {
    const service = new pIpc('user-service', {
        appid: 'com.example.microservices',
    });
    await service.start();
    
    // Mock database
    const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
    ];
    
    service.on('get-all-users', () => {
        return users;
    });
    
    console.log('User service ready');
}

main().catch(console.error);
```

### Example 3: Progress Reporting with Worker

**batch-processor.js** - Main process
```javascript
const pIpc = require('p-ipc');
const { spawn } = require('child_process');

async function processBatch() {
    const processor = spawn('node', ['batch-worker.js']);
    
    const client = new pIpc('processor', {
        appid: 'com.example.batch',
    });
    await client.start();
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Starting batch processing...');
    const result = await client.request(
        'batch-worker',
        'process-batch',
        ['file1.txt', 'file2.txt', 'file3.txt'],
        (progress) => {
            console.log(`Progress: ${progress.current}/${progress.total} - ${progress.message}`);
        }
    );
    
    console.log('Batch complete:', result);
    
    await client.stop();
    processor.kill();
}

processBatch().catch(console.error);
```

**batch-worker.js** - Worker process with progress reporting
```javascript
const pIpc = require('p-ipc');

async function main() {
    const worker = new pIpc('batch-worker', {
        appid: 'com.example.batch',
    });
    await worker.start();
    
    worker.on('process-batch', async (files, onProgress) => {
        const results = [];
        
        for (let i = 0; i < files.length; i++) {
            // Simulate processing
            await new Promise(r => setTimeout(r, 500));
            
            results.push({ file: files[i], processed: true });
            
            // Send progress update
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: files.length,
                    message: `Processed ${files[i]}`
                });
            }
        }
        
        return { processed: results.length, results };
    });
    
    console.log('Batch worker ready');
}

main().catch(console.error);
```

## API Documentation

### Constructor

```javascript
new pIpc(id, config)
```

- **id** (string): Unique identifier for this IPC instance
- **config** (object): Configuration object passed to `node-ipc`:
  - `appid` (string): Application identifier (required, used to organize IPC files)
  - `socketRoot` (string): Path where socket files are stored (optional, defaults to system temp)
  - Other `node-ipc` configuration options are supported

### Methods

#### `start()`

Start the IPC server.

```javascript
await server.start();
```

**Returns:** Promise that resolves when the server is ready

#### `stop()`

Stop the IPC server and close all connections.

```javascript
await server.stop();
```

**Returns:** Promise that resolves when the server is fully stopped

#### `request(id, channel, ...args, [onmessage])`

Send a request and wait for a response.

```javascript
// Simple request
const result = await client.request('server', 'add', 5, 3);

// With streaming messages
const result = await client.request('server', 'download', 'file.zip', (progress) => {
    console.log(`Download progress: ${progress}%`);
});
```

- **id** (string): ID of the target IPC instance
- **channel** (string): Event name on the target instance
- **args** (any): Arguments to pass to the handler (supports multiple arguments)
- **onmessage** (function, optional): Callback for intermediate messages from the handler
- **Returns:** Promise that resolves with the handler's return value

#### `send(id, channel, ...args)`

Send a one-way message without expecting a response.

```javascript
await client.send('server', 'log', 'User login attempt', { userId: 123 });
```

- **id** (string): ID of the target IPC instance
- **channel** (string): Event name on the target instance
- **args** (any): Arguments to pass to the handler
- **Returns:** Promise that resolves when the message is sent

#### `reply(id, rid, channel, data)`

Send a reply message (used internally by handlers, but available for advanced use).

```javascript
await server.reply(senderId, requestId, 'response', { data: result });
```

#### `on(channel, handler, [context])`

Register an event handler on this IPC instance.

```javascript
// Simple handler
server.on('multiply', (a, b) => {
    return a * b;
});

// Async handler
server.on('fetch-data', async (url) => {
    const response = await fetch(url);
    return response.json();
});

// Handler with streaming messages
server.on('process-items', async (items, onmessage) => {
    for (const item of items) {
        await processItem(item);
        if (onmessage) {
            onmessage({ status: 'processing', item });
        }
    }
    return { status: 'complete', count: items.length };
});

// Handler with custom context
const processor = {
    multiplier: 10,
    compute(n) {
        return n * this.multiplier;
    }
};

server.on('compute', function(n) {
    return this.compute(n);
}, processor);
```

- **channel** (string): Event name to listen for
- **handler** (function): Async or sync function that handles the request
  - If the handler has an `onmessage` parameter (last parameter before return), you can call it to send intermediate messages
  - Return value is sent as the response
  - Errors thrown are automatically sent to the requester
- **context** (object, optional): Object to use as `this` when calling the handler

#### `off(channel, handler)`

Unregister an event handler.

```javascript
server.off('multiply', myHandler);
```

- **channel** (string): Event name
- **handler** (function): The handler function to remove

## Traditional Examples (In-Process)

The examples above show separate Node processes. For reference, here's how p-ipc can also be used within a single process (useful for testing and simple scenarios):

### Simple Calculator (In-Process)

```javascript
const pIpc = require('p-ipc');

// Server
const server = new pIpc('calculator', { appid: 'com.example.calc' });
await server.start();

server.on('add', (a, b) => a + b);
server.on('subtract', (a, b) => a - b);
server.on('multiply', (a, b) => a * b);

// Client
const client = new pIpc('client', { appid: 'com.example.calc' });
await client.start();

console.log(await client.request('calculator', 'add', 10, 5)); // 15
console.log(await client.request('calculator', 'multiply', 4, 7)); // 28
```

### File Processing with Progress (In-Process)

```javascript
// Server with streaming
server.on('process-file', async (filename, onmessage) => {
    const lines = readFileLines(filename);
    const results = [];
    
    for (let i = 0; i < lines.length; i++) {
        results.push(processLine(lines[i]));
        
        // Send progress updates
        if (onmessage) {
            onmessage({
                current: i + 1,
                total: lines.length,
                progress: ((i + 1) / lines.length * 100).toFixed(1) + '%'
            });
        }
    }
    
    return { processed: results.length, results };
});

// Client usage
const result = await client.request(
    'worker',
    'process-file',
    'data.txt',
    (progress) => {
        console.log(`Progress: ${progress.progress}`);
    }
);
```

### Error Handling

```javascript
server.on('divide', (a, b) => {
    if (b === 0) {
        throw new Error('Division by zero');
    }
    return a / b;
});

// Client
try {
    await client.request('calculator', 'divide', 10, 0);
} catch (err) {
    console.error('Error:', err.message); // "Division by zero"
}
```

### Multiple Processes

You can create multiple independent instances communicating with each other:

```javascript
// Process A
const processA = new pIpc('process-a', { appid: 'com.example.distributed' });
await processA.start();

processA.on('work', async (data) => {
    console.log('Processing:', data);
    return { status: 'done', input: data };
});

// Process B
const processB = new pIpc('process-b', { appid: 'com.example.distributed' });
await processB.start();

// Send work to Process A
const result = await processB.request('process-a', 'work', 'some data');
console.log(result); // { status: 'done', input: 'some data' }
```

## Data Type Support

p-ipc uses BSON serialization for data transport, which supports:

- **Primitives**: string, number, boolean, null, undefined
- **Collections**: objects, arrays
- **Special Types**: Date, RegExp, Binary, ObjectId, Decimal128, etc.
- **Nested Structures**: Objects and arrays of arbitrary depth
- **Circular References**: Automatically handled (converted to `[Circular]`)

**Note**: Functions cannot be serialized and will be omitted from serialized data.

## Error Handling

Errors thrown in handlers are automatically:
1. Serialized (including stack traces and custom properties)
2. Sent to the requester
3. Deserialized and thrown in the client code

```javascript
// Server
server.on('risky-operation', () => {
    const error = new Error('Something went wrong');
    error.code = 'ERR_OPERATION';
    error.details = { retryable: true };
    throw error;
});

// Client
try {
    await client.request('server', 'risky-operation');
} catch (err) {
    console.log(err.message); // "Something went wrong"
    console.log(err.code); // "ERR_OPERATION"
    console.log(err.details); // { retryable: true }
}
```

## Configuration

### Common node-ipc Options

```javascript
const instance = new pIpc('myapp', {
    appid: 'com.example.app',              // Required: app identifier
    socketRoot: '/custom/socket/path',     // Optional: socket file location
    networkHost: 'localhost',              // Optional: host for network IPC
    networkPort: 8000,                     // Optional: port for network IPC
    encoding: 'utf8',                      // Optional: message encoding
    silent: true,                          // Optional: suppress node-ipc logging
});
```

For more `node-ipc` configuration options, see the [node-ipc documentation](https://github.com/RIAEvangelist/node-ipc).

## Performance Considerations

- **Socket Files**: By default, p-ipc uses Unix domain sockets (on Unix systems) or named pipes (on Windows) for communication. These are very efficient for local IPC.
- **Connection Pooling**: Connections are automatically maintained and reused, so subsequent requests to the same process are fast.
- **Message Serialization**: BSON serialization is fast but adds overhead for very large objects. For extremely high-throughput scenarios, consider splitting data across multiple requests.

## Limitations

- **Same Machine Only**: p-ipc is designed for inter-process communication on the same machine. For network communication, consider using gRPC, HTTP, or message queues.
- **One Handler Per Channel**: Each channel can only have one active handler at a time. Registering a new handler for the same channel replaces the previous one.
- **No Built-in Reconnection**: If a process dies and restarts, existing connections won't automatically reconnect. The next request will establish a new connection.

## Platform-Specific Notes

### Windows
- **Socket Type**: Uses Windows Named Pipes (`\\.\pipe\...`)
- **Socket Naming**: p-ipc combines `appspace` with the instance ID to create socket names
  - Format: `\\.\pipe\{appspace}.{id}`
  - Example: `\\.\pipe\com.example.app.server`
- **Unique Naming**: To avoid collisions when running multiple test suites, use unique appids:
  ```javascript
  // Good: Unique appid per test
  const appid = `test-${Date.now()}-${Math.random()}`;
  ```
- **Path Limitations**: Windows named pipe names cannot contain certain characters (`:`, `/`, `\`)

### Unix/Linux/macOS
- **Socket Type**: Uses Unix Domain Sockets
- **Socket Location**: Stored in temporary directory (typically `/tmp/`)
- **Path Format**: `/tmp/{appspace}{id}`
- **Cleanup**: Socket files are cleaned up automatically on shutdown

### Cross-Platform Consideration
Write your code to work on both platforms:

```javascript
const pIpc = require('p-ipc');

const config = {
    appid: 'com.example.myapp',
    silent: true,
    // On Windows: creates \\.\pipe\com.example.myapp.{id}
    // On Unix: creates /tmp/com.example.myapp.{id}
};

const instance = new pIpc('myservice', config);
```

## Testing

### Unit Testing with p-ipc

For testing handlers in isolation, use in-process instances:

```javascript
// test.js
const assert = require('assert');
const pIpc = require('p-ipc');

describe('Math Operations', () => {
    let server, client;
    
    beforeEach(async () => {
        server = new pIpc('server', { appid: 'com.test.math' });
        await server.start();
        
        // Register handlers AFTER start
        server.on('add', (a, b) => a + b);
        
        client = new pIpc('client', { appid: 'com.test.math' });
        await client.start();
    });
    
    afterEach(async () => {
        await client.stop().catch(() => {});
        await server.stop().catch(() => {});
    });
    
    it('should add two numbers', async () => {
        const result = await client.request('server', 'add', 5, 3);
        assert.strictEqual(result, 8);
    });
});
```

### Integration Testing with Separate Processes

For testing real multiprocess scenarios, spawn child processes:

```javascript
// test.js
const { spawn } = require('child_process');
const pIpc = require('p-ipc');

describe('Multi-process Communication', () => {
    it('should communicate between processes', async () => {
        // Start server process
        const serverProcess = spawn('node', ['server.js']);
        
        // Create client
        const client = new pIpc('client', { appid: 'com.test.app' });
        await client.start();
        
        // Wait for server to be ready
        await new Promise(resolve => {
            serverProcess.stdout.on('data', (data) => {
                if (data.toString().includes('SERVER_READY')) {
                    resolve();
                }
            });
        });
        
        try {
            // Send request
            const result = await Promise.race([
                client.request('server', 'compute', 10),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);
            
            assert.strictEqual(result, 100);
        } finally {
            await client.stop().catch(() => {});
            serverProcess.kill('SIGTERM');
        }
    });
});
```

### Test Suite Best Practices

The p-ipc package includes a comprehensive test suite with 21 tests covering:

- ✅ **In-process communication** - Fundamental request/response patterns
- ✅ **Multi-process communication** - Real spawned Node processes
- ✅ **Error handling** - Errors thrown in handlers are propagated correctly
- ✅ **Streaming messages** - Intermediate message callbacks work correctly
- ✅ **Cleanup** - Proper connection teardown
- ✅ **Timeout handling** - Requests timeout when server is unavailable
- ✅ **Process crashes** - Detection of crashed remote processes

Run tests with:
```bash
npm test
```

**Important**: The test script uses `mocha --exit` to force process termination after tests complete. This is **required** because p-ipc maintains persistent IPC connections that prevent Node.js from exiting naturally. Without the `--exit` flag, tests will complete successfully but the process will hang indefinitely. This is expected behavior and applies to any application using p-ipc for real inter-process communication.

For test examples, see:
- `test/integration.js` - In-process IPC tests
- `test/multiprocess-*.js` - Multi-process scenario tests

## Troubleshooting

### "TypeError: this._ipc.server.on is not a function"
**Solution**: Call `start()` before `on()`. See [Handler Registration Timing](#-critical-handler-registration-timing).

### "EADDRINUSE: address already in use"
**Cause**: Two instances are using the same socket (same appid and ID).

**Solution**: Use unique appids:
```javascript
// In separate test files or processes
const appid1 = `com.example.app-${process.pid}-${Date.now()}`;
const instance1 = new pIpc('service', { appid: appid1 });

const appid2 = `com.example.app-${process.pid}-${Date.now()}`;
const instance2 = new pIpc('service', { appid: appid2 });
```

### "EACCES: permission denied"
Ensure the socket directory is writable. Check the `socketRoot` configuration.

### "Connection timeout"
Make sure both IPC instances:
1. Have the same `appid` configured
2. Have the other instance's ID registered (via previous `request`, `send`, or `on`)
3. Are both started with `start()`

### "ENOENT: no such file or directory"
On Windows, this typically means the named pipe doesn't exist (server not running).

**Solution**: Ensure the server is started and listening on the same appid before making requests.

## Working Examples in Tests

The best way to learn p-ipc is to examine the test suite, which includes real, working examples:

### In-Process Examples
See `test/integration.js` for comprehensive in-process IPC tests:
- Simple arithmetic operations (add, subtract, multiply)
- Object and array serialization
- Error handling and propagation
- Streaming messages with progress callbacks

### Multi-Process Examples  
See `test/multiprocess-*.js` files for real multi-process scenarios:
- `multiprocess-01-basic.js` - Basic cross-process communication
- `multiprocess-02-disconnect.js` - Client reconnection and timeout handling
- `multiprocess-03-crash.js` - Server crash detection
- `multiprocess-04-multiple.js` - Multiple concurrent clients
- `multiprocess-05-streaming.js` - Progress reporting across processes
- `multiprocess-06-connection-mgmt.js` - Connection lifecycle management
- `multiprocess-07-error-handling.js` - Error propagation
- `multiprocess-08-shutdown.js` - Graceful shutdown

Each test file is standalone and shows:
- How to spawn child processes
- Proper initialization order
- Error handling and timeouts
- Clean resource cleanup

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License - see LICENSE file for details

## Author

Cory Braun <cory.l.braun@gmail.com>
