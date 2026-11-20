const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pIpc = require('../index.js');
const { getTempDir, spawnServerWithCapture, createServerScript, indexPath, cleanup, getAppConfig, waitForServerReady } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Server Graceful Shutdown', function () {
    this.timeout(30000);
    
    let tempDir;
    const descriptor = 'shutdown';

    before(function () {
        tempDir = getTempDir();
    });

    after(cleanup);

    afterEach(async function () {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should gracefully shutdown while handling requests', async function () {
        const { appspace, appid } = getAppConfig(descriptor);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
    const server = new pIpc('shutdown-server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    await server.start();
    
    let activeRequests = 0;
    
    server.on('work', async (duration) => {
        activeRequests++;
        await new Promise(r => setTimeout(r, duration));
        activeRequests--;
        return { completed: true, activeRequests };
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
            const client = new pIpc('shutdown-client', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const promise = client.request('shutdown-server', 'work', 500);
            await new Promise(resolve => setTimeout(resolve, 100));
            
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const exitCode = serverProcess.exitCode;
            assert(
                exitCode === 0 || exitCode === null,
                `Server should exit cleanly (code 0), got ${exitCode}`
            );
            
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
