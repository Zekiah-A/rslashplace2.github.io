import { $ } from "../../shared.js";
import { EditList } from "../../shared-elements.js";
import { setSelectColourSample, getDefaultSample } from "./game-audio.js";

export let useLegacyCanvas2D = localStorage.useLegacyCanvas2D === "true";
export let enableNewOverlayMenu = localStorage.enableNewOverlayMenu === "true";
export let enableMelodicPalette = localStorage.enableMelodicPalette === "true";

const secretSettingsDialog = /**@type {HTMLDialogElement}*/($("#secretSettingsDialog"));
const closeButton = /**@type {HTMLButtonElement}*/($("#secretSettingsCloseButton"));
closeButton.addEventListener("click", function() {
	secretSettingsDialog.close();
})

// Experimental settings
const useLegacyCanvas2DCheckbox = /**@type {HTMLInputElement}*/($("#useLegacyCanvas2DCheckbox"));
useLegacyCanvas2DCheckbox.checked = useLegacyCanvas2D;
useLegacyCanvas2DCheckbox.addEventListener("change", function() {
	useLegacyCanvas2D = !useLegacyCanvas2D;
	localStorage.useLegacyCanvas2D = String(useLegacyCanvas2D);
});

const enableNewOverlayMenuCheckbox = /**@type {HTMLInputElement}*/($("#enableNewOverlayMenuCheckbox"));
enableNewOverlayMenuCheckbox.checked = enableNewOverlayMenu;
enableNewOverlayMenuCheckbox.addEventListener("change", function() {
	enableNewOverlayMenu = !enableNewOverlayMenu;
	localStorage.enableNewOverlayMenu = String(enableNewOverlayMenu);
});

// Secret settings
const enableMelodicPaletteCheckbox = /**@type {HTMLInputElement}*/($("#enableMelodicPaletteCheckbox"));
enableMelodicPaletteCheckbox.checked = enableMelodicPalette;
enableMelodicPaletteCheckbox.addEventListener("change", async function() {
	enableMelodicPalette = !enableMelodicPalette;
	localStorage.enableMelodicPalette = String(enableMelodicPalette);
});

const paletteSoundSelect = /**@type {HTMLSelectElement}*/($("#paletteSoundSelect"));
/** @param {string} value */
async function handlePaletteSoundChange(value) {
	const sample = await getDefaultSample(value);
	if (sample) {
		setSelectColourSample(sample);
		localStorage.paletteSelectSound = value;
	}
}
async function initPaletteSoundSelect() {
	const selectSound = localStorage.paletteSelectSound;
	if (selectSound) {
		paletteSoundSelect.value = selectSound;
		handlePaletteSoundChange(selectSound);
	}
}
initPaletteSoundSelect();
paletteSoundSelect.addEventListener("change", function() {
	handlePaletteSoundChange(paletteSoundSelect.value);
});

// Local storage editor
const editLocalStorageList = /**@type {EditList}*/($("#editLocalStorageList"));
editLocalStorageList.data = window.localStorage;
editLocalStorageList.addEventListener("itemchange", (/**@type {any}*/e) => {
	const { key, value } = e.detail;
	localStorage.setItem(key, value);
});
editLocalStorageList.addEventListener("itemremove", (/**@type {any}*/e) => {
	const { key } = e.detail;
	localStorage.removeItem(key);
});
editLocalStorageList.addEventListener("itemadd", (/**@type {any}*/e) => {
	const { key, value } = e.detail;
	localStorage.setItem(key, value);
});
