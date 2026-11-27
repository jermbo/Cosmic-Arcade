/**
 * Compares the two control styles we tried, by counting the inputs needed to fill
 * real puzzles in the order the hint solver fills them (a fair stand-in for a person).
 * Run with `npm run compare-controls`.
 *
 * A. Tile first (kept): pick a tile, then tap a number and/or a color.
 * B. Pane first ("brush", dev prototype at ?controls=brush): arm a number or a color,
 *    then tap tiles to paint it. Only one value is armed at a time, so painting
 *    never sets a part you didn't mean to.
 */
import { practicePuzzle } from '../src/core/daily.ts';
import type { Fact } from '../src/core/logic.ts';
import { solveLogically } from '../src/core/logic.ts';
import { LEVELS } from '../src/core/types.ts';

const PER_LEVEL = 60;

function tileFirst(facts: Fact[]) {
	let sel = -1;
	let taps = 0;
	let keys = 0;
	let at = 0;
	for (const f of facts) {
		if (f.cell !== sel) {
			taps++;
			const dr = Math.abs(Math.floor(f.cell / 4) - Math.floor(at / 4));
			const dc = Math.abs((f.cell % 4) - (at % 4));
			keys += Math.min(dr, 4 - dr) + Math.min(dc, 4 - dc); // arrows wrap around
			sel = f.cell;
			at = f.cell;
		}
		taps++;
		keys++;
	}
	return { taps, keys };
}

function brush(facts: Fact[]) {
	let armed: Fact | null = null;
	let taps = 0;
	for (const f of facts) {
		if (!armed || armed.axis !== f.axis || armed.value !== f.value) {
			taps += armed && armed.axis !== f.axis ? 2 : 1; // switching sides: disarm one, arm the other
			armed = f;
		}
		taps++;
	}
	return taps;
}

const total = { a: 0, aKeys: 0, b: 0, bSorted: 0, facts: 0, n: 0 };
for (const level of LEVELS) {
	for (let i = 0; i < PER_LEVEL; i++) {
		const p = practicePuzzle(level, i);
		const facts = solveLogically(p.givens).steps.flatMap((s) => s.facts);
		const a = tileFirst(facts);
		total.a += a.taps;
		total.aKeys += a.keys;
		total.b += brush(facts);
		// Best case for the brush: a player who paints all of one value at once.
		// (Not realistic: you rarely know them all at once.)
		const sorted = facts.slice().sort((x, y) => (x.axis === y.axis ? x.value - y.value : x.axis === 'num' ? -1 : 1));
		total.bSorted += brush(sorted);
		total.facts += facts.length;
		total.n++;
	}
}
const avg = (x: number) => (x / total.n).toFixed(1);
console.log(`${total.n} puzzles, ${avg(total.facts)} parts to place on average.\n`);
console.log(`A. Tile first, touch:      ${avg(total.a)} taps`);
console.log(`A. Tile first, keyboard:   ${avg(total.aKeys)} key presses (arrows + values)`);
console.log(`B. Pane first, solver order: ${avg(total.b)} taps`);
console.log(`B. Pane first, best case:    ${avg(total.bSorted)} taps (paint each value in one go)`);
