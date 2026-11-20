const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../');
const { getTempDir, spawnServerWithCapture, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Server Error Handling', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'errors';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle handler errors gracefully on server', async function () {
        const { appspace, appid } = getAppConfig(descriptor);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('error-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    let requestCount = 0;
    
    server.on('maybe-error', (shouldError) => {
        requestCount++;
        if (shouldError) {
            throw new Error('Handler error on request ' + requestCount);
        }
        return { success: true, request: requestCount };
    });
    
    console.log('SERVER_READY');
    
    process.on('SIGTERM', async () => {
        try {
            await Promise.race([
                server.stop(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
            ]);
        } catch (err) {
            // Ignore stop errors
        }
        process.exit(0);
    });
}

main().catch(console.error);
        `);
        
        const serverProcess = spawn('node', [serverScript]);
        await waitForServerReady(serverProcess);
        
        try {
            const client = new pIpc('error-client', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            let result1 = await client.request('error-server', 'maybe-error', false);
            assert.strictEqual(result1.request, 1, 'First request should succeed');
            
            try {
                await client.request('error-server', 'maybe-error', true);
                assert.fail('Should have thrown error from handler');
            } catch (err) {
                assert(err.message.includes('Handler error'), 'Should get handler error');
            }
            
            const result3 = await client.request('error-server', 'maybe-error', false);
            assert.strictEqual(result3.request, 3, 'Server should continue working after error');
            
            try {
                await Promise.race([
                    client.stop(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                ]);
            } catch (err) {
                // Ignore stop errors
            }
        } finally {
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    });
});
