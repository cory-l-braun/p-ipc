/**
 * Worker pool member 1
 */

const pIpc = require('../index.js');

async function main() {
    const worker = new pIpc('worker-1', {
        appid: 'com.example.pool-test',
    });
    
    await worker.start();
    
    worker.on('process', (task) => {
        // Simulate some processing
        return `processed: ${task}`;
    });
    
    console.log('Worker 1 ready');
    
    process.on('SIGTERM', async () => {
        await worker.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Worker error:', err);
    process.exit(1);
});
