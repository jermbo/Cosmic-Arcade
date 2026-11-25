export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Overlap area of two axis-aligned rectangles (zero if none). */
export function rectOverlap(first: Rect, second: Rect): number {
	return (
		Math.max(0, Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x)) *
		Math.max(0, Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y))
	);
}