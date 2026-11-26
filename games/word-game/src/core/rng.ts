// Seeded random numbers, so a daily seed always makes the same puzzle.

export type Rng = () => number;

/** FNV-1a hash of a string. */
export function hash(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** Mulberry32 seeded from a string. */
export function makeRng(seed: string): Rng {
	let a = hash(seed) || 1;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function int(rng: Rng, n: number): number {
	return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
	return list[int(rng, list.length)];
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
	const out = list.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = int(rng, i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Today as local YYYY-MM-DD. */
export function todayKey(now = new Date()): string {
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${m}-${d}`;
}

/** The day before a YYYY-MM-DD key. */
export function dayBefore(key: string): string {
	const [y, m, d] = key.split('-').map(Number);
	return todayKey(new Date(y, m - 1, d - 1));
}
