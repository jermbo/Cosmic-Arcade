export interface Rng {
	/** Float in [0, 1). */
	next(): number;
	/** Integer in [min, max], both ends included. */
	int(min: number, max: number): number;
	chance(p: number): boolean;
	pick<T>(list: readonly T[]): T;
	/** Shuffles in place and returns the same array. */
	shuffle<T>(list: T[]): T[];
	weighted<K extends string>(weights: Record<K, number>): K;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function makeRng(seed: number): Rng {
	const next = mulberry32(seed);
	const rng: Rng = {
		next,
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		chance: (p) => next() < p,
		pick: (list) => list[Math.floor(next() * list.length)],
		shuffle(list) {
			for (let i = list.length - 1; i > 0; i--) {
				const j = Math.floor(next() * (i + 1));
				[list[i], list[j]] = [list[j], list[i]];
			}
			return list;
		},
		weighted(weights) {
			const keys = Object.keys(weights) as (keyof typeof weights)[];
			const total = keys.reduce((sum, k) => sum + Math.max(0, weights[k]), 0);
			let roll = next() * total;
			for (const k of keys) {
				roll -= Math.max(0, weights[k]);
				if (roll < 0) return k;
			}
			return keys[0];
		},
	};
	return rng;
}

/** FNV-1a over "seed:stream", so each stream gets its own fixed sequence. */
export function hashSeed(seed: number, stream: string): number {
	let h = 0x811c9dc5;
	for (const ch of `${seed}:${stream}`) {
		h ^= ch.charCodeAt(0);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export function childRng(seed: number, stream: string): Rng {
	return makeRng(hashSeed(seed, stream));
}

export function randomSeed(): number {
	return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

/** Cosmetic label like ⌀12_34_56 from the last six digits of the seed. */
export function seedLabel(seed: number): string {
	const d = String(seed).padStart(6, '0').slice(-6);
	return `⌀${d.slice(0, 2)}_${d.slice(2, 4)}_${d.slice(4, 6)}`;
}
