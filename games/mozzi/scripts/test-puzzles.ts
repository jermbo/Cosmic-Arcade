/**
 * Puzzle tests. Run with `npm test`.
 *
 * For many generated puzzles (practice puzzles of every level, plus daily puzzles):
 * - exactly one solution (exact solver),
 * - the human solver finishes it with no guessing, and every step it takes is right,
 * - every "ruled out" reason is true and never rules out the real answer,
 * - the puzzle needs the hardest rule of its level, and no harder one,
 * - following only hints (from the clues, and from random part-filled boards) finishes it,
 * - a wrong entry is always pointed out first.
 * Also: random minimal puzzles (not from our generator) are all solved by the hint rules.
 */
import { addDays, dailyPuzzle, practicePuzzle } from '../src/core/daily.ts';
import { explain } from '../src/core/explain.ts';
import { LEVEL_TIER } from '../src/core/generate.ts';
import { CELLS, colOf, rowOf } from '../src/core/grid.ts';
import { getHint } from '../src/core/hints.ts';
import type { Candidates, Tier } from '../src/core/logic.ts';
import { applyFacts, known, solveLogically } from '../src/core/logic.ts';
import { makeRng, shuffle } from '../src/core/rng.ts';
import { countSolutions, randomSolution } from '../src/core/solve.ts';
import type { Board, Level, Puzzle } from '../src/core/types.ts';
import { LEVELS, copyBoard, emptyBoard } from '../src/core/types.ts';
import { sentenceText } from '../src/core/words.ts';

const PER_LEVEL = Number(process.env.PER_LEVEL ?? 130);
const DAYS = Number(process.env.DAYS ?? 70);

let failures = 0;
const fail = (msg: string) => {
	failures++;
	if (failures < 30) console.error('FAIL', msg);
};
const sameLine = (a: number, b: number) => rowOf(a) === rowOf(b) || colOf(a) === colOf(b);

/** Every cut must be true for this board and must never remove the real answer. */
function checkCandidates(p: Puzzle, cand: Candidates) {
	const b = cand.board;
	for (let i = 0; i < CELLS; i++) {
		const real = p.solution.num[i] * 4 + p.solution.color[i];
		if (!(cand.pairs[i] & (1 << real))) fail(`${p.id}: tile ${i} lost its real pair`);
		for (let q = 0; q < 16; q++) {
			const r = cand.why[i * 16 + q];
			if (cand.pairs[i] & (1 << q)) continue;
			if (!r) {
				fail(`${p.id}: a cut with no reason`);
				continue;
			}
			if (r.kind === 'line' && (known(b, r.axis)[r.by] !== r.value || !sameLine(i, r.by) || r.by === i))
				fail(`${p.id}: false line reason`);
			if (r.kind === 'pairUsed' && (b.num[r.by] * 4 + b.color[r.by] !== r.pair || r.by === i)) fail(`${p.id}: false pair reason`);
			if (r.kind === 'trade') {
				const [mine, partner] = r.known;
				const k = known(b, r.axis);
				if (k[mine] !== r.b || k[partner] !== r.a) fail(`${p.id}: false trade reason`);
				if (cand.options(r.mirror, r.axis) & (1 << r.b)) fail(`${p.id}: trade mirror could be ${r.b}`);
			}
		}
	}
}

const FALLBACKS = ['nothing it can still be', 'it can’t hold it'];
let fallbackCount = 0;

/** Follows hints only ("what" each time) until the window is done. */
function hintWalk(p: Puzzle, start: Board): number {
	const board = copyBoard(start);
	let hints = 0;
	for (let guard = 0; guard < 64; guard++) {
		const h = getHint(p, board);
		if (h.kind === 'done') return hints;
		if (h.kind !== 'step') {
			fail(`${p.id}: hint walk got "${h.kind}"`);
			return hints;
		}
		hints++;
		const ex = h.ex;
		for (const f of ex.facts) {
			const real = (f.axis === 'num' ? p.solution.num : p.solution.color)[f.cell];
			if (real !== f.value) fail(`${p.id}: hint placed a wrong value`);
		}
		const text = [ex.where, ex.question, ...ex.reasons.map((r) => r.says), ex.answer].map(sentenceText).join(' ');
		if (FALLBACKS.some((f) => text.includes(f))) fallbackCount++;
		if (ex.technique === 'onlySpot' && ex.reasons.length !== 3) fail(`${p.id}: only-spot hint must rule out 3 tiles`);
		if (ex.technique === 'lastOption' && ex.reasons.length !== 3) fail(`${p.id}: last-option hint must rule out 3 values`);
		applyFacts(board, ex.facts);
	}
	fail(`${p.id}: hint walk did not end`);
	return hints;
}

function checkPuzzle(p: Puzzle, rng: () => number) {
	const out = emptyBoard();
	if (countSolutions(p.givens, 2, out) !== 1) fail(`${p.id}: not exactly one solution`);
	if (out.num.join() !== p.solution.num.join() || out.color.join() !== p.solution.color.join()) fail(`${p.id}: solution differs`);

	const run = solveLogically(p.givens);
	if (!run.solved) fail(`${p.id}: human solver got stuck`);
	const board = copyBoard(p.givens);
	for (const s of run.steps) {
		checkCandidates(p, s.cand);
		for (const f of s.facts) if (known(p.solution, f.axis)[f.cell] !== f.value) fail(`${p.id}: solver placed a wrong value`);
		explain(s); // must not throw
		applyFacts(board, s.facts);
	}
	const tier = LEVEL_TIER[p.level];
	if (p.rating.maxTier !== tier) fail(`${p.id}: level ${p.level} but needs tier ${p.rating.maxTier}`);
	if (tier > 1 && solveLogically(p.givens, (tier - 1) as Tier).solved) fail(`${p.id}: easier than its level`);

	hintWalk(p, p.givens);
	// Random part-filled boards: the clues plus some correct parts.
	for (let t = 0; t < 4; t++) {
		const b = copyBoard(p.givens);
		const keep = rng();
		for (let i = 0; i < CELLS; i++) {
			if (rng() < keep) b.num[i] = p.solution.num[i];
			if (rng() < keep) b.color[i] = p.solution.color[i];
		}
		hintWalk(p, b);
	}
	// A wrong entry is found first.
	const open = Array.from({ length: CELLS }, (_, i) => i).filter((i) => p.givens.num[i] < 0);
	if (open.length) {
		const c = open[Math.floor(rng() * open.length)];
		const b = copyBoard(p.givens);
		b.num[c] = (p.solution.num[c] + 1 + Math.floor(rng() * 3)) % 4;
		const h = getHint(p, b);
		if (h.kind !== 'wrong' || h.cell !== c) fail(`${p.id}: wrong entry not found first`);
	}
}

const started = Date.now();
const rng = makeRng(12345);
const stats: Record<string, { n: number; clues: number[]; score: number[]; steps: number[]; top: number[] }> = {};
const note = (p: Puzzle) => {
	const s = (stats[p.level] ??= { n: 0, clues: [], score: [], steps: [], top: [] });
	s.n++;
	s.clues.push(p.rating.clues);
	s.score.push(p.rating.score);
	s.steps.push(p.rating.steps.reduce((a, b) => a + b, 0));
	s.top.push(p.rating.steps[p.rating.maxTier]);
};

let count = 0;
for (const level of LEVELS as Level[]) {
	for (let n = 0; n < PER_LEVEL; n++) {
		const p = practicePuzzle(level, n);
		checkPuzzle(p, rng);
		note(p);
		count++;
	}
}
let day = '2026-11-23';
for (let d = 0; d < DAYS; d++, day = addDays(day, 1)) {
	const p = dailyPuzzle(day);
	const again = dailyPuzzle(day);
	if (JSON.stringify(p.givens) !== JSON.stringify(again.givens)) fail(`${p.id}: daily is not stable`);
	checkPuzzle(p, rng);
	note(p);
	count++;
}

// Beyond our own generator: random puzzles cut down until any more hiding would allow
// a second solution (checked by the exact solver only). The human rules must solve all.
const MINIMAL = Number(process.env.MINIMAL ?? 300);
const needs = [0, 0, 0, 0, 0];
for (let s = 0; s < MINIMAL; s++) {
	const r = makeRng(9000 + s);
	const sol = randomSolution(r);
	const b = copyBoard(sol);
	for (const f of shuffle(Array.from({ length: 32 }, (_, i) => i), r)) {
		const list = f < 16 ? b.num : b.color;
		const keep = list[f % 16];
		list[f % 16] = -1;
		if (countSolutions(b, 2) !== 1) list[f % 16] = keep;
	}
	const run = solveLogically(b);
	if (!run.solved) fail(`minimal puzzle ${s}: the human rules got stuck`);
	else needs[Math.max(...run.steps.map((x) => x.tier))]++;
}

const range = (xs: number[]) => `${Math.min(...xs)}–${Math.max(...xs)} (avg ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)})`;
console.log(`Checked ${count} puzzles in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
for (const level of LEVELS) {
	const s = stats[level];
	console.log(
		`  ${level.padEnd(7)} ${String(s.n).padStart(4)} puzzles · clues ${range(s.clues)} · steps ${range(s.steps)} · hardest-rule steps ${range(s.top)} · score ${range(s.score)}`,
	);
}
console.log(
	`  ${MINIMAL} random minimal puzzles: all solved by the hint rules. Hardest rule needed: used pairs ${needs[2]}, pair hunt ${needs[3]}, trades ${needs[4]}.`,
);
if (fallbackCount) console.log(`  note: ${fallbackCount} hint texts used a fallback phrase`);
if (failures) {
	console.error(`${failures} failures.`);
	process.exit(1);
}
console.log('All puzzle checks passed.');
