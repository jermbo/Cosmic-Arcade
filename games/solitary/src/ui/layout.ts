import type { DealOptions, ModeId } from '../core/types.ts';

export interface Point {
	x: number;
	y: number;
}

export interface Layout {
	kind: 'top' | 'side';
	cw: number;
	ch: number;
	gap: number;
	width: number;
	height: number;
	/** Base position of every pile. */
	piles: Record<string, Point>;
	/** Offset per card for piles that fan: waste (last 3), stock groups. */
	fan: Record<string, Point>;
	/** Spider foundations in a side rail sit as one overlapped stack. */
	stacked: boolean;
}

const MAX_CW = 128;

interface Spec {
	cols: number;
	/** Room the tableau needs below its first card, in card heights. */
	extra: number;
	top: [string, number][];
	left: string[];
	right: string[];
}

function spec(mode: ModeId): Spec {
	if (mode === 'klondike')
		return {
			cols: 7,
			extra: 1.9,
			top: [['stock', 0], ['waste', 1], ['f0', 3], ['f1', 4], ['f2', 5], ['f3', 6]],
			left: ['stock', 'waste'],
			right: ['f0', 'f1', 'f2', 'f3'],
		};
	if (mode === 'freecell')
		return {
			cols: 8,
			extra: 2.2,
			top: [['c0', 0], ['c1', 1], ['c2', 2], ['c3', 3], ['f0', 4], ['f1', 5], ['f2', 6], ['f3', 7]],
			left: ['c0', 'c1', 'c2', 'c3'],
			right: ['f0', 'f1', 'f2', 'f3'],
		};
	return {
		cols: 10,
		extra: 2.3,
		top: [['f0', 0], ['f1', 1], ['f2', 2], ['f3', 3], ['f4', 4], ['f5', 5], ['f6', 6], ['f7', 7], ['stock', 9]],
		left: ['f0'],
		right: ['stock'],
	};
}

const gapFor = (cw: number) => Math.max(4, Math.min(14, Math.round(cw * 0.11)));

/** ratio: card height over width. snap: rounds a card width to one that draws crisp (pixel decks). */
export function computeLayout(
	mode: ModeId,
	opts: DealOptions,
	W: number,
	H: number,
	ratio = 1.4,
	snap: (cw: number) => number = (cw) => cw,
): Layout {
	const RATIO = ratio;
	const s = spec(mode);
	const fanWaste = mode === 'klondike' && opts.draw === 3;
	const candidates: Layout[] = [];

	// Standard: a top row above the tableau.
	{
		let gap = gapFor(W / s.cols);
		let cw = (W - (s.cols - 1) * gap) / s.cols;
		const chByH = (H - gap * 1.4) / (2 + s.extra);
		cw = snap(Math.min(cw, chByH / RATIO, MAX_CW));
		gap = gapFor(cw);
		const ch = cw * RATIO;
		const width = s.cols * cw + (s.cols - 1) * gap;
		const x0 = (W - width) / 2;
		const piles: Record<string, Point> = {};
		const col = (i: number) => x0 + i * (cw + gap);
		for (const [id, i] of s.top) piles[id] = { x: col(i), y: 0 };
		const rowY = ch + gap * 1.4;
		for (let i = 0; i < s.cols; i++) piles[`t${i}`] = { x: col(i), y: rowY };
		const fan: Record<string, Point> = {};
		if (fanWaste) fan.waste = { x: cw * 0.24, y: 0 };
		if (mode === 'spider') fan.stock = { x: -cw * 0.14, y: 0 };
		if (mode === 'spider') for (let i = 0; i < 8; i++) piles[`f${i}`] = { x: col(i), y: 0 };
		candidates.push({ kind: 'top', cw, ch, gap, width: W, height: H, piles, fan, stacked: false });
	}

	// Wide and short (phone in landscape): rails on both sides of the tableau.
	const railOptions = mode === 'spider' ? [[1, 1]] : [[1, 1], [1, 2], [2, 2]];
	for (const [lc, rc] of railOptions) {
		const leftCols = mode === 'klondike' ? 1 : lc;
		const total = leftCols + s.cols + rc;
		let gap = gapFor(W / total);
		const railGap = gap * 2.2;
		let cw = (W - (total - 3) * gap - 2 * railGap) / total;
		const rows = (n: number, c: number) => Math.ceil(n / c);
		const leftRows = rows(s.left.length, leftCols);
		const rightRows = rows(s.right.length, rc);
		const extraLeft = mode === 'klondike' ? (fanWaste ? 0.5 : 0) : mode === 'spider' ? 7 * 0.13 : 0;
		const extraRight = mode === 'spider' ? 0.3 : 0;
		const chByTab = H / (1 + s.extra);
		const chByLeft = (H - (leftRows - 1) * gap) / (leftRows + extraLeft);
		const chByRight = (H - (rightRows - 1) * gap) / (rightRows + extraRight);
		cw = snap(Math.min(cw, chByTab / RATIO, chByLeft / RATIO, chByRight / RATIO, MAX_CW));
		gap = gapFor(cw);
		const rg = gap * 2.2;
		const ch = cw * RATIO;
		const width = (leftCols + s.cols + rc) * cw + (leftCols - 1 + s.cols - 1 + rc - 1) * gap + 2 * rg;
		let x = (W - width) / 2;
		const piles: Record<string, Point> = {};
		const fan: Record<string, Point> = {};
		const place = (ids: string[], cols: number, x0: number, rowExtra = 0) => {
			ids.forEach((id, i) => {
				const c = i % cols;
				const r = Math.floor(i / cols);
				piles[id] = { x: x0 + c * (cw + gap), y: r * (ch + gap + rowExtra) };
			});
		};
		if (mode === 'spider') {
			for (let i = 0; i < 8; i++) piles[`f${i}`] = { x, y: i * ch * 0.13 };
		} else {
			place(s.left, leftCols, x);
		}
		x += leftCols * cw + (leftCols - 1) * gap + rg;
		for (let i = 0; i < s.cols; i++) piles[`t${i}`] = { x: x + i * (cw + gap), y: 0 };
		x += s.cols * cw + (s.cols - 1) * gap + rg;
		place(s.right, rc, x);
		if (fanWaste) fan.waste = { x: 0, y: ch * 0.22 };
		if (mode === 'spider') fan.stock = { x: 0, y: ch * 0.075 };
		candidates.push({ kind: 'side', cw, ch, gap, width: W, height: H, piles, fan, stacked: mode === 'spider' });
	}

	// Biggest cards win. The top layout wins a near tie: it reads as the classic table.
	candidates.sort((a, b) => b.cw - a.cw);
	const top = candidates.find((c) => c.kind === 'top')!;
	if (top.cw >= candidates[0].cw * 0.96) return top;
	return candidates[0];
}
