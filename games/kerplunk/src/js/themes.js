// The themes: each one is a set of design variables. A new theme only changes values.
// No DOM here, so the rules also run in Node (see tools/theme-test.js).
// looks.js puts the variables on the page, and the canvas reads the same values.

export const BLOCK_NAMES = ['Ember', 'Amber', 'Moss', 'Tide', 'Dusk'];
export const INK = '#111111';
export const WHITE = '#FFFFFF';

/** The relative luminance of a #rrggbb color (WCAG). */
function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two #rrggbb colors, from 1 to 21. */
export function contrast(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** Black ink or white, whichever has more contrast on this color. */
export function textOn(hex) {
	return contrast(hex, INK) >= contrast(hex, WHITE) ? INK : WHITE;
}

/** Fills in the text colors that follow from the card colors. */
function finish(theme) {
	return { ...theme, onAccent: textOn(theme.accent), onAccent2: textOn(theme.accent2) };
}

const LIGHT_BLOCKS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C084FC'];

export const LIGHT = finish({
	id: 'light',
	bg: '#FFF8E7',
	dot: '#00000014',
	text: INK,
	ink: INK, // outlines
	shadow: INK,
	card: WHITE,
	accent: '#FFD93D', // the score card
	accent2: '#A0E7E5', // the Plunks card
	well: WHITE,
	empty: '#F3EEE2',
	blockInk: INK,
	blocks: LIGHT_BLOCKS,
	display: 'Archivo Black',
	bw: 3,
	sh: 4,
	r: 6,
	tilt: -1.5,
	dark: false,
});

export const DARK = finish({
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
export const RANDOM_DISPLAYS = ['Archivo Black', 'Bricolage Grotesque'];
export const RANDOM_OUTLINES = [3, 4];
export const RANDOM_SHADOWS = [4, 5, 6];
export const RANDOM_CORNERS = [0, 6, 12];
export const RANDOM_TILT = 2.5; // the score tilt is from -RANDOM_TILT to RANDOM_TILT degrees

/** Rolls a Random look. rng gives a number from 0 up to (not including) 1. */
export function rollTheme(rng = Math.random) {
	const pick = (list) => list[Math.floor(rng() * list.length)];
	const bg = pick(RANDOM_BACKGROUNDS);
	const cards = RANDOM_CARDS.filter((c) => c.toUpperCase() !== bg.toUpperCase());
	const accent = pick(cards);
	const accent2 = pick(cards.filter((c) => c !== accent));
	const well = pick(RANDOM_WELLS);
	const darkWell = well === '#111111';
	return finish({
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
		empty: darkWell ? '#262626' : '#F1ECE0',
		blockInk: INK,
		blocks: pick(RANDOM_BLOCK_SETS).slice(),
		display: pick(RANDOM_DISPLAYS),
		bw: pick(RANDOM_OUTLINES),
		sh: pick(RANDOM_SHADOWS),
		r: pick(RANDOM_CORNERS),
		tilt: Math.round((rng() * 2 - 1) * RANDOM_TILT * 10) / 10,
		dark: false,
	});
}

/** A saved roll is used only when it has every value a theme needs. */
export function isTheme(value) {
	return Boolean(value) && typeof value === 'object' && Array.isArray(value.blocks) && value.blocks.length === 5 && Object.keys(LIGHT).every((k) => k in value);
}

/** The theme in use for the saved looks. With Random, the last roll (Light until there is one). */
export function themeFor(looks) {
	if (looks.theme === 'random') return isTheme(looks.roll) ? looks.roll : LIGHT;
	return looks.theme === 'dark' ? DARK : LIGHT;
}
