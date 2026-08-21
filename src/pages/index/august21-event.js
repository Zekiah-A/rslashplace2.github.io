import { startCountDown, toCountdownString } from "./event-timer.js"
import { DEFAULT_THEMES } from "../../defaults.js";
import { theme } from "./game-themes.js";

const DISABLED_DATE_KEY = "august21DisabledDate";

/**
 * @param {Date} date
 */
function toLocalDateKey(date) {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Show game popup
export function isTodayAugust21st(now = new Date()) {
	// August is month 7 (zero-based)
	return now.getMonth() === 7 && now.getDate() === 21
}

export function shouldEnableAugust21() {
	const now = new Date();
	return isTodayAugust21st(now) && localStorage.getItem(DISABLED_DATE_KEY) !== toLocalDateKey(now);
}

export function disableAugust21ForToday() {
	localStorage.setItem(DISABLED_DATE_KEY, toLocalDateKey(new Date()));
	if (localStorage.effects === "august21") {
		localStorage.removeItem("effects");
	}
}

function startAugust21Effect() {
	if (!shouldEnableAugust21()) return;
	const themeSet = DEFAULT_THEMES.get("r/place 2022");
	if (!themeSet) return;
	theme(themeSet, "dark", "august21").catch((error) => {
		console.error("Failed to start the August 21 effect", error);
	});
	const themeName = document.getElementById("themeDropName");
	if (themeName) themeName.textContent = "☢️ AUGUST 21";
}

if (document.readyState === "complete") {
	startAugust21Effect();
}
else {
	window.addEventListener("load", startAugust21Effect, { once: true });
}

function getNextAugust21st() {
	const now = new Date()
	const year = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() > 21) 
		? now.getFullYear() + 1 
		: now.getFullYear()

	// Get unix timestamp of August 21st of the current year
	const august21st = new Date(year, 7, 21)
	return august21st.getTime()
}

export function enableAugust21() {
	const eventDate = isTodayAugust21st() ? Date.now() : getNextAugust21st()
	
	const popup = /**@type {HTMLDialogElement}*/(document.getElementById("popup"));
	const august21PopupTimer = /**@type {HTMLElement}*/(document.getElementById("august21PopupTimer"));
	const august21PopupLabel = /**@type {HTMLElement}*/(document.getElementById("august21PopupLabel"));
	const august21PopupButton = /**@type {HTMLElement}*/(document.getElementById("august21PopupButton"));

	popup.showModal();

	setInterval(() => {
		august21PopupTimer.textContent = ` (${toCountdownString(eventDate)})`
	}, 1000)

	startCountDown(eventDate, false).then((async) => {
		august21PopupTimer.style.display = "none"

		// TODO: Reimplement on game release
		august21PopupLabel.style.display = "none"
		august21PopupButton.style.display = "flex"
	})	
}
