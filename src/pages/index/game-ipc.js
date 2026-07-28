import { createStrictIpcEndpoint, sendIpcMessage } from "shared-ipc";

/** @typedef {[number, number, number, number, number]} ClientActivity */
/** @typedef {[string, string, string|null]} ConnectArgs */
/** @typedef {{ connect: (device: string, vip: string|null) => void, reportAutomatedActivity: (activity: ClientActivity) => void, stop: () => void, dispose: () => void }} GameIpc */

/** @param {*} activity */
function isClientActivity(activity) {
	if (!Array.isArray(activity) || activity.length !== 5) {
		return false;
	}
	const [flags, ...dimensions] = activity;
	return Number.isInteger(flags) && flags >= 1 && flags <= 31 &&
		dimensions.every(value => Number.isInteger(value) && value >= 0 && value <= 1_000_000);
}

/** @param {*} args */
function isConnectArgs(args) {
	if (!Array.isArray(args) || args.length !== 3 ||
		typeof args[0] !== "string" || args[0].length === 0 ||
		typeof args[1] !== "string" ||
		(args[2] !== null && typeof args[2] !== "string")) {
		return false;
	}
	try {
		const protocol = new URL(args[1]).protocol;
		return protocol === "ws:" || protocol === "wss:";
	}
	catch {
		return false;
	}
}

function createChannelId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The official origin is strict-required. A different origin can only come
 * from the existing explicit custom-server selection.
 * @param {string} server
 * @param {string} officialServer
 * @returns {"strict"|"legacy"}
 */
export function selectGameIpcMode(server, officialServer) {
	try {
		return new URL(server).origin === new URL(officialServer).origin ? "strict" : "legacy";
	}
	catch {
		return "legacy";
	}
}

/**
 * @param {{ postMessage: Function, terminate: Function }} worker
 * @param {string} server
 * @param {string} officialServer
 * @param {number} [bootstrapTimeoutMs]
 * @returns {Promise<GameIpc>}
 */
export async function createGameIpc(worker, server, officialServer, bootstrapTimeoutMs = 5_000) {
	const mode = selectGameIpcMode(server, officialServer);
	if (mode === "legacy") {
		let disposed = false;
		return Object.freeze({
			/**
			 * @param {string} device
			 * @param {string|null} vip
			 */
			connect(device, vip) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "connect", {
					device,
					server,
					vip
				});
			},
			/** @param {ClientActivity} activity */
			reportAutomatedActivity(activity) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				if (!isClientActivity(activity)) {
					throw new TypeError("Invalid client activity");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "informAutomatedActivity", activity);
			},
			stop() {
				if (disposed) {
					return;
				}
				disposed = true;
				sendIpcMessage(/** @type {Worker} */(worker), "stop");
			},
			dispose() {
				disposed = true;
			}
		});
	}
	if (!Number.isSafeInteger(bootstrapTimeoutMs) || bootstrapTimeoutMs <= 0) {
		throw new TypeError("Invalid game IPC configuration");
	}

	const channel = new MessageChannel();
	const channelId = createChannelId();
	/** @type {(() => void)|undefined} */
	let markReady;
	/** @type {Promise<void>} */
	const readyPromise = new Promise(resolve => { markReady = resolve; });
	/** @type {Map<number, import("shared-ipc").StrictIncomingCommand>} */
	const incoming = new Map([[0, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			markReady?.();
			markReady = undefined;
		}
	}]]);
	/** @type {Map<number, import("shared-ipc").StrictOutgoingCommand>} */
	const outgoing = new Map([[0, {
		kind: "message",
		validate: isClientActivity
	}], [1, {
		kind: "message",
		validate: value => value === undefined
	}], [2, {
		kind: "message",
		validate: isConnectArgs
	}]]);
	const endpoint = createStrictIpcEndpoint(channel.port1, {
		channelId,
		incoming,
		outgoing
	});
	incoming.clear();
	outgoing.clear();

	let timeout;
	try {
		worker.postMessage([1, channelId], [channel.port2]);
		await Promise.race([
			readyPromise,
			new Promise((_, reject) => {
				timeout = setTimeout(reject, bootstrapTimeoutMs);
			})
		]);
	}
	catch {
		endpoint.dispose("Game IPC bootstrap failed");
		worker.terminate();
		throw new Error("Game IPC bootstrap failed");
	}
	finally {
		clearTimeout(timeout);
	}

	let disposed = false;
	let connectionStarted = false;
	return Object.freeze({
		/**
		 * @param {string} device
		 * @param {string|null} vip
		 */
		connect(device, vip) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionStarted) {
				throw new Error("Game IPC connection already started");
			}
			/** @type {ConnectArgs} */
			const args = [device, server, vip];
			endpoint.send(2, args);
			connectionStarted = true;
		},
		/** @param {ClientActivity} activity */
		reportAutomatedActivity(activity) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			endpoint.send(0, activity);
		},
		stop() {
			if (disposed) {
				return;
			}
			disposed = true;
			try {
				endpoint.send(1);
			}
			finally {
				endpoint.dispose();
			}
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			endpoint.dispose();
		}
	});
}
