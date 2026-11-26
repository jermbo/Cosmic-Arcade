// Builds puzzles from the group bank (or a hand-made puzzle), a seed and a difficulty.
import { BY_LEVEL, GROUPS, GROUPS_OF_WORD, HAND_PUZZLES } from './bank.ts';
import { makeRng, pick, shuffle, type Rng } from './rng.ts';
import { DIFFICULTY, TUNING } from './tuning.ts';
import type { Board, BoardGroup, CrackPuzzle, Difficulty, Group, Level, LinkPuzzle, ModeId, SecretPuzzle } from './types.ts';

interface BoardOpts {
	levels: Level[];
	maxLength?: number;
	/** Extra rule for the 4 words picked from one group. */
	accept?: (words: string[]) => boolean;
}

/** True when the word sits in some other bank group that is on the board too. */
function clashes(word: string, ownId: string, onBoard: Set<string>): boolean {
	for (const id of GROUPS_OF_WORD.get(word) ?? []) if (id !== ownId && onBoard.has(id)) return true;
	return false;
}

/**
 * 4 groups at the given bank levels, 4 words each, and no word that fits two groups.
 * Each group's `level` is then set to its place on the board (1 = easiest), which sets its color.
 */
export function buildBoard(rng: Rng, opts: BoardOpts): Board {
	const maxLength = opts.maxLength ?? 8;
	const levels = opts.levels.slice().sort((a, b) => a - b);
	for (let attempt = 0; attempt < 800; attempt++) {
		const picks = levels.map((l) => pick(rng, BY_LEVEL[l]));
		const ids = new Set(picks.map((g) => g.id));
		if (ids.size < 4) continue;
		const groups = pickWords(rng, picks, ids, maxLength, opts.accept);
		if (groups) return { groups, tiles: shuffle(rng, groups.flatMap((g) => g.words)) };
	}
	throw new Error('Could not build a board. Check the group bank.');
}

function pickWords(rng: Rng, picks: Group[], ids: Set<string>, maxLength: number, accept?: (w: string[]) => boolean): BoardGroup[] | null {
	const used = new Set<string>();
	const out: BoardGroup[] = [];
	for (const [i, g] of picks.entries()) {
		const pool = g.words.filter((w) => w.length <= maxLength && !used.has(w) && !clashes(w, g.id, ids));
		if (pool.length < 4) return null;
		let words: string[] | null = null;
		for (let k = 0; k < 6 && !words; k++) {
			const w = shuffle(rng, pool).slice(0, 4);
			if (!accept || accept(w)) words = w;
		}
		if (!words) return null;
		words.forEach((w) => used.add(w));
		out.push({ id: g.id, level: (i + 1) as Level, theme: g.theme, words });
	}
	return out;
}

/** The hand-made board for this date and mode, if there is one. */
function handBoard(rng: Rng, mode: ModeId, date?: string): Board | null {
	if (!date) return null;
	const hand = HAND_PUZZLES.find((p) => p.date === date && (!p.mode || p.mode === mode));
	if (!hand) return null;
	const groups: BoardGroup[] = hand.groups
		.map((g, i) => ({ id: `hand-${hand.id}-${i}`, level: g.level, theme: g.theme, words: g.words.map((w) => w.toUpperCase()) }))
		.sort((a, b) => a.level - b.level);
	return { groups, tiles: shuffle(rng, groups.flatMap((g) => g.words)) };
}

export function buildCrack(seed: string, diff: Difficulty, date?: string): CrackPuzzle {
	const D = DIFFICULTY[diff].crack;
	const rng = makeRng(seed);
	const fits = (w: string) => w.length >= D.minLength && w.length <= D.maxLength;
	const board = handBoard(rng, 'crack', date) ?? buildBoard(rng, { levels: DIFFICULTY[diff].levels, accept: (w) => w.some(fits) });
	const locked = board.groups.map((g) => {
		const fit = g.words.filter(fits);
		return fit.length ? pick(rng, fit) : g.words.slice().sort((a, b) => a.length - b.length)[0];
	});
	const hints = locked.map((w) => {
		const shown: (string | null)[] = [...w].map(() => null);
		if (D.showFirst) shown[0] = w[0];
		const rest = shuffle(rng, [...w].map((_, i) => i).filter((i) => shown[i] === null));
		for (const i of rest.slice(0, D.showExtra)) shown[i] = w[i];
		return shown;
	});
	return { board, locked, hints };
}

export function buildSecret(seed: string, diff: Difficulty, date?: string): SecretPuzzle {
	const D = DIFFICULTY[diff].secret;
	const rng = makeRng(seed);
	for (let attempt = 0; attempt < 50; attempt++) {
		const board = handBoard(rng, 'secret', date) ?? buildBoard(rng, { levels: DIFFICULTY[diff].levels });
		const onBoard = new Set(board.groups.map((g) => g.id));
		const words = new Set(board.tiles);
		const choices: { word: string; clue: string }[] = [];
		for (const g of GROUPS) {
			if (g.level > 2 || onBoard.has(g.id)) continue;
			for (const w of g.words) {
				if (w.length < D.minLength || w.length > D.maxLength || words.has(w) || clashes(w, g.id, onBoard)) continue;
				choices.push({ word: w, clue: g.theme });
			}
		}
		if (!choices.length) continue;
		const { word, clue } = pick(rng, choices);
		const spots = shuffle(rng, [...word].map((_, i) => i)).slice(0, board.groups.length);
		return { board, word, clue, reveal: spots };
	}
	throw new Error('Could not pick a secret word.');
}

export function buildLink(seed: string, diff: Difficulty, date?: string): LinkPuzzle {
	const D = DIFFICULTY[diff];
	const rng = makeRng(seed);
	const board = handBoard(rng, 'link', date) ?? buildBoard(rng, { levels: D.levels, maxLength: TUNING.link.maxLength });
	const onBoard = new Set(board.groups.map((g) => g.id));
	const rounds = board.groups.map((group) => {
		const own = GROUPS.find((g) => g.id === group.id);
		const level = own?.level ?? group.level;
		const decoys = GROUPS.filter((g) => !onBoard.has(g.id) && g.theme !== group.theme && !group.words.some((w) => g.words.includes(w)));
		// Prefer decoys near the same level, so the choice is not a give-away.
		const near = decoys.filter((g) => Math.abs(g.level - level) <= 1);
		const pool = shuffle(rng, near.length >= D.link.options - 1 ? near : decoys);
		const options = shuffle(rng, [group.theme, ...pool.slice(0, D.link.options - 1).map((g) => g.theme)]);
		return { group, options };
	});
	return { rounds };
}

export function seedFor(mode: ModeId, diff: Difficulty, date: string | null): string {
	return date ? `${mode}|${diff}|${date}` : `${mode}|${diff}|p|${Math.random().toString(36).slice(2)}`;
}
