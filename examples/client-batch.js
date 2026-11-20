/**
 * Example: Client that sends batch processing jobs
 * First run examples/server-batch-processor.js in one terminal
 * Then run this file in another terminal
 */

const pIpc = require('../index.js');

async function main() {
    console.log('Starting batch job client...\n');
    
    const client = new pIpc('batch-client', {
        appid: 'com.example.batch-process',
    });
    
    await client.start();
    
    // Give server time to start
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Connected to batch processor.\n');
    console.log('Submitting batch job: Processing 5 files\n');
    console.log('Progress:');
    
    try {
        const files = [
            'document1.pdf',
            'document2.pdf',
            'document3.pdf',
            'document4.pdf',
            'document5.pdf'
        ];
        
        const result = await client.request(
            'batch-processor',
            'process-files',
            files,
            (progress) => {
                // This callback is called for each progress update
                const bar = '█'.repeat(progress.percentage / 2) + 
                           '░'.repeat(50 - progress.percentage / 2);
                console.log(`  [${bar}] ${progress.percentage}% - ${progress.current}/${progress.total}`);
                console.log(`    Processing: ${progress.lastFile}`);
            }
        );
        
        console.log('\n✓ Batch job completed!\n');
        console.log('Results:');
        console.log(`  Files processed: ${result.filesProcessed}`);
        console.log(`  Total data size: ${(result.totalSize / 1024).toFixed(2)} KB`);
        console.log('\nDetailed results:');
        result.results.forEach(r => {
            console.log(`  - ${r.file}: ${r.size} bytes`);
        });
        
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
    
    await client.stop();
    console.log('\nClient disconnected.');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
