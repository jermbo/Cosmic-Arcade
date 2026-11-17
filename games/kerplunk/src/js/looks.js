// The look of the game: the active theme and block style. It writes the design variables on the page,
// paints the block colors, and has the view rebuild its sprites.

import { rollTheme, isTheme, themeFor } from './themes.js';
import { writeVariables } from './theme-vars.js';
import { paintPalette, BLOCK_STYLES } from './sprites.js';
import { store } from './storage.js';
import { view, save } from './session.js';

const listeners = [];

/** A screen that draws blocks or theme colors asks to be redrawn when the look changes. */
export function onLooksChange(redraw) {
	listeners.push(redraw);
}

/** The theme in use. With Random, the last roll. */
export function activeTheme() {
	return themeFor(store.looks);
}

/** The block style in use. */
export function activeStyle() {
	return BLOCK_STYLES.includes(store.looks.style) ? store.looks.style : 'patterns';
}

/** Shows the active theme and block style on every screen, at once. */
export function applyLooks() {
	const theme = activeTheme();
	writeVariables(theme);
	loadFonts(theme.display);
	paintPalette(theme.blocks);
	view.setLooks(theme, activeStyle());
	for (const redraw of listeners) redraw();
}

/** With Random in use, a new game rolls a new look. It stays until the next game. The shop can roll one too. */
export function rollForGame() {
	if (store.looks.theme !== 'random') return;
	store.looks.roll = rollTheme(Math.random, isTheme(store.looks.roll) ? store.looks.roll : null);
	save();
	applyLooks();
}

/** At start-up: Random with no roll yet rolls one. */
export function initLooks() {
	if (store.looks.theme === 'random' && !isTheme(store.looks.roll)) {
		store.looks.roll = rollTheme();
		save();
	}
	applyLooks();
}

/** The canvas draws text in the theme fonts, which the page loads only once some text uses them. */
function loadFonts(display) {
	if (!document.fonts) return;
	for (const font of [`20px '${display}'`, "500 20px 'DM Mono'", "700 20px 'Space Grotesk'"]) document.fonts.load(font).catch(() => {});
}
