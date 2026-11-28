/** Everything the game keeps between visits, in one localStorage entry. */
import type { BotId } from '../core/bot.ts';
import { BOT_IDS } from '../core/bot.ts';
import type { Size } from '../core/rules.ts';
import type { GameState, Opponent } from './game.ts';
import { result } from './game.ts';
import type { Earning, Looks } from './shop.ts';
import { DEFAULT_LOOKS, EARN, FREE_ITEMS } from './shop.ts';

export interface Settings {
	sound: number; // 0..1
	music: number; // 0..1
	/** 'auto' follows the device setting. */
	motion: 'auto' | 'reduced' | 'full';
	haptics: boolean;
	/** Accessibility: a soft dot on every legal move. Off by default. */
	moveDots: boolean;
	/** The cozy kit style: soft clay or bold ink. */
	style: 'soft' | 'bold';
}

/** The last picks on the New game screen. */
export interface Setup {
	opponent: Opponent;
	size: Size;
	/** Against a bot: the player goes first (dark). */
	first: boolean;
}

export interface Record3 {
	wins: number;
	losses: number;
	draws: number;
}

export interface SaveData {
	v: 1;
	settings: Settings;
	pips: number;
	/** Shop item ids the player owns (free items are always owned). */
	owned: string[];
	looks: Looks;
	setup: Setup;
	/** The game in progress, if any. */
	game: GameState | null;
	stats: Record<BotId, Record3>;
	pairGames: number;
}

const KEY = 'flippity:v1';

export const defaultSettings = (): Settings => ({
	sound: 0.8,
	music: 0.35,
	motion: 'auto',
	haptics: true,
	moveDots: false,
	style: 'soft',
});

const blankStats = () => Object.fromEntries(BOT_IDS.map((b) => [b, { wins: 0, losses: 0, draws: 0 }])) as Record<BotId, Record3>;

export const freshSave = (): SaveData => ({
	v: 1,
	settings: defaultSettings(),
	pips: 0,
	owned: [...FREE_ITEMS],
	looks: { ...DEFAULT_LOOKS },
	setup: { opponent: 'sleepy', size: 8, first: true },
	game: null,
	stats: blankStats(),
	pairGames: 0,
});

/** Loads the save. A save of another version starts fresh (no migration). */
export function load(): SaveData {
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
			setup: { ...base.setup, ...data.setup },
			stats: { ...base.stats, ...data.stats },
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

/** Ends the game: adds up the Pips, pays them and counts the result. */
export function finishGame(data: SaveData, g: GameState) {
	const r = result(g);
	const earned: Earning[] = [...g.earned];
	if (g.opponent !== 'pair') {
		const bot = g.opponent;
		if (r.outcome === 'win') {
			earned.push({ label: `Win vs ${BOT_NAME[bot]}`, pips: EARN.win[bot] });
			const big = EARN.bigBoard[g.n];
			if (big) earned.push({ label: `${g.n}×${g.n} board`, pips: big });
			if ((g.human === 1 ? r.light : r.dark) === 0) earned.push({ label: 'Wipeout', pips: EARN.wipeout });
		} else if (r.outcome === 'draw') earned.push({ label: `Draw vs ${BOT_NAME[bot]}`, pips: EARN.draw[bot] });
	}
	const total = g.opponent === 'pair' ? 0 : earned.reduce((s, e) => s + e.pips, 0);
	let stats = data.stats;
	if (g.opponent !== 'pair') {
		const s = stats[g.opponent];
		const key = r.outcome === 'win' ? 'wins' : r.outcome === 'loss' ? 'losses' : 'draws';
		stats = { ...stats, [g.opponent]: { ...s, [key]: s[key] + 1 } };
	}
	const next: SaveData = { ...data, pips: data.pips + total, game: null, stats, pairGames: data.pairGames + (g.opponent === 'pair' ? 1 : 0) };
	return { data: next, earned: g.opponent === 'pair' ? [] : earned, total, ...r };
}

/** Pays for something. Null when the player can't pay. */
export function spend(data: SaveData, price: number): SaveData | null {
	if (data.pips < price) return null;
	return { ...data, pips: data.pips - price };
}

/** Buys an item if the player can pay. Returns null when they can't. */
export function buy(data: SaveData, id: string, price: number): SaveData | null {
	if (data.owned.includes(id)) return data;
	if (data.pips < price) return null;
	return { ...data, pips: data.pips - price, owned: [...data.owned, id] };
}

export const BOT_NAME: Record<BotId, string> = { sleepy: 'Sleepy', steady: 'Steady', sharp: 'Sharp' };
