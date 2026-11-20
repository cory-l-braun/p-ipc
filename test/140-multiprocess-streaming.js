const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../index.js');
const { getTempDir, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Message Streaming', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'stream';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should stream messages across process boundary', async function () {
        const { appspace, appid } = getAppConfig(descriptor);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('stream-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    server.on('count', async (n, onmessage) => {
        for (let i = 1; i <= n; i++) {
            if (onmessage) {
                onmessage({ number: i, timestamp: Date.now() });
            }
            await new Promise(r => setTimeout(r, 50));
        }
        return { total: n, completed: true };
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
            const client = new pIpc('stream-client', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const messages = [];
            const result = await client.request('stream-server', 'count', 5, (msg) => {
                messages.push(msg);
            });
            
            assert.strictEqual(messages.length, 5, 'Should receive 5 progress messages');
            messages.forEach((msg, idx) => {
                assert.strictEqual(msg.number, idx + 1, `Message ${idx} should have number ${idx + 1}`);
                assert(msg.timestamp, `Message ${idx} should have timestamp`);
            });
            
            assert.strictEqual(result.total, 5, 'Final result should have total=5');
            assert.strictEqual(result.completed, true, 'Final result should indicate completion');
            
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
            await new Promise(resolve => {
                const exitTimeout = setTimeout(() => {
                    serverProcess.kill('SIGKILL');
                    resolve();
                }, 2000);
                
                serverProcess.on('exit', () => {
                    clearTimeout(exitTimeout);
                    resolve();
                });
            });
        }
    });
});
