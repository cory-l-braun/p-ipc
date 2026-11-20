/**
 * Example: Producer/Consumer Pattern
 * Run this in one terminal, then run examples/consumer.js in another
 * 
 * This example demonstrates:
 * - Multiple producers pushing data to a consumer
 * - Async queue processing
 * - Independent process orchestration
 */

const pIpc = require('../index.js');

async function main() {
    console.log('Starting data consumer worker...\n');
    
    const consumer = new pIpc('data-consumer', {
        appid: 'com.example.producer-consumer',
    });
    
    await consumer.start();
    
    // Queue to hold incoming data items
    const queue = [];
    let processing = false;
    
    async function processQueue() {
        if (processing || queue.length === 0) return;
        processing = true;
        
        while (queue.length > 0) {
            const item = queue.shift();
            console.log(`Processing: ${item.producer} → ${item.data}`);
            
            // Simulate processing
            await new Promise(r => setTimeout(r, 300));
        }
        
        processing = false;
    }
    
    // Handler for receiving data
    consumer.on('send-data', async (data, onProgress) => {
        console.log(`Received from ${data.producer}: "${data.message}"`);
        
        queue.push(data);
        
        if (onProgress) {
            onProgress({
                queueSize: queue.length,
                message: `Added to queue (size: ${queue.length})`
            });
        }
        
        await processQueue();
        
        return {
            success: true,
            queueSize: queue.length,
            message: `Data from ${data.producer} received and queued`
        };
    });
    
    // Handler for getting queue status
    consumer.on('get-status', () => {
        return {
            queueSize: queue.length,
            processing: processing,
            timestamp: new Date().toISOString()
        };
    });
    
    console.log('Data consumer is ready!');
    console.log('Waiting for producers to send data...\n');
    console.log('Run examples/producer-*.js files to start producing data.');
    
    process.on('SIGINT', async () => {
        console.log('\nShutting down consumer...');
        await consumer.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
