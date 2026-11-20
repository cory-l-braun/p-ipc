import ipc from 'node-ipc';
import uniqid from 'uniqid';
import { EJSON } from 'bson';
import { serializeError, deserializeError } from './lib/serialize-error.js';

interface IPCConfig {
	[key: string]: any;
}

interface Resolvers {
	resolve: (value: any) => void;
	reject: (error: any) => void;
	message?: (data: any) => void;
}

class pIpc {
	id: string;
	config: IPCConfig;
	_ipc: any;
	_resolvers: { [key: string]: Resolvers };
	_events: { [key: string]: Array<[Function, Function]> };

	constructor(id: string, config: IPCConfig) {
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

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this._ipc.serve();
			this._ipc.server.on('start', resolve);
			this._ipc.server.on('error', reject);
			this._ipc.server.on('response', (_msg: string) => {
				const msg: any = EJSON.parse(_msg);
				const resolvers = this._resolvers[msg.rid];
				if (!resolvers) return;
				if (msg.error) {
					resolvers.reject(deserializeError(msg.error));
				} else {
					resolvers.resolve(msg.data);
				}
				delete this._resolvers[msg.rid];
			});
			this._ipc.server.on('message', (_msg: string) => {
				const msg: any = EJSON.parse(_msg);
				const resolvers = this._resolvers[msg.rid];
				if (!resolvers) return;
				if (typeof resolvers.message === 'function') {
					setTimeout(() => {
						resolvers.message!(msg.data);
					});
				}
			});
			this._ipc.server.start();
		});
	}

	/**
	 * Stop the IPC server
	 * @returns resolves when server is fully stopped
	 */
	stop(): Promise<void> {
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
	}

	private _connect(id: string): Promise<void> {
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
	}

	/**
	 * Send a message and wait for a reply
	 * @param id - the ID of the remote IPC server
	 * @param channel - the name of the event on the remote IPC server
	 * @param content - request content
	 * @param message - optional callback to run if data is returned prior to the final response
	 * @returns resolves the response data
	 */
	request(id: string, channel: string, ...content: any[]): Promise<any> {
		return new Promise(async (resolve, reject) => {
			const onmessage = typeof content[content.length - 1] === 'function' ? content.pop() : null;
			const rid = uniqid();
			try {
				await this._connect(id);
				this._resolvers[rid] = {
					resolve,
					reject,
					message: onmessage,
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
	}

	/**
	 * Send a message without expecting a reply; only allows setting the 'content' attribute of the message
	 * @param id - the ID of the remote IPC server
	 * @param channel - the name of the event on the remote IPC server
	 * @param content - the data to send to the remote event
	 * @returns resolves after the message has been sent
	 */
	send(id: string, channel: string, ...content: any[]): Promise<void> {
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
	}

	/**
	 * Send a message without expecting a reply; allows setting attributes of the entire message
	 * @param id - the ID of the remote IPC server
	 * @param rid - the ID of the original request
	 * @param channel - the name of the event on the remote IPC server
	 * @param data - the data to send to the remote event
	 * @returns resolves after the message has been sent
	 */
	reply(id: string, rid: string, channel: string, data: any): Promise<void> {
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
	}

	/**
	 * Register an event listener on this IPC server
	 * @param channel - the name of the event on this IPC server
	 * @param fnc - receives request data; should return response data
	 * @param context - if defined the callback is invoked with this context
	 */
	on(channel: string, fnc: Function, context?: any): void {
		const callback = async (request: string) => {
			let parsedRequest: any;
			try {
				parsedRequest = EJSON.parse(request);
				const onmessage = !parsedRequest.rid
					? null
					: async (data: any) => {
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
	}

	/**
	 * Deregister an event listener on this IPC server
	 * @param channel - the name of the event on this IPC server
	 * @param fnc - the original function to deregister
	 */
	off(channel: string, fnc: Function): void {
		const callbacks = this._events[channel] || [];
		let callback: Function | undefined;
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
	}
}

export = pIpc;
