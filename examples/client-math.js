/**
 * Example: Client that communicates with math worker
 * First run examples/server-math-worker.js in one terminal
 * Then run this file in another terminal
 */

const pIpc = require('../index.js');

async function main() {
    console.log('Starting client...');
    
    const client = new pIpc('math-client', {
        appid: 'com.example.simple-worker',
    });
    
    await client.start();
    
    // Give worker time to start if needed
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Connected! Sending requests to worker...\n');
    
    try {
        // Test addition
        console.log('→ Requesting: 10 + 5');
        const sum = await client.request('math-worker', 'add', 10, 5);
        console.log('← Worker responded: 10 + 5 = ' + sum + '\n');
        
        // Test multiplication
        console.log('→ Requesting: 6 * 7');
        const product = await client.request('math-worker', 'multiply', 6, 7);
        console.log('← Worker responded: 6 * 7 = ' + product + '\n');
        
        // Test async power
        console.log('→ Requesting: 2^10 (async computation)');
        const power = await client.request('math-worker', 'power', 2, 10);
        console.log('← Worker responded: 2^10 = ' + power + '\n');
        
        // Send multiple requests in parallel
        console.log('→ Sending 3 requests in parallel...');
        const results = await Promise.all([
            client.request('math-worker', 'add', 100, 200),
            client.request('math-worker', 'multiply', 12, 12),
            client.request('math-worker', 'power', 3, 4)
        ]);
        console.log('← All responses received:');
        console.log('   100 + 200 = ' + results[0]);
        console.log('   12 * 12 = ' + results[1]);
        console.log('   3^4 = ' + results[2] + '\n');
        
        console.log('✓ All tests passed!');
        
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
    
    await client.stop();
    console.log('Client disconnected.');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
