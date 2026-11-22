import { CARD_IDS, STARTER_DECK } from '../data/cards.ts';
import { LAYERS, type LayerDef } from '../data/layers.ts';
import { NODE_INFO, type FightType } from '../data/nodes.ts';
import { startCombat, type Combat } from './combat.ts';
import { FLOORS, generateFloor, nodeById, type FloorMap, type MapNode } from './map.ts';
import { childRng, randomSeed, seedLabel, type Rng } from './rng.ts';
import { GATE_SHED } from './trace.ts';

export const BANK_RATE_FAIL = 0.4;

export type EndKind = 'booted' | 'jacked' | 'cleared';

export const END_CAUSE: Record<EndKind, string> = {
	booted: 'TRACE COMPLETE',
	jacked: 'JACKED OUT',
	cleared: 'LAYER CLEARED',
};

export interface Ending {
	kind: EndKind;
	cause: string;
	cycles: number;
	banked: number;
}

export interface Reward {
	nodeType: FightType;
	cycles: number;
	choices: string[];
}

export interface Run {
	seed: number;
	seedLabel: string;
	layer: LayerDef;
	floor: number;
	marketFloor: number;
	map: FloorMap;
	/** Current node on this floor. Null at the floor entry. */
	at: string | null;
	visited: string[];
	trace: number;
	cycles: number;
	deck: string[];
	mods: { salvage: number; damper: boolean; ventBonus: boolean };
	combat: Combat | null;
	reward: Reward | null;
	/** Offers bought on the current shop visit. Null when not in a shop. */
	shop: Set<string> | null;
	ending: Ending | null;
	rng: { combat: Rng; reward: Rng };
	stats: { cardsPlayed: number; kills: number; fights: number; floorsCleared: number };
}

export function newRun(layerIndex: number, seedIn = 0): Run {
	const seed = seedIn > 0 ? seedIn >>> 0 : randomSeed();
	const layer = LAYERS[layerIndex];
	const marketFloor = childRng(seed, 'market').int(1, FLOORS);
	return {
		seed,
		seedLabel: seedLabel(seed),
		layer,
		floor: 1,
		marketFloor,
		map: generateFloor(seed, 1, layer, marketFloor),
		at: null,
		visited: [],
		trace: 0,
		cycles: 0,
		deck: [...STARTER_DECK],
		mods: { salvage: 1, damper: false, ventBonus: false },
		combat: null,
		reward: null,
		shop: null,
		ending: null,
		rng: { combat: childRng(seed, 'combat'), reward: childRng(seed, 'reward') },
		stats: { cardsPlayed: 0, kills: 0, fights: 0, floorsCleared: 0 },
	};
}

export const currentNode = (run: Run): MapNode | null => (run.at ? nodeById(run.map, run.at) ?? null : null);

export function depthMeters(run: Run): number {
	const node = currentNode(run);
	const row = node ? node.row + 1 : 0;
	return 128 * ((run.floor - 1) * 4 + row) + 24;
}

/** Busy means in a fight, a reward, or a shop. The map is locked. */
export const isBusy = (run: Run) => run.combat !== null || run.reward !== null || run.shop !== null;

export function reachableIds(run: Run): string[] {
	if (run.ending || isBusy(run)) return [];
	const node = currentNode(run);
	if (!node) return run.map.nodes.filter((n) => n.row === 0).map((n) => n.id);
	return node.exits;
}

export const canJackOut = (run: Run) => !run.ending && run.combat === null;

export type EnterResult = 'combat' | 'shop' | null;

export function enterNode(run: Run, id: string): EnterResult {
	if (!reachableIds(run).includes(id)) return null;
	const node = nodeById(run.map, id)!;
	run.at = id;
	run.visited.push(id);
	if (node.type === 'merchant') {
		run.shop = new Set();
		return 'shop';
	}
	run.combat = startCombat(run, node.type);
	return 'combat';
}

/** Call once the fight is clear. Pays cycles and rolls the card offer. */
export function openReward(run: Run): Reward | null {
	const c = run.combat;
	if (!c || run.ending || c.daemons.some((d) => d.hp > 0)) return null;
	const cycles = Math.round(NODE_INFO[c.nodeType].payout * run.mods.salvage);
	run.cycles += cycles;
	run.stats.fights++;
	const choices = c.nodeType === 'boss' ? [] : run.rng.reward.shuffle([...CARD_IDS]).slice(0, 3);
	run.reward = { nodeType: c.nodeType, cycles, choices };
	run.combat = null;
	return run.reward;
}

export type ClaimResult = 'map' | 'next-floor' | 'cleared';

/** pick is an index into reward.choices, or -1 to skip the card. */
export function claimReward(run: Run, pick: number): ClaimResult | null {
	const reward = run.reward;
	if (!reward) return null;
	const card = reward.choices[pick];
	if (card) run.deck.push(card);
	run.reward = null;

	if (reward.nodeType === 'boss') {
		endRun(run, 'cleared');
		return 'cleared';
	}
	if (reward.nodeType === 'gate') {
		run.trace *= 1 - GATE_SHED;
		run.stats.floorsCleared++;
		run.floor++;
		run.map = generateFloor(run.seed, run.floor, run.layer, run.marketFloor);
		run.at = null;
		run.visited = [];
		return 'next-floor';
	}
	return 'map';
}

export function leaveShop(run: Run): void {
	run.shop = null;
}

export function jackOut(run: Run): boolean {
	if (!canJackOut(run)) return false;
	endRun(run, 'jacked');
	return true;
}

export function endRun(run: Run, kind: EndKind): Ending {
	if (run.ending) return run.ending;
	const banked = kind === 'cleared' ? run.cycles : Math.round(run.cycles * BANK_RATE_FAIL);
	if (kind === 'cleared') run.stats.floorsCleared++;
	run.ending = { kind, cause: END_CAUSE[kind], cycles: run.cycles, banked };
	run.combat = null;
	run.shop = null;
	run.reward = null;
	return run.ending;
}
