import { DEFAULT_SERVER } from "../../defaults.js";

/** @typedef {"mute"|"ban"} PunishmentType */
/** @typedef {"pending"|"approved"|"denied"} AppealStatus */
/**
 * @typedef {object} PunishmentRecord
 * @property {PunishmentType} type
 * @property {number} punishmentId
 * @property {number} userIntId
 * @property {string|null} userChatName
 * @property {number} startDate
 * @property {number} finishDate
 * @property {number|null} moderatorIntId
 * @property {string|null} moderatorChatName
 * @property {string} reason
 * @property {number|null} appealId
 * @property {string|null} appealMessage
 * @property {number|null} appealSubmittedAt
 * @property {AppealStatus|null} appealStatus
 * @property {string|null} appealResponse
 * @property {number|null} appealRespondedAt
 * @property {number|null} appealResponderIntId
 * @property {string|null} appealResponderChatName
 */
/** @typedef {{ method?:string, body?:unknown, vipCode?:string }} RequestOptions */
/**
 * @typedef {object} ModerationActionOptions
 * @property {"kick"|"mute"|"ban"|"captcha"|"delete"} action
 * @property {string} reason
 * @property {number} [memberId]
 * @property {number} [messageId]
 * @property {number} [duration]
 * @property {boolean} [affectsAll]
 */

/** @returns {string} */
function httpServerUrl() {
	return (localStorage.server || DEFAULT_SERVER)
		.replace("wss://", "https://").replace("ws://", "http://");
}

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 * @returns {Promise<any>}
 */
async function requestJson(path, options={}) {
	const response = await fetch(`${httpServerUrl()}${path}`, {
		method: options.method || "GET",
		credentials: "include",
		headers: {
			...(options.body === undefined ? {} : { "Content-Type":"application/json" }),
			...(options.vipCode ? { "X-VIP-Code":options.vipCode } : {})
		},
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	let data = null;
	try {
		data = await response.json();
	}
	catch {
		// The status below still provides a useful error for old/custom servers.
	}
	if (!response.ok) {
		const error = /** @type {Error & {status:number}} */(
			new Error(data?.error || `Server request failed (${response.status})`));
		error.status = response.status;
		throw error;
	}
	return data;
}

/** @returns {Promise<{records:PunishmentRecord[]}>} */
export function getOwnPunishments() {
	return requestJson("/appeals/punishments");
}

/**
 * @param {PunishmentType} type
 * @param {number} punishmentId
 * @param {string} message
 * @returns {Promise<{appeal:PunishmentRecord}>}
 */
export function submitPunishmentAppeal(type, punishmentId, message) {
	return requestJson(`/appeals/${type}s/${punishmentId}`, {
		method:"POST",
		body:{ message }
	});
}

/**
 * @param {PunishmentType} type
 * @param {number} offset
 * @param {string} vipCode
 * @returns {Promise<{records:PunishmentRecord[], hasMore:boolean, nextOffset:number|null}>}
 */
export function listPunishments(type, offset, vipCode) {
	return requestJson(`/moderation/${type}s?offset=${offset}`, { vipCode });
}

/**
 * @param {PunishmentType} type
 * @param {number} punishmentId
 * @param {"approved"|"denied"} decision
 * @param {string} response
 * @param {string} vipCode
 * @returns {Promise<{appeal:PunishmentRecord}>}
 */
export function resolvePunishmentAppeal(type, punishmentId, decision, response, vipCode) {
	return requestJson(`/moderation/${type}s/${punishmentId}/appeal`, {
		method:"PATCH",
		vipCode,
		body:{ decision, response }
	});
}

/**
 * @param {ModerationActionOptions} options
 * @param {string} vipCode
 * @returns {Promise<{message:string}>}
 */
export function sendModerationAction(options, vipCode) {
	/** @type {string} */
	let endpoint = options.action;
	let body;
	switch (options.action) {
		case "kick":
			body = { targetIntId:options.memberId, reason:options.reason };
			break;
		case "mute":
		case "ban":
			body = {
				targetIntId:options.memberId,
				durationSeconds:options.duration,
				reason:options.reason
			};
			break;
		case "captcha":
			body = {
				targetIntId:options.affectsAll ? 0 : options.memberId,
				reason:options.reason
			};
			break;
		case "delete":
			endpoint = "delete-message";
			body = { messageId:options.messageId, reason:options.reason };
			break;
		default:
			throw new Error("Unknown moderation action");
	}
	return requestJson(`/moderation/${endpoint}`, { method:"POST", vipCode, body });
}
