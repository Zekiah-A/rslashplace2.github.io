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
	if (/(^|[^a-zA-Z0-9_])@everyone\b/i.test(content)) return true;
	if (intId != null && Number.isFinite(intId)) {
		const idPattern = new RegExp("(^|[^a-zA-Z0-9_])@#" + escapeRegExp(String(intId)) + "\\b");
		if (idPattern.test(content)) return true;
	}
	if (chatName) {
		const name = String(chatName).trim();
		if (name.length > 0) {
			const namePattern = new RegExp("(^|[^a-zA-Z0-9_])@" + escapeRegExp(name) + "\\b", "i");
			if (namePattern.test(content)) return true;
		}
	}
	return false;
}

/** @param {string[]|number[]} list @returns {number[]} */
export function normaliseBlockedUsers(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	const seen = new Set();
	for (const rawEntry of list) {
		const numericId = Number(rawEntry);
		if (!Number.isFinite(numericId) || numericId === 0) continue;
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
