/** @param {string} value */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
