import { DEFAULT_BOARD, DEFAULT_SERVER, ADS, CHAT_COLOURS, COMMANDS, CUSTOM_EMOJIS, DEFAULT_HEIGHT, DEFAULT_PALETTE_KEYS, DEFAULT_THEMES, DEFAULT_WIDTH, EMOJIS, LANG_INFOS, MAX_CHANNEL_MESSAGES, PUNISHMENT_STATE, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_PALETTE, DEFAULT_COOLDOWN } from "./defaults.js";
import { lang, PublicPromise, translate, translateAll, hash, $, stringToHtml, blobToBase64, base64ToBlob }  from "./shared.js";
import { showLoadingScreen, hideLoadingScreen } from "./loading-screen.js";
import { enableDarkplace, disableDarkplace } from "./darkplace.js";
import { enableWinter, disableWinter } from "./snowplace.js";
import { clearCaptchaCanvas, updateImgCaptchaCanvas, updateImgCaptchaCanvasFallback } from "./captcha-canvas.js";
import { BoardRenderer } from "./board-renderer.js";
import { muted, placeChat } from "./game-settings.js";
import { enableNewOverlayMenu, enableWebglCanvas } from "./secret-settings.js";
import { AUDIOS } from "./game-defaults.js";
import { addIpcMessageHandler, handleIpcMessage, sendIpcMessage, makeIpcRequest } from "shared-ipc";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { openOverlayMenu } from "./overlay-menu.js";

// Ws Capsule
if(!("subtle" in (window.crypto || {}))) {
	location.protocol = "https:"
}

// Types
/**
 * @typedef {Object} LiveChatMessage
 * @property {number} messageId
 * @property {string} txt
 * @property {number} senderIntId
 * @property {string} name
 * @property {number} sendDate
 * @property {Map<string, Set<number>>} reactions
 * @property {string} channel
 * @property {number|null} repliesTo
 */
/**
 * @typedef {Object} PlaceChatMessage
 * @property {number} msgPos
 * @property {string} txt
 * @property {number} senderIntId
 * @property {string} name
 */
/**
 * @typedef {Object} ChatPacket
 * @property {"live"|"place"} type
 * @property {LiveChatMessage|PlaceChatMessage} message
 * @property {string} [channel] - Only present for live chat
 */
/**
 * @typedef {Object} LiveChatHistoryPacket
 * @property {number} fromMessageId
 * @property {number} count
 * @property {boolean} before
 * @property {string} channel
 * @property {LiveChatMessage[]} messages
 */
/**
 * @typedef {Object} ModerationPacket
 * @property {number} state - The punishment state (mute/ban)
 * @property {number} startDate - Timestamp in milliseconds
 * @property {number} endDate - Timestamp in milliseconds
 * @property {string} reason - Reason for punishment
 * @property {string} appeal - Appeal status text
 */


// Utilities
const encoder = new TextEncoder()
const decoder = new TextDecoder()

// csrfstate not used at the moment, may be later to encode some extra info for client
let params = new URLSearchParams(location.search);
let csrfState = params.get("state");
let redditOauthCode = params.get("code");
let boardParam = params.get("board");
let serverParam = params.get("server");

if (boardParam && serverParam) {
	if (localStorage.server != serverParam || localStorage.board != boardParam) {
		localStorage.server = serverParam
		localStorage.board = boardParam
		history.pushState(null, "", location.origin)
		window.location.reload()
	}
}

// HTML Elements
const postsFrame = /**@type {HTMLIFrameElement}*/($("#postsFrame"));
const more = /**@type {HTMLElement}*/$("#more");
const spaceFiller = /**@type {HTMLElement}*/($("#spaceFiller"));
const mainContent = /**@type {HTMLElement}*/($("#maincontent"));
const canvParent1 = /**@type {HTMLElement}*/($("#canvparent1"));
const canvParent2 = /**@type {HTMLElement}*/($("#canvparent2"));
const canvSelect = /**@type {HTMLElement}*/($("#canvselect"));
const canvas = /**@type {HTMLCanvasElement}*/($("#canvas"));
const viewportCanvas = /**@type {HTMLCanvasElement}*/($("#viewportCanvas"));
const colours = /**@type {HTMLElement}*/($("#colours"));
const modal = /**@type {HTMLDialogElement}*/($("#modal"));
const modalInstall = /**@type {HTMLButtonElement}*/($("#modalInstall"));
const templateImage = /**@type {HTMLImageElement}*/($("#templateImage"));
const overlayMenuOld = /**@type {HTMLElement}*/($("#overlayMenuOld"));
const overlayMenu = /**@type {HTMLDialogElement}*/($("#overlayMenu"));
const positionIndicator = /**@type {import("./game-elements.js").PositionIndicator}*/($("#positionIndicator"));
const idPosition = /**@type {HTMLElement}*/($("#idPosition"));
const onlineCounter = /**@type {HTMLElement}*/($("#onlineCounter"));
const canvasLock = /**@type {HTMLElement}*/($("#canvasLock"));
const namePanel = /**@type {HTMLElement}*/($("#namePanel"));
const nameInput = /**@type {HTMLInputElement}*/(document.getElementById("nameInput"));
const placeButton = /**@type {HTMLButtonElement}*/($("#place"));
const placeOkButton = /**@type {HTMLButtonElement}*/($("#pok"));
const placeCancelButton = /**@type {HTMLButtonElement}*/($("#pcancel"));
const palette = /**@type {HTMLElement}*/($("#palette"));
const channelDrop = /**@type {HTMLElement}*/($("#channelDrop"));
const channelDropParent = /**@type {HTMLElement}*/($("#channelDropParent"));
const channelEn = /**@type {HTMLElement}*/($("#channelEn"));
const channelMine = /**@type {HTMLElement}*/($("#channelMine"));
const channelMineButton = /**@type {HTMLButtonElement}*/($("#channelMineButton"));
const channelEnButton = /**@type {HTMLButtonElement}*/($("#channelEnButton"));
const channelMineName = /**@type {HTMLElement}*/($("#channelMineName"));
const channelMineImg = /**@type {HTMLImageElement}*/($("#channelMineImg"));
const chatMessages = /**@type {HTMLElement}*/($("#chatMessages"));
const chatPreviousButton = /**@type {HTMLButtonElement}*/($("#chatPreviousButton"));
const captchaOptions = /**@type {HTMLElement}*/($("#captchaOptions"));
const turnstileMenu = /**@type {HTMLElement}*/($("#turnstileMenu"));
const messageInput = /**@type {HTMLInputElement}*/($("#messageInput"));
const messageTypePanel = /**@type {HTMLElement}*/($("#messageTypePanel"));
const messageInputGifPanel = /**@type {HTMLElement}*/($("#messageInputGifPanel"));
const messageReplyPanel = /**@type {HTMLElement}*/($("#messageReplyPanel"));
const messageReplyLabel = /**@type {HTMLElement}*/($("#messageReplyLabel"));
const punishmentNote = /** @type {HTMLElement}*/($("#punishmentNote"));
const punishmentUserId = /** @type {HTMLElement}*/($("#punishmentUserId"));
const punishmentStartDate = /** @type {HTMLElement}*/($("#punishmentStartDate"));
const punishmentEndDate = /** @type {HTMLElement}*/($("#punishmentEndDate"));
const punishmentReason = /** @type {HTMLElement}*/($("#punishmentReason"));
const punishmentAppeal = /** @type {HTMLElement}*/($("#punishmentAppeal"));
const punishmentMenu = /** @type {HTMLElement}*/($("#punishmentMenu"));
const moderationMenu = /**@type {HTMLInputElement}*/($("#moderationMenu"));
const modMemberId = /**@type {HTMLInputElement}*/($("#modMemberId"));
const modMessageId = /**@type {HTMLInputElement}*/($("#modMessageId"));
const modMessagePreview = /**@type {HTMLInputElement}*/($("#modMessagePreview"));
const modDurationH = /**@type {HTMLInputElement}*/($("#modDurationH"));
const modDurationM = /**@type {HTMLInputElement}*/($("#modDurationM"));
const modDurationS = /**@type {HTMLInputElement}*/($("#modDurationS"));
const modAffectsAll = /**@type {HTMLInputElement}*/($("#modAffectsAll"));
const modReason = /**@type {HTMLInputElement}*/($("#modReason"));
const modCloseButton = /**@type {HTMLButtonElement}*/$("#modCloseButton");
const modCancelButtonn = /**@type {HTMLButtonElement}*/$("#modCancelButton");
const captchaPopup = /**@type {HTMLElement}*/($("#captchaPopup"));
const modActionDelete = /**@type {HTMLInputElement}*/($("#modActionDelete"));
const modActionKick = /**@type {HTMLInputElement}*/($("#modActionKick"));
const modActionMute = /**@type {HTMLInputElement}*/($("#modActionMute"));
const modActionBan = /**@type {HTMLInputElement}*/($("#modActionBan"));
const modActionCaptcha = /**@type {HTMLInputElement}*/($("#modActionCaptcha"));
const chatPanel = /**@type {HTMLElement}*/($("#chatPanel"));
const messageEmojisPanel = /**@type {HTMLElement}*/($("#messageEmojisPanel"));
const messageInputEmojiPanel = /**@type {HTMLElement}*/($("#messageInputEmojiPanel"));
const tlSelect = /**@type {HTMLElement}*/($("#tlSelect"));
const tlImage = /**@type {HTMLImageElement}*/($("#tlImage"));
const timelapsePanel = /**@type {HTMLElement}*/($("#timelapsePanel"));
const tlConfirm = /**@type {HTMLButtonElement}*/($("#tlConfirm"));
const tlStartSel = /**@type {HTMLSelectElement}*/($("#tlStartSel"));
const tlEndSel = /**@type {HTMLSelectElement}*/($("#tlEndSel"));
const tlTimer = /**@type {HTMLElement}*/($("#tlTimer"));
const tlFps = /**@type {HTMLInputElement}*/($("#tlFps"));
const tlPlayDir = /**@type {HTMLInputElement}*/($("#tlPlayDir"));
const overlayInput = /**@type {HTMLInputElement}*/($("#overlayInput"));
const chatContext = /**@type {HTMLElement}*/($("#chatContext"));
const userNote = /**@type {HTMLElement}*/($("#userNote"));
const mentionUser = /**@type {HTMLElement}*/($("#mentionUser"));
const replyUser = /**@type {HTMLElement}*/($("#replyUser"));
const blockUser = /**@type {HTMLElement}*/($("#blockUser"));
const changeMyName = /**@type {HTMLElement}*/($("#changeMyName"));
const connProblems = /**@type {HTMLElement}*/($("#connproblems"));
const chatAd = /**@type {HTMLAnchorElement}*/($("#chatAd"));
const chatCloseButton = /**@type {HTMLButtonElement}*/($("#chatCloseButton"));
const closeButton = /**@type {HTMLAnchorElement}*/($("#closebtn"));
const chatButton = /**@type {HTMLAnchorElement}*/($("#chatbtn"));
const messageOptionsButton = /**@type {HTMLAnchorElement}*/($("#messageOptionsButton"));
const themeDrop = /**@type {HTMLElement}*/($("#themeDrop"));
const themeDropName = /**@type {HTMLElement}*/($("#themeDropName"));
const themeDropParent = /**@type {HTMLElement}*/($("#themeDropParent"));

// WS & State variables
/**@type {Map<number, number>}*/ let intIdPositions = new Map(); // position : intId
/**@type {Map<number, string>}*/ export let intIdNames = new Map(); // intId : name
/**@type {any|null}*/ let account = null;
/**@type {number|null}*/ let intId = null;
/**@type {string|null}*/ let chatName = null;
/**@type {boolean}*/ let includesPlacer = false; // Server will tell us this
/**@type {boolean}*/ let initialConnect = false;
/**@type {number|null}*/ let cooldownEndDate = null;
/**@type {number}*/ let online = 1;
/**@type {boolean}*/ let canvasLocked = false;

// Readonly WS & State variables
let PALETTE_USABLE_REGION = DEFAULT_PALETTE_USABLE_REGION;
let PALETTE = DEFAULT_PALETTE;
let WIDTH = DEFAULT_WIDTH;
let HEIGHT = DEFAULT_HEIGHT;
let COOLDOWN = DEFAULT_COOLDOWN;

// WsCapsule logic & wscapsule message handlers
const automated = navigator.webdriver;

const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
	.replace("wss://", "https://").replace("ws://", "http://");
const res = await fetch(`${httpServerUrl}/public/game-worker.js`);
const code = await res.text();
const blob = new Blob([code], { type: "application/javascript" });
const url = URL.createObjectURL(blob);
const wsCapsule = new Worker(url, {
	type: "module"
});
wsCapsule.addEventListener("message", handleIpcMessage);
const injectedCjs = document.createElement("script");
injectedCjs.innerHTML = `
	delete WebSocket;
	delete Worker;
	Object.defineProperty(window, "eval", {
		value: function() { throw new Error() },
		writable: false,
		configurable: false
	});
`;
document.body.appendChild(injectedCjs);

/**
 * 
 */
function handleConnect() {
	initialConnect = true;
	if (automated) {
		const activityObj = {
			windowOuterWidth: window.outerWidth,
			windowInnerWidth: window.innerWidth,
			windowOuterHeight: window.outerHeight,
			windowInnerHeight: window.innerHeight,
			lastMouseMove: new Date(lastMouseMove).toISOString(),
			mouseX: mx,
			mouseY: my,
			localStorage: { ...localStorage }
		};
		sendIpcMessage(wsCapsule, "informAutomatedActivity", activityObj);
	}
}
addIpcMessageHandler("handleConnect", handleConnect);
/**
 * 
 * @param {{ palette: number[], paletteUsableRegion: { start: number, end: number } }} param 
 */
function handlePalette({ palette, paletteUsableRegion }) {
	PALETTE = palette;
	PALETTE_USABLE_REGION.start = paletteUsableRegion.start;
	PALETTE_USABLE_REGION.end = paletteUsableRegion.end;

	generatePalette();
	const binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS);
	generateIndicators(binds);
	// Board might have already been drawn with old palette so we need to draw it again
	if (boardAlreadyRendered === true) {
		renderAll();
	}
}
addIpcMessageHandler("handlePalette", handlePalette);
/**
 * Used by both legacy & RplaceServer
 * @param {{ endDate: number, cooldown: number }} param 
 */
function handleCooldownInfo({ endDate, cooldown }) {
	cooldownEndDate = endDate;
	COOLDOWN = cooldown;
}
addIpcMessageHandler("handleCooldownInfo", handleCooldownInfo);
/**
 * Used by RplaceServer
 * @param {{ width: number, height: number }} param 
 */
async function handleCanvasInfo({ width, height }) {
	WIDTH = width;
	HEIGHT = height;
	setSize(width, height);
	const board = await preloadedBoard;
	if (board) {
		runLengthDecodeBoard(board, width * height);
		hideLoadingScreen();
	}
}
addIpcMessageHandler("handleCanvasInfo", handleCanvasInfo);
/**
 * Used by legacy server
 * @param {DataView<ArrayBuffer>} changes 
 */
async function handleChanges(changes) {
	const board = await preloadedBoard
	if (board) {
		runLengthChanges(changes, board);
		hideLoadingScreen();
	}
}
addIpcMessageHandler("handleChanges", handleChanges);
/**
 * @param {number} count 
 */
function setOnline(count) {
	online = count;
	onlineCounter.textContent = String(count);
	sendPostsFrameMessage("onlineCounter", count);
}
addIpcMessageHandler("setOnline", setOnline);
/**
 * @param {{ position: number, width: number, height: number, region: DataView<ArrayBuffer> }} param
 */
function handlePlacerInfoRegion({ position, width, height, region }) {
	let i = position;
	let regionI = 0;
	while (regionI < region.byteLength) {
		for (let xi = i; xi < i + width; xi++) {
			const placerIntId = region.getUint32(regionI);
			if (placerIntId !== 0xFFFFFFFF) {
				intIdPositions.set(xi, placerIntId);
			}
			regionI += 4;
		}
		i += WIDTH;
	}
}
addIpcMessageHandler("handlePlacerInfoRegion", handlePlacerInfoRegion);
/**
 * @param {number} newIntId 
 */
function handleSetIntId(newIntId) {
	intId = newIntId;
}
addIpcMessageHandler("handleSetIntId", handleSetIntId);
/**
 * @param {{ locked: boolean, reason: string|null }} params 
 */
function setCanvasLocked({ locked, reason }) {
	canvasLocked = locked;
	canvasLock.style.display = locked ? "flex" : "none";
	// TODO: Find a more elegant solution
	if (reason) {
		alert(reason);
	}
}
addIpcMessageHandler("setCanvasLocked", setCanvasLocked);
/**
 * @param {{ position: number, colour: number, placer:number|undefined }[]} pixels 
 */
function handlePixels(pixels) {
	for (const pixel of pixels) {
		seti(pixel.position, pixel.colour);
		if (pixel.placer) {
			intIdPositions.set(pixel.position, pixel.placer)
		}
	}
}
addIpcMessageHandler("handlePixels", handlePixels);
/**
 * @param {{ endDate: number, position: number, colour: number }} param 
 */
function handleRejectedPixel({ endDate, position, colour }) {
	cooldownEndDate = endDate;
	seti(position, colour);
}
addIpcMessageHandler("handleRejectedPixel", handleRejectedPixel);
/**
 * @param {string} name 
 */
function setChatName(name) {
	chatName = name;
	namePanel.style.visibility = "hidden";
}
addIpcMessageHandler("setChatName", setChatName);
/**
 * @param {{ message: LiveChatMessage, channel: string }} param
 */
function addLiveChatMessage({ message, channel }) {
	if (!cMessages.has(channel)) {
		cMessages.set(channel, []);
	}

	const newMessage = createLiveChatMessage(
		message.messageId,
		message.txt,
		message.senderIntId,
		message.name,
		message.sendDate,
		message.repliesTo,
		message.reactions
	);

	// Apply user blocking
	if (message.senderIntId !== 0 && blockedUsers.includes(message.senderIntId)) {
		newMessage.style.color = "transparent";
		newMessage.style.textShadow = "0px 0px 6px black";
	}

	// Handle mentions
	if (message.txt.includes("@" + chatName) ||
		message.txt.includes("@#" + intId) ||
		message.txt.includes("@everyone")) {
		newMessage.setAttribute("mention", "true");
		if (channel === currentChannel) {
			runAudio(AUDIOS.closePalette);
		}
	}

	const atScrollBottom = chatMessages.scrollTop + chatMessages.offsetHeight + 64 >= chatMessages.scrollHeight;

	// Update message storage
	const channelMessages = cMessages.get(channel);
	if (channelMessages) {
		channelMessages.push(newMessage);
		if (channelMessages.length > MAX_CHANNEL_MESSAGES) {
			channelMessages.shift();
		}
	}

	// Update UI if current channel
	if (channel === currentChannel) {
		if (chatMessages.children.length > MAX_CHANNEL_MESSAGES) {
			chatMessages.children[0].remove();
		}
		chatMessages.insertAdjacentElement("beforeend", newMessage);
		newMessage.updateComplete.then(() => {
			if (atScrollBottom) {
				chatMessages.scrollTo(0, chatMessages.scrollHeight);
			}
		});
	}
}
addIpcMessageHandler("addLiveChatMessage", addLiveChatMessage);
/**
 * @param {PlaceChatMessage} message
 */
function addPlaceChatMessage(message) {
	if (!placeChat) {
		return
	}

	// Create message
	const placeMessage = document.createElement("placechat")
	placeMessage.innerHTML = `<span title="${(new Date()).toLocaleString()}" style="color: ${CHAT_COLOURS[hash("" + message.senderIntId) & 7]};">[${message.name}]</span><span>${message.txt}</span>`
	placeMessage.style.left = (message.msgPos % WIDTH) + "px"
	placeMessage.style.top = (Math.floor(message.msgPos / WIDTH) + 0.5) + "px"
	canvParent2.appendChild(placeMessage)

	//Remove message after given time
	setTimeout(() => {
		placeMessage.remove();
	}, localStorage.placeChatTime || 7e3)
}
addIpcMessageHandler("addPlaceChatMessage", addPlaceChatMessage);
/**
 * @param {number} messageId 
 */
function handleLiveChatDelete(messageId) {
	for (const channel of cMessages.values()) {
		for (const messageEl of channel) {
			if (messageEl.messageId !== messageId) {
				continue;
			}
			channel.splice(channel.indexOf(messageEl), 1);
			messageEl.remove();
		}
	}
}
addIpcMessageHandler("handleLiveChatDelete", handleLiveChatDelete);
/**
 * @param {{ messageId: number, reactorId: number, reactionKey: string }} params
 */
function handleLiveChatReaction({ messageId, reactorId, reactionKey }) {
	for (const channel of cMessages.values()) {
		for (const messageEl of channel) {
			if (messageEl.messageId !== messageId) {
				continue;
			}

			const currentReactions = messageEl.reactions;
			const reactors = currentReactions?.get(reactionKey) || new Set();
			if (!reactors.has(reactorId)) {
				const newReactions = currentReactions ? new Map(currentReactions) : new Map();
				reactors.add(reactorId);
				newReactions.set(reactionKey, reactors);
				messageEl.reactions = newReactions;
			}
		}
	}
}
addIpcMessageHandler("handleLiveChatReaction", handleLiveChatReaction);
/**
 * @param {{ options: string[], imageData: Uint8Array, answerCallback:(answer:string) => void }} param
 */
function handleTextCaptcha({ options, imageData, answerCallback }) {
	captchaOptions.innerHTML = ""

	let captchaSubmitted = false
	for (const text of options) {
		const button = document.createElement("button")
		button.textContent = text
		captchaOptions.appendChild(button)

		button.addEventListener("click", (event) => {
			if (captchaSubmitted || !text) {
				return console.error("Could not send captcha response. No text?")
			}
			captchaSubmitted = true;
			answerCallback(text);
			captchaOptions.style.pointerEvents = "none";
		})
	}
	captchaPopup.style.display = "flex";
	captchaOptions.style.pointerEvents = "all";

	const imageBlob = new Blob([imageData], { type: "image/png" });
	if (webGLSupported) {
		updateImgCaptchaCanvas(imageBlob)
	}
	else {
		updateImgCaptchaCanvasFallback(imageBlob)
	}
}
addIpcMessageHandler("handleTextCaptcha", handleTextCaptcha);
/**
 * @param {{ options: string[], imageData: Uint8Array, answerCallback:(answer:string) => void }} param
 */
function handleEmojiCaptcha({ options, imageData, answerCallback }) {
	captchaOptions.innerHTML = ""

	let captchaSubmitted = false
	for (const emoji of options) {
		let buttonParent = document.createElement("button")
		buttonParent.classList.add("captcha-options-button")
		buttonParent.setAttribute("value", emoji)
		let emojiImg = document.createElement("img")
		emojiImg.src = `./tweemoji/${emoji.codePointAt(0)?.toString(16)}.png`
		emojiImg.alt = emoji
		emojiImg.title = emoji
		emojiImg.fetchPriority = "high"
		emojiImg.addEventListener("load", (event) => {
			buttonParent.classList.add("loaded")
		})
		buttonParent.appendChild(emojiImg)
		captchaOptions.appendChild(buttonParent)

		function submitCaptcha() {
			if (captchaSubmitted || !emoji) {
				return console.error("Could not send captcha response. No emoji?")
			}
			captchaSubmitted = true
			answerCallback(emoji)
			captchaOptions.style.pointerEvents = "none";
			clearCaptchaCanvas();
		}
		buttonParent.addEventListener("click", submitCaptcha)
		emojiImg.addEventListener("click", submitCaptcha)
		buttonParent.addEventListener("touchend", submitCaptcha)
		emojiImg.addEventListener("touchend", submitCaptcha)
	}

	captchaPopup.style.display = "flex"
	captchaOptions.style.pointerEvents = "all"
	const imageBlob = new Blob([imageData], { type: "image/png" })
	if (webGLSupported) {
		updateImgCaptchaCanvas(imageBlob)
	}
	else {
		updateImgCaptchaCanvasFallback(imageBlob)
	}
}
addIpcMessageHandler("handleEmojiCaptcha", handleEmojiCaptcha);
/**
 * @param {{ siteKey:string, turnstileCallback: (token: string) => void }} param
 */
function handleTurnstile({ siteKey, turnstileCallback }) {
	const siteVariant = document.documentElement.dataset.variant
	const turnstileTheme = siteVariant === "dark" ? "dark" : "light"

	turnstileMenu.setAttribute("open", "true")

	if (window.turnstile) {
		window.turnstile.ready(function () {
			window.turnstile.render("#turnstileContainer", {
				sitekey: siteKey,
				theme: turnstileTheme,
				language: lang,
				callback: turnstileCallback
			})
		})
	}
}
addIpcMessageHandler("handleTurnstile", handleTurnstile);
export function handleTurnstileSuccess() {
	turnstileMenu.removeAttribute("open")
}
addIpcMessageHandler("handleTurnstileSuccess", handleTurnstileSuccess);
/**
 * @param {ModerationPacket} packet
 */
function applyPunishment(packet) {
	messageInput.disabled = true;
	if (packet.state === PUNISHMENT_STATE.mute) {
		punishmentNote.innerHTML = "You have been <strong>muted</strong>, you cannot send messages in live chat.";
	}
	else if (packet.state === PUNISHMENT_STATE.ban) {
		canvasLocked = true;
		canvasLock.style.display = "flex";
		punishmentNote.innerHTML = "You have been <strong>banned</strong> from placing on the canvas or sending messages in live chat.";
	}

	punishmentUserId.textContent = `Your User ID: #${intId}`;
	punishmentStartDate.textContent = `Started on: ${new Date(packet.startDate).toLocaleString()}`;
	punishmentEndDate.textContent = `Ending on: ${new Date(packet.endDate).toLocaleString()}`;
	punishmentReason.textContent = `Reason: ${packet.reason}`;
	punishmentAppeal.textContent = `Appeal status: ${(packet.appeal && packet.appeal !== "null") ? packet.appeal : 'Unappealable'}`;
	punishmentMenu.setAttribute("open", "true");
}
addIpcMessageHandler("applyPunishment", applyPunishment);
/**
 * @param {{code: number, reason: string }} param 
 */
function handleDisconnect({ code, reason }) {
	if (code === 1006 && !sessionStorage.err) {
		sessionStorage.err = "1";
		window.location.reload();
	}
	cooldownEndDate = null;
	showLoadingScreen("disconnected", reason);
}
addIpcMessageHandler("handleDisconnect", handleDisconnect);
function handleCaptchaSuccess() {
	captchaPopup.style.display = "none";
}
addIpcMessageHandler("handleCaptchaSuccess", handleCaptchaSuccess);
/**
 * @param {{ source: string, input: string }} param0 
 */
async function handleChallenge({ source, input }) {
	const result = await Object.getPrototypeOf(async function () { })
		.constructor(source)(input);
	sendIpcMessage(wsCapsule, "sendChallengeResult", result);
}
addIpcMessageHandler("handleChallenge", handleChallenge);

// Touch & mouse canvas event handling
let moved = 3
/**@type {Touch|null}*/let touch1 = null
/**@type {Touch|null}*/let touch2 = null
let touchMoveDistance = 15

// Bidirectional IPC, similar to server.ts - db-worker.ts communication
// Methods called by posts frame
function resizePostsFrame() {
	if (!postsFrame) {
		return;
	}
	const calcHeight = postsFrame.contentWindow?.document.body.scrollHeight || 0;
	postsFrame.height = String(calcHeight);
	postsFrame.style.minHeight = calcHeight + "px";
}
postsFrame.addEventListener("load", resizePostsFrame);

function openOverlayMenuOld() {
	if (enableNewOverlayMenu === true) {
		openOverlayMenu();
	}
	else {
		overlayMenuOld.setAttribute("open", "true");
	}
}
function scrollToPosts() {
	postsFrame.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" })
}

// Load more posts on scroll down
more.addEventListener("scroll", function(/**@type {any}*/ e) {
	const moreMaxScroll = more.scrollHeight - more.clientHeight
	if (moreMaxScroll - more.scrollTop < 256) {
		sendIpcMessage(postsFrame, "tryLoadBottomPosts");
	}
	// Dialog positioning is messed up as it only sees iframe window, this is cursed but it works
	const dialogTopHeight = Math.max(more.scrollTop - spaceFiller.offsetHeight + window.innerHeight / 2,
		spaceFiller.offsetHeight / 2)
		sendIpcMessage(postsFrame, "updateDialogTop", dialogTopHeight);
}, { passive: true })

// Game input handling && overrides
mainContent.addEventListener("touchstart", function(/**@type {TouchEvent}*/ e) {
	e.preventDefault()
	for (let i = 0; i < e.changedTouches.length; i++) {
		const touch = e.changedTouches[i];
		if (!touch1) {
			touch1 = touch
			touchMoveDistance = 15
		}
		else if (!touch2) {
			touch2 = touch
		}
		else {
			[touch1, touch2] = [touch2, touch]
		}
	}
})
mainContent.addEventListener("touchend", function(/** @type {TouchEvent} */ e) {
	if (!e.isTrusted) {
		return;
	}

	for (let i = 0; i < e.changedTouches.length; i++) {
		const t = e.changedTouches[i];

		assign2: {
			// Clear touch2 if it matches the identifier
			if (touch2 && touch2.identifier === t.identifier) {
				touch2 = null;
			}

			// If touch1 matches, swap and reset touch2
			else if (touch1 && touch1.identifier === t.identifier) {
				[touch1, touch2] = [touch2, null];

				// Check touchMoveDistance and if target is inside canvParent2
				if (touchMoveDistance > 0 && e.target instanceof Node && canvParent2.contains(e.target)) {
					// Ensure target is valid
					if (e.target !== mainContent && !canvParent2.contains(e.target)) {
						break assign2;
					}
					clicked(t.clientX, t.clientY);
				}
			}
		}

		// Ensure target is an HTMLElement before proceeding
		let target = /** @type {HTMLElement|null} */(e.target);
		if (target && "value" in target) {
			target.focus();
		}

		// Traverse up to find a dispatchable target
		while (target && !target.dispatchEvent) {
			target = target.parentElement
		}

		// Handle click on target
		if (touchMoveDistance > 0 && target) {
			target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		}
	}
	e.preventDefault();
});
mainContent.addEventListener("mousedown", function(/** @type {{ button: number; }} */ e) {
	moved = 3
	mouseDown = e.button + 1
})

mainContent.addEventListener("mouseup", function(/** @type {{ target: any; clientX: any; clientY: any; }} */ e) {
	if (e.target != mainContent && !canvParent2.contains(e.target)) {
		return (moved = 3, mouseDown = 0)
	}

	if (moved > 0 && canvParent2.contains(e.target)) {
		clicked(e.clientX, e.clientY)
	}

	moved = 3
	mouseDown = 0
})


let selX = 0
let selY = 0
const canvasCtx = canvas.getContext("2d");
function transform() {
	const scale = z * 50;
	const translateX = x * z * -50;
	const translateY = y * z * -50;
	const width = z * canvas.width * 50;
	const height = z * canvas.height * 50;

	canvParent1.style.transform = `translate(${translateX + innerWidth / 2}px, ${translateY + mainContent.offsetHeight / 2}px) scale(${scale})`;
	canvParent2.style.transform = canvParent1.style.transform;
	canvSelect.style.transform = `translate(${Math.floor(x)}px, ${Math.floor(y)}px) scale(0.01)`;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.transform = `translate(${translateX}px, ${translateY}px)`;
	canvas.style.imageRendering = z < 1 / 50 / devicePixelRatio ? "initial" : "";
}

// Essential game variable definitions
export let x = 0;
export let y = 0;
export let z = 0;
let minZoom = 0;
/**@type {Uint8Array|null}*/let BOARD = null;


// Prompt user if they want to install site as PWA if they press the modal button
/**@type {Event|null}*/
let pwaPrompter = null
modalInstall.disabled = true
window.addEventListener("beforeinstallprompt", function(e) {
	e.preventDefault()
	pwaPrompter = e
	modalInstall.disabled = false
})
modalInstall.addEventListener("click", () => {
	pwaPrompter?.prompt();
});

// Keybinds
document.body.addEventListener("keydown", function(/**@type {KeyboardEvent}*/e) {
	if (!e.isTrusted) {
		return
	}

	// Handle keybindings
	if (!document.activeElement || !("value" in document.activeElement)) {
		//"Shift+O" to open overlay menu
		if (e.key === "O" && e.shiftKey) {
			e.preventDefault();
			overlayMenuOld.toggleAttribute("open");
		}
		else if (e.key === "/") {
			e.preventDefault();
			openChatPanel();
			messageInput.focus();
		}
		else if (e.key === "Escape") {
			e.preventDefault();
			modal.showModal();
		}
		else if ((e.key === "=" || e.key == "+")) {
			e.preventDefault();
			z += 0.02;
			pos();
		}
		else if (e.key === "-") {
			e.preventDefault();
			z -= 0.02;
			pos();
		}

		// Move around with arrow keys
		let moveEaseI = 10;
		let arrowkeyDown = {
			left: false,
			right: false,
			up: false,
			down: false
		};
		let repeatFunc = setInterval(function() {
			// We use 55 because: 10/55+9/55+8/55+7/55+6/55+5/55+4/55+3/55+2/55+1/55 = 1
			switch (e.keyCode) {
			case 37:
				x -= moveEaseI / 55
				arrowkeyDown.right = true
				break //right
			case 38:
				y -= moveEaseI / 55
				arrowkeyDown.up = true
				break //up
			case 39:
				x += moveEaseI / 55
				arrowkeyDown.left = true
				break //left
			case 40:
				y += moveEaseI / 55
				arrowkeyDown.down = true
				break //down
			}
			pos()
			moveEaseI--
			if (moveEaseI <= 0) clearInterval(repeatFunc)
		}, 16);
	}

	//Begin palette commands
	if (onCooldown || canvasLocked) {
		return;
	}

	//"Enter" key to place selected block without using mouse
	if (e.key == "Enter" && (!document.activeElement || !("value" in document.activeElement))) {
		handlePixelPlace(e);
		return;
	}

	//Keyboard shortcuts for selecting palette colours
	let keyIndex = null
	if (document.activeElement != document.body) {
		return
	}
	keyIndex = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS).indexOf(e.key)
	if (keyIndex == -1) {
		return
	}
	if (palette.style.transform == "translateY(100%)") {
		showPalette()
	}
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c].firstChild);
		indicator.style.visibility = "visible"
	}
	let colourI = [...(colours.children)]
		.indexOf(colours.children[keyIndex])
	if (colourI < 0) return
	let el = colours.children[PEN]
	if (el) {
		el.classList.remove("sel")
	}
	PEN = keyIndex;
	runAudio(AUDIOS.selectColour)
	canvSelect.style.background = colours.children[keyIndex].style.background
	colours.children[keyIndex].classList.add("sel")
	placeOkButton.classList.add("enabled")
	canvSelect.children[0].style.display = "none"
	canvSelect.style.outline= "8px white solid"
	canvSelect.style.boxShadow= "0px 2px 4px 0px rgb(0 0 0 / 50%)"
});

/**
 * @param {number} w
 * @param {number} h
 */
export function setSize(w, h = w) {
	canvas.width = WIDTH = w;
	canvas.height = HEIGHT = h;
	canvParent1.style.width = w + "px";
	canvParent1.style.height = h + "px";
	canvParent2.style.width = w + "px";
	canvParent2.style.height = h + "px";
	BOARD = new Uint8Array(w * h).fill(255);
	let i = BOARD.length;
	x = +localStorage.x || w / 2;
	y = +localStorage.y || h / 2;
	z = +localStorage.z || 0.2;

	for (let [key, value] of new URLSearchParams(location.search)) {
		switch (key) { // Only for numeric value params
			case "x": {
				x = parseInt(value, 10) || 0;
				pos();
				break;
			}
			case "y": {
				y = parseInt(value, 10) || 0;
				pos(); break;
			}
			case "z": {
				z = parseInt(value, 10) || 0;
				break;
			}
			case "err": {
				onerror = alert;
				break;
			}
			case "overlay":
				overlayInfo = JSON.parse(value);
				const imageData = base64ToBlob(overlayInfo.data, overlayInfo.type);
				templateImage.src = URL.createObjectURL(imageData);
				overlayInfo.x = overlayInfo.x || 0;
				overlayInfo.y = overlayInfo.y || 0;
				templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`;
				templateImage.style.opacity = String(overlayInfo.opacity || 0.8);
				x = overlayInfo.x;
				y = overlayInfo.y;
				z = Math.min(Math.max(z, minZoom), 1);
				pos();
				openOverlayMenuOld();
				break;
		}
	}
	onMainContentResize();
}

function onMainContentResize() {
	minZoom = Math.min(innerWidth / canvas.width, mainContent.offsetHeight / canvas.height) / 100;
	pos();
}

// Mouse input handling
export let lastMouseMove = 0
export let mouseDown = 0
export let mx = 0
export let my = 0

mainContent.addEventListener("mousemove", function(/** @type {{ target: any; clientX: number; clientY: number; }} */ e) {
	lastMouseMove = Date.now();
	if (e.target != mainContent && !canvParent2.contains(e.target)) {
		return;
	}
	moved--;
	let dx = -(mx - (mx = e.clientX - innerWidth / 2));
	let dy = -(my - (my = e.clientY - mainContent.offsetHeight / 2));
	if (dx != dx || dy != dy) {
		return;
	}
	if (mouseDown) {
		x -= dx / (z * 50);
		y -= dy / (z * 50);
		pos();
		if (anim) {
			clearInterval(anim);
		}
	}
})

mainContent.addEventListener("wheel", function(/** @type {{ target: any; deltaY: number; }} */ e) {
	if (e.target != mainContent && !canvParent2.contains(e.target)) {
		return
	}
	const d = Math.max(minZoom / z, Math.min(3 ** Math.max(-0.5, Math.min(0.5, e.deltaY * -0.01)), 1 / z));
	z *= d;
	x += mx * (d - 1) / z / 50;
	y += my * (d - 1) / z / 50;
	pos();
})

let idPositionDebounce = false;
/**@type {Timer|null}*/let idPositionTimeout = null;
let lastIntX = Math.floor(x);
let lastIntY = Math.floor(y);

export function pos(newX=x, newY=y, newZ=z) {
	newX = x = Math.max(Math.min(newX, WIDTH - 1), 0);
	newY = y = Math.max(Math.min(newY, HEIGHT - 1), 0);
	newZ = z = Math.min(Math.max(newZ, minZoom), 1);

	const right = newX - canvas.width + 0.01;
	const left = newX;
	const up = newY - canvas.height + 0.01;
	const down = newY;

	if (right >= left) newX = 0;
	else if (right > 0) newX -= right;
	else if (left < 0) newX -= left;
	if (up >= down) newY = 0;
	else if (up > 0) newY -= up;
	else if (down < 0) newY -= down;
	localStorage.x = Math.floor(newX) + 0.5;
	localStorage.y = Math.floor(newY) + 0.5;
	localStorage.z = newZ;
	transform();
	if (positionIndicator.setPosition) {
		positionIndicator.setPosition(x, y, z);
	}
	boardRenderer?.setPosition(x, y, z);

	const intX = Math.floor(newX), intY = Math.floor(newY);
	if (intX != lastIntX || intY != lastIntY) {
		if(idPositionTimeout) {
			clearTimeout(idPositionTimeout);
		}
		idPosition.style.display = "none";
		idPositionDebounce = false;
	}
	lastIntX = intX;
	lastIntY = intY;

	if (!idPositionDebounce) {
		idPositionDebounce = true;

		idPositionTimeout = setTimeout(() => {
			idPositionDebounce = false;
			let id = intIdPositions.get(intX + intY * WIDTH);
			if (id === undefined || id === null) {
				// Request 16x16 region of pixel placers from server (fine tune if necessary)
				const placersRadius = 16;
				const centreX = Math.floor(Math.max(intX - placersRadius / 2, 0));
				const centreY = Math.floor(Math.max(intY - placersRadius / 2));
				const width = Math.min(placersRadius, WIDTH - intX);
				const height = Math.min(placersRadius, HEIGHT - intY);
				const position = centreX + centreY * WIDTH;

				if (initialConnect) {
					sendIpcMessage(wsCapsule, "requestPixelPlacers", { position, width, height });
				}
				return;
			}
			idPosition.style.display = "flex";
			idPosition.style.left = intX + "px";
			idPosition.style.top = intY + "px";
			if (idPosition.children[1]) {
				/** @type {HTMLElement} */(idPosition.children[1]).style.color = CHAT_COLOURS[hash("" + id) & 7];
				idPosition.children[1].textContent = intIdNames.get(id) || ("#" + id);
			}
		}, 1000)
	}
}

/**@type {BoardRenderer|null}*/let boardRenderer = null;
if (enableWebglCanvas) { // localStorage.useLegacyRenderer !== "true"
	try {
		boardRenderer = new BoardRenderer(viewportCanvas);
		canvas.style.opacity = "0";			
	}
	catch(e) {
		console.error(e);
	}
}

export let boardAlreadyRendered = false
export function renderAll() {
	const img = new ImageData(canvas.width, canvas.height)
	const data = new Uint32Array(img.data.buffer)
	if (BOARD) {
		for (let i = 0; i < BOARD.length; i++) {
			data[i] = PALETTE[BOARD[i]]
		}

		boardRenderer?.setSources(BOARD, new Uint32Array(PALETTE), WIDTH, HEIGHT);
	}
	if (canvasCtx) {
		canvasCtx.putImageData(img, 0, 0)
		// HACK: Workaround for blank-canvas bug on chrome on M1 chips
		canvasCtx.getImageData(0, 0, 1, 1)
		boardAlreadyRendered = true
	}
}


/**@type {Uint32Array}*/let xa = new Uint32Array(1)
/**@type {Uint8Array}*/let xb = new Uint8Array(xa.buffer)

/**
 * @param {number} x
 * @param {number} y
 * @param { number} colour
 */
export function set(x, y, colour) {
	if (!BOARD) {
		return;
	}
	BOARD[x % canvas.width + (y % canvas.height) * canvas.width] = colour
	xa[0] = PALETTE[colour]
	if (canvasCtx) {
		canvasCtx.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
		canvasCtx.clearRect(x, y, 1, 1)
		canvasCtx.fillRect(x, y, 1, 1)
	}
}

mainContent.addEventListener("touchmove", function(/**@type {TouchEvent}*/ e) {
	if (!e.target) {
		return;
	}

	for (let i = 0; i < e.changedTouches.length; i++) {
		const touch = e.changedTouches[i];
		if (!touch) {
			continue;
		}
		if (anim) {
			clearInterval(anim);
		}
		const touchTarget = /**@type {HTMLElement}*/(e.target);

		// Single touch move
		if (!touch2 && touch1 && touch1.identifier == touch.identifier) {
			touchMoveDistance -= Math.abs(touch.clientY - touch1.clientY) + Math.abs(touch.clientX - touch1.clientX)
			if (e.target != mainContent && !canvParent2.contains(touchTarget)) {
				break
			}
			x -= (touch.clientX - touch1.clientX) / (z * 50)
			y -= (touch.clientY - touch1.clientY) / (z * 50)
			pos()
		}

		// Multi-touch move
		else if (touch1 && touch2) {
			if (e.target != mainContent && !canvParent2.contains(touchTarget)) {
				break
			}
			let currentTouch = touch1.identifier == touch.identifier ? touch1 : (touch2.identifier == touch.identifier ? touch2 : null)
			if (!currentTouch) {
				break
			}
			const otherTouch = currentTouch == touch1 ? touch2 : touch1
			x -= (touch.clientX - currentTouch.clientX) / (z * 50)
			y -= (touch.clientY - currentTouch.clientY) / (z * 50)
			touchMoveDistance -= Math.abs(touch.clientY - currentTouch.clientY) + Math.abs(touch.clientX - currentTouch.clientX)
			let dx = currentTouch.clientX - otherTouch.clientX
			let dy = currentTouch.clientY - otherTouch.clientY
			let initialDistance = dx * dx + dy * dy
			dx = touch.clientX - otherTouch.clientX
			dy = touch.clientY - otherTouch.clientY
			const scale = Math.sqrt((dx * dx + dy * dy) / initialDistance)
			z *= scale
			pos()
		}
		// Update touch points
		if (touch1 && touch1.identifier == touch.identifier) touch1 = touch
		else if (touch2 && touch2.identifier == touch.identifier) touch2 = touch
	}
})

/**@type {Timer|null}*/let anim = null

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function clicked(clientX, clientY) {
	if (anim) {
		clearInterval(anim)
	}

	clientX = Math.floor(x + (clientX - innerWidth / 2) / z / 50) + 0.5
	clientY = Math.floor(y + (clientY - mainContent.offsetHeight / 2) / z / 50) + 0.5
	if (clientX == Math.floor(x) + 0.5 && clientY == Math.floor(y) + 0.5) {
		clientX -= 0.5;
		clientY -= 0.5
		if ((cooldownEndDate||0) < Date.now()) {
			zoomIn()
			showPalette()
		}
		else {
			runAudio(AUDIOS.invalid)
		}
		return
	}
	runAudio((cooldownEndDate||0) > Date.now() ? AUDIOS.invalid : AUDIOS.highlight)
	anim = setInterval(function() {
		x += (clientX - x) / 10;
		y += (clientY - y) / 10;
		pos();

		if (Math.abs(clientX - x) + Math.abs(clientY - y) < 0.1) {
			clearInterval(anim);
		}
	}, 15)
}

function zoomIn() {
	if (z >= 0.4) return
	if (anim) {
		clearInterval(anim)
	}
	let dz = 0.005
	anim = setInterval(function() {
		if (dz < 0.2) dz *= 1.1
		z *= 1 + dz
		pos()
		if (anim && z >= 0.4) {
			clearInterval(anim)
		}
	}, 15)
}

/**
 * @param {HTMLAudioElement} audio
 */
export async function runAudio(audio) {
	if (muted) {
		return;
	}
	audio.currentTime = 0;
	await audio.play().catch((/** @type {any} */ e) => console.error(e));
}

// Client state
let onCooldown = false;
let PEN = -1;

let focused = true;
/**
 * @param {boolean} state 
 */
function setFocused(state) {
	if (focused !== state) {
		focused = state;
		// TODO: Disable pixel place UI, suspend clientside cooldown
	}
}
window.addEventListener("blur", () => {
	setFocused(false);
});
window.addEventListener("focus", () => {
	setFocused(true);
});
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") {
		setFocused(true);
	}
	else {
		setFocused(false);
	}
});

/**
 * @param {Event} e
 * @returns
 */
function handlePixelPlace(e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return
	}

	// If cooldownEndDate is null but we have already made that initial connection, we have likely ghost disconnected from the WS
	if (!focused || !initialConnect
		|| (cooldownEndDate === null && initialConnect)
		|| (cooldownEndDate && cooldownEndDate > Date.now())) {
		return;
	}
	if (!placeOkButton.classList.contains("enabled")) {
		return;
	}

	// Send place to websocket
	const position = Math.floor(x) + Math.floor(y) * WIDTH;
	sendIpcMessage(wsCapsule, "putPixel", { e, position, colour: PEN });

	// Apply on client-side
	cooldownEndDate = Date.now() + (localStorage.vip ? (localStorage.vip[0] === "!" ? 0 : COOLDOWN / 2) : COOLDOWN);
	hideIndicators();
	set(Math.floor(x), Math.floor(y), PEN)
	placeOkButton.classList.remove("enabled")
	canvSelect.style.background = ""
	canvSelect.children[0].style.display = "block"
	canvSelect.style.outline = ""
	canvSelect.style.boxShadow = ""
	palette.style.transform = "translateY(100%)"
	runAudio(AUDIOS.cooldownStart)

	if (!mobile) {
		colours.children[PEN].classList.remove("sel")
		PEN = -1
	}
}
// Any button that requires e.isTrusted to be true will cause a problem on mobile due to mobile
// inputs emitting fake events. This is a workaround to prevent that.
placeOkButton.addEventListener("touchstart", handlePixelPlace);
placeOkButton.addEventListener("click", handlePixelPlace);
/**
 * @param {Event} e
 */
function handlePlaceButtonClicked(e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	if (initialConnect && cooldownEndDate < Date.now()) {
		zoomIn()
		showPalette()

		// Persistent colours on mobile platforms
		if (PEN != -1) {
			placeOkButton.classList.add("enabled")
			canvSelect.style.background = colours.children[PEN].style.background
			canvSelect.children[0].style.display = 'none'
			canvSelect.style.outline = '8px white solid'
			canvSelect.style.boxShadow = '0px 2px 4px 0px rgb(0 0 0 / 50%)'
		}
	}
	else {
		runAudio(AUDIOS.invalid)
	}
}
placeButton.addEventListener("touchstart", handlePlaceButtonClicked);
placeButton.addEventListener("click", handlePlaceButtonClicked);

placeCancelButton.addEventListener("click", function(e) {
	runAudio(AUDIOS.closePalette);
	canvSelect.style.background = "";
	palette.style.transform = "translateY(100%)";
	if (PEN != -1) {
		colours.children[PEN].classList.remove("sel");
		PEN = -1;
	}
	placeOkButton.classList.remove("enabled");
	canvSelect.children[0].style.display = "block";
	canvSelect.style.outline = "";
	canvSelect.style.boxShadow = "";
	hideIndicators();
})

setInterval(async () => {
	const left = Math.floor(((cooldownEndDate||0) - Date.now()) / 1000);
	placeButton.innerHTML = initialConnect
		? cooldownEndDate === null // They have made initial connect
			? `<span style="color:#f50; white-space: nowrap;">${await translate("connectingFail")}</span>` // They connected but now have disconnected
			: left > 0
				? `<svg xmlns="http://www.w3.org/2000/svg" data-name="icons final" viewBox="0 0 20 20" style="height: 1.1rem;vertical-align:top"><path d="M13.558 14.442l-4.183-4.183V4h1.25v5.741l3.817 3.817-.884.884z"></path><path d="M10 19.625A9.625 9.625 0 1119.625 10 9.636 9.636 0 0110 19.625zm0-18A8.375 8.375 0 1018.375 10 8.384 8.384 0 0010 1.625z"></path></svg> ${
						("" + Math.floor(left/3600)).padStart(2, "0")}:${("" + Math.floor((left / 60)) % 60).padStart(2, "0")}:${("" + left % 60).padStart(2, "0")}` // They are connected + still connected but in cooldown
				: await translate("placeTile") // They are connected + still connected + after cooldown
		: await translate("connecting") // They are yet to connect

	if ((cooldownEndDate||0) > Date.now() && !onCooldown) {
		onCooldown = true;
	}
	if ((cooldownEndDate||0) < Date.now() && onCooldown) {
		onCooldown = false;
		if (!document.hasFocus()) {
			runAudio(AUDIOS.cooldownEnd)
		}
	}
}, 200)

function showPalette() {
	palette.style.transform = "";
	runAudio(AUDIOS.highlight);
}

export function generatePalette() {
	colours.innerHTML = ""
	for (let i = PALETTE_USABLE_REGION.start; i < PALETTE_USABLE_REGION.end; i++) {
		const colour = PALETTE[i] || 0
		const colourEl = document.createElement("div")
		colourEl.dataset.index = String(i)
		colourEl.style.background = `rgba(${colour & 255},${(colour >> 8) & 255},${(colour >> 16) & 255}, 1)`
		if (colour == 0xffffffff) {
			colourEl.style.outline = "1px #ddd solid"
			colourEl.style.outlineOffset = "-1px"
		}
		const indicatorSpan = document.createElement("span")
		indicatorSpan.contentEditable = "true"
		indicatorSpan.onkeydown = function(event) {
			rebindIndicator(event, i)
		}
		colourEl.appendChild(indicatorSpan)
		colours.appendChild(colourEl)
	}
}
generatePalette()

colours.onclick = (/**@type {MouseEvent}*/e) => {
	const clickedColour = /**@type {HTMLElement}*/(e.target);
	if (!clickedColour || !clickedColour.dataset.index) {
		return;
	}
	const i = parseInt(clickedColour.dataset.index);
	if (Number.isNaN(i) || i < PALETTE_USABLE_REGION.start || i >= PALETTE_USABLE_REGION.end) {
		return;
	}
	for (let i = 0; i < colours.children.length; i++) {
		const colour = colours.children[i];
		colour.classList.remove("sel");
	}
	PEN = i;
	canvSelect.style.background = clickedColour.style.background;
	clickedColour.classList.add("sel");
	placeOkButton.classList.add("enabled");
	canvSelect.children[0].style.display = "none";
	canvSelect.style.outline = "8px white solid";
	canvSelect.style.boxShadow = "0px 2px 4px 0px rgb(0 0 0 / 50%)";
	hideIndicators();
	runAudio(AUDIOS.selectColour);
}

/**
 * @param {DataView<ArrayBuffer>} data - Canges packet data
 * @param {any} buffer - Fetched board from git server
 */
export function runLengthChanges(data, buffer) {
	let i = 9;
	let boardI = 0;
	const w = data.getUint32(1);
	const h = data.getUint32(5);
	if (w != WIDTH || h != HEIGHT) {
		setSize(w, h);
	}
	BOARD = new Uint8Array(buffer);
	while (i < data.byteLength) {
		let cell = data.getUint8(i++);
		let c = cell >> 6;
		if (c == 1) c = data.getUint8(i++);
		else if (c == 2) c = data.getUint16(i++), i++;
		else if (c == 3) c = data.getUint32(i++), i += 3;
		boardI += c;
		BOARD[boardI++] = cell & 63;
	}
	renderAll();
}

// The new server's equivalent for run length changes, based upon run length encoding
/**
 * @param {ArrayBuffer} data
 * @param {number} length
 */
export function runLengthDecodeBoard(data, length) {
	const dataArr = new Uint8Array(data)
	BOARD = new Uint8Array(length)
	let boardI = 0
	let colour = 0

	for (let i = 0; i < data.byteLength; i++) {
		// Then it is a palette value
		if (i % 2 == 0) {
			colour = dataArr[i]
			continue
		}
		// After colour, loop until we unpack all repeats, byte can only hold max 255,
		// so we add one to repeated data[i], and treat it as if 0 = 1 (+1)
		for (let j = 0; j < dataArr[i] + 1; j++) {
			BOARD[boardI] = colour
			boardI++
		}
	}
	renderAll()
}

const allowed = ["rplace.tk", "rplace.live", "google.com", "wikipedia.org", "pxls.space"]
const webGLSupported = (() => {
	let supported = true
	const glTestCanvas = document.createElement("canvas")
	try { supported = glTestCanvas.getContext("webgl2") !== null }
	catch(e) { supported = false }
	return supported
})();
if (!webGLSupported) {
	console.error("Client doesn't support WebGL! Some site features may break!")
}

const mobile = window.matchMedia("(orientation: portrait)").matches

let extraLanguage = (lang == "en" ? "tr" : lang);
/** @type {Map<string, import("./game-elements.js").LiveChatMessage[]>} */export const cMessages = new Map([
	[extraLanguage, []],
	["en", []]
]);
let chatPreviousLoadDebounce = false;
let chatPreviousAutoLoad = false;
export let currentChannel = lang;
let fetchCooldown = 50;
/**@type {Timer|null}*/let fetchFailTimeout = null;
extraChannel(extraLanguage);
initChannelDrop();
switchLanguageChannel(currentChannel);

async function fetchBoard() {
	// Override browser cache with ?v= param, may incur longer loading times
	// TODO: investigate optimisations to only do a hard reload when necessary
	const response = await fetch((localStorage.board || DEFAULT_BOARD) + "?v=" + Date.now())
	if (!response.ok) {
		showLoadingScreen();
		fetchFailTimeout = setTimeout(fetchBoard, fetchCooldown *= 2);
		if (fetchCooldown > 8000) {
			showLoadingScreen("timeout");
			clearTimeout(fetchFailTimeout);
		}

		return null;
	}

	if (fetchFailTimeout) {
		clearTimeout(fetchFailTimeout);
	}

	return await response.arrayBuffer();
}

// We don't await this yet, when the changes (old server) / canvas width & height (new server) packet
// comes through, it will await this unawaited state until it is fulfilled, so we are sure we have all the data
/**@type {Promise<ArrayBuffer|null>}*/export let preloadedBoard = fetchBoard()

/**
 * @param {number} i
 * @param {number} b
 */
export function seti(i, b) {
	if (!BOARD) {
		return;
	}

	BOARD[i] = b
	xa[0] = PALETTE[b]
	if (canvasCtx) {
		canvasCtx.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
		canvasCtx.fillRect(i % WIDTH, Math.floor(i / WIDTH), 1, 1)
	}
}

function hideIndicators() {
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c]?.firstChild);
		if (indicator) {
			indicator.style.visibility = "hidden";
		}
	}
}

/**
 * @param {KeyboardEvent} e
 * @param {string | number} i
 */
function rebindIndicator(e, i) {
	const indicator = /**@type {HTMLElement}*/ (e.target);
	if (!e.key || e.key.length != 1 || !indicator){
		return;
	}
	indicator.innerText = e.key
	indicator.blur()

	let binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS).split("")
	const preExisting = binds.indexOf(e.key)
	if (preExisting != -1) {
		binds[preExisting] = "​"
	}
	binds[i] = e.key.charAt(0)
	localStorage.paletteKeys = binds.join("")
	generateIndicators(binds.join(""))
}
/**
 * @param {string} keybinds
 */
export function generateIndicators(keybinds) {
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c].firstChild);
		indicator.textContent = keybinds.charAt(c)
	}
}
generateIndicators(localStorage.paletteKeys || DEFAULT_PALETTE_KEYS)

// Live chat channels

function initChannelDrop() {
	let containsMy = false;

	channelDrop.children[0].innerHTML = "";
	for (const [code, info] of LANG_INFOS) {
		if (code == lang) {
			containsMy = true;
		}
		const el = document.createElement("li");
		el.innerHTML = `<span>${info.name}</span> <img src="${info.flag}" style="height: 24px;">`;
		el.dataset.lang = code;
		channelDrop.children[0].appendChild(el);
	}

	if (!containsMy) {
		const el = document.createElement("li");
		el.innerHTML = `<span>${lang}</span>`;
		el.dataset.lang = lang;
		channelDrop.children[0].appendChild(el);
	}
}

const channelList = channelDrop.firstElementChild
channelList?.addEventListener("click", function(e) {
	let target = e.target
	while (target instanceof HTMLElement && target != channelList) {
		if (target.nodeName != "LI") {
			target = target.parentElement;
			continue;
		}

		const lang = target.dataset.lang
		if (!lang) {
			break;
		}
		if (lang != extraLanguage && lang != "en") {
			extraChannel(lang);
		}
		switchLanguageChannel(lang);
		e.stopPropagation();
		channelDropParent.removeAttribute("open");
		break;
	}
});

channelMineButton.addEventListener("click", function(e) {
	switchLanguageChannel(extraLanguage);
});

channelEnButton.addEventListener("click", function(e) {
	switchLanguageChannel("en");
});

/**
 * @param {string} code
 */
function extraChannel(code) {
	let info = LANG_INFOS.get(code);
	channelMineName.innerText = code.toUpperCase();
	channelMineImg.src = info?.flag || "/svg/flag-unknown.svg";
	//channelMineImg.style.display = ((info?.flag) ? "inline" : "none")
	extraLanguage = code
	cMessages.set(code, cMessages.get(code) || [])
}


/**
 * @param {string} selected
 */
function switchLanguageChannel(selected) {
	channelMine.style.opacity = "0.5"
	channelEn.style.opacity = "0.5"
	if (currentChannel != selected) {
		chatCancelReplies()
	}
	currentChannel = selected
	chatMessages.style.direction = (LANG_INFOS.get(selected)?.rtl) ? "rtl" : "ltr"

	if (selected == "en") {
		channelEn.style.opacity = "1"
	}
	else if (selected == extraLanguage) {
		channelMine.style.opacity = "1"
	}
	chatMessages.innerHTML = ""
	// User must ask to load previous at least once for each channel before site
	// will start auto loading previous chat messages
	chatPreviousAutoLoad = false
	const messageRenderPromises = []

	if (cMessages.get(selected)?.length) {
		for (const messageEl of cMessages.get(selected) ?? []) {
			messageRenderPromises.push(messageEl.updateComplete);
			chatMessages.appendChild(messageEl);
		}
		Promise.all(messageRenderPromises).then(() => {
			chatMessages.scrollTo(0, chatMessages.scrollHeight);
		})
	}

	// If we don't have any cached messages for this channel, try pre-populate with a few
	const oldestMessage = /**@type {import("./game-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
	sendIpcMessage(wsCapsule, "requestLoadChannelPrevious", {
		channel: currentChannel,
		anchorMsgId: oldestMessage?.messageId || 0,
		msgCount: 32
	});
}

/**
 * @param {number} messageId
 * @param {string} txt
 * @param {number} senderId
 * @param {string|null} name
 * @param {number} sendDate
 * @param {number|null} repliesTo
 * @param {Map<string, Set<number>>|null} reactions
 * @returns {import("./game-elements.js").LiveChatMessage}
 */
export function createLiveChatMessage(messageId, txt, senderId, name, sendDate, repliesTo = null, reactions = null) {
	const message = /**@type {import("./game-elements.js").LiveChatMessage}*/(document.createElement("r-live-chat-message"));
	message.messageId = messageId;
	message.content = txt;
	message.senderId = senderId;
	message.name = name;
	message.sendDate = sendDate;
	message.repliesTo = repliesTo;
	message.reactions = reactions;
	return message;
}

nameInput.addEventListener("keydown", function(e) {
	if (e.key == "Enter") {
		nameInput.blur();
		sendIpcMessage(wsCapsule, "setName", nameInput.value);
	}
	else if (e.key == "Escape") {
		namePanel.style.visibility = "hidden";
	}
	else if (e.key == "Backspace" && nameInput.value.length == 0) {
		namePanel.style.visibility = "hidden";
	}
});
nameInput.addEventListener("input", function() {
	nameInput.value = nameInput.value.replace(/\W+/g, "").toLowerCase()
});
const nameButton = /**@type {HTMLButtonElement}*/($("#nameButton"));
nameButton.addEventListener("click", function() {
	nameInput.blur();
	sendIpcMessage(wsCapsule, "setName", nameInput.value);
});

/**
 * @param {string} command
 * @param {string} message
 */
export function handleLiveChatCommand(command, message) {
	switch (command) {
		case "name": {
			namePanel.style.visibility = "visible";
			nameInput.value = message.slice(5).trim();
			break;
		}
		case "vip": {
			const key = message.slice(4).trim();
			localStorage.vip2 = key;
			localStorage.vip = key;
			window.location.reload();
			break;
		}
		case "getid": {
			const targetName = message.slice(6).trim().toLowerCase();
			if (!targetName) {
				alert("Your User ID is: #" + intId);
			}
			else {
				let foundUsers = `Found Users with name '${targetName}:'\n`;
				for (const pair of intIdNames) {
					if (pair[1] === targetName) {
						foundUsers += `${pair[1]}, #${pair[0]}\n`;
					}
				}
				alert(foundUsers);
			}
			break;
		}
		case "whoplaced": {
			const id = intIdPositions.get(Math.floor(x) + Math.floor(y) * WIDTH);
			if (id === undefined) {
				alert("Could not find details of who placed pixel at current location...");
				return;
			}
			let name = intIdNames.get(id);
			alert(`Details of who placed at ${
				Math.floor(x)}, ${
				Math.floor(y)}:\nName: ${
				name || 'anon'}\nUser ID: #${
				id}`);
			break;
		}
		case "help": {
			const newMessage = createLiveChatMessage(0, `
# Chat Styling Guide ✨
Text in rplace chat can be styled using a simplified version of markdown:
**bold**, *italic*, ||spoilers||, __underline__, \`code\` & ~strikethrough~.

## Text Formatting:
- \`**bold me**\` → **I didn't skip leg day**
- \`*italize me*\` → *whispering sweet nothings*
- \`__underline me__\` → __the terms no-one read__
- \`~strike me out~\` → ~~pineapple pizza is actually ok~~
- \`||spoil the plot||\` → ||Bruce Willis was dead the whole time||
- \`sudo rm -fr /\` → Remove french translations for a faster PC

### Headers:
Use # for a large header, ## for medium, and ### for small. Don’t forget to add a space between the leading heading character and your text!

### Separators:
To create a separator, create a blank line (Shift + Enter on keyboard) and insert a triple dash \`---\`.

### Extras:
1. You can make a list by placing a dash (\`-\`) or star (\`*\`) before what you want to say.
2. > "Block quotes (\`>\`) solve arguments"
>> \\- Confucius, probably (\`>>\`)

---

# Chat commands:
\`\`\`
:vip        :name       :lookup
:getid      :whoplaced
\`\`\`

## Usage:
\`\`\`
:command arg1 arg2 arg3
\`\`\`

## Example:
\`\`\`
:name zekiah
\`\`\`
(^ Will set your username to 'zekiah')`, 0, ":HELP@RPLACE.LIVE", Date.now());
			chatMessages.insertAdjacentElement("beforeend", newMessage);
			break;
		}
	}
}

/**
 * @param {LiveChatHistoryPacket} params - The parameters for adding chat messages.
 */
function addChatMessages({ channel, messages, before }) {
	if (channel !== currentChannel) {
		return;
	}

	/** @type {HTMLElement|null} */const chatMessages = document.getElementById('chatMessages');
	if (!chatMessages) throw new Error('Chat messages container not found');

	const newChatScroll = chatMessages.scrollTop;
	/** @type {Promise<void>[]} */
	const messageRenderPromises = [];

	messages.forEach(msgData => {
		const name = intIdNames.get(msgData.senderIntId) || 'Unknown';
		/** @type {import("./game-elements.js").LiveChatMessage}*/
		const newMessage = createLiveChatMessage(
			msgData.messageId,
			msgData.txt,
			msgData.senderIntId,
			name,
			msgData.sendDate,
			msgData.repliesTo,
			msgData.reactions
		);

		const channelMessages = cMessages.get(currentChannel);
		if (before) {
			chatMessages.prepend(newMessage);
			channelMessages?.unshift(newMessage);
		}
		else {
			chatMessages.append(newMessage);
			channelMessages?.push(newMessage);
		}
		messageRenderPromises.push(
			newMessage.updateComplete.then(() => {
				chatMessages.scrollTop += newMessage.offsetHeight;
			})
		);
	});

	Promise.all(messageRenderPromises).then(() => {
		if (before) {
			chatMessages.scrollTop = chatMessages.scrollTop - chatPreviousButton.offsetHeight;
		}
		chatPreviousLoadDebounce = false;
	});
}
addIpcMessageHandler("addChatMessages", addChatMessages);

chatMessages.addEventListener("scroll", () => {
	if (chatMessages.scrollTop < 64) {
		if (chatPreviousAutoLoad === true && chatPreviousLoadDebounce === false) {
			const oldestMessage = /**@type {import("./game-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
			sendIpcMessage(wsCapsule, "requestLoadChannelPrevious", {
				channel: currentChannel,
				anchorMsgId: oldestMessage?.messageId || 0
			});
			chatPreviousLoadDebounce = true;
		}
		else {
			chatPreviousButton.dataset.hidden = "false"
		}
	}
	else {
		chatPreviousButton.dataset.hidden = "true"
	}
})
chatPreviousButton.addEventListener("click", () => {
	const oldestMessage = /**@type {import("./game-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
	sendIpcMessage(wsCapsule, "requestLoadChannelPrevious", {
		channel: currentChannel,
		anchorMsgId: oldestMessage?.messageId || 0
	});
	chatPreviousLoadDebounce = true;
	// Keep loading previous for this channel as they scroll up
	chatPreviousAutoLoad = true	;
})

messageInput.addEventListener("keydown", function(/**@type {KeyboardEvent}*/ e) {
	if (!e.isTrusted) {
		return
	}

	openChatPanel();
	if (e.key == "Enter" && !e.shiftKey) {
		// ctrl + enter send as place chat, enter send as normal live chat
		if (e.ctrlKey) {
			sendPlaceChatMsg(messageInput.value)
		}
		else {
			sendLiveChatMsg(messageInput.value)
		}
		e.preventDefault()
		messageInput.value = ""
		updateMessageInputHeight()
	}
});
messageInput.addEventListener("focus", openChatPanel);

/**
 * @param {string} text
 */
export function chatInsertText(text) {
	const [ start, end ] = [ messageInput.selectionStart, messageInput.selectionEnd ]
	messageInput.setRangeText(text, start || 0, end || 0, "end")
	messageInput.focus()
}

/**
 * @param {number} senderId
 */
export function chatMentionUser(senderId) {
	let mentionText = "@"
	const identifier = intIdNames.get(senderId) || ("#" + senderId)
	if (typeof identifier === "string") {
		mentionText += identifier
	}
	else if (typeof identifier === "number") {
		mentionText += "#" + identifier
	}
	chatInsertText(mentionText)
}

messageTypePanel.children[0].addEventListener("click", function (/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	sendPlaceChatMsg(messageInput.value);
	messageInput.value = "";
});
messageTypePanel.children[1].addEventListener("click", function(/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	sendLiveChatMsg(messageInput.value);
	messageInput.value = "";
});

// @ts-expect-error
messageInputGifPanel.addEventListener("gifselection", function(/**@type {CustomEvent}*/ e) {
	const gif = e.detail;
	if (!gif) {
		return;
	}
	messageInputGifPanel.removeAttribute("open")
	sendLiveChatMsg(`[gif:${gif.id}:tenor]`); // TODO: Put gif URL in ()
});

/**
 * 
 * @param {string} message 
 */
function sendPlaceChatMsg(message) {
	const position = Math.floor(y) * WIDTH + Math.floor(x);
	sendIpcMessage(wsCapsule, "sendPlaceChatMsg", { message, position });
}

/**
 * 
 * @param {string} message 
 * @param {string} channel 
 * @param {number|null} replyId 
 * @returns 
 */
function sendLiveChatMsg(message, channel=currentChannel, replyId=currentReply) {
	// Execute live chat commands
	for (const [command] of COMMANDS) {
		if (message.startsWith(":" + command)) {
			handleLiveChatCommand(command, message);
			return;
		}
	}

	// VIP key leak detection
	if (localStorage.vip && message.includes(localStorage.vip)) {
		alert("Can't send VIP key in chat. Use ':vip yourvipkeyhere' to apply a VIP key");
		return;
	}

	sendIpcMessage(wsCapsule, "sendLiveChatMsg", { message, channel, replyId });
	chatCancelReplies();
}

/**
 * @param {any} messageId
 * @param {number} senderId
 */
export async function chatReply(messageId, senderId) {
	for (const messageEl of cMessages.get(currentChannel) || []) {
		messageEl.removeAttribute("reply")
	}
	currentReply = messageId

	// HACK: Ensure no overlap between reply and send features
	messageTypePanel.style.height = "calc(var(--message-input-height) + 92px)"
	messageInput.focus()
	messageReplyPanel.removeAttribute("closed")
	messageReplyLabel.innerText = await translate("replyTo") + ": " + (intIdNames.get(senderId) || ("#" + senderId))
	for (const m of cMessages.get(currentChannel) || []) {
		if (m["messageId"] == messageId) {
			m.setAttribute("reply", "true")
			break
		}
	}
}

/**
 * @param {number} messageId 
 * @param {number} senderId 
 */
export function chatReport(messageId, senderId) {
	const reason = prompt("Enter the reason for why you are reporting this message (max 280 chars)\n\n" +
		`Additional info:\nMessage ID: ${messageId}\nSender ID: ${senderId}\n`)?.trim();
	if (reason === null) {
		return;
	}
	sendIpcMessage(wsCapsule, "chatReport", { messageId, reason });
	alert("Report sent!\nIn the meantime you can block this user by 'right clicking / press hold on the message' > 'block'");
}

/**
 * @param {number} messageId 
 * @param {string} reactKey 
 */
export function chatReact(messageId, reactKey) {
	sendIpcMessage(wsCapsule, "chatReact", { messageId, reactKey });
}

export function chatCancelReplies() {
	for (const messageEl of cMessages.get(currentChannel) || []) {
		messageEl.removeAttribute("reply")
	}
	currentReply = null
	// TODO: Use CSS classes / find a better solution
	// HACK: Ensure no overlap between reply and send features
	messageTypePanel.style.height = "calc(var(--message-input-height) + 62px)"
	messageReplyPanel.setAttribute('closed', 'true')
}

// Moderation UI
/**
 * @typedef {"kick" | "mute" | "ban" | "captcha" | "delete"} ModAction
 */
/**
 * @typedef {Object} ModOptions
 * @property {ModAction} action
 * @property {string} reason
 * @property {number|undefined} memberId
 * @property {number|undefined} messageId
 * @property {boolean|undefined} affectsAll
 * @property {number} duration - Seconds
 */
const modOptionsButton = /**@type {HTMLButtonElement}*/($("#modOptionsButton"));
modOptionsButton.addEventListener("click", async function(e) {
	const options = getModOptions();
	if (!options) {
		return;
	}
	const statusMsg = await makeIpcRequest(wsCapsule, "sendModAction", options);
	alert(statusMsg);
	clearChatModerate();
})
modMessageId.addEventListener("input", async function(e) {
	// Show loading state immediately
	modMessagePreview.textContent = "Loading message...";

	// Check local cache first
	let found = null;
	for (const message of (cMessages.get(currentChannel) || [])) {
		if (message.messageId == modMessageId.value) {
			found = message;
			break;
		}
	}

	if (found) {
		// Display local cached message immediately
		modMessagePreview.innerHTML = found.innerHTML;
	}
	else {
		// Try to fetch the message from the server using live chat history API
		try {
			const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
				.replace("wss://", "https://").replace("ws://", "http://");
			const url = `${httpServerUrl}/live-chat/messages/${modMessageId.value}`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error("Message not found");
			}

			const data = await response.json();
			if (data.messages && data.messages.length > 0) {
				const message = data.messages[0];
				const chatName = data.users[message.senderIntId].chatName || "Unknown";

				// Use createLiveChatMessage to build the HTML element
				const messageElement = createLiveChatMessage(message.id, message.message, message.senderIntId,
					chatName, message.date * 1000, message.repliesTo, null);

				modMessagePreview.innerHTML = "";
				modMessagePreview.appendChild(messageElement);
			}
			else {
				modMessagePreview.textContent = "Message not found";
			}
		}
		catch (error) {
			modMessagePreview.textContent = "Message not found";
		}
	}
});
/**
 * @returns {ModOptions | null}
 */
function getModOptions() {
	const reason = modReason.value.slice(0, 300);
	const memberId = +modMemberId.value;
	const messageId = +modMessageId.value;
	const affectsAll = modAffectsAll.checked;

	if (modActionKick.checked) {
		return { action: "kick", reason, memberId };
	}
	else if (modActionMute.checked || modActionBan.checked) {
		const seconds = (+modDurationS.value || 0);
		const minutes = (+modDurationM.value || 0);
		const hours = (+modDurationH.value || 0);
		const duration = seconds + minutes * 60 + hours * 3600;
		return {
			action: modActionMute.checked ? "mute" : "ban",
			reason,
			memberId,
			duration
		};
	}
	else if (modActionCaptcha.checked) {
		return {
			action: "captcha",
			reason,
			memberId,
			affectsAll
		};
	}
	else if (modActionDelete.checked) {
		return {
			action: "delete",
			reason,
			messageId
		};
	}
	return null;
}
function clearChatModerate() {
	modMessageId.value = ""
	modMessagePreview.innerHTML = ""
	modDurationH.value = "0"
	modDurationM.value = "0"
	modDurationS.value = "0"
	modAffectsAll.checked = false
	modReason.value = ""
}
function closeChatModerate() {
	moderationMenu.removeAttribute('opened')
	clearChatModerate()
}
modCloseButton.addEventListener("click", closeChatModerate);
modCancelButtonn.addEventListener("click", closeChatModerate);

/**
 * @param {"delete"|"kick"|"mute"|"ban"|"captcha"} mode
 * @param {number|null} senderId
 * @param {import("./game-elements.js").LiveChatMessage|null} messageElement
 */
export function chatModerate(mode, senderId, messageId = null, messageElement = null) {
	clearChatModerate()
	modMemberId.value = String(senderId)
	modMessageId.value = String(messageId)
	moderationMenu.setAttribute("open", "true")
	moderationMenu.setAttribute("mode", mode)
	modMessagePreview.innerHTML = messageElement?.innerHTML || ""

	switch(mode) {
		case "delete":
			modActionDelete.checked = true
			break
		case "kick":
			modActionKick.checked = true
			break
		case "mute":
			modActionMute.checked = true
			break
		case "ban":
			modActionBan.checked = true
			break
		case "captcha":
			modActionCaptcha.checked = true
			break
	}
}

// Chat messages UI
function closeMessageEmojisPanel() {
	messageEmojisPanel.setAttribute("closed", "true")
	messageInput.setAttribute("state", "default")
}

let messageInputHeight = messageInput.scrollHeight
function updateMessageInputHeight() {
	messageInput.style.height = "0px"
	const oldHeight = messageInputHeight
	messageInputHeight = Math.min(messageInput.scrollHeight, 256)
	chatPanel.style.setProperty("--message-input-height", messageInputHeight + "px")
	messageInput.style.height = "" // unset
	const diffHeight = messageInputHeight - oldHeight
	chatMessages.scrollBy(0, diffHeight)
}
if (document.readyState !== "loading") {
	updateMessageInputHeight();
}
else {
	window.addEventListener("DOMContentLoaded", updateMessageInputHeight);
}

messageInput.oninput = (/** @type {{ isTrusted: any; }} */ e) => {
	if (!e.isTrusted) return
	updateMessageInputHeight()

	messageEmojisPanel.innerHTML = ""
	let comp = ""
	let search = true
	let count = 0
	for (let i = messageInput.value.length - 1; i >= 0; i--) {
		// No emoji code will ever have a space before we reach the opening : (going backwards
		// through string) so we can guess to just stop if seen as we backtrack
		if (messageInput.value[i] == " " && search) {
			comp = ""
			break
		}
		else if (messageInput.value[i] == ":") {
			count++
			search = false
		}
		if (search) {
			comp = messageInput.value[i] + comp
		}
	}
	// All : already closed, they are probably not trying to do an emoji so we ignore
	if (count % 2 == 0) comp = ""

	if (comp) {
		messageInput.setAttribute("state", "command")
	}
	else {
		closeMessageEmojisPanel()
	}

	/**
	 * @param {any} emojiCode
	 */
	function createEmojiEntry(emojiCode) {
		const entryElement = document.createElement("button")
		entryElement.classList.add("message-emojis-suggestion")
		entryElement.title = `Send this emoji in chat with :${emojiCode}:`
		const entryLabel = document.createElement("span")
		entryLabel.textContent = `:${emojiCode}:`
		entryElement.appendChild(entryLabel)
		return entryElement
	}

	let handled = false
	for (const [emojiCode, value] of EMOJIS) {
		if (comp && emojiCode.startsWith(comp)) {
			const entryElement = createEmojiEntry(emojiCode)
			const entryValueText = document.createTextNode(value)
			entryElement.appendChild(entryValueText)
			entryElement.addEventListener("click", function() {
				for (let i = messageInput.value.length - 1; i >= 0; i--) {
					if (messageInput.value[i] == ":") {
						messageInput.value = messageInput.value.slice(0, i) + value
						closeMessageEmojisPanel()
						break
					}
				}
			})
			messageEmojisPanel.appendChild(entryElement)
			messageEmojisPanel.removeAttribute("closed")
		}

		if (messageInput.value.includes(":" + emojiCode + ":")) {
			messageInput.value = messageInput.value.replace(":" + emojiCode + ":", value)
			messageInput.setAttribute("state", "default")
			handled = true
		}
	}
	if (!handled) for (const [emojiCode, value] of CUSTOM_EMOJIS) {
		if (comp && emojiCode.startsWith(comp)) {
			const entryElement = createEmojiEntry(emojiCode)
			entryElement.appendChild(stringToHtml(value))
			entryElement.addEventListener("click", function() {
				for (let i = messageInput.value.length - 1; i >= 0; i--) {
					if (messageInput.value[i] == ":") {
						messageInput.value = messageInput.value.slice(0, i) + ":" + emojiCode + ":"
						closeMessageEmojisPanel()
						break
					}
				}
			})
			messageEmojisPanel.appendChild(entryElement)
			messageEmojisPanel.removeAttribute("closed")
		}

		if (messageInput.value.includes(":" + emojiCode + ":")) {
			messageInput.setAttribute("state", "default")
			handled = true
		}
	}
	if (!handled) for (const [commandCode, value] of COMMANDS) {
		if (comp && commandCode.startsWith(comp)) {
			const entryElement = document.createElement("button")
			entryElement.classList.add("message-emojis-suggestion")
			entryElement.title = `Use this command in chat :${commandCode} [ARGUMENTS]`
			const entryLabel = document.createElement("span")
			entryLabel.textContent = `:${commandCode}`
			entryElement.appendChild(entryLabel)
			entryElement.addEventListener("click", function() {
				messageInput.value = ":" + commandCode
				closeMessageEmojisPanel()
			})
			entryElement.appendChild(stringToHtml(value))
			messageEmojisPanel.appendChild(entryElement)
			messageEmojisPanel.removeAttribute("closed")
		}

		if (messageInput.value.includes(":" + commandCode)) {
			messageInput.setAttribute("state", "default")
			handled = true
		}
	}
}

// @ts-expect-error
messageInputEmojiPanel.addEventListener("emojiselection", (/**@type {CustomEvent}*/ e) => {
	messageInputEmojiPanel.removeAttribute("open")
	if (CUSTOM_EMOJIS.has(e.detail.key)) {
		chatInsertText(`:${e.detail.key}:`)
	}
	else {
		chatInsertText(e.detail.value)
	}
})

function defaultServer() {
	delete localStorage.board;
	delete localStorage.server;
	delete localStorage.vip;

	// Handle URL cleanup and page refresh
	const baseUrl = location.toString().split("?")[0];
	if (location.toString().includes("?")) {
		location.replace(baseUrl);
	}
	else {
		location.reload();
	}
}

/**
 * @param {string} serverAddress
 * @param {string} boardAddress
 * @param {string} vip
 * @param {Storage} storage
 */
function server(serverAddress, boardAddress, vip = "", storage = localStorage) {
	if (!serverAddress) {
		storage.vip = storage.vip2
		delete storage.vip2
		delete storage.server
		delete storage.board
		return
	}

	storage.vip2 = storage.vip2 || storage.vip
	storage.vip = vip
	storage.server = serverAddress
	storage.board = boardAddress
}

/**
 * @param {string} forceTheme
 * @param {string|null} forceVariant
 * @param {string|null} forceEffects
 */
export async function forceTheme(forceTheme, forceVariant = null , forceEffects = null) {
	const currentThemeSet = document.documentElement.dataset.theme
	const currentVariant = document.documentElement.dataset.variant
	if (currentThemeSet != forceTheme || currentVariant != forceVariant) {
		console.warn("Forcing site theme to", forceTheme, forceVariant)
		await theme(/**@type {import("./defaults.js").ThemeInfo}*/(DEFAULT_THEMES.get(forceTheme)), forceVariant, forceEffects)
	}
}

/**@type {HTMLLinkElement|null}*/let styleElement = null;
/**@type {import("./defaults.js").ThemeInfo|null}*/let currentTheme = null;

/**
 * @param {import("./defaults.js").ThemeInfo} themeSet
 * @param {string|null} variant
 * @param {string|null} effects
 */
async function theme(themeSet, variant = null, effects = null) {
	variant ??= "";

	// Effects
	// TODO: Fix dodgy module load race condition concerning forceTheme func
	/*disableDarkplace();
	disableWinter();
	switch (effects) {
		case "darkplace":
			enableDarkplace();
			break;
		case "winter":
			enableWinter();
			break;
	}*/

	if (currentTheme !== themeSet) {
		// Intermediate stylesheet handles giving a nice transition animation during theme change
		const intermediate = document.createElement("link");
		intermediate.rel = "stylesheet";
		intermediate.type = "text/css";
		intermediate.href = "/css/theme-switch.css";
		intermediate.setAttribute("intermediate-temp", "true");
		await (new Promise(resolve => {
			intermediate.onload = resolve;
			document.head.appendChild(intermediate);
		}))

		// Load in new CSS
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = themeSet.css + "?v=" + themeSet.cssVersion;
		await (new Promise(async (resolve) => {
			link.onload = resolve;
			document.head.appendChild(link);
		}));
		setTimeout(() => document.head.removeChild(intermediate), 200);
		// Swap out intermediate and old stylesheet
		if (styleElement) {
			document.head.removeChild(styleElement);
		}
		styleElement = link;
		currentTheme = themeSet;

		document.querySelectorAll("[theme]").forEach((element) => {
			const themeKey = element.getAttribute("theme")
			if (!themeKey) {
				return
			}
			if (element.tagName == "IMG") {
				const imageElement = /**@type {HTMLImageElement}*/(element);
				imageElement.src = themeSet[themeKey] || imageElement.src
			}
			else {
				element.innerHTML = themeSet[themeKey] || element.innerHTML
			}
		})
		document.documentElement.dataset.theme = themeSet.id
	}
	document.documentElement.dataset.variant = variant
}
function initTheme() {
	let startupThemeSet = DEFAULT_THEMES.get(localStorage.theme || "r/place 2022");
	if (!startupThemeSet) {
		startupThemeSet = DEFAULT_THEMES.get("r/place 2022");
	}
	if (startupThemeSet) {
		theme(startupThemeSet, localStorage.variant, localStorage.effects);
		themeDropName.textContent = "🖌️ " + (localStorage.theme || "r/place 2022");
	}
	else {
		const errorMessage = "Error: Can't find startup theme set, site may appear broken!";
		console.error(errorMessage, { availableThemes: DEFAULT_THEMES, savedTheme: localStorage.theme });
		alert(errorMessage);
	}
}
if (document.readyState !== "loading") {
	initTheme();
}
else {
	window.addEventListener("DOMContentLoaded", initTheme);
}

const themeDropList = themeDrop.firstElementChild;
themeDropList?.addEventListener("click", function(e) {
	let target = e.target;
	while (target instanceof HTMLElement && target != themeDropList) {
		if (target.nodeName != "LI") {
			target = target.parentElement;
			continue;
		}
		let targetEffects = target.getAttribute("effects");
		let targetVariant = target.getAttribute("variant");
		let targetTheme = target.getAttribute("theme");
		themeDropParent.removeAttribute("open");
		e.stopPropagation();

		if (targetTheme) {
			themeDropName.textContent = '🖌️ ' + targetTheme;
			const newTheme = DEFAULT_THEMES.get(targetTheme);
			if (newTheme) {
				theme(newTheme, targetVariant, targetEffects);
				localStorage.theme = targetTheme;
				localStorage.variant = targetVariant;
				localStorage.effects = targetEffects;
			}
		}
		break;
	}
});

/**
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}


/**
 * @param {MouseEvent} e
 */
function tlMouseMove(e) {
	if (tlSelect.getAttribute("dragging") == "true") {
		tlSelect.style.cursor = "default"
		return
	}
	tlSelect.style.left = clamp(e.clientX - tlImage.getBoundingClientRect().left, 0, WIDTH - tlSelect.offsetWidth) + "px"
	tlSelect.style.top = clamp(e.clientY - tlImage.getBoundingClientRect().top, 0, HEIGHT - tlSelect.offsetHeight) + "px"
	tlSelect.style.cursor = "all-scroll"
}

function toggleTlPanel() {
	timelapsePanel.style.display = timelapsePanel.style.display == 'none' ? 'block' : 'none'
	tlImage.src = canvas.toDataURL("image/png")
	tlSelect.style.width = WIDTH + "px"
	tlSelect.style.height = HEIGHT + "px"

	let backups = []
	fetch(localStorage.board + '/backuplist')
		.then((response) => response.text())
		.then((data) => {
			for (let b of data.split("\n")) backups.push(b)
		})
}

/**@type {number}*/let tlTimerStart = 0

function confirmTlCreate() {
	tlConfirm.value = "Timelapse loading. Hang tight! ⏳"
	tlConfirm.style.pointerEvents = "none"
	tlTimerStart = Date.now()
	let tlTimerInterval = setInterval(updateTlTimer, 100)

	fetch(`https://${localStorage.server || DEFAULT_SERVER}/timelapse/`, {
			method: "POST",
			body: JSON.stringify({
				"backupStart": tlStartSel.value,
				"backupEnd": tlEndSel.value,
				"fps": Number(tlFps.value),
				"startX": 0,
				"startY": 0,
				"endX": WIDTH,
				"endY": HEIGHT,
				"reverse": tlPlayDir.getAttribute("reverse") == "true"
			}),
			headers: { 'Content-type': 'application/json; charset=UTF-8' }
		})
		.then(resp => resp.blob())
		.then(blob => {
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.style.display = 'none'
			a.href = url
			a.download = 'place_timelapse.gif'
			document.body.appendChild(a)
			a.click()
			tlConfirm.value = "Create"
			tlConfirm.style.pointerEvents = "auto"
			clearInterval(tlTimerInterval)
			tlTimer.innerText = "0.0s"
		})
		.catch((e) => {
			console.error("Timelapse failed, " + e)
			tlConfirm.value = "Create"
			tlConfirm.style.pointerEvents = "auto"
			clearInterval(tlTimerInterval)
			tlTimer.innerText = "0.0s"
		})
}
function updateTlTimer() {
	const elapsedTime = Date.now() - tlTimerStart
	tlTimer.innerText = ((elapsedTime / 1000).toFixed(3)) + "s"
}

/**
 * @typedef {Object} OverlayInfo
 * @property {number} x - The x-coordinate of the overlay.
 * @property {number} y - The y-coordinate of the overlay.
 * @property {number} w - The width of the overlay.
 * @property {number} h - The height of the overlay.
 * @property {number} opacity - The opacity level of the overlay (0 to 1).
 * @property {string} type - The type of the overlay.
 * @property {any} data - Additional data associated with the overlay.
 */
/**@type {OverlayInfo}*/var overlayInfo = { x: 0, y: 0, w: 0, h: 0, opacity: 0.8, type: "", data: null }
overlayInput.onchange = function() {
	if (!overlayInput.files || !overlayInput.files[0]) return
	templateImage.src = URL.createObjectURL(overlayInput.files[0])
	templateImage.style.opacity = "0.8"
}
async function generateOverlayUrl() {
	if (!overlayInput.files) {
		return null;
	}

	const file = overlayInput.files[0];

	overlayInfo.type = file.type;
	overlayInfo.data = await blobToBase64(file);

	return `${location.origin}/?server=${localStorage.server || DEFAULT_SERVER}&board=${localStorage.board || DEFAULT_BOARD}&overlay=${JSON.stringify(overlayInfo)}`;
}
/**@type {Timer|null}*/let overlayFailTimeout = null;
const overlayCopyButton = /**@type {HTMLButtonElement}*/($("#overlayCopyButton"));
overlayCopyButton.addEventListener("click", async function(e) {
	const uriString = await generateOverlayUrl();
	if (!uriString) {
		return;
	}

	console.log(uriString);

	if (uriString.length < 2000) {
		navigator.clipboard.writeText(uriString)
		overlayCopyButton.children[2].animate([
			{ opacity: 1 },
			{ scale: 1.1 }
		], { duration: 1000, iterations: 1 });
	}
	else {
		overlayCopyButton.children[2].textContent = "Failed: Overlay is too big!";
		overlayCopyButton.children[2].animate([
			{ opacity: 1 },
			{ color: 'red' }
		], { duration: 1000, iterations: 1 });
		if (overlayFailTimeout) {
			clearTimeout(overlayFailTimeout);
		}
		overlayFailTimeout = setTimeout(() => {
			overlayCopyButton.children[2].textContent = "Copied to clipboard!";
		}, 1000)
	}
});
const overlayXInput = /**@type {HTMLInputElement}*/($("#overlayXInput"));
overlayXInput.addEventListener("change", function() {
	overlayInfo.x = Number(overlayXInput.value);
	templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`;
});
const overlayYInput = /**@type {HTMLInputElement}*/($("#overlayYInput"));
overlayYInput.addEventListener("change", function() {
	overlayInfo.y = Number(overlayYInput.value);
	templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`
});
const overlayOpacity = /**@type {HTMLInputElement}*/($("#overlayOpacity"));
overlayOpacity.addEventListener("change", function() {
	overlayInfo.opacity = (+this.value || 80) / 100;
	templateImage.style.opacity = String(overlayInfo.opacity);
});

let blockedUsers = localStorage.blocked?.split(",") || []
let targetedIntId = null
let targetedMsgId = null
export let currentReply = null
let openedChat = false

function openChatPanel() {
	chatPanel.setAttribute("open", "true")
	if (!openedChat) {
		openedChat = true
	}
	chatPanel.inert = false
}
chatButton.addEventListener("click", openChatPanel);

messageOptionsButton.addEventListener("click", function(e) {
	updateMessageInputHeight();
	messageTypePanel.toggleAttribute('closed')
})

// Chat panel
chatCloseButton.addEventListener("click", closeChatPanel);

function closeChatPanel() {
	messageInput.blur()
	messageInputEmojiPanel.removeAttribute("open")
	messageInputGifPanel.removeAttribute("open")
	chatPanel.removeAttribute("open")
	chatPanel.inert = true
}
closeChatPanel()

// Close button / space filler transition to posts view
const mainContentObserver = new ResizeObserver((entries) => {
	onMainContentResize();
});
mainContentObserver.observe(mainContent);

closeButton.addEventListener("click", function() {
	modal.close();
	closeChatPanel();
	document.body.id = "out";
	onMainContentResize();
})

spaceFiller.addEventListener("click", function() {
	if (document.body.id != "out") {
		return;
	}
	document.body.id = "";
	onMainContentResize();
})

/**
 * @param {MouseEvent} e
 * @param {number} senderId
 * @param {any} msgId
 */
export async function onChatContext(e, senderId, msgId) {
	e.preventDefault();

	if (chatContext.style.display == "block") {
		chatContext.style.display = "none";
	}
	else {
		let msgName = intIdNames.get(senderId);
		const identifier = msgName || ("#" + senderId);
		if (msgName) {
			if (msgName[msgName.length - 1] === "~") {
				msgName = msgName.slice(0, -1);
				userNote.style.display = "block";
				userNote.textContent = "This user is likely impersonating @" + msgName;
			}
			else if (msgName[msgName.length - 1] === "✓") {
				msgName = msgName.slice(0, -1);
				userNote.style.display = "block";
				userNote.textContent = "This user is verified as @" + msgName;
			}
			else {
				userNote.style.display = "none";
			}
		}

		targetedMsgId = msgId;
		targetedIntId = senderId;
		chatContext.style.display = "block";
		mentionUser.children[0].textContent = `${await translate("mention")} ${identifier}`;
		replyUser.children[0].textContent = `${await translate("replyTo")} ${identifier}`;
		blockUser.children[0].textContent =
			`${await translate(blockedUsers.includes(senderId) ? "unblock" : "block")} ${identifier}`;

		// TODO: Do this in CSS instead
		const blockUserText = /**@type {HTMLElement}*/(blockUser.children[0]);
		if (senderId == intId) {
			blockUser.style.pointerEvents = "none";
			blockUserText.style.color = "grey";
			changeMyName.style.display = "";
		}
		else  {
			blockUser.style.pointerEvents = "all";
			blockUserText.style.color = "black";
			changeMyName.style.display = "none";
		}

		chatContext.style.left = e.pageX - chatPanel.offsetLeft + "px"
		chatContext.style.top = e.pageY - chatPanel.offsetTop + "px"
	}
}

const verifiedAppHash = "f255e4c294a5413cce887407b91062ac162faec4cb1e6e21cdd6e4492fb270f8"
async function checkVerifiedAppStatus() {
	const urlParams = new URLSearchParams(window.location.search);
	const verifyAppValue = urlParams.get("verify-app")
	if (!verifyAppValue) {
		return "none"
	}
	const hashedValue = await sha256(verifyAppValue)
	return hashedValue === verifiedAppHash ?  "valid" : "invalid"
}
/**
 * @param {string} str
 */
function sha256(str) {
	const encoder = new TextEncoder()
	const data = encoder.encode(str)
	return crypto.subtle.digest("SHA-256", data).then(hashBuffer => {
		const hashArray = Array.from(new Uint8Array(hashBuffer))
		return hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("")
	})
}
checkVerifiedAppStatus().then(status => {
	if (status === "valid") {
		console.log("Successfully verified rplace.live app");
	}
	else if (import.meta.env.MODE !== "development" && (
		window.location !== window.parent.location
			|| typeof window.Android !== "undefined"
			|| typeof window.Kodular !== "undefined"
			|| status === "invalid")) {
		window.location.replace("fakeapp.html")

		// Block interaction if page redirect was overidden
		document.body.style.opacity = "0.6"
		document.body.style.pointerEvents = "none"
		alert("Error: App failed verification - game is being accessed via an unofficial or unauthorised site or app\n" +
			"Please report to developers or visit the game online at https://rplace.live")
	}
})

// Cancel context menu
window.addEventListener("contextmenu", function(e) {
	e.preventDefault()
})

// Cancel touchpad page zooming that interferes with canvas zooming
if (!mobile) {
	/**
	 * @param {{ preventDefault: () => void; }} e
	 */
	function cancelZoomGesture(e) {
		e.preventDefault()
	}
	window.addEventListener("wheel", function(e) {
		const targetElement = /**@type {HTMLElement}*/(e.target);
		if (e.target == mainContent || canvParent2.contains(targetElement)) {
			e.preventDefault()
		}
	}, { passive: false })
	window.addEventListener("gesturestart", cancelZoomGesture)
	window.addEventListener("gesturechange", cancelZoomGesture)
	window.addEventListener("gestureend", cancelZoomGesture)
}

// Server connection timeout message
setTimeout(() => {
	if (connProblems) {
		connProblems.style.opacity = "1";
	}
}, 5000)

// Ads
if (localStorage.noad && Date.now() - localStorage.noad < 1.21e9) { // 14 days
	chatAd.style.display = "none"
}
else {
	let adI = Math.floor(Math.random() * ADS.length)
	function cycleAd() {
		const currentAd = ADS[adI % ADS.length];
		const langBanners = /**@type {Record<string, string>}*/(currentAd.banners);
		chatAd.style.setProperty("--adurl", `url(${langBanners[lang] || langBanners["en"]})`);
		chatAd.href = currentAd.url;
		adI++;
	}
	setInterval(cycleAd, 12e4); // 2 mins
	cycleAd();
}

// Final initialisation
translateAll();
showLoadingScreen();

// Hook up cross frame / parent window IPC request handlers
addIpcMessageHandler("fetchLinkKey", () => makeIpcRequest(wsCapsule, "fetchLinkKey"));
addIpcMessageHandler("openChatPanel", openChatPanel);
addIpcMessageHandler("scrollToPosts", scrollToPosts);
addIpcMessageHandler("defaultServer", defaultServer);
addIpcMessageHandler("openOverlayMenu", openOverlayMenuOld);
addIpcMessageHandler("resizePostsFrame", resizePostsFrame);
window.addEventListener("message", handleIpcMessage);

// Tell wsCapsule to start initialising websocket connection
const fingerprintJS = await FingerprintJS.load();
const result = await fingerprintJS.get();
sendIpcMessage(wsCapsule, "connect", {
	fingerprint: result.visitorId,
	server: localStorage.server || DEFAULT_SERVER,
	vip: localStorage.vip
});

// Blank default render and canvas size init before we have loaded board
setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
renderAll();
