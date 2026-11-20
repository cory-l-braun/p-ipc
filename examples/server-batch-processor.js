/**
 * Example: File processing worker with progress updates
 * Run this in one terminal, then run examples/client-batch.js in another
 */

const pIpc = require('../index.js');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('Starting batch processor worker...');
    
    const worker = new pIpc('batch-processor', {
        appid: 'com.example.batch-process',
    });
    
    await worker.start();
    
    // Handler that processes files with progress updates
    worker.on('process-files', async (fileList, onProgress) => {
        const results = [];
        
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            
            // Simulate file processing
            await new Promise(r => setTimeout(r, 300));
            
            const result = {
                file: file,
                size: Math.random() * 10000 | 0,
                processed: true,
                timestamp: new Date().toISOString()
            };
            
            results.push(result);
            
            // Send progress update to client
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: fileList.length,
                    percentage: ((i + 1) / fileList.length * 100).toFixed(0),
                    lastFile: file
                });
            }
        }
        
        return {
            filesProcessed: results.length,
            totalSize: results.reduce((sum, r) => sum + r.size, 0),
            results: results
        };
    });
    
    console.log('Batch processor ready!');
    console.log('Waiting for file processing requests...\n');
    console.log('Run examples/client-batch.js to send a batch job.');
    
    process.on('SIGINT', async () => {
        console.log('\nShutting down batch processor...');
        await worker.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
