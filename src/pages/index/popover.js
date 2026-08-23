"use strict";

/**
 * @typedef {HTMLElement & {
 *   showPopover: () => void;
 *   hidePopover: () => void;
 * }} NativePopover
 */

/**
 * @param {HTMLElement} popover
 * @returns {boolean}
 */
export function isPopoverOpen(popover) {
	return popover.matches(":popover-open");
}

/**
 * @param {HTMLElement} popover
 * @returns {boolean}
 */
export function showPopover(popover) {
	const nativePopover = /** @type {NativePopover} */(popover);
	for (const openPopover of document.querySelectorAll(":popover-open")) {
		if (openPopover !== popover) hidePopover(/** @type {HTMLElement} */(openPopover));
	}
	if (!isPopoverOpen(popover)) {
		nativePopover.showPopover();
	}
	return true;
}

/**
 * @param {HTMLElement} popover
 * @returns {boolean}
 */
export function hidePopover(popover) {
	const nativePopover = /** @type {NativePopover} */(popover);
	if (isPopoverOpen(popover)) {
		nativePopover.hidePopover();
	}
	return true;
}

/**
 * @param {HTMLElement} popover
 * @returns {boolean}
 */
export function togglePopover(popover) {
	return isPopoverOpen(popover) ? hidePopover(popover) : showPopover(popover);
}

/**
 * Position a manually positioned popover in viewport coordinates.
 * @param {HTMLElement} popover
 * @param {number} clientX
 * @param {number} clientY
 */
export function positionPopover(popover, clientX, clientY) {
	popover.style.left = `${clientX}px`;
	popover.style.top = `${clientY}px`;
}

/**
 * Add the context-menu dismissal behavior that native manual popovers do not
 * provide automatically.
 * @param {HTMLElement} popover
 */
export function enablePopoverDismissal(popover) {
	document.addEventListener("pointerdown", event => {
		if (isPopoverOpen(popover) && event.target instanceof Node && !popover.contains(event.target)) {
			hidePopover(popover);
		}
	});
	document.addEventListener("keydown", event => {
		if (event.key === "Escape") hidePopover(popover);
	});
}
