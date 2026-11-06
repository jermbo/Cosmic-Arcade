// Checks the match, chain and power-up rules on hand-made boards. Run: node tools/rules-test.js
import assert from 'node:assert/strict';
import { Game, CHAIN_REWARDS, BAG_SIZE } from '../src/js/engine.js';

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

// Rewards: the highest tier reached.
const [high, mid, low] = CHAIN_REWARDS;
g = board(['0.....']);
assert.equal(g.rewardFor(low.chain - 1), null);
assert.equal(g.rewardFor(low.chain), 'prism');
assert.equal(g.rewardFor(mid.chain), 'blast');
assert.equal(g.rewardFor(high.chain + 3), 'remix');

// The bag has a limit, and a reward that does not fit is lost.
for (let i = 0; i < BAG_SIZE; i++) assert.equal(g.awardChain(low.chain).lost, false);
assert.equal(g.awardChain(low.chain).lost, true);
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

// A new game starts with an empty board.
g = new Game({ lab: { grid: 'medium' }, seed: 7 });
assert.equal(count(g), 0, 'the board starts empty');

// A full clear only pays the bonus when the board had enough blocks.
g = board(['111...']);
assert.equal(g.resolveStep(1).allClear, false, 'small board: no all-clear');
g = board(['111222', '111222']);
g.grid[g.index(5, 1)] = null;
assert.equal(g.resolveStep(1).allClear, true);

// Remix keeps every position and the count of each color, and normally leaves no match.
g = board(['010101', '101010', '010101', '2.3.2.']);
g.bag = ['remix'];
const tally = () => {
	const t = {};
	for (const b of g.grid) if (b) t[b.color] = (t[b.color] || 0) + 1;
	return t;
};
const filled = g.grid.map((b) => Boolean(b));
const tallyBefore = tally();
assert.ok(g.useRemix());
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

console.log('rules ok');
