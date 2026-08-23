/** @param {string} value */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @typedef {{ start: number; end: number; label: string; intId: number }} MentionToken */
/** @typedef {{ start: number; oldEnd: number; newEnd: number }} TextEdit */

/**
 * @param {string} content
 * @param {string|null|undefined} chatName
 * @param {number|null|undefined} intId
 * @returns {boolean}
 */
export function isMention(content, chatName, intId) {
	if (!content || typeof content !== "string") return false;
	if (!content.includes("@")) return false;
	if (/(^|[^a-zA-Z0-9_])@everyone(?![a-zA-Z0-9_])/i.test(content)) return true;
	if (intId != null && Number.isFinite(intId)) {
		const idPattern = new RegExp("(^|[^a-zA-Z0-9_])@#" + escapeRegExp(String(intId)) + "(?![a-zA-Z0-9_])");
		if (idPattern.test(content)) return true;
	}
	if (chatName) {
		const name = String(chatName).trim();
		if (name.length > 0) {
			const namePattern = new RegExp("(^|[^a-zA-Z0-9_])@" + escapeRegExp(name) + "(?![a-zA-Z0-9_])", "i");
			if (namePattern.test(content)) return true;
		}
	}
	return false;
}

/** @param {number} intId @returns {string} */
export function formatMention(intId) {
	return `@#${intId}`;
}

/**
 * @param {string} value
 * @param {number} cursor
 * @returns {{ query: string; start: number; end: number }|null}
 */
export function findMentionQuery(value, cursor) {
	if (typeof value !== "string" || !Number.isSafeInteger(cursor)) return null;
	const boundedCursor = Math.min(Math.max(cursor, 0), value.length);
	const match = value.slice(0, boundedCursor)
		.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{0,16})$/);
	if (!match) return null;
	return {
		query: match[2].toLowerCase(),
		start: boundedCursor - match[2].length - 1,
		end: boundedCursor
	};
}

/**
 * @param {string} previousValue
 * @param {string} nextValue
 * @returns {TextEdit|null}
 */
export function findTextEdit(previousValue, nextValue) {
	if (previousValue === nextValue) return null;
	let start = 0;
	while (start < previousValue.length && start < nextValue.length &&
		previousValue[start] === nextValue[start]) {
		start++;
	}

	let oldEnd = previousValue.length;
	let newEnd = nextValue.length;
	while (oldEnd > start && newEnd > start &&
		previousValue[oldEnd - 1] === nextValue[newEnd - 1]) {
		oldEnd--;
		newEnd--;
	}
	return { start, oldEnd, newEnd };
}

/**
 * @param {MentionToken[]} tokens
 * @param {TextEdit|null} edit
 * @returns {MentionToken[]}
 */
export function rebaseMentionTokens(tokens, edit) {
	if (!edit) return tokens;
	const offset = edit.newEnd - edit.oldEnd;
	const rebased = [];
	for (const token of tokens) {
		if (token.end <= edit.start) {
			rebased.push(token);
		}
		else if (token.start >= edit.oldEnd) {
			rebased.push({ ...token, start: token.start + offset, end: token.end + offset });
		}
	}
	return rebased;
}

/**
 * @param {string} value
 * @param {MentionToken[]} tokens
 * @returns {string}
 */
export function serialiseMentionTokens(value, tokens) {
	const validTokens = tokens
		.filter(token => Number.isSafeInteger(token.start) && Number.isSafeInteger(token.end) &&
			token.start >= 0 && token.end > token.start && token.end <= value.length &&
			Number.isSafeInteger(token.intId) && token.intId > 0 && token.intId <= 0xFFFFFFFF &&
			value.slice(token.start, token.end) === token.label)
		.sort((first, second) => first.start - second.start);

	let previousEnd = 0;
	const nonOverlappingTokens = validTokens.filter(token => {
		if (token.start < previousEnd) return false;
		previousEnd = token.end;
		return true;
	});

	let serialised = value;
	for (let index = nonOverlappingTokens.length - 1; index >= 0; index--) {
		const token = nonOverlappingTokens[index];
		serialised = serialised.slice(0, token.start) + formatMention(token.intId) +
			serialised.slice(token.end);
	}
	return serialised;
}

/** @param {(string|number)[]} list @returns {number[]} */
export function normaliseBlockedUsers(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	const seen = new Set();
	for (const rawEntry of list) {
		const numericId = Number(rawEntry);
		if (!Number.isSafeInteger(numericId) || numericId <= 0) continue;
		if (seen.has(numericId)) continue;
		seen.add(numericId);
		out.push(numericId);
	}
	return out;
}

/** @param {number} senderIntId @param {number[]} blockedList @returns {boolean} */
export function isBlocked(senderIntId, blockedList) {
	if (!Array.isArray(blockedList) || blockedList.length === 0) return false;
	return blockedList.includes(Number(senderIntId));
}
