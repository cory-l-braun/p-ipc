/**
 * Worker process that streams messages back to client
 */

const pIpc = require('../index.js');

async function main() {
    const worker = new pIpc('worker-stream', {
        appid: 'com.example.stream-test',
    });
    
    await worker.start();
    
    worker.on('stream-data', async (count, onProgress) => {
        for (let i = 1; i <= count; i++) {
            if (onProgress) {
                onProgress(`chunk ${i}`);
                await new Promise(r => setTimeout(r, 50));
            }
        }
        return `Complete: ${count} chunks`;
    });
    
    console.log('Worker ready');
    
    process.on('SIGTERM', async () => {
        await worker.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Worker error:', err);
    process.exit(1);
});
