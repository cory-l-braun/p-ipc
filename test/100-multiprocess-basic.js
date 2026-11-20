const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const pIpc = require('../');
const { createServerScript, indexPath, cleanup, getAppConfig, spawnServer } = require('./multiprocess-helpers');

describe('p-ipc Multiprocess - Basic Communication', function () {
    this.timeout(30000);

    after(cleanup);

    it('should communicate between processes', async function () {
        const descriptor = 'basic';
        const { appspace, appid } = getAppConfig(descriptor);
        
        const serverScript = createServerScript(`${descriptor}.js`,
`const pIpc = require(${JSON.stringify(indexPath)});

async function main() {
            console.log('[SERVER] Creating pIpc instance with appid:', ${JSON.stringify(appid)});
    
    const server = new pIpc('server', {
        appspace: ${JSON.stringify(appspace)},
        appid: ${JSON.stringify(appid)},
        silent: true,
    });
    
            console.log('[SERVER] pIpc instance created, calling start()...');
            await server.start();
            console.log('[SERVER] Server started successfully');
    
    server.on('multiply', (a, b) => {
        return a * b;
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
        
        const serverProcess = await spawnServer(serverScript);
        
        try {
            const client = new pIpc('client', {
                appspace: appspace,
                appid: appid,
                silent: true,
            });
            await client.start();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const result = await client.request('server', 'multiply', 7, 6);
            assert.strictEqual(result, 42, 'Server should return 7 * 6 = 42');
            
            // Stop client with timeout
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
            // Wait for process to exit, but don't hang forever
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
