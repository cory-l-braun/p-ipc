const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../');
const { getTempDir, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Server Crash Handling', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'crash';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should detect server crash on subsequent request', async function () {
        const { appspace, appid } = getAppConfig(descriptor);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('crashable-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    let callCount = 0;
    server.on('call', () => {
        callCount++;
        if (callCount === 2) {
            process.exit(1);
        }
        return { ok: true, call: callCount };
    });
    
    console.log('SERVER_READY');
}

main().catch(console.error);
        `);
        
        const serverProcess = spawn('node', [serverScript]);
        await waitForServerReady(serverProcess);
        
        try {
            const client = new pIpc('crash-test-client', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            const result1 = await client.request('crashable-server', 'call');
            assert.strictEqual(result1.call, 1, 'First call should succeed');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                const promise = client.request('crashable-server', 'call');
                await Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 2000))
                ]);
                assert.fail('Should have failed due to server crash');
            } catch (err) {
                assert(
                    err.message.includes('ECONNREFUSED') || err.message.includes('ENOENT') || err.message.includes('timeout') || err.code === 'ECONNREFUSED',
                    `Should get connection error, got: ${err.message}`
                );
            }
            
            try {
                await Promise.race([
                    client.stop(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                ]);
            } catch (err) {
                // Ignore stop errors
            }
        } finally {
            if (!serverProcess.killed) {
                serverProcess.kill('SIGKILL');
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    });
});
