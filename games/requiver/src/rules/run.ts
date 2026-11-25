// One run: health, gold, boosts, the map and what waits at the current spot.
// Plain JSON data, so it can be saved as is.

import { ACTS } from './data/acts.ts';
import { ECONOMY, PLAYER, REST, SCORE, SHOP } from './data/balance.ts';
import { BOOSTS, type Rarity } from './data/boosts.ts';
import { BOWS } from './data/bows.ts';
import { EVENTS, type Choice, type Effect } from './data/events.ts';
import { SPOTS } from './data/spots.ts';
import type { BattleSetup, BattleTally } from './combat.ts';
import { generateMap, nodeById, type ActMap, type MapNode } from './map.ts';
import { applyMeta, featherPayout, newTally, unlocks, type MetaState, type RunTally } from './meta.ts';
import { Rng } from './rng.ts';
import { applyMod, baseStats, type Stats } from './stats.ts';
import type { FightKind } from './waves.ts';

export interface OwnedBoost {
	id: string;
	level: number;
}

export interface Offer {
	id: string;
	/** The level the boost will have once taken. */
	level: number;
	upgrade: boolean;
}

export interface ShopItem {
	kind: 'boost' | 'heal' | 'upgrade' | 'slot';
	price: number;
	offer?: Offer;
	sold: boolean;
}

export type Pending =
	| { kind: 'battle'; node: number; fight: FightKind; seed: number }
	| { kind: 'reward'; title: string; gold: number; offers: Offer[]; slot: boolean; taken: boolean }
	| { kind: 'shop'; items: ShopItem[] }
	| { kind: 'rest'; done: boolean }
	| { kind: 'event'; id: string; result: string | null; then: Pending | null };

export interface RunState {
	seed: number;
	rng: number;
	act: number;
	map: ActMap;
	/** The last spot reached in this act. null means the start of the act. */
	at: number | null;
	visited: number[];
	hp: number;
	maxHpBonus: number;
	gold: number;
	extraSlots: number;
	boosts: OwnedBoost[];
	bow: string;
	tally: RunTally;
	pending: Pending | null;
	result: 'dead' | 'won' | null;
	score: number;
	feathers: number;
	/** Events seen this run. */
	events: string[];
	/** True for the first fight of a player who has not done the tutorial. */
	tutorial: boolean;
}

const withRng = <T>(run: RunState, fn: (rng: Rng) => T): T => {
	const rng = new Rng(run.rng);
	const out = fn(rng);
	run.rng = rng.state;
	return out;
};

export function newRun(meta: MetaState, bow: string, seed: number): RunState {
	const rng = new Rng(seed);
	const run: RunState = {
		seed,
		rng: 0,
		act: 0,
		map: generateMap(rng, 0),
		at: null,
		visited: [],
		hp: 0,
		maxHpBonus: 0,
		gold: 0,
		extraSlots: 0,
		boosts: [],
		bow: BOWS[bow] ? bow : 'ash',
		tally: newTally(),
		pending: null,
		result: null,
		score: 0,
		feathers: 0,
		events: [],
		tutorial: !meta.tutorialDone,
	};
	run.rng = rng.state;
	const stats = runStats(run, meta);
	run.hp = stats.maxHp;
	run.gold = Math.round(stats.startGold);
	return run;
}

/** The archer's numbers right now. */
export function runStats(run: RunState, meta: MetaState): Stats {
	const s = baseStats();
	applyMeta(s, meta);
	applyMod(s, BOWS[run.bow]?.mod ?? {});
	for (const b of run.boosts) {
		const def = BOOSTS[b.id];
		if (def) applyMod(s, def.levels[b.level - 1]);
	}
	s.maxHp = Math.max(1, Math.round(s.maxHp + run.maxHpBonus));
	s.slots = Math.min(PLAYER.maxSlots, Math.round(s.slots + run.extraSlots));
	return s;
}

export const slotCount = (run: RunState, meta: MetaState) => runStats(run, meta).slots;

/** Runs a change to boosts or max health, and keeps hp in step with max hp. */
function changeBuild(run: RunState, meta: MetaState, fn: () => void) {
	const before = runStats(run, meta).maxHp;
	fn();
	const after = runStats(run, meta).maxHp;
	if (after > before) run.hp += after - before;
	run.hp = Math.min(run.hp, after);
}

// ---------- The map ----------

export function choices(run: RunState): MapNode[] {
	if (run.pending) return [];
	if (run.at === null) return run.map.nodes.filter((n) => n.row === 0);
	return nodeById(run.map, run.at).next.map((id) => nodeById(run.map, id));
}

/** Moves to a spot and sets up what happens there. */
export function enterSpot(run: RunState, meta: MetaState, id: number) {
	if (!choices(run).some((n) => n.id === id)) return;
	const node = nodeById(run.map, id);
	run.at = id;
	run.visited.push(id);
	const spot = SPOTS[node.type];
	switch (spot.resolve) {
		case 'battle':
			run.pending = { kind: 'battle', node: id, fight: spot.fight ?? 'fight', seed: withRng(run, (r) => r.int(1, 2 ** 31)) };
			break;
		case 'shop':
			run.pending = { kind: 'shop', items: makeShop(run, meta) };
			run.tally.spots++;
			break;
		case 'rest':
			run.pending = { kind: 'rest', done: false };
			run.tally.spots++;
			break;
		case 'event':
			run.pending = { kind: 'event', id: pickEvent(run, meta), result: null, then: null };
			run.tally.spots++;
			break;
		case 'treasure': {
			const gold = withRng(run, (r) => r.int(...ECONOMY.goldTreasure));
			run.gold += gold;
			run.tally.goldEarned += gold;
			run.tally.spots++;
			run.pending = reward(run, meta, 'Treasure', gold, 'treasure');
			break;
		}
	}
}

export function battleSetup(run: RunState, meta: MetaState): BattleSetup | null {
	const p = run.pending;
	if (!p || p.kind !== 'battle') return null;
	const node = nodeById(run.map, p.node);
	return { seed: p.seed, act: run.act, row: node.row, kind: p.fight, stats: runStats(run, meta), hp: run.hp, tutorial: run.tutorial };
}

/** Applies the end of a fight. */
export function finishBattle(run: RunState, meta: MetaState, outcome: 'won' | 'lost', hp: number, t: BattleTally) {
	const p = run.pending;
	if (!p || p.kind !== 'battle') return;
	const tally = run.tally;
	tally.kills += t.kills;
	tally.headshots += t.headshots;
	tally.shots += t.shots;
	tally.hits += t.hits;
	tally.damageTaken += t.damageTaken;
	tally.maxStreak = Math.max(tally.maxStreak, t.maxStreak);
	tally.bonusShots += t.bonusShots;
	tally.time += t.time;
	run.tutorial = false;
	if (outcome === 'lost') {
		run.hp = 0;
		endRun(run, meta, 'dead');
		return;
	}
	const stats = runStats(run, meta);
	run.hp = Math.min(stats.maxHp, Math.max(1, Math.round(hp)) + Math.round(stats.mend));
	tally.spots++;
	if (p.fight === 'elite') tally.elites++;
	if (p.fight === 'boss') tally.bosses++;
	const range = p.fight === 'boss' ? ECONOMY.goldBoss : p.fight === 'elite' ? ECONOMY.goldElite : ECONOMY.goldFight;
	const gold = withRng(run, (r) => r.int(range[0], range[1]));
	run.gold += gold;
	tally.goldEarned += gold;
	if (p.fight === 'boss' && run.act === ACTS.length - 1) {
		tally.acts = ACTS.length;
		endRun(run, meta, 'won');
		return;
	}
	const title = p.fight === 'boss' ? 'Boss down' : p.fight === 'elite' ? 'Elite beaten' : 'Victory';
	run.pending = reward(run, meta, title, gold, p.fight);
}

// ---------- Rewards ----------

function reward(run: RunState, meta: MetaState, title: string, gold: number, source: string): Pending {
	const offers = makeOffers(run, meta, ECONOMY.rarityOdds[source] ?? ECONOMY.rarityOdds.fight, ECONOMY.rewardChoices);
	const slotChance = ECONOMY.slotOfferChance[source] ?? 0;
	const slot = slotCount(run, meta) < PLAYER.maxSlots && withRng(run, (r) => r.chance(slotChance));
	return { kind: 'reward', title, gold, offers, slot, taken: false };
}

/** Boosts the player can be offered: unlocked, not maxed. Owned ones come back as level ups. */
export function makeOffers(run: RunState, meta: MetaState, odds: Record<Rarity, number>, count: number, only?: Rarity): Offer[] {
	const open = unlocks(meta);
	const pool = Object.values(BOOSTS).filter((b) => {
		if (b.locked && !open.has(`boost:${b.id}`)) return false;
		const own = run.boosts.find((o) => o.id === b.id);
		return !own || own.level < b.levels.length;
	});
	const offers: Offer[] = [];
	withRng(run, (rng) => {
		for (let i = 0; i < count && pool.length; i++) {
			const rarity = only ?? rng.weighted(['common', 'uncommon', 'rare'] as Rarity[], (r) => odds[r])!;
			const list = pool.filter((b) => b.rarity === rarity && !offers.some((o) => o.id === b.id));
			const fallback = pool.filter((b) => !offers.some((o) => o.id === b.id));
			const pick = rng.pick(list.length ? list : fallback.length ? fallback : pool);
			if (!pick || offers.some((o) => o.id === pick.id)) continue;
			const own = run.boosts.find((o) => o.id === pick.id);
			offers.push({ id: pick.id, level: own ? own.level + 1 : 1, upgrade: !!own });
		}
	});
	return offers;
}

/** True when taking this offer needs a free slot and there is none. */
export function needsReplace(run: RunState, meta: MetaState, offer: Offer) {
	return !offer.upgrade && run.boosts.length >= slotCount(run, meta);
}

/** Takes a boost. `replace` is the index of the boost to drop when the slots are full. */
export function takeOffer(run: RunState, meta: MetaState, offer: Offer, replace?: number): boolean {
	if (needsReplace(run, meta, offer) && (replace === undefined || !run.boosts[replace])) return false;
	changeBuild(run, meta, () => {
		const own = run.boosts.find((o) => o.id === offer.id);
		if (own) own.level = Math.min(BOOSTS[offer.id].levels.length, own.level + 1);
		else if (replace !== undefined && needsReplace(run, meta, offer)) run.boosts[replace] = { id: offer.id, level: 1 };
		else run.boosts.push({ id: offer.id, level: 1 });
	});
	return true;
}

export function claimReward(run: RunState, meta: MetaState, choice: { offer?: Offer; replace?: number; slot?: boolean; skip?: boolean }) {
	const p = run.pending;
	if (!p || p.kind !== 'reward' || p.taken) return false;
	if (choice.slot) {
		run.extraSlots++;
	} else if (choice.offer) {
		if (!takeOffer(run, meta, choice.offer, choice.replace)) return false;
	} else {
		run.gold += ECONOMY.skipGold;
		run.tally.goldEarned += ECONOMY.skipGold;
	}
	p.taken = true;
	return true;
}

// ---------- Shop ----------

function makeShop(run: RunState, meta: MetaState): ShopItem[] {
	const offers = makeOffers(run, meta, ECONOMY.rarityOdds.shop, SHOP.boostCount);
	const items: ShopItem[] = withRng(run, (rng) =>
		offers.map((offer) => ({
			kind: 'boost' as const,
			offer,
			price: Math.round(SHOP.price[BOOSTS[offer.id].rarity] * (1 + rng.range(-SHOP.priceJitter, SHOP.priceJitter))),
			sold: false,
		})),
	);
	items.push({ kind: 'heal', price: SHOP.heal.price, sold: false });
	items.push({ kind: 'upgrade', price: SHOP.upgradePrice, sold: false });
	if (withRng(run, (r) => r.chance(SHOP.slotChance))) items.push({ kind: 'slot', price: SHOP.slotPrice, sold: false });
	return items;
}

export function canBuy(run: RunState, meta: MetaState, item: ShopItem): boolean {
	if (item.sold || run.gold < item.price) return false;
	if (item.kind === 'heal') return run.hp < runStats(run, meta).maxHp;
	if (item.kind === 'upgrade') return upgradable(run).length > 0;
	if (item.kind === 'slot') return slotCount(run, meta) < PLAYER.maxSlots;
	return true;
}

/** Buys an item. For 'upgrade', `index` is the boost to level up; for a boost, the one to replace. */
export function buyItem(run: RunState, meta: MetaState, item: ShopItem, index?: number): boolean {
	if (!canBuy(run, meta, item)) return false;
	if (item.kind === 'boost' && item.offer) {
		if (!takeOffer(run, meta, item.offer, index)) return false;
	} else if (item.kind === 'heal') {
		run.hp = Math.min(runStats(run, meta).maxHp, run.hp + SHOP.heal.amount);
	} else if (item.kind === 'upgrade') {
		if (index === undefined || !upgradeBoost(run, meta, index)) return false;
	} else if (item.kind === 'slot') {
		run.extraSlots++;
	}
	run.gold -= item.price;
	item.sold = item.kind !== 'heal';
	return true;
}

// ---------- Rest ----------

export const upgradable = (run: RunState) => run.boosts.map((b, i) => ({ b, i })).filter(({ b }) => b.level < BOOSTS[b.id].levels.length).map(({ i }) => i);

export function upgradeBoost(run: RunState, meta: MetaState, index: number): boolean {
	const b = run.boosts[index];
	if (!b || b.level >= BOOSTS[b.id].levels.length) return false;
	changeBuild(run, meta, () => b.level++);
	return true;
}

export const restHealAmount = (run: RunState, meta: MetaState) => Math.round(runStats(run, meta).maxHp * REST.healShare);

export function rest(run: RunState, meta: MetaState, choice: { heal: true } | { upgrade: number }): boolean {
	const p = run.pending;
	if (!p || p.kind !== 'rest' || p.done) return false;
	if ('heal' in choice) run.hp = Math.min(runStats(run, meta).maxHp, run.hp + restHealAmount(run, meta));
	else if (!upgradeBoost(run, meta, choice.upgrade)) return false;
	p.done = true;
	return true;
}

// ---------- Events ----------

function pickEvent(run: RunState, meta: MetaState): string {
	const open = unlocks(meta);
	const list = Object.values(EVENTS).filter((e) => e.acts.includes(run.act) && (!e.unlock || open.has(`event:${e.unlock}`)));
	// Seen events are rare, so a run does not repeat itself.
	const id = withRng(run, (r) => r.weighted(list, (e) => (run.events.includes(e.id) ? e.weight * 0.1 : e.weight))?.id ?? 'tree');
	run.events.push(id);
	return id;
}

export function choiceOpen(run: RunState, choice: Choice): boolean {
	const n = choice.needs;
	if (!n) return true;
	if (n.gold !== undefined && run.gold < n.gold) return false;
	if (n.boosts !== undefined && run.boosts.length < n.boosts) return false;
	if (n.hp !== undefined && run.hp < n.hp) return false;
	return true;
}

/** Picks an event choice. The result text is set and any follow-up (reward, fight) waits in `then`. */
export function chooseEvent(run: RunState, meta: MetaState, index: number): boolean {
	const p = run.pending;
	if (!p || p.kind !== 'event' || p.result !== null) return false;
	const choice = EVENTS[p.id].choices[index];
	if (!choice || !choiceOpen(run, choice)) return false;
	const outcome = withRng(run, (r) => r.weighted(choice.outcomes, (o) => o.weight))!;
	p.result = outcome.text;
	for (const fx of outcome.effects) applyEffect(run, meta, fx, p);
	return true;
}

function applyEffect(run: RunState, meta: MetaState, fx: Effect, p: Extract<Pending, { kind: 'event' }>) {
	switch (fx.type) {
		case 'gold':
			run.gold = Math.max(0, run.gold + fx.amount);
			if (fx.amount > 0) run.tally.goldEarned += fx.amount;
			break;
		case 'hp':
			run.hp = Math.max(1, Math.min(runStats(run, meta).maxHp, run.hp + fx.amount));
			break;
		case 'maxHp':
			changeBuild(run, meta, () => (run.maxHpBonus += fx.amount));
			run.hp = Math.max(1, run.hp);
			break;
		case 'boostChoice': {
			const offers = makeOffers(run, meta, ECONOMY.rarityOdds.event, ECONOMY.rewardChoices, fx.rarity);
			p.then = { kind: 'reward', title: 'Pick one', gold: 0, offers, slot: false, taken: false };
			break;
		}
		case 'boost': {
			const own = run.boosts.find((b) => b.id === fx.id);
			const offer: Offer = { id: fx.id, level: own ? own.level + 1 : 1, upgrade: !!own };
			if (own && own.level >= BOOSTS[fx.id].levels.length) break;
			if (needsReplace(run, meta, offer)) p.then = { kind: 'reward', title: 'Make room?', gold: 0, offers: [offer], slot: false, taken: false };
			else takeOffer(run, meta, offer);
			break;
		}
		case 'upgradeRandom': {
			const list = upgradable(run);
			if (list.length) upgradeBoost(run, meta, withRng(run, (r) => r.pick(list)));
			break;
		}
		case 'loseRandomBoost':
			if (run.boosts.length) changeBuild(run, meta, () => run.boosts.splice(withRng(run, (r) => r.int(0, run.boosts.length - 1)), 1));
			break;
		case 'slot':
			run.extraSlots += fx.amount;
			break;
		case 'feathers':
			run.feathers += fx.amount;
			break;
		case 'fight':
			p.then = { kind: 'battle', node: run.at ?? 0, fight: fx.kind, seed: withRng(run, (r) => r.int(1, 2 ** 31)) };
			break;
	}
}

/** After an event result: go on to the reward or fight it set up, if any. */
export function continueEvent(run: RunState) {
	const p = run.pending;
	if (!p || p.kind !== 'event' || p.result === null) return;
	run.pending = p.then;
}

// ---------- Leaving a spot, acts, the end ----------

/** Leaves the current spot and returns to the map. After a boss, the next act starts. */
export function leaveSpot(run: RunState) {
	if (run.result) return;
	const p = run.pending;
	if (p?.kind === 'battle') return;
	run.pending = null;
	const node = run.at !== null ? nodeById(run.map, run.at) : null;
	if (node && node.type === 'boss') {
		run.act++;
		run.tally.acts = run.act;
		run.map = withRng(run, (r) => generateMap(r, run.act));
		run.at = null;
		run.visited = [];
	}
}

export function endRun(run: RunState, meta: MetaState, result: 'dead' | 'won') {
	if (run.result) return;
	run.result = result;
	run.pending = null;
	const t = run.tally;
	if (result === 'won') t.acts = ACTS.length;
	run.score = Math.round(
		t.kills * SCORE.perKill +
			t.headshots * SCORE.perHeadshot +
			t.spots * SCORE.perSpot +
			t.elites * SCORE.perElite +
			t.bosses * SCORE.perBoss +
			t.acts * SCORE.perAct +
			t.maxStreak * SCORE.perMaxCombo +
			(result === 'won' ? SCORE.win + run.hp * SCORE.perHpLeft : 0),
	);
	run.feathers += featherPayout(t, result === 'won');
	meta.feathers += run.feathers;
	meta.runs++;
	if (result === 'won') meta.wins++;
	meta.tutorialDone = true;
	if (!meta.best || run.score > meta.best.score) {
		meta.best = { score: run.score, act: run.act + 1, won: result === 'won', date: new Date().toISOString().slice(0, 10) };
	}
}

/** Where the sun is in this act: 0 at the start, 1 at the boss. */
export function dusk(run: RunState): number {
	if (run.at === null) return 0;
	const node = nodeById(run.map, run.at);
	return node.row / Math.max(1, run.map.rows - 1);
}
