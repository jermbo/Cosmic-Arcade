/**
 * The puzzle maker.
 *
 * 1. Make a random full window (every tile has a number and a color).
 * 2. Start with every number and color shown (32 clues).
 * 3. In a random order, try to hide each clue. Keep it hidden only if the human
 *    solver can still finish the window with the rules allowed for this level.
 * 4. Check the puzzle really needs the level's hardest rule. If not, try again.
 *
 * Because the human solver only makes sound deductions, "it can finish" also means
 * "exactly one solution". The tests check that with the exact solver too.
 */
import { CELLS } from './grid.ts';
import type { Tier } from './logic.ts';
import { solveLogically } from './logic.ts';
import { hashSeed, makeRng, shuffle } from './rng.ts';
import { randomSolution } from './solve.ts';
import type { Board, Level, Puzzle, Rating } from './types.ts';
import { copyBoard } from './types.ts';

/** The rule tier each level needs. Tune here. */
export const LEVEL_TIER: Record<Level, Tier> = { easy: 1, medium: 2, hard: 3, expert: 4 };

/** How much one step of each tier adds to the score. */
const STEP_WEIGHT = [0, 1, 2, 4, 7];

export function rate(givens: Board): Rating | null {
	const run = solveLogically(givens);
	if (!run.solved) return null;
	const steps = [0, 0, 0, 0, 0];
	for (const s of run.steps) steps[s.tier]++;
	const maxTier = Math.max(...run.steps.map((s) => s.tier), 1);
	const clues = givens.num.filter((v) => v >= 0).length + givens.color.filter((v) => v >= 0).length;
	const score = run.steps.reduce((sum, s) => sum + STEP_WEIGHT[s.tier], 0);
	return { maxTier, steps, score, clues };
}

/** One try at a puzzle that needs exactly `tier`. Returns null when it came out easier. */
function attempt(seed: number, tier: Tier): { givens: Board; solution: Board } | null {
	const rng = makeRng(seed);
	const solution = randomSolution(rng);
	const givens = copyBoard(solution);
	const clues = shuffle(Array.from({ length: CELLS * 2 }, (_, i) => i), rng);
	for (const clue of clues) {
		const list = clue < CELLS ? givens.num : givens.color;
		const at = clue % CELLS;
		const keep = list[at];
		list[at] = -1;
		if (!solveLogically(givens, tier).solved) list[at] = keep;
	}
	if (tier > 1 && solveLogically(givens, (tier - 1) as Tier).solved) return null;
	return { givens, solution };
}

/**
 * How many good tries to make per puzzle; the one that leans hardest on its
 * level's rule wins. More tries give tougher Hard and Expert puzzles. Tune here.
 */
export const TRIES: Record<Level, number> = { easy: 1, medium: 3, hard: 8, expert: 8 };

export function makePuzzle(id: string, seedText: string, level: Level): Puzzle {
	const tier = LEVEL_TIER[level];
	let best: Puzzle | null = null;
	let good = 0;
	for (let n = 0; good < TRIES[level]; n++) {
		const seed = hashSeed(`${seedText}#${n}`);
		const made = attempt(seed, tier);
		if (!made) continue;
		good++;
		const rating = rate(made.givens)!;
		const value = rating.steps[tier] * 100 + rating.score;
		if (!best || value > best.rating.steps[tier] * 100 + best.rating.score)
			best = { id, seed, level, givens: made.givens, solution: made.solution, rating };
	}
	return best!;
}
