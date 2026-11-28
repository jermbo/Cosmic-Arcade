// The look of the game: the active theme and block style. It writes the design variables on the page,
// paints the block colors, and has the view rebuild its block images.

import { rollTheme, isTheme, themeFor } from './themes.js';
import { writeVariables } from './theme-variables.js';
import { paintPalette, BLOCK_STYLES } from '../view/sprites/block-sprites.js';
import { store } from '../app/storage.js';
import { view, save } from '../play/session.js';
import { applyFeel } from '../feel/player-feel.js';

const redrawOnChange = [];

/** A screen that draws blocks or theme colors asks to be redrawn when the look changes. */
export function onLooksChange(redraw) {
	redrawOnChange.push(redraw);
}

/** The cozy kit style in use: 'bold' or 'soft' (a free setting). */
export function activeKitStyle() {
	return store.settings.bold ? 'bold' : 'soft';
}

/** The theme in use, in the style in use. With Random, the last roll. */
export function activeTheme() {
	return themeFor(store.looks, activeKitStyle());
}

/** The block style in use. */
export function activeStyle() {
	return BLOCK_STYLES.includes(store.looks.style) ? store.looks.style : 'patterns';
}

/** Shows the active theme and block style on every screen, at once. */
export function applyLooks() {
	const theme = activeTheme();
	writeVariables(theme);
	loadFonts(theme.displayFont, theme.uiFont);
	paintPalette(theme.blocks);
	view.setLooks(theme, activeStyle());
	// The feel goes with the look: the sound profile and the animation style in use.
	applyFeel(store.looks.sound, store.looks.motion);
	for (const redraw of redrawOnChange) redraw();
}

/** With Random in use, a new game rolls a new look. It stays until the next game. The shop can roll one too. */
export function rollForGame() {
	if (store.looks.theme !== 'random') return;
	const previous = isTheme(store.looks.roll) ? store.looks.roll : null;
	store.looks.roll = rollTheme(Math.random, previous);
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
function loadFonts(displayFont, uiFont) {
	if (!document.fonts) return;
	for (const font of [`20px '${displayFont}'`, "500 20px 'DM Mono'", `700 20px '${uiFont}'`]) document.fonts.load(font).catch(() => {});
}
