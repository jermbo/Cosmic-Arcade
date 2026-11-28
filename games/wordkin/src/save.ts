// Settings, daily results and stats in localStorage. A new version wipes old saves.
import { dayBefore } from './core/rng.ts';
import { EARN } from './core/economy.ts';
import type { Difficulty, ModeId } from './core/types.ts';

const KEY = 'wordkin';
const VERSION = 1;

export interface Settings {
	sound: boolean;
	haptics: boolean;
	lessMotion: boolean;
	difficulty: Difficulty;
	/** The cozy kit style: soft clay or bold ink. */
	style: 'soft' | 'bold';
}

export interface DailyResult {
	won: boolean;
	stars: number;
	score: number;
	share: string;
}

export interface ModeStats {
	played: number;
	won: number;
	bestScore: number;
	streak: number;
	bestStreak: number;
	lastDaily: string | null;
}

interface SaveData {
	version: number;
	settings: Settings;
	seenHelp: Partial<Record<ModeId, boolean>>;
	daily: Record<string, DailyResult>;
	stats: Record<ModeId, ModeStats>;
	/** Kin Book: group id → times solved and the first date. */
	book: Record<string, { n: number; first: string }>;
	/** The set id whose hat Kip wears, or null. */
	hat: string | null;
	/** Daily chain results: `diff|date` → guesses and whether it was solved. */
	chain: Record<string, { guesses: string[]; won: boolean; done: boolean }>;
	/** Wins of the daily chain in a row, per difficulty does not matter. */
	chainStreak: { streak: number; best: number; last: string | null };
	/** Shop: the coin balance, what is owned in each section, and what is in use. */
	coins: number;
	owned: Record<string, string[]>;
	looks: { theme: string; tiles: string; sound: string; motion: string };
	/** Endless Run and Blitz bests. */
	best: { runPuzzles: number; runScore: number; blitz: number };
	seenRun: boolean;
}

const freshStats = (): ModeStats => ({ played: 0, won: 0, bestScore: 0, streak: 0, bestStreak: 0, lastDaily: null });

function fresh(): SaveData {
	const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	return {
		version: VERSION,
		settings: { sound: true, haptics: true, lessMotion: reduced, difficulty: 'medium', style: 'soft' },
		seenHelp: {},
		daily: {},
		stats: { crack: freshStats(), secret: freshStats(), link: freshStats(), blitz: freshStats() },
		book: {},
		hat: null,
		chain: {},
		chainStreak: { streak: 0, best: 0, last: null },
		coins: EARN.start,
		owned: { theme: ['oat', 'plum'], tiles: ['classic'], sound: ['paper'], motion: ['bouncy'] },
		looks: { theme: 'oat', tiles: 'classic', sound: 'paper', motion: 'bouncy' },
		best: { runPuzzles: 0, runScore: 0, blitz: 0 },
		seenRun: false,
	};
}

function load(): SaveData {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const data = JSON.parse(raw) as SaveData;
			if (data.version === VERSION) {
				const base = fresh();
				data.settings.difficulty ??= 'medium';
				data.settings.style ??= 'soft';
				data.book ??= base.book;
				data.hat ??= null;
				data.chain ??= base.chain;
				data.chainStreak ??= base.chainStreak;
				data.stats.blitz ??= freshStats();
				data.coins ??= base.coins;
				data.owned ??= base.owned;
				data.looks ??= base.looks;
				// Theme ids from before the cozy kit. The kit's free themes are owned by everyone.
				const alias: Record<string, string> = { paper: 'oat', sorbet: 'blossom', meadow: 'sage', dusk: 'plum' };
				data.looks.theme = alias[data.looks.theme] ?? data.looks.theme;
				data.owned.theme = [...new Set([...base.owned.theme, ...(data.owned.theme ?? []).map((id) => alias[id] ?? id)])];
				data.best ??= base.best;
				data.seenRun ??= false;
				return data;
			}
		}
	} catch {
		// Private mode or bad data: start fresh.
	}
	return fresh();
}

export const save: SaveData = load();

export function persist(): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(save));
	} catch {
		// Storage is full or blocked. The game goes on.
	}
}

// One daily per mode and difficulty. Older saves have keys without a difficulty: those were medium-like, so they are ignored.
const dailyKey = (mode: ModeId, diff: Difficulty, date: string) => `${mode}|${diff}|${date}`;

export function dailyResult(mode: ModeId, diff: Difficulty, date: string): DailyResult | undefined {
	return save.daily[dailyKey(mode, diff, date)];
}

/** Records a finished game. Returns true for a new best score. */
export function recordGame(mode: ModeId, diff: Difficulty, date: string | null, result: DailyResult): boolean {
	const s = save.stats[mode];
	s.played++;
	if (result.won) s.won++;
	const best = result.score > s.bestScore;
	if (best) s.bestScore = result.score;
	if (date) {
		save.daily[dailyKey(mode, diff, date)] = result;
		if (result.won) {
			// A second win on the same day (another difficulty) keeps the streak as it is.
			if (s.lastDaily !== date) s.streak = s.lastDaily === dayBefore(date) ? s.streak + 1 : 1;
			s.bestStreak = Math.max(s.bestStreak, s.streak);
			s.lastDaily = date;
		} else if (s.lastDaily !== date) {
			s.streak = 0;
		}
	}
	persist();
	return best;
}

export function chainState(diff: Difficulty, date: string) {
	return save.chain[`${diff}|${date}`] ?? { guesses: [], won: false, done: false };
}

/** Saves the chain after each guess. A win on a new day grows the chain streak. */
export function recordChain(diff: Difficulty, date: string, guesses: string[], won: boolean, done: boolean): void {
	save.chain[`${diff}|${date}`] = { guesses, won, done };
	const s = save.chainStreak;
	if (won && s.last !== date) {
		s.streak = s.last === dayBefore(date) ? s.streak + 1 : 1;
		s.best = Math.max(s.best, s.streak);
		s.last = date;
	}
	persist();
}

export function resetAll(): void {
	const settings = save.settings;
	const { book, hat, coins, owned, looks } = save;
	// The Kin Book and the shop are things you own, not stats: they stay.
	Object.assign(save, fresh(), { settings, book, hat, coins, owned, looks });
	persist();
}
