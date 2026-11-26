// Settings, daily results and stats in localStorage. A new version wipes old saves.
import { dayBefore } from './core/rng.ts';
import type { Difficulty, ModeId } from './core/types.ts';

const KEY = 'wordkin';
const VERSION = 1;

export interface Settings {
	sound: boolean;
	haptics: boolean;
	lessMotion: boolean;
	difficulty: Difficulty;
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
}

const freshStats = (): ModeStats => ({ played: 0, won: 0, bestScore: 0, streak: 0, bestStreak: 0, lastDaily: null });

function fresh(): SaveData {
	const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	return {
		version: VERSION,
		settings: { sound: true, haptics: true, lessMotion: reduced, difficulty: 'medium' },
		seenHelp: {},
		daily: {},
		stats: { crack: freshStats(), secret: freshStats(), link: freshStats() },
		book: {},
		hat: null,
		chain: {},
		chainStreak: { streak: 0, best: 0, last: null },
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
				data.book ??= base.book;
				data.hat ??= null;
				data.chain ??= base.chain;
				data.chainStreak ??= base.chainStreak;
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
	const { book, hat } = save;
	// The Kin Book is a collection, not a stat: it stays.
	Object.assign(save, fresh(), { settings, book, hat });
	persist();
}
