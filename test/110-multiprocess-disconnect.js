const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../index.js');
const { getTempDir, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Client Disconnect Scenarios', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'disconnect';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle client disconnect and reconnect', async function () {
        const { appspace, appid } = getAppConfig(`${descriptor}.1`);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    let requestCount = 0;
    server.on('ping', () => {
        requestCount++;
        return { pong: true, count: requestCount };
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
            const client1 = new pIpc('client1', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client1.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const result1 = await client1.request('server', 'ping');
            assert.strictEqual(result1.count, 1, 'Server should have received 1 request');
            
            try {
                await Promise.race([
                    client1.stop(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                ]);
            } catch (err) {
                // Ignore stop errors
            }
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const client2 = new pIpc('client2', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client2.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const result2 = await client2.request('server', 'ping');
            assert.strictEqual(result2.count, 2, 'Server should count request from new client as request #2');
            
            try {
                await Promise.race([
                    client2.stop(),
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

    it('should timeout when server is unavailable', async function () {
        const { appspace, appid } = getAppConfig(`${descriptor}.2`);
        
        const client = new pIpc('orphan-client', {
            appspace: appspace,
            appid: appid,
            silent: true,
        });
        await client.start();
        
        try {
            const promise = client.request('nonexistent-server', 'test', 'data');
            
            await Promise.race([
                promise,
                new Promise((resolve, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), 2000)
                )
            ]);
            
            assert.fail('Should have timed out or thrown error when server unavailable');
        } catch (err) {
            assert(
                err.message.includes('timeout') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOENT'),
                `Should timeout or get connection error, got: ${err.message}`
            );
        } finally {
            try {
                await Promise.race([
                    client.stop(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                ]);
            } catch (err) {
                // Ignore stop errors
            }
        }
    });
});
