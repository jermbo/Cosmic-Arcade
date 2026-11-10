// Credits that come in, and the meter of credits per second from cargo sales.

import type { Game } from './game.ts';

const BUCKETS = 20;

const income = { buckets: new Array<number>(BUCKETS).fill(0), i: 0, t: 0, filled: 1 };

export function resetIncome() {
	income.buckets.fill(0);
	income.i = 0;
	income.t = 0;
	income.filled = 1;
}

function addIncome(n: number) {
	income.buckets[income.i] += n;
}

export function stepIncome(dt: number) {
	income.t += dt;
	while (income.t >= 1) {
		income.t -= 1;
		income.i = (income.i + 1) % BUCKETS;
		income.buckets[income.i] = 0;
		income.filled = Math.min(BUCKETS - 1, income.filled + 1);
	}
}

/** Credits per second from cargo, over the last 20 seconds. */
export function incomeRate(): number {
	let sum = 0;
	for (let k = 0; k < BUCKETS; k++) if (k !== income.i) sum += income.buckets[k];
	return sum / income.filled;
}

/** Adds credits. Only cargo sales count toward the income meter. */
export function earn(g: Game, n: number, sale = false) {
	g.credits += n;
	g.runEarned += n;
	g.stats.allEarned += n;
	if (sale) addIncome(n);
}
