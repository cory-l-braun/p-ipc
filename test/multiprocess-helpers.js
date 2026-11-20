const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.js');

function uniqueAppId(descriptor) {
    // Returns a unique identifier for socket naming
    // node-ipc uses this to generate unique socket paths
    return `test-${descriptor}-${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getAppConfig(descriptor) {
    // Returns complete config for unique ipc sockets
    // Both appspace and appid are needed for complete uniqueness
    const unique = `${descriptor}-${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
        appspace: `${unique}.`,
        appid: unique
    };
}

async function spawnServer(scriptPath, timeoutMs = 10000) {
    const serverProcess = spawn('node', [scriptPath]);
    let serverReady = false;
    let stdoutBuffer = '';
    let stderrBuffer = '';
    
    return new Promise((resolve, reject) => {
        serverProcess.stdout.on('data', (data) => {
            const str = data.toString();
            stdoutBuffer += str;
            if (str.includes('SERVER_READY')) {
                serverReady = true;
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            const str = data.toString();
            stderrBuffer += str;
        });
        
        const timeout = setTimeout(() => {
            serverProcess.kill();
            reject(new Error(
                `Server startup timeout after ${timeoutMs}ms\n` +
                `Stdout: ${stdoutBuffer}\n` +
                `Stderr: ${stderrBuffer}`
            ));
        }, timeoutMs);
        
        const checkReady = setInterval(() => {
            if (serverReady) {
                clearInterval(checkReady);
                clearTimeout(timeout);
                resolve(serverProcess);
            }
        }, 50);
    });
}

async function waitForServerReady(serverProcess, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        let serverReady = false;
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('SERVER_READY')) {
                serverReady = true;
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            console.error('[Server stderr]', data.toString());
        });
        
        const timeout = setTimeout(() => {
            reject(new Error('Server startup timeout'));
        }, timeoutMs);
        
        const checkReady = setInterval(() => {
            if (serverReady) {
                clearInterval(checkReady);
                clearTimeout(timeout);
                resolve();
            }
        }, 100);
    });
}

let tempDir;

function getTempDir() {
    if (!tempDir) {
        tempDir = path.join(__dirname, '.multiprocess-temp');
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
        } catch (e) {
            // Directory may have been created by another parallel test
        }
    }
    return tempDir;
}

function cleanup() {
    if (tempDir && fs.existsSync(tempDir)) {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
            // May be in use by another parallel test
        }
    }
}

function createServerScript(filename, content) {
    const tempDirectory = getTempDir();
    // Ensure the directory exists before writing the file
    if (!fs.existsSync(tempDirectory)) {
        try {
            fs.mkdirSync(tempDirectory, { recursive: true });
        } catch (e) {
            // May have been created by parallel test
        }
    }
    const scriptPath = path.join(tempDirectory, filename);
    fs.writeFileSync(scriptPath, content);
    return scriptPath;
}

module.exports = {
    spawnServer,
    createServerScript,
    indexPath,
    cleanup,
    uniqueAppId,
    getTempDir,
    waitForServerReady,
    getAppConfig,
};
