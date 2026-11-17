// Checks the match, chain and power-up rules on hand-made boards. Run: node tools/engine-test.js
import assert from 'node:assert/strict';
import { Game, dailySeed, glintsFor, glintsForAllClear, SECOND_WIND_ROWS, POWER_KINDS, REWARD_CHAIN, REWARD_GROUP, BAG_SIZE, groupMultiplier } from '../src/js/engine.js';
import { REROLL_COST, REROLL_STEP } from '../src/js/prices.js';
import { SHAPES } from '../src/js/shape-list.js';

/** rows are listed from the ceiling down: '.' empty, a digit is a color. */
function board(rows, lab = {}) {
	const g = new Game({ lab: { grid: 'small', ...lab }, seed: 1 });
	g.grid.fill(null);
	rows.forEach((line, y) => {
		[...line].forEach((ch, x) => {
			if (ch !== '.') g.grid[g.index(x, y)] = g.makeBlock(Number(ch));
		});
	});
	return g;
}
const count = (g) => g.grid.filter(Boolean).length;

// A straight line of 3 matches.
let g = board(['000...']);
assert.equal(g.findGroups().length, 1);

// A bent group of 3 matches (an L), and a snake of 4.
g = board(['00....', '0.....']);
assert.equal(g.findGroups().length, 1, 'L shape links');
g = board(['00....', '.0....', '.00...']);
assert.equal(g.findGroups()[0].cells.size, 5, 'a bent snake links all its blocks');

// Diagonals never link.
g = board(['0.....', '.0....', '..0...']);
assert.equal(g.findGroups().length, 0, 'diagonal does not link');
g = board(['00....', '..0...']);
assert.equal(g.findGroups().length, 0, 'a diagonal gap does not link');

// Two in a row do not match.
g = board(['00....']);
assert.equal(g.findGroups().length, 0);

// Blocks rise to the ceiling after a clear.
g = board(['1.....', '000...', '2.....', '3.....']);
const s = g.resolveStep(1);
assert.equal(s.cleared.length, 3);
assert.equal(g.get(0, 0).color, 1, 'top block stays');
assert.equal(g.get(0, 1).color, 2, 'block below rises into the gap');
assert.equal(g.get(0, 2).color, 3);
assert.equal(g.get(0, 3), null);

// Pieces land against the ceiling, top cell first.
g = new Game({ lab: { grid: 'small' }, seed: 3 });
g.grid.fill(null);
const piece = { id: 99, w: 1, h: 3, cells: [{ dx: 0, dy: 0, color: 1 }, { dx: 0, dy: 1, color: 2 }, { dx: 0, dy: 2, color: 3 }] };
g.pieces[0] = piece;
g.place(0, 2, piece);
assert.deepEqual([0, 1, 2].map((y) => g.get(2, y).color), [1, 2, 3]);
assert.equal(g.height(2), 3);

// Chain multiplier.
g = board(['111...']);
assert.equal(g.resolveStep(3).points, 3 * 10 * 3);

// A clear can pull two groups together and start a chain.
g = board(['1.....', '000...', '11....']);
g.resolveStep(1);
assert.equal(g.resolveStep(2).cleared.length, 3, 'the 1s now touch');

// Group size multiplier: 3 and 4 pay x1, 5 pays x2, 6 pays x3, capped.
assert.deepEqual([3, 4, 5, 6, 7, 8, 9, 20].map(groupMultiplier), [1, 1, 2, 3, 4, 5, 6, 6]);
g = board(['11111.']);
assert.equal(g.resolveStep(1).points, 5 * 10 * 2, 'a group of 5 pays x2');
g = board(['111111']);
assert.equal(g.resolveStep(2).points, 6 * 10 * 2 * 3, 'chain step and group size multiply');
g = board(['111222']);
assert.equal(g.resolveStep(1).points, 6 * 10, 'two groups of 3 pay x1 each');

// Rewards: a long chain or a big group earns one power-up.
g = board(['0.....']);
assert.equal(g.earnsReward(REWARD_CHAIN - 1, REWARD_GROUP - 1), false);
assert.equal(g.earnsReward(REWARD_CHAIN, 0), true);
assert.equal(g.earnsReward(1, REWARD_GROUP), true);
assert.equal(g.awardChain(1, 3), null, 'no reward for a small turn');

// The deck deals every kind once before any repeats, and a new deck never opens with the last card.
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
	g = new Game({ lab: { grid: 'small' }, seed });
	const drawn = [];
	for (let i = 0; i < POWER_KINDS.length * 6; i++) drawn.push(g.drawPower());
	for (let i = 0; i < drawn.length; i += POWER_KINDS.length) {
		assert.deepEqual(drawn.slice(i, i + POWER_KINDS.length).sort(), POWER_KINDS.slice().sort(), 'each kind once per deck');
	}
	for (let i = 1; i < drawn.length; i++) assert.notEqual(drawn[i], drawn[i - 1], 'never the same twice in a row');
}

// The bag has a limit, and a reward that does not fit is lost without using up a card.
g = board(['0.....']);
for (let i = 0; i < BAG_SIZE; i++) assert.equal(g.awardChain(REWARD_CHAIN).lost, false);
assert.equal(new Set(g.bag).size, BAG_SIZE, 'a full bag holds three different power-ups');
const deckBefore = g.deck.slice();
assert.equal(g.awardChain(REWARD_CHAIN).lost, true);
assert.deepEqual(g.deck, deckBefore);
assert.equal(g.bag.length, BAG_SIZE);

// Prism paints a tray piece one color and uses up the power-up.
g = new Game({ lab: { grid: 'small' }, seed: 5 });
g.bag = ['prism'];
const before = g.pieces[0];
assert.ok(g.usePrism(0, 2));
assert.ok(g.pieces[0].cells.every((c) => c.color === 2));
assert.notEqual(g.pieces[0].id, before.id);
assert.equal(g.bag.length, 0);
assert.equal(g.usePrism(0, 1), false, 'no prism left');

// Blast clears a 3x3 area, then the rest rises.
g = board(['0123..', '1230..', '2301..', '3012..']);
g.bag = ['blast'];
assert.ok(g.useBlast(1, 1));
const blast = g.resolveStep(1);
assert.equal(blast.cleared.length, 9);
assert.equal(count(g), 7, 'the other 7 of 16 blocks remain');
assert.equal(g.useBlast(1, 1), false, 'bag is empty');
assert.equal(g.pendingBlast, null);

// A blast on empty cells is refused and keeps the power-up.
g = board(['0.....']);
g.bag = ['blast'];
assert.equal(g.useBlast(4, 0), false);
assert.deepEqual(g.bag, ['blast']);

g = new Game({ lab: { grid: 'large' }, seed: 11 });
const seen = new Set();
for (let i = 0; i < 4000; i++) {
	const p = g.makePiece();
	seen.add(p.cells.map((c) => c.dx + '' + c.dy).join());
	assert.ok(new Set(p.cells.map((c) => c.color)).size > 1, 'a piece is never one color');
}
assert.equal(seen.size, SHAPES.length, 'every shape shows up');

// A piece moves as one rigid shape. A T keeps its stem under the middle of its bar.
g = new Game({ lab: { grid: 'small' }, seed: 3 });
g.grid.fill(null);
const tee = { id: 98, w: 3, h: 2, cells: [{ dx: 0, dy: 0, color: 0 }, { dx: 1, dy: 0, color: 1 }, { dx: 2, dy: 0, color: 2 }, { dx: 1, dy: 1, color: 3 }] };
g.pieces[0] = tee;
g.place(0, 1, tee);
assert.equal(g.height(1), 1);
assert.equal(g.height(2), 2);
assert.equal(g.height(3), 1);

// The shape must fit as a whole. This T has a stem under its middle, so it needs 2 free rows under all
// three of its columns at once. Checking each column alone would let it in when the ends have 1 free row.
const stack = (x, n) => {
	for (let y = 0; y < n; y++) g.grid[g.index(x, y)] = g.makeBlock((x + y) % 5);
};
g = new Game({ lab: { grid: 'small' }, seed: 4 });
g.grid.fill(null);
assert.equal(g.rows, 8);
stack(0, 7); // 1 free row
stack(1, 6); // 2 free rows
stack(2, 7); // 1 free row
assert.equal(g.fits(tee, 0), false, 'the stem would stick out of the bottom, so the T does not fit');
assert.equal(g.fits(tee, 3), true, 'on an empty part of the well it fits');
g = new Game({ lab: { grid: 'small' }, seed: 4 });
g.grid.fill(null);
stack(0, 6);
stack(1, 6);
stack(2, 6);
assert.equal(g.fits(tee, 0), true, 'with 2 free rows under every column it fits');

// A piece with a gap in its shape rests as a shape first, then the loose blocks rise to close the gap.
const ess = { id: 97, w: 3, h: 2, cells: [{ dx: 1, dy: 0, color: 0 }, { dx: 2, dy: 0, color: 1 }, { dx: 0, dy: 1, color: 2 }, { dx: 1, dy: 1, color: 3 }] };
g = new Game({ lab: { grid: 'small' }, seed: 5 });
g.grid.fill(null);
g.pieces[0] = ess;
g.placeRigid(0, 0, ess);
assert.equal(g.get(0, 1).color, 2, 'the left block rests one row down, as drawn');
assert.equal(g.get(0, 0), null, 'with a gap above it');
g.settle();
assert.equal(g.get(0, 0).color, 2, 'then it rises to the ceiling');
assert.equal(g.get(0, 1), null);

// The piece rises until its first block in some column hits a stack, so a tall stack holds the whole shape low.
g = new Game({ lab: { grid: 'small' }, seed: 6 });
g.grid.fill(null);
stack(0, 3);
const bar = { id: 96, w: 3, h: 1, cells: [0, 1, 2].map((dx) => ({ dx, dy: 0, color: dx })) };
assert.deepEqual(g.landing(bar, 0).map((l) => l.y), [3, 3, 3]);
g.pieces[0] = bar;
g.placeRigid(0, 0, bar);
assert.equal(g.get(1, 3).color, 1, 'the bar rests under the stack as one flat row');
g.settle();
assert.equal(g.get(1, 0).color, 1, 'then the loose blocks rise');
assert.equal(g.get(0, 3).color, 0, 'the block under the stack stays');

// The default place settles at once.
g = new Game({ lab: { grid: 'small' }, seed: 7 });
g.grid.fill(null);
g.pieces[0] = bar;
g.place(0, 0, bar);
assert.equal(g.get(2, 0).color, 2);


// A new game starts with an empty board.
g = new Game({ lab: { grid: 'medium' }, seed: 7 });
assert.equal(count(g), 0, 'the board starts empty');

// A full clear only pays the bonus when the board had enough blocks.
g = board(['111...']);
assert.equal(g.resolveStep(1).allClear, false, 'small board: no all-clear');
g = board(['111222', '111222']);
g.grid[g.index(5, 1)] = null;
assert.equal(g.resolveStep(1).allClear, true);

// Remix keeps the filled cells and the count of each color, moves the blocks around, and normally leaves no match.
g = board(['010101', '101010', '010101', '2.3.2.']);
g.bag = ['remix'];
const tally = () => {
	const t = {};
	for (const b of g.grid) if (b) t[b.color] = (t[b.color] || 0) + 1;
	return t;
};
const filled = g.grid.map((b) => Boolean(b));
const tallyBefore = tally();
const idsBefore = g.grid.filter(Boolean).map((b) => b.id).sort((a, b) => a - b);
const moves = g.useRemix();
assert.ok(moves);
assert.deepEqual(g.grid.filter(Boolean).map((b) => b.id).sort((a, b) => a - b), idsBefore, 'the same blocks, only moved');
assert.equal(moves.length, idsBefore.length, 'every block is listed in the moves');
for (const m of moves) assert.equal(g.grid[m.to], m.block, 'a move says where the block ended up');
assert.ok(moves.filter((m) => m.from !== m.to).length >= moves.length / 2, 'most blocks change cells');
assert.deepEqual(g.grid.map((b) => Boolean(b)), filled);
assert.deepEqual(tally(), tallyBefore);
assert.equal(g.findGroups().length, 0, 'remix leaves no match when it can avoid one');

// A board with no free move but a blast in the bag is not stuck.
g = new Game({ lab: { grid: 'small' }, seed: 9 });
g.grid.fill(null);
for (let i = 0; i < g.grid.length; i++) g.grid[i] = g.makeBlock(i % 3);
assert.equal(g.hasMove(), false);
assert.equal(g.stuck, true);
g.bag = ['blast'];
assert.equal(g.stuck, false);

// Glints: a step earns (chain - 1) + (group multiplier - 1), and a full clear earns a bonus.
assert.equal(glintsFor(1, 1), 0, 'a plain clear earns nothing');
assert.equal(glintsFor(2, 1), 1);
assert.equal(glintsFor(3, 3), 4);
assert.equal(glintsForAllClear(1, 1), 10);
g = board(['11111.']);
assert.equal(g.resolveStep(1).glints, 1, 'a group of 5 earns 1');
assert.equal(g.glints, 1, 'the run total keeps the glints');
g = board(['111...']);
assert.equal(g.resolveStep(2).glints, 1, 'chain step 2 earns 1');

// Second wind clears the bottom rows of the stack, once per game.
g = new Game({ lab: { grid: 'small' }, seed: 12 });
g.grid.fill(null);
for (let x = 0; x < g.cols; x++) for (let y = 0; y < 7; y++) g.grid[g.index(x, y)] = g.makeBlock((x + y) % 5);
const colsFull = g.cols;
assert.equal(g.canSecondWind, true);
const gone = g.useSecondWind();
assert.equal(gone.length, colsFull * SECOND_WIND_ROWS, 'the 4 lowest rows are cleared');
assert.equal(g.height(0), 3, 'the top 3 rows stay');
assert.ok(gone.every((c) => c.y >= 3), 'only the rows farthest from the ceiling go');
assert.equal(g.canSecondWind, false, 'only once per game');
assert.equal(g.useSecondWind(), null);

// On a ragged stack the bottom rows are counted from the lowest block.
g = new Game({ lab: { grid: 'small' }, seed: 13 });
g.grid.fill(null);
for (const [x, h] of [[0, 8], [1, 4], [2, 6]]) for (let y = 0; y < h; y++) g.grid[g.index(x, y)] = g.makeBlock((x + y) % 5);
g.useSecondWind();
assert.deepEqual([0, 1, 2].map((x) => g.height(x)), [4, 4, 4], 'rows 4 to 7 go; shorter columns keep what is above that');


// The daily seed: the same date gives the same pieces in the same order, whatever else happens.
assert.equal(dailySeed('2026-11-07'), dailySeed('2026-11-07'));
assert.notEqual(dailySeed('2026-11-07'), dailySeed('2026-11-08'));
const dealt = (seed, useStuff) => {
	const game = new Game({ mode: 'daily', lab: { grid: 'medium' }, seed });
	const out = game.pieces.map((p) => JSON.stringify(p.cells));
	for (let i = 0; i < 12; i++) {
		if (useStuff) {
			game.bag.push('remix');
			game.grid[game.index(0, 0)] = game.makeBlock(1);
			game.grid[game.index(1, 0)] = game.makeBlock(2);
			game.useRemix();
			game.drawPower();
		}
		game.refill(i % 2);
		out.push(JSON.stringify(game.pieces[i % 2].cells));
	}
	return out;
};
assert.deepEqual(dealt(dailySeed('2026-11-07'), false), dealt(dailySeed('2026-11-07'), true), 'power-ups and Remix do not change which pieces come');

// Reroll swaps the whole tray, and costs more each time in a game.
g = new Game({ lab: { grid: 'medium' }, seed: 31 });
assert.equal(g.rerollCost, REROLL_COST);
const trayBefore = g.pieces.map((p) => p.id);
g.reroll();
assert.equal(g.pieces.length, 2);
assert.ok(g.pieces.every((p, i) => p.id !== trayBefore[i]), 'both pieces are new');
assert.equal(g.rerollCost, REROLL_COST + REROLL_STEP);

// A banned shape never shows up.
g = new Game({ lab: { grid: 'large' }, seed: 33, banned: 0 });
const bannedArt = JSON.stringify(SHAPES[0].map(([dx, dy]) => ({ dx, dy })));
for (let i = 0; i < 3000; i++) {
	const p = g.makePiece();
	assert.notEqual(JSON.stringify(p.cells.map(({ dx, dy }) => ({ dx, dy }))), bannedArt, 'the banned shape is skipped');
}
const seenWithBan = new Set();
for (let i = 0; i < 4000; i++) seenWithBan.add(JSON.stringify(g.makePiece().cells.map(({ dx, dy }) => [dx, dy])));
assert.equal(seenWithBan.size, SHAPES.length - 1, 'every other shape still shows up');

// A bigger bag holds more power-ups.
g = new Game({ lab: { grid: 'small' }, seed: 35, bagSize: 5 });
for (let i = 0; i < 5; i++) assert.equal(g.awardChain(REWARD_CHAIN).lost, false);
assert.equal(g.awardChain(REWARD_CHAIN).lost, true);
assert.equal(g.bag.length, 5);

// A column is in danger when fewer than 3 rows are free, and the danger grows with each block.
g = new Game({ lab: { grid: 'small' }, seed: 36 });
g.grid.fill(null);
assert.equal(g.rows, 8);
stack(0, 5); // 3 free rows
stack(1, 6); // 2 free rows
stack(2, 8); // 0 free rows
assert.equal(g.dangerOf(0), 0, '3 free rows is still safe');
assert.equal(g.dangerOf(1), 1);
assert.equal(g.dangerOf(2), 3);
assert.equal(g.dangerOf(3), 0, 'an empty column is safe');

// A cell index turns into its column and row.
g = new Game({ lab: { grid: 'small' }, seed: 37 });
assert.equal(g.columnOf(g.index(4, 2)), 4);
assert.equal(g.rowOf(g.index(4, 2)), 2);

// A cell touches 2 neighbors in a corner, 3 on an edge, and 4 in the middle. Diagonals do not count.
const bySize = (list) => list.slice().sort((a, b) => a - b);
assert.deepEqual(bySize(g.neighborsOf(g.index(0, 0))), bySize([g.index(1, 0), g.index(0, 1)]));
assert.equal(g.neighborsOf(g.index(g.cols - 1, g.rows - 1)).length, 2);
assert.equal(g.neighborsOf(g.index(3, 0)).length, 3);
assert.equal(g.neighborsOf(g.index(3, 3)).length, 4);

console.log('engine ok');
