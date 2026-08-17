import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	getOwnPunishments,
	listPunishments,
	resolvePunishmentAppeal,
	sendModerationAction,
	submitPunishmentAppeal
} from "./moderation-api.js";

/** @typedef {{method?:string, credentials?:string, headers?:Record<string, string>, body?:unknown}} CapturedInit */

describe("moderation REST client", () => {
	/** @type {typeof globalThis.fetch} */
	let originalFetch;
	/** @type {Storage} */
	let originalLocalStorage;
	/** @type {[string, CapturedInit|undefined][]} */
	let requests;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalLocalStorage = globalThis.localStorage;
		globalThis.localStorage = /** @type {Storage} */(/** @type {unknown} */({
			server:"ws://localhost:8082", vip:"!moderator"
		}));
		requests = [];
		globalThis.fetch = /** @type {typeof globalThis.fetch} */(async (url, init) => {
			requests.push([String(url), /** @type {CapturedInit|undefined} */(init)]);
			return new Response(JSON.stringify({ success:true, records:[], message:"done" }), {
				status:200,
				headers:{ "Content-Type":"application/json" }
			});
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.localStorage = originalLocalStorage;
	});

	test("uses credentialed REST resources for player appeals", async () => {
		await getOwnPunishments();
		await submitPunishmentAppeal("mute", 5, "review this");
		expect(requests[0][0]).toBe("http://localhost:8082/appeals/punishments");
		expect(requests[0][1]).toMatchObject({ method:"GET", credentials:"include" });
		expect(requests[1][0]).toBe("http://localhost:8082/appeals/mutes/5");
		expect(requests[1][1]).toMatchObject({
			method:"POST",
			credentials:"include",
			body:JSON.stringify({ message:"review this" })
		});
	});

	test("sends the VIP key only to moderator resources", async () => {
		await listPunishments("ban", 50, "!moderator");
		await resolvePunishmentAppeal("ban", 7, "denied", "not supported", "!moderator");
		expect(requests[0][0]).toBe("http://localhost:8082/moderation/bans?offset=50");
		expect(requests[0][1]?.headers?.["X-VIP-Code"]).toBe("!moderator");
		expect(requests[1][0]).toBe("http://localhost:8082/moderation/bans/7/appeal");
		expect(requests[1][1]?.method).toBe("PATCH");
	});

	test("maps the existing action form onto the HTTP API", async () => {
		await sendModerationAction({
			action:"mute", memberId:42, duration:600, reason:"spam"
		}, "!moderator");
		expect(requests[0][0]).toBe("http://localhost:8082/moderation/mute");
		expect(JSON.parse(String(requests[0][1]?.body))).toEqual({
			targetIntId:42,
			durationSeconds:600,
			reason:"spam"
		});
	});

	test("surfaces structured server failures", async () => {
		globalThis.fetch = /** @type {typeof globalThis.fetch} */(/** @type {unknown} */(async () =>
			new Response(JSON.stringify({ error:"Appeal has already been resolved" }), {
			status:409,
			headers:{ "Content-Type":"application/json" }
		})));
		try {
			await resolvePunishmentAppeal("mute", 1, "approved", "response", "!moderator");
			throw new Error("Expected request to fail");
		}
		catch (error) {
			if (!(error instanceof Error) || !("status" in error)) throw error;
			expect(error.message).toBe("Appeal has already been resolved");
			expect(error.status).toBe(409);
		}
	});
});
