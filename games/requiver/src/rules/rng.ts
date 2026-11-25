// Seeded random numbers. The state is one number, so a run can be saved and resumed.

export class Rng {
	state: number;

	constructor(seed: number) {
		this.state = seed >>> 0 || 1;
	}

	/** A float in [0, 1). Mulberry32. */
	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	range(min: number, max: number): number {
		return min + (max - min) * this.next();
	}

	/** An integer in [min, max], both ends included. */
	int(min: number, max: number): number {
		return Math.floor(this.range(min, max + 1));
	}

	chance(p: number): boolean {
		return this.next() < p;
	}

	pick<T>(list: readonly T[]): T {
		return list[Math.floor(this.next() * list.length)];
	}

	/** Picks by weight. Items with weight 0 or less are never picked. */
	weighted<T>(list: readonly T[], weight: (item: T) => number): T | undefined {
		const total = list.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
		if (total <= 0) return undefined;
		let roll = this.next() * total;
		for (const item of list) {
			roll -= Math.max(0, weight(item));
			if (roll < 0) return item;
		}
		return list[list.length - 1];
	}

	shuffle<T>(list: T[]): T[] {
		for (let i = list.length - 1; i > 0; i--) {
			const j = Math.floor(this.next() * (i + 1));
			[list[i], list[j]] = [list[j], list[i]];
		}
		return list;
	}

	/** A value with mean 0 and spread about 1. */
	gauss(): number {
		return (this.next() + this.next() + this.next() - 1.5) * 2;
	}
}

export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;
