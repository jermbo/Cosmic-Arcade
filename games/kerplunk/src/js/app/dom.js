// Small helpers for the page: find an element, show one modal, flash a banner.

/** The element with this id. ($ is a short name many web projects use for this.) */
export const $ = (id) => document.getElementById(id);

/** Shows the modal screen with this id, and hides the others. */
export function showModal(id) {
	for (const element of document.querySelectorAll('.screen--modal')) element.hidden = element.id !== id;
}

export function hideModals() {
	showModal(null);
}

/** Plays a CSS animation again, even if it is still running: takes the class off, then puts it back. */
export function replayAnimation(element, className) {
	element.classList.remove(className);
	void element.offsetWidth; // makes the browser notice the class was removed
	element.classList.add(className);
}

/** Makes an element pop once (the is-bump animation in the CSS). */
export function bump(element) {
	replayAnimation(element, 'is-bump');
}

let bannerTimer = 0;

/** Shows a big banner in the middle of the screen. It hides after `ms`, or stays when ms is 0. */
export function showBanner(text, ms) {
	const banner = $('banner');
	banner.textContent = text;
	banner.hidden = false;
	banner.style.animation = 'none';
	void banner.offsetWidth; // restarts the animation
	banner.style.animation = '';
	clearTimeout(bannerTimer);
	if (ms) bannerTimer = setTimeout(() => (banner.hidden = true), ms);
}

/**
 * Sets a text where each ✦ is a bold, bigger mark. In small label type a plain ✦ is so thin
 * that it reads like a "+".
 */
export function setPlunkText(element, text) {
	element.textContent = '';
	text.split('✦').forEach((part, i) => {
		if (i > 0) element.append(plunkMark());
		if (part) element.append(part);
	});
}

function plunkMark() {
	const mark = document.createElement('b');
	mark.className = 'plunk-mark';
	mark.textContent = '✦';
	return mark;
}

/** Keeps the pointer events on an element while a finger or the mouse is down. */
export function capturePointer(element, pointerId) {
	try {
		element.setPointerCapture(pointerId);
	} catch {
		// Capture can fail if the pointer is already gone.
	}
}

/** Makes a new element with a class and a text. */
export function makeElement(tag, className, text) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

/** True when the player asked the system for less motion. */
export function prefersStillness() {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
