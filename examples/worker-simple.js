/**
 * Simple worker process for multi-process testing
 * This process listens for requests and responds
 */

const pIpc = require('../index.js');

async function main() {
    const worker = new pIpc('worker-process', {
        appid: 'com.example.worker-test',
    });
    
    await worker.start();
    
    // Handler for simple arithmetic
    worker.on('add', (a, b) => {
        return a + b;
    });
    
    // Handler for async operations
    worker.on('async-compute', async (ms) => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`completed in ${ms}ms`);
            }, Math.min(ms, 100));
        });
    });
    
    // Handler that throws an error
    worker.on('throw-error', () => {
        throw new Error('Worker error: intentional failure');
    });
    
    console.log('Worker ready');
    
    // Keep process alive
    process.on('SIGTERM', async () => {
        await worker.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Worker error:', err);
    process.exit(1);
});
