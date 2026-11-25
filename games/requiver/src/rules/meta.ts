// Progress between runs: Feathers, the upgrade tree, unlocks and the best score.

import { META } from './data/balance.ts';
import { UPGRADES } from './data/upgrades.ts';
import { applyMod, type Stats } from './stats.ts';

export interface BestScore {
	score: number;
	act: number;
	won: boolean;
	date: string;
}

export interface MetaState {
	feathers: number;
	ranks: Record<string, number>;
	runs: number;
	wins: number;
	best: BestScore | null;
	tutorialDone: boolean;
	/** The bow picked last time. */
	bow: string;
}

export function newMeta(): MetaState {
	return { feathers: 0, ranks: {}, runs: 0, wins: 0, best: null, tutorialDone: false, bow: 'ash' };
}

export const rankOf = (meta: MetaState, id: string) => meta.ranks[id] ?? 0;

/** Unlock keys from bought nodes, such as "boost:homing". */
export function unlocks(meta: MetaState): Set<string> {
	const out = new Set<string>();
	for (const [id, rank] of Object.entries(meta.ranks)) {
		const u = UPGRADES[id];
		if (u?.unlock && rank > 0) out.add(u.unlock);
	}
	return out;
}

export type BuyState = 'owned' | 'buy' | 'poor' | 'locked';

export function buyState(meta: MetaState, id: string): BuyState {
	const u = UPGRADES[id];
	const rank = rankOf(meta, id);
	if (rank >= u.cost.length) return 'owned';
	if (!u.requires.every((r) => rankOf(meta, r) > 0)) return 'locked';
	return meta.feathers >= u.cost[rank] ? 'buy' : 'poor';
}

export function nextCost(meta: MetaState, id: string): number | null {
	const u = UPGRADES[id];
	const rank = rankOf(meta, id);
	return rank < u.cost.length ? u.cost[rank] : null;
}

export function buy(meta: MetaState, id: string): boolean {
	if (buyState(meta, id) !== 'buy') return false;
	meta.feathers -= UPGRADES[id].cost[rankOf(meta, id)];
	meta.ranks[id] = rankOf(meta, id) + 1;
	return true;
}

export function applyMeta(stats: Stats, meta: MetaState) {
	for (const [id, rank] of Object.entries(meta.ranks)) {
		const u = UPGRADES[id];
		if (u?.mod && rank > 0) applyMod(stats, u.mod, rank);
	}
}

export interface RunTally {
	spots: number;
	kills: number;
	headshots: number;
	shots: number;
	hits: number;
	elites: number;
	bosses: number;
	acts: number;
	maxStreak: number;
	bonusShots: number;
	damageTaken: number;
	goldEarned: number;
	time: number;
}

export function newTally(): RunTally {
	return { spots: 0, kills: 0, headshots: 0, shots: 0, hits: 0, elites: 0, bosses: 0, acts: 0, maxStreak: 0, bonusShots: 0, damageTaken: 0, goldEarned: 0, time: 0 };
}

export function featherPayout(t: RunTally, won: boolean): number {
	const p = META.payout;
	return Math.floor(t.spots * p.perSpot + t.kills * p.perKill + t.headshots * p.perHeadshot + t.elites * p.perElite + t.bosses * p.perBoss + (won ? p.win : 0));
}
