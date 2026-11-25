import type { Layout } from './layout.ts';

/** Nearest pile in a direction, using layout positions on the table. */
export function neighbourPile(
	layout: Layout,
	pileIds: readonly string[],
	fromPile: string,
	dir: 'left' | 'right' | 'up' | 'down',
): string | null {
	const fromPoint = layout.piles[fromPile];
	let best: string | null = null;
	let bestScore = Infinity;
	for (const pile of pileIds) {
		if (pile === fromPile) continue;
		const other = layout.piles[pile];
		const dx = other.x - fromPoint.x;
		const dy = other.y - fromPoint.y;
		const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
		const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
		if (along <= 1) continue;
		const score = along + across * 3;
		if (score < bestScore) {
			bestScore = score;
			best = pile;
		}
	}
	return best;
}