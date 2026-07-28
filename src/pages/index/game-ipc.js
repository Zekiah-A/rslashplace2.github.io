import { createStrictIpcEndpoint, sendIpcMessage } from "shared-ipc";

/** @typedef {[number, number, number, number, number]} ClientActivity */
/** @typedef {[string, string, string|null]} ConnectArgs */
/** @typedef {[number, string[], Uint8Array]} DefaultCaptchaChallenge */
/** @typedef {{ chatReact: (messageId: number, reaction: string) => void, chatReport: (messageId: number, reason: string) => void, connect: (device: string, vip: string|null) => void, putPixel: (position: number, colour: number) => void, reportAutomatedActivity: (activity: ClientActivity) => void, sendCaptchaResult: (captchaId: number, result: string) => void, setName: (name: string) => void, spectateUser: (userId: number) => void, unspectateUser: () => void, stop: () => void, dispose: () => void }} GameIpc */
const MAX_DATE_MS = 8_640_000_000_000_000;

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

/** @param {*} value */
function isDisconnect(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 65_535 &&
		typeof value[1] === "string";
}

function isDefaultCaptchaChallenge(value) {
	return Array.isArray(value) && value.length === 3 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 255 &&
		Array.isArray(value[1]) && value[1].every(option => typeof option === "string") &&
		value[2] instanceof Uint8Array;
}

function isDefaultCaptchaResult(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 255 &&
		typeof value[1] === "string" && value[1].length > 0;
}

function isPixelPlacement(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 0xFFFF_FFFF &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 255;
}

/** @param {*} value */
function isUint32(value) {
	return Number.isInteger(value) && value >= 0 && value <= 0xFFFF_FFFF;
}

/** @param {*} value */
function isUnspectating(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string";
}

function isPixels(value) {
	return Array.isArray(value) && value.length > 0 &&
		value.every(pixel => Array.isArray(pixel) &&
			(pixel.length === 2 || pixel.length === 3) &&
			isUint32(pixel[0]) &&
			Number.isInteger(pixel[1]) && pixel[1] >= 0 && pixel[1] <= 255 &&
			(pixel.length === 2 || isUint32(pixel[2])));
}

function isNameEntries(value) {
	return Array.isArray(value) && value.every(entry =>
		Array.isArray(entry) && entry.length === 2 &&
		isUint32(entry[0]) && typeof entry[1] === "string" &&
		entry[1].length <= 255);
}

function isNameRequest(value) {
	return typeof value === "string" && value.length <= 16;
}

function isChatReactionRequest(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		value[1].length > 0 && value[1].length <= 255;
}

function isChatReaction(value) {
	return Array.isArray(value) && value.length === 3 &&
		isUint32(value[0]) && isUint32(value[1]) &&
		typeof value[2] === "string" && value[2].length > 0;
}

function isChatReport(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		value[1].length > 0;
}

function isTimestamp(value) {
	return Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATE_MS;
}

function isCooldownInfo(value) {
	return Array.isArray(value) && value.length === 2 &&
		isTimestamp(value[0]) &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 0xFFFF_FFFF;
}

function isCooldown(value) {
	return Array.isArray(value) && value.length === 1 && isTimestamp(value[0]);
}

function isRejectedPixel(value) {
	return Array.isArray(value) && value.length === 3 &&
		isTimestamp(value[0]) &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 0xFFFF_FFFF &&
		Number.isInteger(value[2]) && value[2] >= 0 && value[2] <= 255;
}

function isCanvasDimensions(width, height) {
	return Number.isInteger(width) && width > 0 && width <= 0xFFFF_FFFF &&
		Number.isInteger(height) && height > 0 && height <= 0xFFFF_FFFF &&
		width * height <= 0x1_0000_0000;
}

function isPalette(value) {
	if (!Array.isArray(value) || value.length !== 3 || !Array.isArray(value[0]) ||
		value[0].length > 255 ||
		!value[0].every(colour => Number.isInteger(colour) &&
			colour >= 0 && colour <= 0xFFFF_FFFF)) {
		return false;
	}
	return Number.isInteger(value[1]) && value[1] >= 0 &&
		Number.isInteger(value[2]) && value[2] >= value[1] &&
		value[2] <= value[0].length;
}

function isChanges(value) {
	return Array.isArray(value) && value.length === 3 &&
		isCanvasDimensions(value[0], value[1]) &&
		value[2] instanceof ArrayBuffer;
}

function isCanvasRestriction(value) {
	return Array.isArray(value) && value.length === 2 &&
		typeof value[0] === "boolean" && typeof value[1] === "string";
}

function createChannelId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** @param {unknown} value */
function isWorkerBootstrap(value) {
	return Array.isArray(value) && value.length === 3 && value[0] === 1 &&
		value.slice(1).every(sequence => Number.isSafeInteger(sequence) &&
			sequence >= 0 && sequence <= 0xFFFF_FFFF_FFFF);
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
 * @param {[() => void, (value: [number, string]) => void, (value: DefaultCaptchaChallenge) => void, (value: DefaultCaptchaChallenge) => void, () => void, (value: [number, number]) => void, (value: [number]) => void, (value: [number, number, number]) => void, (value: [number[], number, number]) => void, (value: [number, number, ArrayBuffer]) => void, (value: [boolean, string]) => void, () => void, () => void, (value: number) => void, (value: [number, string]) => void, (value: ([number, number]|[number, number, number])[]) => void]} [eventHandlers]
 * @returns {Promise<GameIpc>}
 */
export async function createGameIpc(
	worker,
	server,
	officialServer,
	bootstrapTimeoutMs = 5_000,
	eventHandlers = [
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined
	]
) {
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
			sendCaptchaResult(captchaId, result) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "sendCaptchaResult", {
					captchaId,
					result
				});
			},
			putPixel(position, colour) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "putPixel", {
					position,
					colour
				});
			},
			/** @param {number} userId */
			spectateUser(userId) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				if (!isUint32(userId)) {
					throw new TypeError("Invalid spectate target");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "spectateUser", userId);
			},
			unspectateUser() {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "unspectateUser");
			},
			/** @param {string} name */
			setName(name) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				if (!isNameRequest(name)) {
					throw new TypeError("Invalid chat name");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "setName", name);
			},
			chatReact(messageId, reaction) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				const value = [messageId, reaction];
				if (!isChatReactionRequest(value)) {
					throw new TypeError("Invalid chat reaction");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "chatReact", {
					messageId,
					reactKey: reaction
				});
			},
			chatReport(messageId, reason) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [messageId, reason];
				if (!isChatReport(value)) throw new TypeError("Invalid chat report");
				sendIpcMessage(/** @type {Worker} */(worker), "chatReport", { messageId, reason });
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
	let disposed = false;
	// 0 = port-bound, 1 = connecting, 2 = open, 3 = closed.
	let connectionState = 0;
	const outstandingCaptchas = new Set();
	let pendingCaptcha = null;
	// 0 = unknown, 1 = required, 2 = completed.
	let passkeyState = 0;
	/** @type {number|null} */
	let spectatingId = null;
	/** @type {number|null} */
	let userId = null;
	const spectators = new Set();
	/** @type {ReturnType<typeof createStrictIpcEndpoint>|undefined} */
	let endpoint;
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
	}], [1, {
		kind: "message",
		validate: value => connectionState === 1 && value === undefined,
		handler: () => {
			connectionState = 2;
			eventHandlers[0]();
		}
	}], [2, {
		kind: "message",
		validate: value => (connectionState === 1 || connectionState === 2) && isDisconnect(value),
		handler: value => {
			connectionState = 3;
			disposed = true;
			try {
				eventHandlers[1](value);
			}
			finally {
				endpoint?.dispose();
			}
		}
	}], [3, {
		kind: "message",
		validate: value => connectionState === 2 && isDefaultCaptchaChallenge(value) &&
			!outstandingCaptchas.has(value[0]) && pendingCaptcha !== value[0],
		handler: value => {
			outstandingCaptchas.add(value[0]);
			eventHandlers[2](value);
		}
	}], [4, {
		kind: "message",
		validate: value => connectionState === 2 && isDefaultCaptchaChallenge(value) &&
			!outstandingCaptchas.has(value[0]) && pendingCaptcha !== value[0],
		handler: value => {
			outstandingCaptchas.add(value[0]);
			eventHandlers[3](value);
		}
	}], [5, {
		kind: "message",
		validate: value => connectionState === 2 && pendingCaptcha !== null && value === undefined,
		handler: () => {
			pendingCaptcha = null;
			eventHandlers[4]();
		}
	}], [6, {
		kind: "message",
		validate: value => connectionState === 2 && isCooldownInfo(value),
		handler: value => { eventHandlers[5](value); }
	}], [7, {
		kind: "message",
		validate: value => connectionState === 2 && isCooldown(value),
		handler: value => { eventHandlers[6](value); }
	}], [8, {
		kind: "message",
		validate: value => connectionState === 2 && isRejectedPixel(value),
		handler: value => { eventHandlers[7](value); }
	}], [9, {
		kind: "message",
		validate: value => connectionState === 2 && isPalette(value),
		handler: value => { eventHandlers[8](value); }
	}], [10, {
		kind: "message",
		validate: value => connectionState === 2 && isChanges(value),
		handler: value => eventHandlers[9](value)
	}], [11, {
		kind: "message",
		validate: value => connectionState === 2 && isCanvasRestriction(value),
		handler: value => { eventHandlers[10](value); }
	}], [12, {
		kind: "message",
		validate: value => connectionState === 2 && passkeyState === 0 && value === undefined,
		handler: () => {
			passkeyState = 1;
			eventHandlers[11]();
		}
	}], [13, {
		kind: "message",
		validate: value => connectionState === 2 && passkeyState !== 2 && value === undefined,
		handler: () => {
			passkeyState = 2;
			eventHandlers[12]();
		}
	}], [14, {
		kind: "message",
		validate: value => connectionState === 2 && isUint32(value),
		handler: value => {
			spectatingId = value;
			eventHandlers[13](value);
		}
	}], [15, {
		kind: "message",
		validate: value => connectionState === 2 && isUnspectating(value) &&
			spectatingId === value[0],
		handler: value => {
			spectatingId = null;
			eventHandlers[14](value);
		}
	}], [16, {
		kind: "message",
		validate: value => connectionState === 2 && isPixels(value),
		handler: value => { eventHandlers[15](value); }
	}], [17, {
		kind: "message",
		validate: value => connectionState === 2 &&
			Number.isInteger(value) && value >= 0 && value <= 65_535,
		handler: value => { eventHandlers[16](value); }
	}], [18, {
		kind: "message",
		validate: value => connectionState === 2 && userId === null && isUint32(value),
		handler: value => {
			userId = value;
			eventHandlers[17](value);
		}
	}], [19, {
		kind: "message",
		validate: value => connectionState === 2 && isNameEntries(value),
		handler: value => { eventHandlers[18](value); }
	}], [20, {
		kind: "message",
		validate: value => connectionState === 2 &&
			typeof value === "string" && value.length <= 255,
		handler: value => { eventHandlers[19](value); }
	}], [21, {
		kind: "message",
		validate: value => connectionState === 2 && isUint32(value) &&
			!spectators.has(value),
		handler: value => {
			spectators.add(value);
			eventHandlers[20](value);
		}
	}], [22, {
		kind: "message",
		validate: value => connectionState === 2 && isUint32(value) &&
			spectators.has(value),
		handler: value => {
			spectators.delete(value);
			eventHandlers[21](value);
		}
	}], [23, {
		kind: "message",
		validate: value => connectionState === 2 && isUint32(value),
		handler: value => { eventHandlers[22](value); }
	}], [24, {
		kind: "message",
		validate: value => connectionState === 2 && isChatReaction(value),
		handler: value => { eventHandlers[23](value); }
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
	}], [3, {
		kind: "message",
		validate: isDefaultCaptchaResult
	}], [4, {
		kind: "message",
		validate: isPixelPlacement
	}], [5, {
		kind: "message",
		validate: isUint32
	}], [6, {
		kind: "message",
		validate: value => value === undefined
	}], [7, {
		kind: "message",
		validate: isNameRequest
	}], [8, {
		kind: "message",
		validate: isChatReactionRequest
	}], [9, {
		kind: "message",
		validate: isChatReport
	}]]);
	let timeout;
	const timeoutPromise = new Promise((_, reject) => {
		timeout = setTimeout(reject, bootstrapTimeoutMs);
	});
	/** @type {(event: MessageEvent) => void} */
	const handleBootstrap = event => {
		channel.port1.removeEventListener("message", handleBootstrap);
		if (!isWorkerBootstrap(event.data)) {
			failBootstrap?.(new Error("Invalid worker bootstrap"));
			return;
		}
		completeBootstrap?.([event.data[1], event.data[2]]);
	};
	/** @type {((value: [number, number]) => void)|undefined} */
	let completeBootstrap;
	/** @type {((error: Error) => void)|undefined} */
	let failBootstrap;
	/** @type {Promise<[number, number]>} */
	const bootstrapPromise = new Promise((resolve, reject) => {
		completeBootstrap = resolve;
		failBootstrap = reject;
	});
	channel.port1.addEventListener("message", handleBootstrap);
	channel.port1.start();

	try {
		worker.postMessage([1, channelId], [channel.port2]);
		const sequenceStarts = await Promise.race([bootstrapPromise, timeoutPromise]);
		/** @param {{ reason: string, call?: import("shared-ipc").StrictIpcCommand }} rejection */
		const failSequence = rejection => {
			if (rejection.reason !== "invalid-sequence" || disposed) {
				return;
			}
			const priorState = connectionState;
			disposed = true;
			connectionState = 3;
			endpoint?.dispose("Game IPC integrity failure");
			worker.terminate();
			try {
				console.warn("Game IPC sequence integrity failure");
			}
			catch {
				// Diagnostics must not affect terminal enforcement.
			}
			if (priorState === 1 || priorState === 2) {
				eventHandlers[1]([1002, "Game IPC integrity failure"]);
			}
		};
		endpoint = createStrictIpcEndpoint(channel.port1, {
			channelId,
			incoming,
			outgoing,
			sendSequenceStart: sequenceStarts[0],
			receiveSequenceStart: sequenceStarts[1],
			onReject: failSequence
		});
		incoming.clear();
		outgoing.clear();
		await Promise.race([readyPromise, timeoutPromise]);
	}
	catch {
		channel.port1.removeEventListener("message", handleBootstrap);
		endpoint?.dispose("Game IPC bootstrap failed");
		channel.port1.close();
		worker.terminate();
		throw new Error("Game IPC bootstrap failed");
	}
	finally {
		clearTimeout(timeout);
	}

	return Object.freeze({
		/**
		 * @param {string} device
		 * @param {string|null} vip
		 */
		connect(device, vip) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 0) {
				throw new Error("Game IPC connection already started");
			}
			/** @type {ConnectArgs} */
			const args = [device, server, vip];
			endpoint.send(2, args);
			connectionState = 1;
		},
		/** @param {ClientActivity} activity */
		reportAutomatedActivity(activity) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2) {
				throw new Error("Game IPC connection is not open");
			}
			endpoint.send(0, activity);
		},
		sendCaptchaResult(captchaId, result) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			const value = [captchaId, result];
			if (connectionState !== 2 || pendingCaptcha !== null ||
				!isDefaultCaptchaResult(value) || !outstandingCaptchas.has(captchaId)) {
				throw new Error("Default CAPTCHA response is not valid");
			}
			outstandingCaptchas.delete(captchaId);
			pendingCaptcha = captchaId;
			endpoint.send(3, value);
		},
		putPixel(position, colour) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			const value = [position, colour];
			if (connectionState !== 2 || !isPixelPlacement(value)) {
				throw new Error("Pixel placement is not valid");
			}
			endpoint.send(4, value);
		},
		/** @param {number} userId */
		spectateUser(userId) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2 || !isUint32(userId)) {
				throw new Error("Spectate target is not valid");
			}
			endpoint.send(5, userId);
		},
		unspectateUser() {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2 || spectatingId === null) {
				throw new Error("Game IPC is not spectating");
			}
			endpoint.send(6);
		},
		/** @param {string} name */
		setName(name) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2 || !isNameRequest(name)) {
				throw new Error("Chat name is not valid");
			}
			endpoint.send(7, name);
		},
		chatReact(messageId, reaction) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			const value = [messageId, reaction];
			if (connectionState !== 2 || !isChatReactionRequest(value)) {
				throw new Error("Chat reaction is not valid");
			}
			endpoint.send(8, value);
		},
		chatReport(messageId, reason) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [messageId, reason];
			if (connectionState !== 2 || !isChatReport(value)) {
				throw new Error("Chat report is not valid");
			}
			endpoint.send(9, value);
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
