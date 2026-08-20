function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

export function normaliseBlockedUsers(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	const seen = new Set();
	for (const v of list) {
		const n = Number(v);
		if (!Number.isFinite(n) || n === 0) continue;
		if (seen.has(n)) continue;
		seen.add(n);
		out.push(n);
	}
	return out;
}

export function isBlocked(senderIntId, blockedList) {
	if (!Array.isArray(blockedList) || blockedList.length === 0) return false;
	return blockedList.includes(Number(senderIntId));
}

export function isLanguageChannel(channel) {
	return typeof channel === "string" && !channel.startsWith("group:");
}
