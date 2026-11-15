/** Small shared helpers: grid keys, directions, maths and seeded random numbers. */

/** Direction index: 0 north (z-1), 1 east (x+1), 2 south (z+1), 3 west (x-1). */
export const DX = [0, 1, 0, -1];
export const DZ = [-1, 0, 1, 0];

export const key = (x: number, z: number): string => `${x},${z}`;

export function unkey(k: string): [number, number] {
	const i = k.indexOf(',');
	return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => t * t * (3 - 2 * t);

/** A stable pseudo-random number in 0..1 from two integers. */
export function hash2(x: number, z: number, salt = 0): number {
	let h = (x * 374761393 + z * 668265263 + salt * 2147483647) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	h ^= h >>> 16;
	return ((h >>> 0) % 100000) / 100000;
}

/** A seeded random generator (mulberry32). */
export function rng(seed: number): () => number {
	let a = (seed * 2654435761) >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function pick<T>(list: readonly T[], r: number): T {
	return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}

/** Moves an angle toward a target by the short way. */
export function turnToward(a: number, b: number, t: number): number {
	let d = (b - a) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d < -Math.PI) d += Math.PI * 2;
	return a + d * t;
}
