/** Grid helpers. Cells are numbered row × width + column. */

const cache = new Map<string, number[][]>();

/** The up, right, down and left neighbors of every cell. */
export function neighbors(w: number, h: number): number[][] {
	const key = `${w}x${h}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const out: number[][] = [];
	for (let i = 0; i < w * h; i++) {
		const r = Math.floor(i / w);
		const c = i % w;
		const list: number[] = [];
		if (r > 0) list.push(i - w);
		if (c < w - 1) list.push(i + 1);
		if (r < h - 1) list.push(i + w);
		if (c > 0) list.push(i - 1);
		out.push(list);
	}
	cache.set(key, out);
	return out;
}

export const isNext = (w: number, a: number, b: number) => {
	const d = Math.abs(a - b);
	return d === w || (d === 1 && Math.floor(a / w) === Math.floor(b / w));
};

/**
 * The cells a straight move from `from` to `to` passes, one step at a time
 * (so a fast drag that skips cells still makes a path of neighbors).
 */
export function stepsBetween(w: number, from: number, to: number): number[] {
	const out: number[] = [];
	let r = Math.floor(from / w);
	let c = from % w;
	const tr = Math.floor(to / w);
	const tc = to % w;
	while (r !== tr || c !== tc) {
		const dr = tr - r;
		const dc = tc - c;
		// Step along the longer gap first, so the path follows the finger.
		if (Math.abs(dc) >= Math.abs(dr)) c += Math.sign(dc);
		else r += Math.sign(dr);
		out.push(r * w + c);
	}
	return out;
}
