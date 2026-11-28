/**
 * Puzzle tests. Run with `npm test`.
 *
 * For many practice and daily puzzles:
 * - exactly one answer (exact solver), and the stored answer is a real one:
 *   every square used once, each line a chain of neighbors from dot to dot,
 *   no line touches itself, no line shorter than 3;
 * - the same seed always makes the same puzzle;
 * - drawing each answer line with drags solves it; hints alone solve it;
 * - a drag that crosses a line cuts it, and pulling back brings it back;
 * - Endless: clock boards grow on time; each road stop starts where the last
 *   one left, and its road runs from the left edge to the right edge.
 */
import { dragTo, dragView, emptyPaths, hintColor, isSolved, showLine, startDrag } from '../src/app/game.ts';
import type { Paths } from '../src/app/game.ts';
import { addDays, dailyPuzzle, practicePuzzle } from '../src/core/daily.ts';
import { clockBoard, clockSize, entryRow, exitRow, roadBoard, roadSize } from '../src/core/endless.ts';
import { makePuzzle } from '../src/core/generate.ts';
import { isNext, neighbors } from '../src/core/grid.ts';
import { solve } from '../src/core/solve.ts';
import type { Puzzle } from '../src/core/types.ts';
import { LEVEL_SHAPE, LEVELS, PALETTE } from '../src/core/types.ts';

const PER_LEVEL = Number(process.env.PER_LEVEL ?? 60);
const DAYS = Number(process.env.DAYS ?? 42);

let failures = 0;
const fail = (msg: string) => {
	failures++;
	if (failures < 30) console.error('FAIL', msg);
};

function checkPuzzle(p: Puzzle, endless = false) {
	const n = p.w * p.h;
	const nb = neighbors(p.w, p.h);
	if (!endless) {
		const shape = LEVEL_SHAPE[p.level];
		if (p.w !== shape.size || p.h !== shape.size) fail(`${p.id}: wrong size`);
		if (p.pairs.length < shape.colors[0] || p.pairs.length > shape.colors[1]) fail(`${p.id}: ${p.pairs.length} colors is out of range`);
	}
	if (p.pairs.length > PALETTE) fail(`${p.id}: more colors than the palette`);
	const used = new Int8Array(n).fill(-1);
	p.solution.forEach((line, k) => {
		const { a, b } = p.pairs[k];
		if (line[0] !== a || line[line.length - 1] !== b) fail(`${p.id}: line ${k} does not run dot to dot`);
		if (line.length < 3) fail(`${p.id}: line ${k} is too short`);
		line.forEach((c, i) => {
			if (used[c] >= 0) fail(`${p.id}: square ${c} used twice`);
			used[c] = k;
			if (i > 0 && !isNext(p.w, line[i - 1], c)) fail(`${p.id}: line ${k} jumps`);
		});
		const at = new Map(line.map((c, i) => [c, i]));
		for (const [c, i] of at) for (const m of nb[c]) {
			const j = at.get(m);
			if (j !== undefined && Math.abs(i - j) > 1) fail(`${p.id}: line ${k} touches itself`);
		}
	});
	if (used.some((u) => u < 0)) fail(`${p.id}: a square is empty in the answer`);
	const res = solve(p.w, p.h, p.pairs, 2, 2_000_000);
	if (res.gaveUp) fail(`${p.id}: solver gave up`);
	else if (res.count !== 1) fail(`${p.id}: ${res.count} answers`);
}

/** Draws every answer line with drags, as a player would. */
function checkDrawing(p: Puzzle) {
	let paths: Paths = emptyPaths(p);
	p.solution.forEach((line, k) => {
		let d = startDrag(p, paths, line[0]);
		if (!d || d.color !== k) return fail(`${p.id}: can't start line ${k}`);
		for (const c of line.slice(1)) d = dragTo(p, d, c);
		paths = dragView(d);
	});
	if (!isSolved(p, paths)) fail(`${p.id}: drawing the answer does not solve it`);

	// Hints alone.
	let h: Paths = emptyPaths(p);
	for (let i = 0; i <= p.pairs.length; i++) {
		const k = hintColor(p, h);
		if (k < 0) break;
		h = showLine(p, h, k);
	}
	if (!isSolved(p, h)) fail(`${p.id}: hints alone do not solve it`);
}

/** A drag across another line cuts it; pulling back before letting go restores it. */
function checkCut() {
	const p: Puzzle = {
		id: 'cut',
		seed: 0,
		level: 'easy',
		w: 3,
		h: 3,
		pairs: [
			{ a: 0, b: 2 },
			{ a: 6, b: 8 },
		],
		solution: [],
	};
	const base: Paths = [[0, 1, 2], []];
	let d = startDrag(p, base, 6)!;
	d = dragTo(p, d, 3);
	d = dragTo(p, d, 4);
	d = dragTo(p, d, 1);
	const cut = dragView(d);
	if (cut[0].length !== 0 || cut[1].join() !== '6,3,4,1') fail(`cut: got ${JSON.stringify(cut)}`);
	d = dragTo(p, d, 4);
	const back = dragView(d);
	if (back[0].join() !== '0,1,2') fail(`cut: line did not come back, got ${JSON.stringify(back)}`);
	// Another color's dot blocks the way.
	const blocked = dragTo(p, startDrag(p, base, 6)!, 7);
	const into = dragTo(p, blocked, 8);
	if (dragView(into)[1].join() !== '6,7,8') fail('cut: own dot should link');
	const wall = dragTo(p, startDrag(p, [[], []], 6)!, 3);
	if (dragTo(p, wall, 0) !== wall) fail('cut: another dot should block');
}

const start = performance.now();
let count = 0;
const timing: Record<string, number> = {};
for (const level of LEVELS) {
	const t = performance.now();
	for (let i = 0; i < PER_LEVEL; i++) {
		const p = practicePuzzle(level, i);
		checkPuzzle(p);
		checkDrawing(p);
		count++;
	}
	timing[level] = (performance.now() - t) / PER_LEVEL;
}
for (let i = 0; i < DAYS; i++) {
	const p = dailyPuzzle(addDays('2026-11-23', i));
	checkPuzzle(p);
	checkDrawing(p);
	count++;
}
const again = makePuzzle('x', 'hueway-practice-hard-3', 'hard');
if (JSON.stringify(again.pairs) !== JSON.stringify(practicePuzzle('hard', 3).pairs)) fail('same seed made a different puzzle');
checkCut();

// Endless.
for (let run = 0; run < 3; run++) {
	for (let n = 0; n < 12; n++) {
		const p = clockBoard(`t${run}`, n);
		if (p.w !== clockSize(n)) fail(`${p.id}: wrong clock size`);
		checkPuzzle(p, true);
		checkDrawing(p);
		count++;
	}
}
for (let trip = 0; trip < 4; trip++) {
	let entry: number | null = null;
	for (let n = 0; n < 24; n++) {
		const p = roadBoard(`t${trip}`, n, entry);
		const road = p.solution[0];
		if (p.w !== roadSize(n)) fail(`${p.id}: wrong road size`);
		if (road[0] % p.w !== 0) fail(`${p.id}: road does not start on the left edge`);
		if (road[road.length - 1] % p.w !== p.w - 1) fail(`${p.id}: road does not end on the right edge`);
		if (entry !== null && entryRow(p) !== entry) fail(`${p.id}: road starts in row ${entryRow(p)}, not ${entry}`);
		checkPuzzle(p, true);
		checkDrawing(p);
		entry = exitRow(p);
		count++;
	}
}

console.log(`Checked ${count} puzzles in ${((performance.now() - start) / 1000).toFixed(1)} s.`);
console.log('Average ms per puzzle (make + check):', Object.entries(timing).map(([l, ms]) => `${l} ${ms.toFixed(1)}`).join(', '));
if (failures) {
	console.error(`${failures} failures.`);
	process.exit(1);
}
console.log('All good.');
