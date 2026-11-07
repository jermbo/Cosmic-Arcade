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

// The bot only picks a move that fits.
g = new Game({ lab: { grid: 'medium' }, seed: 22 });
const move = chooseMove(g);
assert.ok(g.fits(g.pieces[move.slot], move.x));

// With a full well no piece fits, so the bot has no move.
g = new Game({ lab: { grid: 'small' }, seed: 23 });
for (let i = 0; i < g.grid.length; i++) g.grid[i] = g.makeBlock(i % 3);
assert.equal(chooseMove(g), null);
assert.equal(autoPlay(g, WARMUP_ROUNDS), 0, 'it stops at once when no piece fits');

console.log('bot ok');
