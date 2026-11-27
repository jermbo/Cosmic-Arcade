/** Everything the game keeps between visits, in one localStorage entry. */
import { addDays } from '../core/daily.ts';
import type { Level } from '../core/types.ts';

export interface Settings {
	sound: number; // 0..1
	music: number; // 0..1
	/** 'auto' follows the device setting. */
	motion: 'auto' | 'reduced' | 'full';
	showTimer: boolean;
	/** Mark tiles that break a rule. */
	showClashes: boolean;
	/** Light up the row, column and matching values of the picked tile. */
	helpers: boolean;
	haptics: boolean;
}

/** A window in progress. */
export interface GameSave {
	num: number[];
	color: number[];
	noteNum: number[];
	noteColor: number[];
	elapsed: number;
	hints: number;
	shown: number;
}

export interface Finish {
	time: number; // ms
	hints: number;
	shown: number;
	/** The day it was finished (YYYY-MM-DD). */
	on: string;
	level: Level;
}

export interface Record {
	time: number;
	hints: number;
	shown: number;
	on: string;
	id: string;
}

export interface SaveData {
	v: 1;
	settings: Settings;
	tutorialDone: boolean;
	games: { [id: string]: GameSave };
	finished: { [id: string]: Finish };
	/** Next practice number per level. */
	practice: { [L in Level]: number };
	/** Best times per level, fastest first (top 5). */
	records: { [L in Level]: Record[] };
	streak: { current: number; best: number; lastDay: string };
}

const KEY = 'sudoglue:v1';

export const defaultSettings = (): Settings => ({
	sound: 0.8,
	music: 0.45,
	motion: 'auto',
	showTimer: true,
	showClashes: true,
	helpers: true,
	haptics: true,
});

const fresh = (): SaveData => ({
	v: 1,
	settings: defaultSettings(),
	tutorialDone: false,
	games: {},
	finished: {},
	practice: { easy: 0, medium: 0, hard: 0, expert: 0 },
	records: { easy: [], medium: [], hard: [], expert: [] },
	streak: { current: 0, best: 0, lastDay: '' },
});

export function load(): SaveData {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return fresh();
		const data = JSON.parse(raw) as SaveData;
		if (data.v !== 1) return fresh();
		const base = fresh();
		return { ...base, ...data, settings: { ...base.settings, ...data.settings } };
	} catch {
		return fresh();
	}
}

let pending = 0;
export function store(data: SaveData) {
	clearTimeout(pending);
	pending = window.setTimeout(() => {
		try {
			localStorage.setItem(KEY, JSON.stringify(data));
		} catch {
			// Storage can be full or blocked (private mode). The game still plays.
		}
	}, 150);
}

/** The streak as it stands today: it breaks if yesterday's window was missed. */
export function liveStreak(data: SaveData, today: string): number {
	const { current, lastDay } = data.streak;
	return lastDay === today || lastDay === addDays(today, -1) ? current : 0;
}

/** Records a finished window. Returns the updated data and whether it is a new best. */
export function finish(data: SaveData, id: string, level: Level, f: Omit<Finish, 'level'>, today: string, dailyDay?: string) {
	const finished = { ...data.finished, [id]: { ...f, level } };
	const games = { ...data.games };
	delete games[id];
	const list = [...data.records[level], { time: f.time, hints: f.hints, shown: f.shown, on: f.on, id }].sort((a, b) => a.time - b.time);
	const isBest = list[0].id === id && list.length > 0;
	const records = { ...data.records, [level]: list.slice(0, 5) };
	let streak = data.streak;
	// A daily counts for the streak when it is finished on its own day.
	if (dailyDay && dailyDay === today && streak.lastDay !== today) {
		const current = streak.lastDay === addDays(today, -1) ? streak.current + 1 : 1;
		streak = { current, best: Math.max(streak.best, current), lastDay: today };
	}
	return { data: { ...data, finished, games, records, streak }, isBest };
}

export function formatTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	return `${m}:${String(s % 60).padStart(2, '0')}`;
}
