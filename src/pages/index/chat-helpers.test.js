import { describe, expect, test } from "bun:test";
import { findMentionQuery, findTextEdit, formatMention, isBlocked, isMention,
	normaliseBlockedUsers, rebaseMentionTokens, serialiseMentionTokens } from "./chat-helpers.js";

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

	test("rebases intact tokens through a contiguous edit", () => {
		const tokens = [
			{ start: 0, end: 6, label: "@alice", intId: 12 },
			{ start: 10, end: 14, label: "@bob", intId: 23 }
		];
		const edit = findTextEdit("@alice hi @bob", "Well @alice hi @bob");
		expect(edit).toEqual({ start: 0, oldEnd: 0, newEnd: 5 });
		expect(rebaseMentionTokens(tokens, edit)).toEqual([
			{ start: 5, end: 11, label: "@alice", intId: 12 },
			{ start: 15, end: 19, label: "@bob", intId: 23 }
		]);
	});

	test("drops only tokens touched by an edit", () => {
		const tokens = [
			{ start: 0, end: 6, label: "@alice", intId: 12 },
			{ start: 10, end: 14, label: "@bob", intId: 23 }
		];
		const edit = findTextEdit("@alice hi @bob", "@alicia hi @bob");
		expect(rebaseMentionTokens(tokens, edit)).toEqual([
			{ start: 11, end: 15, label: "@bob", intId: 23 }
		]);
		expect(rebaseMentionTokens([tokens[0]], { start: 0, oldEnd: 6, newEnd: 6 })).toEqual([]);
	});

	test("serialises multiple intact vanity tokens from right to left", () => {
		const value = "@alice met @alice and @bob";
		const tokens = [
			{ start: 0, end: 6, label: "@alice", intId: 12 },
			{ start: 11, end: 17, label: "@alice", intId: 34 },
			{ start: 22, end: 26, label: "@bob", intId: 23 }
		];
		expect(serialiseMentionTokens(value, tokens)).toBe("@#12 met @#34 and @#23");
		expect(serialiseMentionTokens("@alicia", [tokens[0]])).toBe("@alicia");
	});
});

describe("blocked-user helpers", () => {
	test("normalises positive integer IDs and removes duplicates", () => {
		expect(normaliseBlockedUsers(["12", 12, "-1", "1.5", "nope", 0, 23])).toEqual([12, 23]);
		expect(isBlocked(12, [12, 23])).toBe(true);
		expect(isBlocked(7, [12, 23])).toBe(false);
	});
});
