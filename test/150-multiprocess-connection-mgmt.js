const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../index.js');
const { getTempDir, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Server Connection Management', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'connmgmt';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should clean up disconnected client connections', async function () {
        const { appspace, appid } = getAppConfig(`${descriptor}.1`);
        
        const serverScript = createServerScript(`${descriptor}.1.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('cleanup-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    let activeConnections = 0;
    let totalConnections = 0;
    
    server.on('connect', () => {
        activeConnections++;
        totalConnections++;
        console.log('CONNECT:' + activeConnections);
        return { status: 'connected' };
    });
    
    server.on('disconnect', () => {
        activeConnections--;
        console.log('ACTIVE:' + activeConnections);
        return { status: 'disconnected', active: activeConnections };
    });
    
    server.on('echo', (data) => {
        return { data, activeConnections };
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
            const clientCount = 5;
            
            for (let i = 0; i < clientCount; i++) {
                const client = new pIpc(`cleanup-client-${i}`, {
                    appspace: appspace,
                    appid: appid,
                    silent: true,
                });
                await client.start();
                
                await client.request('cleanup-server', 'connect');
                await client.request('cleanup-server', 'echo', 'test');
                
                const disconnectResult = await client.request('cleanup-server', 'disconnect');
                assert.strictEqual(
                    disconnectResult.active,
                    0,
                    `After disconnect, server should report 0 active connections, got ${disconnectResult.active}`
                );
                
                try {
                    await Promise.race([
                        client.stop(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                    ]);
                } catch (err) {
                    // Ignore stop errors
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            const finalClient = new pIpc('final-client', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await finalClient.start();
            const finalEcho = await finalClient.request('cleanup-server', 'echo', 'final');
            assert.strictEqual(finalEcho.data, 'final', 'Server should still respond after multiple client cycles');
            try {
                await Promise.race([
                    finalClient.stop(),
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

    it('should handle rapid client connect/disconnect cycles', async function () {
        const { appspace, appid } = getAppConfig(`${descriptor}.2`);
        
        const serverScript = createServerScript(`${descriptor}.2.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('rapid-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    let requestCount = 0;
    server.on('ping', () => {
        requestCount++;
        return { count: requestCount };
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
            const cycles = 5;
            let totalRequests = 0;
            
            for (let i = 0; i < cycles; i++) {
                const client = new pIpc(`rapid-client-${i}`, {
                    appspace: appspace,
                    appid: appid,
                    silent: true,
                });
                await client.start();
                
                for (let j = 0; j < 3; j++) {
                    const result = await client.request('rapid-server', 'ping');
                    totalRequests++;
                    assert.strictEqual(result.count, totalRequests, 
                        `Request ${totalRequests} should be counted correctly on server`);
                }
                
                try {
                    await Promise.race([
                        client.stop(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 1000))
                    ]);
                } catch (err) {
                    // Ignore stop errors
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            assert.strictEqual(totalRequests, cycles * 3, 'All requests should have been processed');
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
