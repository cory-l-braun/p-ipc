# p-ipc Examples

These examples demonstrate real multi-process communication using p-ipc.

## Running the Examples

Each example consists of a server (worker) and a client. You need to run them in separate terminals.

### Example 1: Math Worker

This example shows basic request/response communication between processes.

**Terminal 1** - Start the worker:
```bash
node server-math-worker.js
```

You should see: `Math worker is ready!`

**Terminal 2** - Run the client:
```bash
node client-math.js
```

The client will send several math operations (add, multiply, power) to the worker and display results.

**What it demonstrates:**
- Basic request/response communication
- Synchronous operations (add, multiply)
- Asynchronous operations (power)
- Parallel requests using `Promise.all()`

### Example 2: Batch Processor

This example shows how to handle progress updates from a worker process.

**Terminal 1** - Start the batch processor:
```bash
node server-batch-processor.js
```

You should see: `Batch processor ready!`

**Terminal 2** - Run the client:
```bash
node client-batch.js
```

The client will submit a batch job and display progress as the worker processes files. Each progress update is shown with a visual progress bar.

**What it demonstrates:**
- Streaming messages from worker to client
- Progress reporting pattern
- Handling long-running operations
- Real-world batch processing scenario

### Example 3: Producer/Consumer Pattern

This example shows multiple independent producers sending data to a single consumer process.

**Terminal 1** - Start the consumer:
```bash
node consumer.js
```

You should see: `Data consumer is ready!`

**Terminal 2** - Run Producer 1:
```bash
node producer-1.js
```

**Terminal 3** (optional) - Run Producer 2 simultaneously:
```bash
node producer-2.js
```

Both producers will send data to the consumer, which queues and processes it. The consumer coordinates the work while producers operate independently.

**What it demonstrates:**
- Multiple processes communicating with one central coordinator
- Queue management from multiple sources
- Concurrent data production
- Status monitoring pattern
- Real-world distributed processing scenario

## Creating Your Own Examples

To create a new server-client pair:

1. **Create a server** (`server-*.js`):
```javascript
const pIpc = require('../index.js');

async function main() {
    const worker = new pIpc('my-worker', {
        appid: 'com.example.myapp',
    });
    
    await worker.start();
    
    worker.on('my-operation', (data) => {
        // Handle the request
        return { result: 'something' };
    });
    
    console.log('Worker ready');
    
    process.on('SIGINT', async () => {
        await worker.stop();
        process.exit(0);
    });
}

main().catch(console.error);
```

2. **Create a client** (`client-*.js`):
```javascript
const pIpc = require('../index.js');

async function main() {
    const client = new pIpc('my-client', {
        appid: 'com.example.myapp',
    });
    
    await client.start();
    
    // Give server time to start
    await new Promise(r => setTimeout(r, 1000));
    
    try {
        const result = await client.request('my-worker', 'my-operation', {/* data */});
        console.log('Result:', result);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
    
    await client.stop();
    process.exit(0);
}

main().catch(console.error);
```

3. **Important**: Both server and client must use the same `appid`!

## Tips

- Both processes must have the same `appid` to communicate
- The server should be started first
- Use `console.log` statements to see what's happening
- Errors from the server are automatically propagated to the client
- Use Ctrl+C to stop the server or client

## Troubleshooting

**Client times out waiting for connection:**
- Make sure the server is started first
- Check that both have the same `appid`
- Wait a moment before sending requests (sockets need time to establish)

**"Cannot find module 'p-ipc'":**
- Make sure you're running from the examples directory
- Run `npm install` in the parent directory first

**Multiple instances can't communicate:**
- Each instance needs a unique ID (the first parameter to `new pIpc()`)
- Clients use that ID to connect to servers
