'use strict';

const ipc = require('node-ipc');
const uniqid = require('uniqid');
const EJSON = require('bson').EJSON;

function pIpc (id,config) {
    this.id = id;
    this.config = config;
    this._ipc = ipc;
    Object.keys(config).forEach( key => this._ipc.config[key] = config[key] );
    this._ipc.config.id = id;
    this._resolvers = {};
};

/*
* @function start - start the IPC server
* @return {Promise} - resolves when started
*/
pIpc.prototype.start = function start () {
    return new Promise( (resolve,reject) => {
        this._ipc.serve();
        this._ipc.server.on('start',resolve);
        this._ipc.server.on('error',reject);
        this._ipc.server.on('response', (_msg) => {
            let msg = EJSON.parse(_msg);
            let resolvers = this._resolvers[msg.rid];
            if ( !resolvers ) return;
            if ( msg.error ) resolvers.reject(msg.error)
            else resolvers.resolve(msg.data);
            delete this._resolvers[msg.rid];
        });
        this._ipc.server.start();
    });
};

/*
* @function stop - stop the IPC server
* @returns {Promise } - resolves when server is fully stopped
*/
pIpc.prototype.stop = function stop () {
    return new Promise( (resolve,reject) => {
        this._ipc.server.on('destroy',resolve);
        try {
            this._ipc.server.stop();
        }
        catch (err) {
            reject(err);
        }
    });
};

pIpc.prototype._connect = function _connect (id) {
    return new Promise( (resolve,reject) => {
        try {
            if ( !this._ipc.of[id] ) {
                this._ipc.connectTo( id, () => {
                    this._ipc.of[id].on('error',reject);
                    this._ipc.of[id].on('connect',resolve);
                });
            }
            else {
                resolve();
            }
        }
        catch (err) {
            reject(err);
        }
    });
};

/*
* @function request - send a message and wait for a reply
* @param {String} id - the ID of the remote IPC server
* @param {String} channel - the name of the event on the remove IPC server
* ... remaining parameters are sent as the request content
* @returns {Promise} - resolves the response data
*/
pIpc.prototype.request = function request (id,channel,...content) {
    return new Promise( async (resolve,reject) => {
        let rid = uniqid();
        try {
            await this._connect(id);
            this._resolvers[rid] = { 'resolve': resolve, 'reject': reject };
            this._ipc.of[id].emit(channel,EJSON.stringify({ sender: this.id, rid: rid, content: content },{ relaxed: false }));
        }
        catch (err) {
            reject(err);
        }
    });
};

/*
* @function send - send a message without expecting a reply
* @param {String} id - the ID of the remote IPC server
* @param {String} channel - the name of the event on the remove IPC server
* @param {Object} data - the data to send to the remove event
* @returns {Promise} - resolves after the message has been sent
*/
pIpc.prototype.send = function send (id,rid,channel,response) {
    return new Promise( async (resolve,reject) => {
        try {
            await this._connect(id);
            this._ipc.of[id].emit(channel,EJSON.stringify(Object.assign({ sender: this.id, rid: rid },response),{ relaxed: false }));
            resolve();
        }
        catch (err) {
            reject(err);
        }
    });
};

/*
* @function on - register an event listener on this IPC server
* @param {String} channel - the name of the event on this IPC server
* @param {Function} callback - receives request data; should return response data
*/
pIpc.prototype.on = function on (channel,callback) {
    this._ipc.server.on(channel, async (_request) => {
        let request = EJSON.parse(_request);
        try {
            let data = await callback(...(request.content));
            await this.send(request.sender,request.rid,'response',{ data: data });
        }
        catch (err) {
            await this.send(request.sender,request.rid,'response',{ error: err });
        }
    });
};

/*
* @function off - deregister an event listener on this IPC server
* @WIP
* @param {String} channel - the name of the event on this IPC server
* @param {Function} callback - receives request data; should return response data
*/
pIpc.prototype.off = function off (channel,callback) {
    
};

module.exports = pIpc;