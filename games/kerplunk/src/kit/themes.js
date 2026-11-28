// The cozy kit: the shared looks of the arcade's cozy puzzle games.
//
// Two parts, and any theme works with any style:
//   THEMES  the colors (4 light, 3 dark). Plain data, so canvas games can read it too.
//   STYLES  the shape: Soft (soft clay) or Bold (neo-brutalist). Fonts, outlines, corners, shadows.
//
// scripts/make-css.js turns this file into kit.css. Run `npm run css -w @arcade/cozy-kit` after a change.
// No DOM here, so the color checks run in Node.

/**
 * Line and tile colors, one set per tone. Ordered so a game with few colors
 * gets the clearest ones: the first five stay apart for color-blind players
 * (see scripts/check-colors.js). Dark ink (`onColor`) reads on every one.
 */
export const PALETTES = {
	light: ['#fd4f48', '#92abe8', '#fbbc37', '#4ed089', '#a56bfe', '#f6914a', '#3fc1b8', '#f28fbc', '#b8875f', '#9aa1ad'],
	dark: ['#ed5857', '#336aef', '#ffad21', '#aeffd9', '#cfb2ff', '#ff8f57', '#4fd4cd', '#ff9ccb', '#cf9c70', '#b0b7c3'],
};

/** Names of the palette colors, for screen readers and hints. */
export const COLOR_NAMES = ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange', 'Teal', 'Pink', 'Brown', 'Stone'];

/** Dark text on a palette color. */
export const ON_COLOR = { light: '#2b2430', dark: '#1f1823' };

/**
 * A theme. Every value is a color.
 *   bg, glow        the page, and the soft glow at its top (Soft style)
 *   dot             the dot grid on the page (Bold style)
 *   surface         cards, buttons, sheets
 *   surface2        a quieter card: chips, tabs, stat boxes
 *   well, board     a game board, and the empty cells on it
 *   ink, muted      text, and quiet text
 *   stroke          outlines and hard shadows in Bold: the ink on light themes,
 *                   near-black on dark ones (white outlines on a dark page are hard to read)
 *   line            thin dividers and empty outlines
 *   edge, drop      the soft clay shadow under a card, and a wider soft shadow
 *   accent          the main button (accentInk: its text), accentSoft: a soft badge
 *   bad, good       warning and good-news colors
 */
export const THEMES = [
	{
		id: 'oat',
		name: 'Oat',
		tone: 'light',
		blurb: 'Warm cream and soft linen.',
		bg: '#f6efe3',
		glow: '#fde4cc',
		dot: '#e6d8c1',
		surface: '#fffaf3',
		surface2: '#eee5d8',
		well: '#faf4ec',
		board: '#ebe1d3',
		ink: '#2e2730',
		stroke: '#2e2730',
		muted: '#6b5e65',
		line: '#dbcfbf',
		edge: 'rgba(110, 80, 50, 0.2)',
		drop: 'rgba(110, 80, 50, 0.16)',
		accent: '#c24f2a',
		accentInk: '#fffaf5',
		accentSoft: '#fcdcca',
		bad: '#c8352f',
		good: '#1f7341',
	},
	{
		id: 'sage',
		name: 'Sage',
		tone: 'light',
		blurb: 'Garden green and morning light.',
		bg: '#e8f0e3',
		glow: '#f4f5d6',
		dot: '#cfdfc6',
		surface: '#f9fcf6',
		surface2: '#dae6d4',
		well: '#f2f8ef',
		board: '#d6e2cf',
		ink: '#263127',
		stroke: '#263127',
		muted: '#536553',
		line: '#c3d5bd',
		edge: 'rgba(50, 80, 50, 0.2)',
		drop: 'rgba(50, 80, 50, 0.15)',
		accent: '#357849',
		accentInk: '#f8fff8',
		accentSoft: '#d2ead5',
		bad: '#c23a33',
		good: '#1f7341',
	},
	{
		id: 'blossom',
		name: 'Blossom',
		tone: 'light',
		blurb: 'Peach and petal pink.',
		bg: '#fbebe8',
		glow: '#ffd9e1',
		dot: '#f2cdcd',
		surface: '#fffafa',
		surface2: '#f4dbd7',
		well: '#fff5f3',
		board: '#f1d6d1',
		ink: '#40263a',
		stroke: '#40263a',
		muted: '#7a5866',
		line: '#eac6c1',
		edge: 'rgba(140, 60, 80, 0.18)',
		drop: 'rgba(140, 60, 80, 0.14)',
		accent: '#bd3b61',
		accentInk: '#fff8fa',
		accentSoft: '#fcd2de',
		bad: '#bf2f45',
		good: '#1f7341',
	},
	{
		id: 'sky',
		name: 'Sky',
		tone: 'light',
		blurb: 'Cool blue, like a clear morning.',
		bg: '#e5effa',
		glow: '#def0ff',
		dot: '#c9d9ee',
		surface: '#f8fbff',
		surface2: '#d7e4f3',
		well: '#f1f6fd',
		board: '#d3e0f0',
		ink: '#24303e',
		stroke: '#24303e',
		muted: '#526379',
		line: '#c1d2e6',
		edge: 'rgba(40, 70, 120, 0.18)',
		drop: 'rgba(40, 70, 120, 0.14)',
		accent: '#2c68c8',
		accentInk: '#f7fbff',
		accentSoft: '#d3e3fb',
		bad: '#c23838',
		good: '#1f7341',
	},
	{
		id: 'plum',
		name: 'Plum',
		tone: 'dark',
		blurb: 'A quiet plum night.',
		bg: '#221c27',
		glow: '#3a2a45',
		dot: '#33293b',
		surface: '#2f2836',
		surface2: '#3d3546',
		well: '#2a2331',
		board: '#3a3243',
		ink: '#f5eef6',
		stroke: '#0a070c',
		muted: '#ad9fb5',
		line: '#4b4255',
		edge: 'rgba(0, 0, 0, 0.42)',
		drop: 'rgba(0, 0, 0, 0.35)',
		accent: '#ffb46b',
		accentInk: '#2b1f1a',
		accentSoft: '#4c3a32',
		bad: '#ff7b7f',
		good: '#79dba0',
	},
	{
		id: 'tide',
		name: 'Tide',
		tone: 'dark',
		blurb: 'Deep blue water, still and calm.',
		bg: '#111d29',
		glow: '#163448',
		dot: '#1c2d3d',
		surface: '#1a2a39',
		surface2: '#24384b',
		well: '#172534',
		board: '#213547',
		ink: '#e8f2f7',
		stroke: '#03080d',
		muted: '#93abb9',
		line: '#2f4659',
		edge: 'rgba(0, 0, 0, 0.45)',
		drop: 'rgba(0, 0, 0, 0.38)',
		accent: '#63d3c5',
		accentInk: '#0d1f24',
		accentSoft: '#1f4447',
		bad: '#ff7c7c',
		good: '#77dfa6',
	},
	{
		id: 'hearth',
		name: 'Hearth',
		tone: 'dark',
		blurb: 'Charcoal and the glow of a fire.',
		bg: '#1f1b19',
		glow: '#3b2618',
		dot: '#2e2724',
		surface: '#2b2522',
		surface2: '#3a322d',
		well: '#26201d',
		board: '#362e29',
		ink: '#f7ede4',
		stroke: '#080605',
		muted: '#b4a395',
		line: '#4a3f38',
		edge: 'rgba(0, 0, 0, 0.45)',
		drop: 'rgba(0, 0, 0, 0.38)',
		accent: '#ff9446',
		accentInk: '#2a1708',
		accentSoft: '#4e3320',
		bad: '#ff7a6c',
		good: '#7fdc9c',
	},
];

/** The theme a new player gets, and the free dark one. */
export const DEFAULT_THEME = 'oat';
export const FREE_THEMES = ['oat', 'plum'];

/**
 * A style: the shape of everything.
 *   outline        outline width in px (0 for none); the outline color is the ink
 *   radius         corner radius in px: big (cards, sheets), normal (buttons), small (chips, tiles)
 *   lift           how far a button sits above its shadow, in px
 *   hard           true: hard offset shadows in ink (Bold); false: soft clay shadows (Soft)
 *   displayFont    big titles and numbers (displayWeight: its weight)
 *   uiFont         everything else
 *   page           'glow' (a soft glow at the top) or 'dots' (a dot grid)
 */
export const STYLES = {
	soft: {
		id: 'soft',
		name: 'Soft',
		blurb: 'Soft clay: round and puffy.',
		outline: 0,
		radius: { big: 24, normal: 16, small: 12 },
		lift: 3,
		hard: false,
		displayFont: 'Bricolage Grotesque',
		displayWeight: 800,
		uiFont: 'Bricolage Grotesque',
		page: 'glow',
	},
	bold: {
		id: 'bold',
		name: 'Bold',
		blurb: 'Bold ink outlines and hard shadows.',
		outline: 3,
		radius: { big: 14, normal: 10, small: 6 },
		lift: 4,
		hard: true,
		displayFont: 'Archivo Black',
		displayWeight: 400,
		uiFont: 'Space Grotesk',
		page: 'dots',
	},
};

export const DEFAULT_STYLE = 'soft';

export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const styleById = (id) => STYLES[id] ?? STYLES[DEFAULT_STYLE];
export const paletteOf = (theme) => PALETTES[theme.tone];

/**
 * Puts a theme and a style on the page: data attributes on <html> (kit.css
 * reads them) and the browser's theme color. Call it again after any change.
 */
export function applyLooks(themeId, styleId) {
	const theme = themeById(themeId);
	const style = styleById(styleId);
	const root = document.documentElement;
	root.dataset.theme = theme.id;
	root.dataset.tone = theme.tone;
	root.dataset.style = style.id;
	root.style.colorScheme = theme.tone;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
	return { theme, style };
}
