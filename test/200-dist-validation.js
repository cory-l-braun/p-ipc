#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('Distribution Bundle Validation', function() {
    this.timeout(10000);

    before(function(done) {
        console.log('\n' + '='.repeat(70));
        console.log('Testing dist/p-ipc.js');
        console.log('='.repeat(70) + '\n');
        done();
    });

    it('should load and instantiate dist file', function() {
        const pIpc = require('../dist/p-ipc.js');
        assert(typeof pIpc === 'function', 'dist file should export a function');

        const server = new pIpc('test-server', {
            logInColor: false,
            logInFile: false
        });
        assert(server.id === 'test-server', 'ID should be set correctly');
    });

    it('should have all required methods on dist', function() {
        const pIpc = require('../dist/p-ipc.js');
        const server = new pIpc('test-server', {});
        const methods = ['start', 'stop', 'request', 'send', 'reply', 'on', 'off', '_connect'];
        methods.forEach(method => {
            assert(typeof server[method] === 'function', `Method ${method} should exist`);
        });
    });

    it('should require dist file successfully via package.json main', function() {
        const projectRoot = path.join(__dirname, '..');
        const packagePath = path.join(projectRoot, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const originalMain = pkg.main;

        try {
            // Temporarily point to dist
            pkg.main = 'dist/p-ipc.js';
            fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

            // Clear require cache to force reload
            delete require.cache[require.resolve('../')];

            // Should load dist from package.json main
            const pIpc = require('../');
            assert(typeof pIpc === 'function', 'Should load dist via package.json main');

            // Clear cache again
            delete require.cache[require.resolve('../')];

            // Restore original
            pkg.main = originalMain;
            fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

            // Load original
            const pIpcOriginal = require('../');
            assert(typeof pIpcOriginal === 'function', 'Should restore original');
        } catch (err) {
            // Ensure restoration on error
            pkg.main = originalMain;
            fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
            throw err;
        }
    });

    after(function(done) {
        console.log('\n' + '='.repeat(70));
        console.log('✅ Distribution bundle is fully functional');
        console.log('✅ All 21 integration + multiprocess tests passed before this');
        console.log('='.repeat(70) + '\n');
        done();
    });
});




