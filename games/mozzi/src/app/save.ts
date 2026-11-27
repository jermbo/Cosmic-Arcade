/** Everything the game keeps between visits, in one localStorage entry. */
import { addDays } from '../core/daily.ts';
import type { Level } from '../core/types.ts';
import type { Earning, Looks } from './shop.ts';
import { DEFAULT_LOOKS, FREE_ITEMS, earnings } from './shop.ts';

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
	/** A symbol on each color (circle, triangle, square, diamond). */
	colorShapes: boolean;
	/** Bigger numbers and notes on the board. */
	bigText: boolean;
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
	coins: number;
	/** Shop item ids the player owns (free items are always owned). */
	owned: string[];
	/** The theme, tile style and sound pack in use. */
	looks: Looks;
}

const KEY = 'mozzi:v1';
/** The game was called Sudoglue first. Its save moves over once, on the first load. */
const OLD_KEY = 'sudoglue:v1';

function moveOldSave() {
	try {
		const old = localStorage.getItem(OLD_KEY);
		if (old && !localStorage.getItem(KEY)) localStorage.setItem(KEY, old);
		if (old) localStorage.removeItem(OLD_KEY);
	} catch {
		// Storage can be blocked; then there is nothing to move.
	}
}

export const defaultSettings = (): Settings => ({
	sound: 0.8,
	music: 0.45,
	motion: 'auto',
	showTimer: true,
	showClashes: true,
	helpers: true,
	haptics: true,
	colorShapes: false,
	bigText: false,
});

export const freshSave = (): SaveData => ({
	v: 1,
	settings: defaultSettings(),
	tutorialDone: false,
	games: {},
	finished: {},
	practice: { easy: 0, medium: 0, hard: 0, expert: 0 },
	records: { easy: [], medium: [], hard: [], expert: [] },
	streak: { current: 0, best: 0, lastDay: '' },
	coins: 0,
	owned: [...FREE_ITEMS],
	looks: { ...DEFAULT_LOOKS },
});

export function load(): SaveData {
	moveOldSave();
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return freshSave();
		const data = JSON.parse(raw) as SaveData;
		if (data.v !== 1) return freshSave();
		const base = freshSave();
		return {
			...base,
			...data,
			settings: { ...base.settings, ...data.settings },
			looks: { ...base.looks, ...data.looks },
			owned: [...new Set([...FREE_ITEMS, ...(data.owned ?? [])])],
		};
	} catch {
		return freshSave();
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

/**
 * Records a finished window: records, streak and coins.
 * A window earns coins only the first time it is finished.
 */
export function finish(data: SaveData, id: string, level: Level, f: Omit<Finish, 'level'>, today: string, dailyDay?: string) {
	const first = !data.finished[id];
	const finished = { ...data.finished, [id]: { ...f, level } };
	const games = { ...data.games };
	delete games[id];
	const before = data.records[level];
	const isBest = before.length > 0 && f.time < before[0].time;
	const list = [...before, { time: f.time, hints: f.hints, shown: f.shown, on: f.on, id }].sort((a, b) => a.time - b.time);
	const records = { ...data.records, [level]: list.slice(0, 5) };
	let streak = data.streak;
	// A daily counts for the streak when it is finished on its own day.
	const dailyToday = !!dailyDay && dailyDay === today && streak.lastDay !== today;
	if (dailyToday) {
		const current = streak.lastDay === addDays(today, -1) ? streak.current + 1 : 1;
		streak = { current, best: Math.max(streak.best, current), lastDay: today };
	}
	const earned: Earning[] = first ? earnings({ level, hints: f.hints, isBest, dailyToday, streak: streak.current }) : [];
	const coins = data.coins + earned.reduce((sum, e) => sum + e.coins, 0);
	return { data: { ...data, finished, games, records, streak, coins }, isBest, earned };
}

/** Buys an item if the player can pay. Returns null when they can't. */
export function buy(data: SaveData, id: string, price: number): SaveData | null {
	if (data.owned.includes(id)) return data;
	if (data.coins < price) return null;
	return { ...data, coins: data.coins - price, owned: [...data.owned, id] };
}

export function formatTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	return `${m}:${String(s % 60).padStart(2, '0')}`;
}
