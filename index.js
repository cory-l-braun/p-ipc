'use strict';

const ipc = require('node-ipc');
const uniqid = require('uniqid');
const EJSON = require('bson').EJSON;
const { serializeError, deserializeError } = require('./lib/serialize-error.js');

function pIpc (id, config) {
    this.id = id;
    this.config = config;
    this._ipc = ipc;
    Object.keys(config).forEach(key => {
        this._ipc.config[key] = config[key];
    });
    this._ipc.config.id = id;
    this._resolvers = {};
    this._events = {};
}

pIpc.prototype.start = function start () {
    return new Promise((resolve, reject) => {
        this._ipc.serve();
        this._ipc.server.on('start', resolve);
        this._ipc.server.on('error', reject);
        this._ipc.server.on('response', (_msg) => {
            const msg = EJSON.parse(_msg);
            const resolvers = this._resolvers[msg.rid];
            if (!resolvers) return;
            if (msg.error) {
                resolvers.reject(deserializeError(msg.error));
            } else {
                resolvers.resolve(msg.data);
            }
            delete this._resolvers[msg.rid];
        });
        this._ipc.server.on('message', (_msg) => {
            const msg = EJSON.parse(_msg);
            const resolvers = this._resolvers[msg.rid];
            if (!resolvers) return;
            if (typeof resolvers.message === 'function') {
                setTimeout(() => {
                    resolvers.message(msg.data);
                });
            }
        });
        this._ipc.server.start();
    });
};

/*
* @function stop - stop the IPC server
* @returns {Promise} - resolves when server is fully stopped
*/
pIpc.prototype.stop = function stop () {
    return new Promise((resolve, reject) => {
        for (const name in this._ipc.of) {
            ipc.disconnect(name);
        }
        this._ipc.server.on('destroy', resolve);
        try {
            this._ipc.server.stop();
        } catch (err) {
            reject(err);
        }
    });
};

pIpc.prototype._connect = function _connect (id) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!this._ipc.of[id]) {
                await this._ipc.connectTo(id, () => {
                    this._ipc.of[id].on('error', reject);
                    this._ipc.of[id].on('connect', resolve);
                });
            } else {
                resolve();
            }
        } catch (err) {
            reject(err);
        }
    });
};

/*
* @function request - send a message and wait for a reply
* @param {String} id - the ID of the remote IPC server
* @param {String} channel - the name of the event on the remote IPC server
* ... remaining parameters are sent as the request content
* @param {!Function} message - a callback to run if data is returned prior to the final response
* @returns {Promise} - resolves the response data
*/
pIpc.prototype.request = function request (id, channel, ...content) {
    return new Promise(async (resolve, reject) => {
        const onmessage = typeof content[content.length - 1] === 'function' ? content.pop() : null;
        const rid = uniqid();
        try {
            await this._connect(id);
            this._resolvers[rid] = {
                resolve,
                reject,
                message: onmessage
            };
            const message = EJSON.stringify(
                { sender: this.id, rid, content },
                { relaxed: false }
            );
            this._ipc.of[id].emit(channel, message);
        } catch (err) {
            reject(err);
        }
    });
};

/*
* @function send - send a message without expecting a reply; only allows setting the 'content' attribute of the message
* @param {String} id - the ID of the remote IPC server
* @param {String} channel - the name of the event on the remote IPC server
* @param {Object} content - the data to send to the remote event
* @returns {Promise} - resolves after the message has been sent
*/
pIpc.prototype.send = function send (id, channel, ...content) {
    return new Promise(async (resolve, reject) => {
        try {
            await this._connect(id);
            const message = EJSON.stringify(
                { sender: this.id, content },
                { relaxed: false }
            );
            this._ipc.of[id].emit(channel, message);
            resolve();
        } catch (err) {
            reject(err);
        }
    });
};

/*
* @function reply - send a message without expecting a reply; allows setting attributes of the entire message
* @param {String} id - the ID of the remote IPC server
* @param {String} rid - the ID of the original request
* @param {String} channel - the name of the event on the remote IPC server
* @param {Object} data - the data to send to the remote event
* @returns {Promise} - resolves after the message has been sent
*/
pIpc.prototype.reply = function reply (id, rid, channel, data) {
    return new Promise(async (resolve, reject) => {
        try {
            await this._connect(id);
            const message = EJSON.stringify(
                Object.assign({ sender: this.id, rid }, data),
                { relaxed: false }
            );
            this._ipc.of[id].emit(channel, message);
            resolve();
        } catch (err) {
            reject(err);
        }
    });
};

/*
* @function on - register an event listener on this IPC server
* @param {String} channel - the name of the event on this IPC server
* @param {Function} fnc - receives request data; should return response data
* @param {!Object} context - if defined the callback is invoked with this context
*/
pIpc.prototype.on = function on (channel, fnc, context) {
    const callback = async (request) => {
        let parsedRequest;
        try {
            parsedRequest = EJSON.parse(request);
            const onmessage = !parsedRequest.rid
                ? null
                : async (data) => {
                    return this.reply(parsedRequest.sender, parsedRequest.rid, 'message', { data });
                };
            const data = context
                ? await fnc.call(context, ...parsedRequest.content, onmessage)
                : await fnc(...parsedRequest.content, onmessage);
            await this.reply(parsedRequest.sender, parsedRequest.rid, 'response', { data });
        } catch (err) {
            if (parsedRequest) {
                await this.reply(parsedRequest.sender, parsedRequest.rid, 'response', { error: serializeError(err) });
            }
        }
    };
    if (!this._events[channel]) {
        this._events[channel] = [];
    }
    this._events[channel].push([callback, fnc]);
    this._ipc.server.on(channel, callback);
};

/*
* @function off - deregister an event listener on this IPC server
* @param {String} channel - the name of the event on this IPC server
* @param {Function} fnc - the original function to deregister
*/
pIpc.prototype.off = function off (channel, fnc) {
    const callbacks = this._events[channel] || [];
    let callback;
    for (let i = 0; i < callbacks.length; i++) {
        const evt = callbacks[i];
        if (evt[1] === fnc) {
            callback = evt[0];
            this._events[channel].splice(i, 1);
            break;
        }
    }
    if (callback) {
        this._ipc.server.off(channel, callback);
    }
};

module.exports = pIpc;