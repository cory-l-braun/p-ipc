/**
 * Example: Simple Worker Process
 * Run this file and then run examples/client-simple.js in another terminal
 */

const pIpc = require('../index.js');

async function main() {
    console.log('Starting worker process...');
    
    const worker = new pIpc('math-worker', {
        appid: 'com.example.simple-worker',
    });
    
    await worker.start();
    
    // Register math operations
    worker.on('add', (a, b) => {
        console.log(`Worker: Computing ${a} + ${b}`);
        return a + b;
    });
    
    worker.on('multiply', (a, b) => {
        console.log(`Worker: Computing ${a} * ${b}`);
        return a * b;
    });
    
    worker.on('power', async (base, exponent) => {
        console.log(`Worker: Computing ${base}^${exponent}`);
        // Simulate async computation
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(Math.pow(base, exponent));
            }, 500);
        });
    });
    
    console.log('Math worker is ready!');
    console.log('Waiting for requests...');
    console.log('');
    console.log('Run examples/client-simple.js in another terminal to send requests.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down worker...');
        await worker.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
