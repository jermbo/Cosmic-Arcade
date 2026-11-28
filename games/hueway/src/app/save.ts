/** Everything the game keeps between visits, in one localStorage entry. */
import { addDays } from '../core/daily.ts';
import type { Level } from '../core/types.ts';
import { LEVELS } from '../core/types.ts';
import type { Paths } from './game.ts';
import type { Earning, Looks } from './shop.ts';
import { DEFAULT_LOOKS, EARN_ENDLESS, FREE_ITEMS, earnings } from './shop.ts';

export interface Settings {
	sound: number; // 0..1
	music: number; // 0..1
	/** 'auto' follows the device setting. */
	motion: 'auto' | 'reduced' | 'full';
	showTimer: boolean;
	haptics: boolean;
	/** A small symbol on each dot, so color is never the only clue. */
	dotMarks: boolean;
	/** Tint the squares a line runs through. */
	fillTint: boolean;
	/** The cozy kit style: soft clay or bold ink. */
	style: 'soft' | 'bold';
}

/** A puzzle in progress. */
export interface GameSave {
	paths: Paths;
	elapsed: number;
	hints: number;
	moves: number;
	lastColor: number;
	/** Colors a hint drew. */
	shown: number[];
}

export interface Finish {
	time: number; // ms
	hints: number;
	moves: number;
	perfect: boolean;
	/** The day it was finished (YYYY-MM-DD). */
	on: string;
	level: Level;
}

export interface Best {
	time: number;
	on: string;
	id: string;
}

/** One stop of a road trip, kept for the map. */
export interface Leg {
	size: number;
	road: number[];
	others: number[][];
}

export interface EndlessSave {
	clockBest: number;
	clockRuns: number;
	/** The road trip in progress. */
	trip: number;
	stops: number;
	/** The last stops, for the map (the oldest drop off). */
	legs: Leg[];
	/** Lines drawn on the current stop. */
	paths?: Paths;
	/** The longest trip, in stops. */
	bestTrip: number;
}

/** How many stops the map keeps. */
const MAP_LEGS = 40;

type PerLevel<T> = { [L in Level]: T };

export interface SaveData {
	v: 1;
	settings: Settings;
	tutorialDone: boolean;
	games: { [id: string]: GameSave };
	finished: { [id: string]: Finish };
	/** Next practice number per level. */
	practice: PerLevel<number>;
	/** Best times per level, fastest first (top 5). */
	records: PerLevel<Best[]>;
	streak: { current: number; best: number; lastDay: string };
	coins: number;
	/** Shop item ids the player owns (free items are always owned). */
	owned: string[];
	looks: Looks;
	endless: EndlessSave;
}

const KEY = 'hueway:v1';

const perLevel = <T>(make: () => T) => Object.fromEntries(LEVELS.map((l) => [l, make()])) as PerLevel<T>;

export const defaultSettings = (): Settings => ({
	sound: 0.8,
	music: 0.4,
	motion: 'auto',
	showTimer: true,
	haptics: true,
	dotMarks: false,
	fillTint: true,
	style: 'soft',
});

export const freshSave = (): SaveData => ({
	v: 1,
	settings: defaultSettings(),
	tutorialDone: false,
	games: {},
	finished: {},
	practice: perLevel(() => 0),
	records: perLevel(() => []),
	streak: { current: 0, best: 0, lastDay: '' },
	coins: 0,
	owned: [...FREE_ITEMS],
	looks: { ...DEFAULT_LOOKS },
	endless: { clockBest: 0, clockRuns: 0, trip: 0, stops: 0, legs: [], bestTrip: 0 },
});

export function load(): SaveData {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return freshSave();
		const data = JSON.parse(raw) as SaveData;
		if (data.v !== 1) return freshSave();
		const base = freshSave();
		// Old theme ids from before the cozy kit.
		const alias: Record<string, string> = { apricot: 'blossom' };
		if (data.looks) data.looks.theme = alias[data.looks.theme] ?? data.looks.theme;
		data.owned = (data.owned ?? []).map((id) => alias[id] ?? id);
		return {
			...base,
			...data,
			settings: { ...base.settings, ...data.settings },
			looks: { ...base.looks, ...data.looks },
			practice: { ...base.practice, ...data.practice },
			records: { ...base.records, ...data.records },
			endless: { ...base.endless, ...data.endless },
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

/** The streak as it stands today: it breaks if yesterday's puzzle was missed. */
export function liveStreak(data: SaveData, today: string): number {
	const { current, lastDay } = data.streak;
	return lastDay === today || lastDay === addDays(today, -1) ? current : 0;
}

/**
 * Records a finished puzzle: best times, streak and coins.
 * A puzzle earns coins only the first time it is finished.
 */
export function finish(data: SaveData, id: string, level: Level, f: Omit<Finish, 'level'>, today: string, dailyDay?: string) {
	const first = !data.finished[id];
	const finished = { ...data.finished, [id]: { ...f, level } };
	const games = { ...data.games };
	delete games[id];
	const before = data.records[level];
	const isBest = first && before.length > 0 && f.time < before[0].time;
	const list = first ? [...before, { time: f.time, on: f.on, id }].sort((a, b) => a.time - b.time).slice(0, 5) : before;
	const records = { ...data.records, [level]: list };
	let streak = data.streak;
	// A daily counts for the streak when it is finished on its own day.
	const dailyToday = !!dailyDay && dailyDay === today && streak.lastDay !== today;
	if (dailyToday) {
		const current = streak.lastDay === addDays(today, -1) ? streak.current + 1 : 1;
		streak = { current, best: Math.max(streak.best, current), lastDay: today };
	}
	const earned: Earning[] = first ? earnings({ level, hints: f.hints, perfect: f.perfect, isBest, dailyToday, streak: streak.current }) : [];
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

/** A clock run ended after solving `boards` boards. */
export function finishClock(data: SaveData, boards: number) {
	const e = data.endless;
	const isBest = boards > e.clockBest;
	const earned: Earning[] = [];
	if (boards > 0) earned.push({ label: `${boards} board${boards === 1 ? '' : 's'}`, coins: boards * EARN_ENDLESS.clockPerBoard });
	if (isBest && e.clockRuns > 0) earned.push({ label: 'New best run', coins: EARN_ENDLESS.clockBest });
	const coins = data.coins + earned.reduce((sum, x) => sum + x.coins, 0);
	return { data: { ...data, coins, endless: { ...e, clockRuns: e.clockRuns + 1, clockBest: Math.max(e.clockBest, boards) } }, earned, isBest };
}

/** The road reached the next stop: `leg` goes on the map. */
export function roadStop(data: SaveData, leg: Leg) {
	const e = data.endless;
	const stops = e.stops + 1;
	const earned: Earning[] = [{ label: 'Stop reached', coins: EARN_ENDLESS.roadPerStop }];
	if (stops % EARN_ENDLESS.roadMilestone === 0) earned.push({ label: `${stops} stops`, coins: EARN_ENDLESS.roadMilestoneCoins });
	const coins = data.coins + earned.reduce((sum, x) => sum + x.coins, 0);
	const endless = { ...e, stops, legs: [...e.legs, leg].slice(-MAP_LEGS), paths: undefined, bestTrip: Math.max(e.bestTrip, stops) };
	return { data: { ...data, coins, endless }, earned };
}

/** Starts a new road trip. The best trip stays. */
export const newTrip = (data: SaveData): SaveData => ({ ...data, endless: { ...data.endless, trip: data.endless.trip + 1, stops: 0, legs: [], paths: undefined } });
