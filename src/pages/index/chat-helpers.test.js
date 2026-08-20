import { describe, expect, test } from "bun:test";
import { findMentionQuery, formatMention, isBlocked, isMention, normaliseBlockedUsers } from "./chat-helpers.js";

describe("chat mention helpers", () => {
	test("matches stable IDs, names and everyone at token boundaries", () => {
		expect(isMention("hello @#42", "alice", 42)).toBe(true);
		expect(isMention("hello @ALICE!", "alice", 42)).toBe(true);
		expect(isMention("hello @everyone", "alice", 42)).toBe(true);
		expect(isMention("email test@alice.com", "alice", 42)).toBe(false);
		expect(isMention("not @#420", "alice", 42)).toBe(false);
	});

	test("matches server-decorated names without accepting longer names", () => {
		expect(isMention("hello @alice~", "alice~", 42)).toBe(true);
		expect(isMention("hello @alice✓", "alice✓", 42)).toBe(true);
		expect(isMention("hello @alice✓extra", "alice✓", 42)).toBe(false);
	});

	test("formats canonical identity tokens", () => {
		expect(formatMention(42)).toBe("@#42");
	});

	test("finds the active name query at the cursor without matching emails", () => {
		expect(findMentionQuery("hello @Ali world", 10)).toEqual({ query: "ali", start: 6, end: 10 });
		expect(findMentionQuery("@", 1)).toEqual({ query: "", start: 0, end: 1 });
		expect(findMentionQuery("test@ali", 8)).toBeNull();
		expect(findMentionQuery("hello @#42", 10)).toBeNull();
	});
});

describe("blocked-user helpers", () => {
	test("normalises positive integer IDs and removes duplicates", () => {
		expect(normaliseBlockedUsers(["12", 12, "-1", "1.5", "nope", 0, 23])).toEqual([12, 23]);
		expect(isBlocked(12, [12, 23])).toBe(true);
		expect(isBlocked(7, [12, 23])).toBe(false);
	});
});
