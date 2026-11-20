/**
 * Example: Producer #2
 * Run this in one terminal while consumer.js is running
 * Can be run alongside producer-1.js for concurrent data production
 */

const pIpc = require('../index.js');

async function main() {
    const producer = new pIpc('producer-2', {
        appid: 'com.example.producer-consumer',
    });
    
    await producer.start();
    
    // Give consumer time to start
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('Producer 2: Starting to send data...\n');
    
    try {
        const dataItems = [
            'scanning file system',
            'reading database',
            'compiling results'
        ];
        
        for (let i = 0; i < dataItems.length; i++) {
            const result = await producer.request(
                'data-consumer',
                'send-data',
                {
                    producer: 'Producer-2',
                    message: dataItems[i],
                    timestamp: new Date().toISOString()
                },
                (progress) => {
                    console.log(`  → Queue update: ${progress.message}`);
                }
            );
            
            console.log(`✓ Response: ${result.message}\n`);
            
            // Wait between sends
            await new Promise(r => setTimeout(r, 500));
        }
        
        // Check final status
        console.log('Checking final status...');
        const status = await producer.request('data-consumer', 'get-status');
        console.log(`Final status: Queue size = ${status.queueSize}, Processing = ${status.processing}`);
        
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
    
    await producer.stop();
    console.log('\nProducer 2 finished.');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
