// Checks the rules and the bots. Runs before every build: npm test -w flippity
import assert from 'node:assert/strict';
import type { BotId } from '../src/core/bot.ts';
import { BOTS, pickMove } from '../src/core/bot.ts';
import type { Side } from '../src/core/rules.ts';
import { DARK, LIGHT, SIZES, count, flipsAt, legalMoves, nextTurn, play, start } from '../src/core/rules.ts';

// The start position: 2 of each, and 4 moves for dark.
for (const n of SIZES) {
	const s = start(n);
	assert.deepEqual(count(s), { dark: 2, light: 2, empty: n * n - 4 }, `start ${n}`);
	assert.equal(legalMoves(s, n, DARK).length, 4, `opening moves ${n}`);
}

// A classic first move on 8×8: D3 flips D4.
{
	const n = 8;
	const s = start(n);
	const d3 = 2 * n + 3;
	const f = flipsAt(s, n, d3, DARK);
	assert.deepEqual(f.flips, [3 * n + 3]);
	assert.equal(f.lines, 1);
	const after = play(s, n, d3, DARK);
	assert.deepEqual(count(after.cells), { dark: 4, light: 1, empty: 59 });
}

// Two lines at once.
{
	// Dark at 2 traps 1 along the row (to 0) and 8 down the column (to 14).
	const n = 6;
	const b = new Array(36).fill(0);
	b[0] = DARK;
	b[1] = LIGHT; // row line to 2
	b[8] = LIGHT; // column line from 2 down to 14
	b[14] = DARK;
	const f = flipsAt(b, n, 2, DARK);
	assert.equal(f.lines, 2);
	assert.deepEqual(new Set(f.flips), new Set([1, 8]));
}

// Pass rules: a full board ends the game.
{
	const n = 6;
	const full = new Array(36).fill(DARK);
	assert.deepEqual(nextTurn(full, n, DARK), { toMove: null, passed: null });
}

// Bots: every game ends, every move is legal, and stronger bots win more.
BOTS.sharp.time = { 6: 15, 8: 20, 10: 25 };
function game(n: number, darkBot: BotId, lightBot: BotId): number {
	let cells = start(n);
	let side: Side | null = DARK;
	let moves = 0;
	while (side) {
		const bot = side === DARK ? darkBot : lightBot;
		const m = pickMove(cells, n, side, bot);
		assert.ok(legalMoves(cells, n, side).includes(m), `${bot} played a legal move`);
		cells = play(cells, n, m, side).cells;
		side = nextTurn(cells, n, side).toMove;
		assert.ok(++moves <= n * n, 'the game ends');
	}
	const c = count(cells);
	return c.dark - c.light;
}

function match(n: number, a: BotId, b: BotId, games: number) {
	let aWins = 0;
	for (let g = 0; g < games; g++) {
		const aDark = g % 2 === 0;
		const d = aDark ? game(n, a, b) : -game(n, b, a);
		if (d > 0) aWins++;
	}
	return aWins / games;
}

const t0 = performance.now();
const steadyVsSleepy = match(6, 'steady', 'sleepy', 20);
const sharpVsSteady = match(6, 'sharp', 'steady', 10);
const sharpBig = match(10, 'sharp', 'sleepy', 2);
console.log(`6×6: Steady beats Sleepy ${Math.round(steadyVsSleepy * 100)}%, Sharp beats Steady ${Math.round(sharpVsSteady * 100)}%. 10×10: Sharp beats Sleepy ${Math.round(sharpBig * 100)}%.`);
assert.ok(steadyVsSleepy >= 0.6, 'Steady beats Sleepy most of the time');
assert.ok(sharpVsSteady >= 0.6, 'Sharp beats Steady most of the time');
console.log(`Rules and bots OK (${Math.round(performance.now() - t0)} ms).`);
