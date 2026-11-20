const assert = require('assert');
const pIpc = require('../');

/**
 * Integration test suite for p-ipc
 * Tests core functionality: request/response, error handling, and data serialization
 */

describe('p-ipc Integration Tests', function () {
    this.timeout(60000); // Increased timeout for entire suite
    
    let server, client;
    
    before(async function () {
        // Create and start server
        server = new pIpc('test-server', {
            appid: 'com.example.test',
            silent: true,
        });
        await server.start();
        
        // Register test handlers
        server.on('add', (a, b) => {
            return a + b;
        });
        
        server.on('greet', (name) => {
            return `Hello, ${name}!`;
        });
        
        server.on('async-task', async (ms) => {
            return new Promise(resolve => {
                setTimeout(() => resolve(`Waited ${ms}ms`), ms);
            });
        });
        
        server.on('stream', async (count, onmessage) => {
            for (let i = 1; i <= count; i++) {
                if (onmessage) {
                    onmessage(`Message ${i}`);
                    await new Promise(resolve => setTimeout(resolve, 30));
                }
            }
            return `Completed ${count} messages`;
        });
        
        server.on('throw-error', () => {
            throw new Error('Test error message');
        });
        
        server.on('throw-custom-error', () => {
            const err = new Error('Custom error');
            err.code = 'CUSTOM_ERR';
            err.details = { retryable: true };
            throw err;
        });
        
        server.on('echo', (data) => {
            return data;
        });
        
        // Create and start client
        client = new pIpc('test-client', {
            appid: 'com.example.test',
            silent: true,
        });
        await client.start();
        
        // Wait a bit for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    after(async function () {
        this.timeout(5000); // Set a shorter timeout for cleanup
        try {
            if (client && typeof client.stop === 'function') {
                try {
                    await Promise.race([
                        client.stop(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 2000))
                    ]);
                } catch (err) {
                    // Ignore client stop errors
                }
            }
            if (server && typeof server.stop === 'function') {
                try {
                    await Promise.race([
                        server.stop(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('stop timeout')), 2000))
                    ]);
                } catch (err) {
                    // Ignore server stop errors
                }
            }
        } catch (err) {
            // Ignore cleanup errors
        }
    });
    
    describe('Basic Request/Response', function () {
        it('should handle simple arithmetic', async function () {
            const result = await client.request('test-server', 'add', 5, 3);
            assert.strictEqual(result, 8);
        });
        
        it('should handle string parameters', async function () {
            const result = await client.request('test-server', 'greet', 'World');
            assert.strictEqual(result, 'Hello, World!');
        });
        
        it('should handle async handlers', async function () {
            const result = await client.request('test-server', 'async-task', 100);
            assert.strictEqual(result, 'Waited 100ms');
        });
    });
    
    describe('Complex Data Types', function () {
        it('should handle objects', async function () {
            const obj = { name: 'test', value: 42 };
            const result = await client.request('test-server', 'echo', obj);
            assert.deepStrictEqual(result, obj);
        });
        
        it('should handle arrays', async function () {
            const arr = [1, 2, 3, { key: 'value' }];
            const result = await client.request('test-server', 'echo', arr);
            assert.deepStrictEqual(result, arr);
        });
        
        it('should handle nested structures', async function () {
            const data = {
                items: [{ id: 1 }, { id: 2 }],
                metadata: { version: 1 }
            };
            const result = await client.request('test-server', 'echo', data);
            assert.deepStrictEqual(result.items, data.items);
            assert.deepStrictEqual(result.metadata, data.metadata);
        });
        
        it('should handle boolean values', async function () {
            const resultTrue = await client.request('test-server', 'echo', true);
            const resultFalse = await client.request('test-server', 'echo', false);
            assert.strictEqual(resultTrue, true);
            assert.strictEqual(resultFalse, false);
        });
    });
    
    describe('Error Handling', function () {
        it('should propagate errors to client', async function () {
            try {
                await client.request('test-server', 'throw-error');
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert(err instanceof Error);
                assert.strictEqual(err.message, 'Test error message');
            }
        });
        
        it('should preserve error properties', async function () {
            try {
                await client.request('test-server', 'throw-custom-error');
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert(err instanceof Error);
                assert.strictEqual(err.message, 'Custom error');
                assert.strictEqual(err.code, 'CUSTOM_ERR');
                assert.deepStrictEqual(err.details, { retryable: true });
            }
        });
    });
    
    describe('Streaming Messages', function () {
        it('should receive streaming messages before final response', async function () {
            const messages = [];
            
            const result = await client.request('test-server', 'stream', 3, (msg) => {
                messages.push(msg);
            });
            
            assert.deepStrictEqual(messages, ['Message 1', 'Message 2', 'Message 3']);
            assert.strictEqual(result, 'Completed 3 messages');
        });
        
        it('should work without message callback', async function () {
            const result = await client.request('test-server', 'stream', 2);
            assert.strictEqual(result, 'Completed 2 messages');
        });
    });
    
});
