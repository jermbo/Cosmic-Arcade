/**
 * The look: glass colors, their patterns, hand-drawn numerals, and the wobbly
 * pane shapes of the window. All drawn in code (SVG), nothing downloaded.
 */
import { makeRng } from '../core/rng.ts';

export interface Glass {
	name: string;
	/** Main glass color. */
	base: string;
	/** Darker edge and pattern ink. */
	deep: string;
	/** Light tint for highlights. */
	light: string;
	pattern: 'stripes' | 'waves' | 'dots' | 'checks';
}

export const GLASS: Glass[] = [
	{ name: 'Ruby', base: '#ec5b5f', deep: '#b3303a', light: '#ffc2bd', pattern: 'stripes' },
	{ name: 'Cobalt', base: '#4a86e8', deep: '#2753a8', light: '#c4dbff', pattern: 'waves' },
	{ name: 'Amber', base: '#f6b93b', deep: '#c27a0e', light: '#ffe6a8', pattern: 'dots' },
	{ name: 'Jade', base: '#38b67f', deep: '#1b7c52', light: '#b9eccf', pattern: 'checks' },
];

export const INK = '#241a2e';
export const CREAM = '#fff8ea';
export const LIGHT = '#fff1cc';
export const GOLD = '#ffcf3f';
export const CORAL = '#ff6b4a';

/**
 * Hand-drawn numerals 1..4, as single strokes in a box from -20 to 20.
 * Drawn with round caps, so they read like ink on glass.
 */
export const NUMERALS = [
	'M -7 -10 C -3 -12 0 -15 2.5 -18 C 2 -6 2.4 6 2 17 M -7.5 17 C -2 16 4 16.3 10 16.6',
	'M -10.5 -8 C -9.5 -17 2 -20 8 -14.5 C 13 -9.5 8 -2 1 4 C -3.5 8 -7.5 12 -11 16.5 C -3 15.5 4 16 11.5 16',
	'M -9.5 -13.5 C -3 -19 8 -18 9.5 -11.5 C 10.5 -6 5.5 -2.5 -1 -1.5 C 6.5 -1.5 12 2 11 9 C 10 16.5 -1 19.5 -11 13',
	'M 5 17.5 C 4.6 6 4.4 -6 4.8 -18 C -1 -10 -6.5 -2 -11.5 6 C -3 5.4 5 5.6 12.5 6',
];

/** Geometry of the window, in SVG units. */
export const WIN = {
	w: 400,
	h: 456,
	gridX: 36,
	gridY: 88,
	cell: 82,
	get size() {
		return this.cell * 4;
	},
};

export const cellBox = (cell: number) => {
	const r = Math.floor(cell / 4);
	const c = cell % 4;
	const x = WIN.gridX + c * WIN.cell;
	const y = WIN.gridY + r * WIN.cell;
	return { x, y, cx: x + WIN.cell / 2, cy: y + WIN.cell / 2 };
};

/** A slightly uneven quad, like a cut piece of glass. Same tile, same shape, every time. */
export function paneShape(cell: number, inset = 5.5): { d: string; corners: [number, number][] } {
	const rng = makeRng(cell * 7919 + 17);
	const j = (n: number) => (rng() - 0.5) * n;
	const { x, y } = cellBox(cell);
	const s = WIN.cell;
	const corners: [number, number][] = [
		[x + inset + j(3), y + inset + j(3)],
		[x + s - inset + j(3), y + inset + j(3)],
		[x + s - inset + j(3), y + s - inset + j(3)],
		[x + inset + j(3), y + s - inset + j(3)],
	];
	// Soft corners and a gentle bow on each edge.
	const r = 6;
	let d = '';
	for (let i = 0; i < 4; i++) {
		const [ax, ay] = corners[i];
		const [bx, by] = corners[(i + 1) % 4];
		const len = Math.hypot(bx - ax, by - ay);
		const ux = (bx - ax) / len;
		const uy = (by - ay) / len;
		const sx = ax + ux * r;
		const sy = ay + uy * r;
		const ex = bx - ux * r;
		const ey = by - uy * r;
		const bow = j(3.2);
		const mx = (sx + ex) / 2 - uy * bow;
		const my = (sy + ey) / 2 + ux * bow;
		d += i === 0 ? `M ${sx.toFixed(1)} ${sy.toFixed(1)} ` : '';
		d += `Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} `;
		const [nx, ny] = corners[(i + 2) % 4];
		const len2 = Math.hypot(nx - bx, ny - by);
		const n2x = bx + ((nx - bx) / len2) * r;
		const n2y = by + ((ny - by) / len2) * r;
		d += `Q ${bx.toFixed(1)} ${by.toFixed(1)} ${n2x.toFixed(1)} ${n2y.toFixed(1)} `;
	}
	return { d: d + 'Z', corners };
}

/** A crack across a pane, for rule clashes. */
export function crackPath(cell: number): string {
	const rng = makeRng(cell * 131 + 3);
	const { x, y } = cellBox(cell);
	const s = WIN.cell;
	const pts: [number, number][] = [[x + 12 + rng() * 10, y + 10]];
	for (let i = 1; i <= 4; i++) pts.push([x + 14 + (i / 4) * (s - 30) + (rng() - 0.5) * 14, y + 10 + (i / 4) * (s - 20) + (rng() - 0.5) * 10]);
	const branch = pts[2];
	return `M ${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L ')} M ${branch[0].toFixed(1)} ${branch[1].toFixed(1)} l ${(12 + rng() * 6).toFixed(1)} ${(-10 - rng() * 6).toFixed(1)}`;
}

/** The pointed arch of the window frame. */
export const ARCH_OUTER = 'M 8 450 L 8 96 C 8 46 112 12 200 8 C 288 12 392 46 392 96 L 392 450 Z';
export const ARCH_INNER = 'M 26 426 L 26 98 C 26 58 120 28 200 24 C 280 28 374 58 374 98 L 374 426 Z';
/** Where the rose window sits, in the arch above the grid. */
export const ROSE = { x: 200, y: 57, r: 25 };
