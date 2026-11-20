// Helpers the three lab pages share: the look of the game, a toast, copying text, and waking the sound.

import { store } from '../app/storage.js';
import { themeFor } from '../looks/themes.js';
import { writeVariables } from '../looks/theme-variables.js';
import { audio } from '../audio/sound-player.js';

export { $ } from '../app/dom.js';

const TOAST_MS = 3200;
let toastTimer = 0;

/** The theme the player uses in the game, written on the lab page. Returns the theme. */
export function wearGameTheme() {
	const theme = themeFor(store.looks);
	writeVariables(theme);
	return theme;
}

/** A short message at the bottom of the page. */
export function toast(text) {
	const element = document.getElementById('toast');
	element.textContent = text;
	element.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (element.hidden = true), TOAST_MS);
}

/** Copies text to the clipboard. Returns false when the browser does not allow it. */
export async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/** Phones block audio until the first tap, so every tap and key tries to wake it. */
export function unlockAudioOnTouch() {
	for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

/** Sets the pressed state of a toggle button. */
export function setPressed(button, on) {
	button.setAttribute('aria-pressed', String(on));
}
