// Checks the warm-up bot. Run: node tools/bot-test.js
import assert from 'node:assert/strict';
import { Game } from '../src/js/engine.js';
import { chooseMove, autoPlay, WARMUP_ROUNDS } from '../src/js/bot.js';

// The warm-up plays rounds for the player, keeps the stack legal, and keeps the run total of glints.
let g = new Game({ lab: { grid: 'medium' }, seed: 21 });
const played = autoPlay(g, WARMUP_ROUNDS);
assert.equal(played, WARMUP_ROUNDS, 'it plays every round on an empty board');
assert.equal(g.stats.turns, WARMUP_ROUNDS);
assert.ok(g.pieces.every(Boolean), 'the tray is refilled');
assert.equal(g.findGroups().length, 0, 'the board is still after the last round');
for (let x = 0; x < g.cols; x++) for (let y = 1; y < g.rows; y++) if (g.get(x, y)) assert.ok(g.get(x, y - 1), 'no gaps in a column');

// With a full well no piece fits, so the bot has no move.
g = new Game({ lab: { grid: 'small' }, seed: 23 });
for (let i = 0; i < g.grid.length; i++) g.grid[i] = g.makeBlock(i % 3);
assert.equal(chooseMove(g), null);
assert.equal(autoPlay(g, WARMUP_ROUNDS), 0, 'it stops at once when no piece fits');

// A full game under the two-piece rule: the bot never picks an empty slot, and the tray refills only when empty.
g = new Game({ lab: { grid: 'medium' }, seed: 24 });
for (let turn = 0; turn < 400; turn++) {
	const m = chooseMove(g);
	if (!m) break;
	assert.ok(g.pieces[m.slot], 'the bot never places a piece from an empty slot');
	const left = g.pieces.filter(Boolean).length - 1;
	g.place(m.slot, m.x);
	g.resolveAll();
	const refilled = g.refillTray();
	assert.equal(refilled.length, left === 0 ? 2 : 0, 'refill only when both are used');
}

// In Timed the warm-up uses each power-up it earns at once, so the bag is empty after it.
g = new Game({ mode: 'timed', lab: { grid: 'medium' }, seed: 25 });
g.bag.push('blast');
autoPlay(g, WARMUP_ROUNDS);
assert.equal(g.bag.length, 0, 'no power-up waits in a Timed bag');

console.log('bot ok');
