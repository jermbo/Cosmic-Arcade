// Suit shapes and UI icons as one inline SVG sprite. Suit glyphs from fonts can turn into emoji on phones.

const SUITS = `
<symbol id="suit-H" viewBox="0 0 100 100"><path d="M50 90C22 68 5 51 5 31 5 16 16 6 29 6c9 0 17 5 21 13 4-8 12-13 21-13 13 0 24 10 24 25 0 20-17 37-45 59z"/></symbol>
<symbol id="suit-D" viewBox="0 0 100 100"><path d="M50 3c10 17 24 33 40 47-16 14-30 30-40 47C40 80 26 64 10 50 26 36 40 20 50 3z"/></symbol>
<symbol id="suit-S" viewBox="0 0 100 100"><path d="M50 4C70 26 95 40 95 61c0 13-10 23-22 23-9 0-15-4-19-10 1 9 5 15 12 21H34c7-6 11-12 12-21-4 6-10 10-19 10C15 84 5 74 5 61 5 40 30 26 50 4z"/></symbol>
<symbol id="suit-C" viewBox="0 0 100 100"><circle cx="50" cy="27" r="21"/><circle cx="26" cy="58" r="21"/><circle cx="74" cy="58" r="21"/><path d="M42 44h16v8H42zM46 58c0 16-4 27-12 37h32c-8-10-12-21-12-37z"/></symbol>`;

const ICONS = `
<symbol id="i-pause" viewBox="0 0 24 24"><path d="M7 4h4v16H7zM13 4h4v16h-4z"/></symbol>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 4 3 10l6 6v-4h5a4 4 0 0 1 0 8h-3v3h3a7 7 0 0 0 0-14H9z"/></symbol>
<symbol id="i-hint" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v2H9z"/></symbol>
<symbol id="i-new" viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zm9 1.5V8h3.5zM11 10v3H8v2h3v3h2v-3h3v-2h-3v-3z"/></symbol>
<symbol id="i-gear" viewBox="0 0 24 24"><path d="m10 2-.6 2.6a8 8 0 0 0-2 1.2L4.9 5 3 8.4l2 1.8a8 8 0 0 0 0 3.6l-2 1.8L4.9 19l2.5-.8a8 8 0 0 0 2 1.2L10 22h4l.6-2.6a8 8 0 0 0 2-1.2l2.5.8 2-3.4-2-1.8a8 8 0 0 0 0-3.6l2-1.8-2-3.4-2.5.8a8 8 0 0 0-2-1.2L14 2zm2 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></symbol>
<symbol id="i-help" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 15h2v2h-2zm1-11a4 4 0 0 1 2.2 7.3c-.8.6-1.2 1-1.2 1.7v.5h-2V15c0-1.5.8-2.3 1.8-3a2 2 0 1 0-2.8-1.8H9A3 3 0 0 1 12 6z"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M10 5 3 12l7 7v-5h11v-4H10z"/></symbol>
<symbol id="i-redo" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 8 8h-3a5 5 0 1 1-5-5v3l5-4.5L12 1z"/></symbol>
<symbol id="i-sound" viewBox="0 0 24 24"><path d="M3 9h4l5-5v16l-5-5H3zm13-1a5 5 0 0 1 0 8l-1.4-1.4a3 3 0 0 0 0-5.2zm2.5-3a9 9 0 0 1 0 14l-1.4-1.4a7 7 0 0 0 0-11.2z"/></symbol>`;

export function installSprite() {
	const holder = document.createElement('div');
	holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">${SUITS}${ICONS}</svg>`;
	document.body.prepend(holder.firstElementChild!);
}

export const icon = (name: string, cls = 'icon') =>
	`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

export const suitIcon = (suit: string, cls = 'pip') =>
	`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#suit-${suit}"/></svg>`;

// Pixel suits, 7 x 7, drawn to match the Pixel Plebes deck.
const PIXEL_SUITS: Record<string, string[]> = {
	H: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
	D: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
	S: ['...#...', '..###..', '.#####.', '#######', '#######', '.#.#.#.', '..###..'],
	C: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
};

const pixelPaths: Record<string, string> = {};
for (const [suit, rows] of Object.entries(PIXEL_SUITS)) {
	let d = '';
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) if (row[x] === '#') d += `M${x} ${y}h1v1h-1z`;
	});
	pixelPaths[suit] = d;
}

export const pixelSuit = (suit: string, cls = 'pixel-suit') =>
	`<svg class="${cls}" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${pixelPaths[suit]}"/></svg>`;
