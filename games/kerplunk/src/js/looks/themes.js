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
//   displayFont      the font of the big numbers
//   outlineWidth, shadowOffset, cornerRadius   in pixels
//   tilt             the tilt of the score card, in degrees
//   dark             true for a dark theme

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

const LIGHT_BLOCKS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C084FC'];

export const LIGHT = withTextColors({
	id: 'light',
	bg: '#FFF8E7',
	dot: '#00000014',
	text: INK,
	ink: INK,
	shadow: INK,
	card: WHITE,
	accent: '#FFD93D',
	accent2: '#A0E7E5',
	well: WHITE,
	empty: '#F3EEE2',
	blockInk: INK,
	blocks: LIGHT_BLOCKS,
	displayFont: 'Archivo Black',
	outlineWidth: 3,
	shadowOffset: 4,
	cornerRadius: 6,
	tilt: -1.5,
	dark: false,
});

export const DARK = withTextColors({
	...LIGHT,
	id: 'dark',
	bg: '#121212',
	dot: '#FFFFFF0F',
	text: '#F4F1EA',
	ink: '#F4F1EA',
	shadow: '#F4F1EA',
	card: '#1E1E1E',
	accent: '#FFD93D',
	accent2: '#C084FC',
	well: '#1A1A1A',
	empty: '#262626',
	blockInk: '#0A0A0A',
	dark: true,
});

// The lists a Random roll picks from.
export const RANDOM_BACKGROUNDS = ['#FFDE59', '#A0E7E5', '#FFAEBC', '#B4F8C8', '#C3B1E1', '#FBE7C6', '#90E0EF', '#FFC6A8', '#E4F4A5'];
export const RANDOM_CARDS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C084FC', '#FF9F1C', '#2EC4B6', '#F72585', '#FFFFFF', '#111111'];
export const RANDOM_WELLS = ['#FFFFFF', '#FFFDF5', '#111111'];
export const RANDOM_BLOCK_SETS = [
	LIGHT_BLOCKS,
	['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#9D4EDD'],
	['#FF5C5C', '#FFB000', '#3DDC97', '#4CC9F0', '#F15BB5'],
	['#FF7A59', '#F8E16C', '#00C2A8', '#5B8DEF', '#B388EB'],
];
export const RANDOM_DISPLAY_FONTS = ['Archivo Black', 'Bricolage Grotesque'];
export const RANDOM_OUTLINES = [3, 4];
export const RANDOM_SHADOWS = [4, 5, 6];
export const RANDOM_CORNERS = [0, 6, 12];
export const RANDOM_TILT = 2.5; // the score tilt is from -RANDOM_TILT to RANDOM_TILT degrees
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
		displayFont: pick(RANDOM_DISPLAY_FONTS),
		outlineWidth: pick(RANDOM_OUTLINES),
		shadowOffset: pick(RANDOM_SHADOWS),
		cornerRadius: pick(RANDOM_CORNERS),
		tilt: Math.round((rng() * 2 - 1) * RANDOM_TILT * 10) / 10,
		dark: false,
	});
}

/** A saved roll is used only when it has every value a theme needs. */
export function isTheme(value) {
	if (!value || typeof value !== 'object') return false;
	if (!Array.isArray(value.blocks) || value.blocks.length !== BLOCK_NAMES.length) return false;
	return Object.keys(LIGHT).every((key) => key in value);
}

/** The theme in use for the saved looks. With Random, the last roll (Light until there is one). */
export function themeFor(looks) {
	if (looks.theme === 'random') return isTheme(looks.roll) ? looks.roll : LIGHT;
	return looks.theme === 'dark' ? DARK : LIGHT;
}
