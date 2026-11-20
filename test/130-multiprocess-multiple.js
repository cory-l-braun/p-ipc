const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../');
const { getTempDir, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Multiple Clients', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'multi';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle multiple concurrent clients', async function () {
        const { appspace, appid } = getAppConfig(descriptor);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('multi-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    server.on('work', async (id, duration) => {
        await new Promise(r => setTimeout(r, duration));
        return { id, completed: true, timestamp: Date.now() };
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
            const clients = [];
            for (let i = 0; i < 3; i++) {
                const c = new pIpc(`client-${i}`, {
                    appspace: appspace,
                    appid: appid,
                    silent: true,
                });
                await c.start();
                clients.push(c);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const promises = clients.map((client, idx) =>
                client.request('multi-server', 'work', idx, 100 + (idx * 50))
            );
            
            const results = await Promise.all(promises);
            
            assert.strictEqual(results.length, 3, 'Should have 3 results');
            results.forEach((result, idx) => {
                assert.strictEqual(result.id, idx, `Result ${idx} should have matching id`);
                assert.strictEqual(result.completed, true, `Result ${idx} should be completed`);
            });
            
            for (const client of clients) {
                try {
                    await Promise.race([
                        client.stop(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                    ]);
                } catch (err) {
                    // Ignore stop errors
                }
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
