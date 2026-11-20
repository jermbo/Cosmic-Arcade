// Checks the match, chain and power-up rules on hand-made boards. Run: node tools/engine-test.js
import assert from 'node:assert/strict';
import { Game } from '../src/js/rules/game.js';
import { dailySeed } from '../src/js/rules/random.js';
import { POWER_KINDS, REWARD_CHAIN, REWARD_GROUP, BAG_SIZE } from '../src/js/rules/power-ups.js';
import { SECOND_WIND_ROWS } from '../src/js/rules/second-wind.js';
import { timeForTurn, TIME_FOR_CHAIN, TIME_FOR_BIG_GROUP, BIG_GROUP } from '../src/js/rules/timed-mode.js';
import { REROLL_COST, REROLL_STEP } from '../src/js/shop/prices.js';

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

// A clear can pull two groups together and start a chain.
g = board(['1.....', '000...', '11....']);
g.resolveStep(1);
assert.equal(g.resolveStep(2).cleared.length, 3, 'the 1s now touch');

// Points: the chain step and the group size multiply, and each group pays by its own size.
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

// A piece is never one color, so it never clears by itself.
g = new Game({ lab: { grid: 'large' }, seed: 11 });
for (let i = 0; i < 500; i++) assert.ok(new Set(g.makePiece().cells.map((c) => c.color)).size > 1, 'a piece is never one color');

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

// Plunks: a step pays for its chain step and its group size, and the run keeps the total.
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

// The tray: a used slot stays empty while the other slot has a piece.
g = new Game({ lab: { grid: 'medium' }, seed: 41 });
g.grid.fill(null);
const keep = g.pieces[1];
assert.ok(g.place(0, 0));
assert.deepEqual(g.refillTray(), [], 'no refill while a piece is left');
assert.equal(g.pieces[0], null, 'slot 1 is empty');
assert.equal(g.pieces[1], keep, 'slot 2 still has its piece');

// A reroll swaps only the pieces in the tray. The empty slot stays empty.
g.reroll();
assert.equal(g.pieces[0], null, 'the empty slot stays empty after a reroll');
assert.ok(g.pieces[1] && g.pieces[1].id !== keep.id, 'slot 2 gets a new piece');

// When both slots are used, both get a new piece at the same time.
assert.ok(g.place(1, 3));
assert.deepEqual(g.refillTray(), [0, 1]);
assert.ok(g.pieces.every(Boolean), 'two new pieces');

// A Lab tray of 3 refills only when all 3 are used.
g = new Game({ lab: { grid: 'large', pieces: 3 }, seed: 42 });
g.grid.fill(null);
g.place(0, 0);
assert.deepEqual(g.refillTray(), []);
g.place(1, 4);
assert.deepEqual(g.refillTray(), [], 'one piece is left, so no refill');
g.place(2, 0);
assert.deepEqual(g.refillTray(), [0, 1, 2]);

// The game is over when the piece left does not fit and there is no Blast. A Blast keeps it going.
g = board(['000000', '111111', '000000', '111111', '000000', '111111', '000000', '.11111']);
g.pieces = [null, { id: 900, w: 2, h: 1, cells: [{ dx: 0, dy: 0, color: 2 }, { dx: 1, dy: 0, color: 3 }] }];
assert.equal(g.stuck, true, 'slot 1 is empty and slot 2 does not fit');
g.bag.push('blast');
assert.equal(g.stuck, false, 'a Blast can still make room');

// Timed: a chain longer than the table adds the most time, and a big group adds its bonus on top.
const top = Math.max(...Object.keys(TIME_FOR_CHAIN).map(Number));
assert.equal(timeForTurn(top + 3), timeForTurn(top), 'a longer chain adds the time of the longest in the table');
assert.equal(timeForTurn(3, BIG_GROUP), timeForTurn(3) + TIME_FOR_BIG_GROUP, 'a big group adds its bonus');
assert.equal(timeForTurn(3, BIG_GROUP - 1), timeForTurn(3), 'a smaller group adds nothing');

// An automatic Prism paints both tray pieces the color with the biggest clear.
// Here two Tide (3) blocks wait at the ceiling: a Tide piece under them clears.
g = board(['33....', '......'], { grid: 'small' });
g.mode = 'timed';
const dot = (id) => ({ id, w: 1, h: 1, cells: [{ dx: 0, dy: 0, color: 0 }] });
const bar2 = (id) => ({ id, w: 2, h: 1, cells: [{ dx: 0, dy: 0, color: 0 }, { dx: 1, dy: 0, color: 1 }] });
g.pieces = [bar2(501), dot(502)];
g.bag.push('prism');
assert.equal(g.bestPrismColor(), 3, 'Tide gives the biggest clear');
assert.equal(g.autoPrism(), 3);
assert.ok(g.pieces.every((p) => p.cells.every((c) => c.color === 3)), 'both tray pieces are Tide');
assert.equal(g.bag.length, 0, 'the Prism is used');

// The color it picks gives a clear at least as big as any other color.
for (let seed = 50; seed < 70; seed++) {
	const game = new Game({ mode: 'timed', lab: { grid: 'medium' }, seed });
	for (let i = 0; i < 25; i++) game.grid[(i * 7 + seed) % game.grid.length] = game.makeBlock((i * 3 + seed) % 4);
	game.applyGravity();
	game.resolveAll();
	const pick = game.bestPrismColor();
	const most = (color) => {
		let m = 0;
		for (const p of game.pieces) {
			const painted = { ...p, cells: p.cells.map((c) => ({ ...c, color })) };
			for (let x = 0; x <= game.cols - p.w; x++) if (game.fits(painted, x)) m = Math.max(m, game.clearedBy(painted, x));
		}
		return m;
	};
	for (let c = 0; c < game.colors; c++) assert.ok(most(pick) >= most(c), 'no other color gives a bigger clear');
	for (let c = 0; c < pick; c++) assert.ok(most(c) < most(pick), 'a tie goes to the lower color');
}

// An automatic Blast aims at the 3x3 area with the most blocks; a tie goes to the area nearest the tray.
g = board(['1.....', '1.....', '......', '......', '......', '...2..', '...2..', '......']);
assert.equal(g.bestBlastCell().y, 6, 'a tie goes to the area nearest the tray');
g = board(['111...', '111...', '......', '......', '......', '...2..', '...2..', '......']);
assert.deepEqual(g.bestBlastCell(), { x: 1, y: 1 }, 'the area with the most blocks');
g.bag.push('blast');
assert.equal(g.autoUse('blast'), true);
assert.equal(count(g), 2, 'the blast clears its area');

console.log('engine ok');
