// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { createStrictIpcEndpoint } from "shared-ipc";
import { createGameIpc, selectGameIpcMode } from "./game-ipc.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("game IPC mode selection", () => {
	test("requires strict mode for every spelling of the official origin", () => {
		expect(selectGameIpcMode("wss://server.rplace.live", "wss://server.rplace.live")).toBe("strict");
		expect(selectGameIpcMode("wss://SERVER.RPLACE.LIVE/other", "wss://server.rplace.live")).toBe("strict");
	});

	test("uses legacy mode only for an explicitly different custom origin", () => {
		expect(selectGameIpcMode("ws://localhost:3000", "wss://server.rplace.live")).toBe("legacy");
		expect(selectGameIpcMode("wss://example.invalid", "wss://server.rplace.live")).toBe("legacy");
	});
});

describe("page game IPC adapter", () => {
	test("binds a dedicated port and sends only the exact activity tuple", async () => {
		let workerEndpoint;
		let received;
		let stopCount = 0;
		const worker = {
			postMessage(data, ports) {
				expect(data[0]).toBe(1);
				expect(data[1]).toMatch(/^[0-9a-f]{32}$/);
				expect(ports).toHaveLength(1);
				workerEndpoint = createStrictIpcEndpoint(ports[0], {
					channelId: data[1],
					incoming: new Map([[0, {
						kind: "message",
						validate: value => Array.isArray(value) && value.length === 5,
						handler: value => { received = value; }
					}], [2, {
						kind: "message",
						validate: () => true,
						handler: () => { workerEndpoint.send(1); }
					}], [1, {
						kind: "message",
						validate: value => value === undefined,
						handler: () => { stopCount++; }
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}], [1, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);
		ipc.connect("device", null);
		await tick();
		ipc.reportAutomatedActivity([17, 1920, 1900, 1080, 1000]);
		await tick();

		expect(received).toEqual([17, 1920, 1900, 1080, 1000]);
		expect(() => ipc.reportAutomatedActivity([17, 1, 2, 3])).toThrow();
		expect(Reflect.ownKeys(ipc).sort()).toEqual(["connect", "dispose", "reportAutomatedActivity", "stop"]);
		ipc.dispose();
		ipc.stop();
		await tick();
		expect(stopCount).toBe(0);
		workerEndpoint.dispose();
	});

	test("sends one exact strict connection tuple without using legacy IPC", async () => {
		let workerEndpoint;
		const received = [];
		const bootstrapMessages = [];
		const worker = {
			postMessage(data, ports) {
				bootstrapMessages.push(data);
				workerEndpoint = createStrictIpcEndpoint(ports[0], {
					channelId: data[1],
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: value => { received.push(value); }
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);
		expect(() => ipc.connect("", null)).toThrow();
		ipc.connect("0123456789abcdef", "!vip");
		expect(() => ipc.connect("another-device", null)).toThrow();
		await tick();

		expect(received).toEqual([[
			"0123456789abcdef",
			"wss://server.rplace.live",
			"!vip"
		]]);
		expect(bootstrapMessages).toHaveLength(1);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates strict open and close lifecycle notifications", async () => {
		let workerEndpoint;
		const lifecycle = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createStrictIpcEndpoint(ports[0], {
					channelId: data[1],
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => {
							workerEndpoint.send(1);
							workerEndpoint.send(2, [1000, "complete"]);
						}
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}], [1, {
						kind: "message",
						validate: value => value === undefined
					}], [2, {
						kind: "message",
						validate: () => true
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => { lifecycle.push("open"); },
				value => { lifecycle.push(value); }
			]
		);
		ipc.connect("device", null);
		await tick();

		expect(lifecycle).toEqual(["open", [1000, "complete"]]);
		expect(() => ipc.reportAutomatedActivity([17, 1, 2, 3, 4])).toThrow();
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("rejects malformed strict close notification fields", async () => {
		let workerEndpoint;
		let closes = 0;
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createStrictIpcEndpoint(ports[0], {
					channelId: data[1],
					incoming: new Map(),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}], [2, {
						kind: "message",
						validate: () => true
					}]])
				});
				workerEndpoint.send(0);
				workerEndpoint.send(2, [65_536, "invalid"]);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[() => undefined, () => { closes++; }]
		);
		await tick();

		expect(closes).toBe(0);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends strict stop once, disposes locally and never emits the legacy route", async () => {
		let workerEndpoint;
		let stopCount = 0;
		const bootstrapMessages = [];
		const worker = {
			postMessage(data, ports) {
				bootstrapMessages.push(data);
				workerEndpoint = createStrictIpcEndpoint(ports[0], {
					channelId: data[1],
					incoming: new Map([[1, {
						kind: "message",
						validate: value => value === undefined,
						handler: () => { stopCount++; }
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);
		ipc.stop();
		ipc.stop();
		ipc.dispose();
		await tick();

		expect(stopCount).toBe(1);
		expect(bootstrapMessages).toHaveLength(1);
		expect(bootstrapMessages[0][0]).toBe(1);
		expect(() => ipc.reportAutomatedActivity([17, 1, 2, 3, 4])).toThrow();
		workerEndpoint.dispose();
	});

	test("fails closed when the official worker does not acknowledge strict bootstrap", async () => {
		let terminated = false;
		const worker = {
			postMessage() {},
			terminate() { terminated = true; }
		};

		await expect(createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			10
		)).rejects.toThrow("Game IPC bootstrap failed");
		expect(terminated).toBe(true);
	});

	test("keeps legacy connect, activity and stop only in explicit custom-server mode", async () => {
		const messages = [];
		const worker = {
			postMessage(value) { messages.push(value); }
		};
		const ipc = await createGameIpc(worker, "ws://localhost:3000", "wss://server.rplace.live");

		ipc.connect("custom-device", null);
		ipc.reportAutomatedActivity([1, 2, 3, 4, 5]);
		ipc.stop();
		ipc.stop();

		expect(messages[0]).toMatchObject({
			call: "connect",
			data: {
				device: "custom-device",
				server: "ws://localhost:3000",
				vip: null
			}
		});
		expect(messages[1].call).toBe("informAutomatedActivity");
		expect(messages[1].data).toEqual([1, 2, 3, 4, 5]);
		expect(messages[2]).toMatchObject({ call: "stop", data: undefined });
		expect(messages).toHaveLength(3);
		expect(() => ipc.reportAutomatedActivity([1, 2, 3, 4, 5])).toThrow();
	});
});
