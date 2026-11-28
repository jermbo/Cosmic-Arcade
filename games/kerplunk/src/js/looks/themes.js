// The themes: each one is a set of design values. A new theme only changes values.
// No DOM here, so the rules also run in Node (see tools/theme-test.js).
// theme-variables.js puts the values on the page as CSS variables, and the canvas reads the same values.
//
// A theme has:
//   bg, dot          the page paper and the color of its dot pattern
//   text, ink        the text color, and the outline color of cards and blocks
//   shadow           the color of the hard shadows
//   card             the plain card color
//   accent, accent2  the score card and the Plunks card (onAccent, onAccent2: the text on them)
//   well, empty      the well and its empty cells
//   blockInk         the outline and pattern color of the blocks
//   blocks           the five block colors: Ember, Amber, Moss, Tide, Dusk
//   displayFont      the font of the big numbers; uiFont: everything else
//   outlineWidth, shadowOffset, cornerRadius   in pixels
//   shadowSideways   true: hard diagonal shadows (Bold); false: soft shadows straight down (Soft)
//   tilt             the tilt of the score card, in degrees
//   dark             true for a dark theme

import { DEFAULT_STYLE, ON_COLOR, PALETTES, styleById, themeById } from '../../kit/themes.js';

export const BLOCK_NAMES = ['Ember', 'Amber', 'Moss', 'Tide', 'Dusk'];
export const INK = '#111111';
export const WHITE = '#FFFFFF';

/** The relative luminance of a #rrggbb color (the WCAG formula). */
function luminance(hex) {
	const [red, green, blue] = [1, 3, 5].map((start) => {
		const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The contrast ratio of two #rrggbb colors, from 1 to 21. */
export function contrast(a, b) {
	const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (lighter + 0.05) / (darker + 0.05);
}

/** Black ink or white, whichever has more contrast on this color. */
export function textOn(hex) {
	return contrast(hex, INK) >= contrast(hex, WHITE) ? INK : WHITE;
}

/** Fills in the text colors that follow from the card colors. */
function withTextColors(theme) {
	return { ...theme, onAccent: textOn(theme.accent), onAccent2: textOn(theme.accent2) };
}

// The themes are the cozy kit's (src/kit/themes.js, copied from games/cozy-kit), shared with
// the arcade's other cozy games. The style (Soft or Bold, a free setting) gives the shape:
// fonts, outlines, corners and shadows. kitTheme() turns the two into a Kerplunk theme.

/** The five blocks are the kit's color-blind-safe five: red, yellow, green, blue, purple. */
const BLOCK_ORDER = [0, 2, 3, 1, 4];

/** The shape values of a kit style. */
function shapeOf(style) {
	return {
		displayFont: style.displayFont,
		uiFont: style.uiFont,
		outlineWidth: style.outline,
		shadowOffset: style.hard ? 4 : 3,
		shadowSideways: style.hard,
		cornerRadius: style.hard ? 6 : 12,
		tilt: style.hard ? -1.5 : 0,
	};
}

/** A Kerplunk theme from a kit theme id and a kit style id ('soft' or 'bold'). */
export function kitTheme(themeId, styleId = DEFAULT_STYLE) {
	const t = themeById(themeId);
	const style = styleById(styleId);
	const palette = PALETTES[t.tone];
	return withTextColors({
		id: t.id,
		bg: t.bg,
		dot: style.hard ? t.dot : 'transparent',
		text: t.ink,
		ink: t.stroke,
		shadow: style.hard ? t.stroke : t.edge,
		card: t.surface,
		accent: palette[2],
		accent2: palette[6],
		well: t.surface,
		empty: t.board,
		blockInk: ON_COLOR[t.tone],
		blocks: BLOCK_ORDER.map((i) => palette[i]),
		...shapeOf(style),
		dark: t.tone === 'dark',
	});
}

export const LIGHT = kitTheme('oat', 'bold');
export const DARK = kitTheme('plum', 'bold');

// The lists a Random roll picks from.
export const RANDOM_BACKGROUNDS = ['#FFDE59', '#A0E7E5', '#FFAEBC', '#B4F8C8', '#C3B1E1', '#FBE7C6', '#90E0EF', '#FFC6A8', '#E4F4A5'];
export const RANDOM_CARDS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C084FC', '#FF9F1C', '#2EC4B6', '#F72585', '#FFFFFF', '#111111'];
export const RANDOM_WELLS = ['#FFFFFF', '#FFFDF5', '#111111'];
export const RANDOM_BLOCK_SETS = [
	['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C084FC'],
	['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#9D4EDD'],
	['#FF5C5C', '#FFB000', '#3DDC97', '#4CC9F0', '#F15BB5'],
	['#FF7A59', '#F8E16C', '#00C2A8', '#5B8DEF', '#B388EB'],
];
const DARK_WELL = '#111111';

/**
 * Rolls a Random look. rng gives a number from 0 up to (not including) 1.
 * With a previous roll, the new one has another background, so each roll looks new.
 */
export function rollTheme(rng = Math.random, previous = null) {
	const pick = (list) => list[Math.floor(rng() * list.length)];
	const bg = pick(RANDOM_BACKGROUNDS.filter((color) => !previous || color !== previous.bg));
	const cards = RANDOM_CARDS.filter((color) => color.toUpperCase() !== bg.toUpperCase());
	const accent = pick(cards);
	const accent2 = pick(cards.filter((color) => color !== accent));
	const well = pick(RANDOM_WELLS);
	return withTextColors({
		id: 'random',
		bg,
		dot: '#00000014',
		text: INK,
		ink: INK,
		shadow: INK,
		card: WHITE,
		accent,
		accent2,
		well,
		empty: well === DARK_WELL ? '#262626' : '#F1ECE0',
		blockInk: INK,
		blocks: pick(RANDOM_BLOCK_SETS).slice(),
		...shapeOf(styleById('bold')),
		dark: false,
	});
}

/** A saved roll is used only when it has every value a theme needs. */
export function isTheme(value) {
	if (!value || typeof value !== 'object') return false;
	if (!Array.isArray(value.blocks) || value.blocks.length !== BLOCK_NAMES.length) return false;
	return Object.keys(LIGHT).every((key) => key in value);
}

/** The theme in use for the saved looks and the style. With Random, the last roll of colors, in the style's shape. */
export function themeFor(looks, styleId = DEFAULT_STYLE) {
	if (looks.theme === 'random') {
		const roll = isTheme(looks.roll) ? looks.roll : kitTheme('oat', styleId);
		const style = styleById(styleId);
		return { ...roll, ...shapeOf(style), dot: style.hard ? roll.dot : 'transparent', shadow: style.hard ? roll.ink : 'rgba(0, 0, 0, 0.16)' };
	}
	return kitTheme(looks.theme, styleId);
}
