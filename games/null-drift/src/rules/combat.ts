import { CARDS, type CardDef } from '../data/cards.ts';
import { DAEMONS } from '../data/daemons.ts';
import type { FightType } from '../data/nodes.ts';
import type { Rng } from './rng.ts';
import type { Run } from './run.ts';
import { addTrace, isBooted } from './trace.ts';

export const ENERGY = 3;
export const HAND_DRAW = 5;
export const HAND_MAX = 7;
const DEFEND_CHANCE = 0.28;

export interface Intent {
	kind: 'attack' | 'defend';
	value: number;
}

export interface Daemon {
	uid: number;
	id: string;
	name: string;
	sigil: string;
	hp: number;
	maxHp: number;
	mask: number;
	intent: Intent;
}

export interface Combat {
	nodeType: FightType;
	daemons: Daemon[];
	drawPile: string[];
	discard: string[];
	hand: string[];
	energy: number;
	mask: number;
	turn: number;
}

export interface Hit {
	uid: number;
	absorbed: number;
	damage: number;
	killed: boolean;
}

export interface PlayResult {
	card: CardDef;
	hits: Hit[];
	noise: number;
	cycles: number;
	drawn: number;
	booted: boolean;
	cleared: boolean;
}

export interface TurnResult {
	attackers: { uid: number; value: number }[];
	incoming: number;
	blocked: number;
	through: number;
	booted: boolean;
}

export function rollIntent(d: Daemon, rng: Rng): void {
	if (rng.chance(DEFEND_CHANCE)) {
		d.intent = { kind: 'defend', value: Math.max(3, Math.round(d.maxHp / 5)) };
		d.mask = d.intent.value;
	} else {
		d.intent = { kind: 'attack', value: Math.max(3, Math.round(d.maxHp / 4 + rng.int(0, 4))) };
		d.mask = 0;
	}
}

export const living = (c: Combat) => c.daemons.filter((d) => d.hp > 0);

export function startCombat(run: Run, nodeType: FightType): Combat {
	const rng = run.rng.combat;
	let uid = 0;
	const daemons = run.layer.rosters[nodeType].map((id): Daemon => {
		const def = DAEMONS[id];
		const d: Daemon = { uid: uid++, id, name: def.name, sigil: def.sigil, hp: def.maxHp, maxHp: def.maxHp, mask: 0, intent: { kind: 'attack', value: 0 } };
		rollIntent(d, rng);
		return d;
	});
	const combat: Combat = {
		nodeType,
		daemons,
		drawPile: rng.shuffle([...run.deck]),
		discard: [],
		hand: [],
		energy: ENERGY,
		mask: 0,
		turn: 1,
	};
	drawCards(combat, HAND_DRAW, rng);
	return combat;
}

/** Draws up to n cards. Stops at the hand limit or when both piles are empty. */
export function drawCards(c: Combat, n: number, rng: Rng): number {
	let drawn = 0;
	for (let i = 0; i < n; i++) {
		if (c.hand.length >= HAND_MAX) break;
		if (c.drawPile.length === 0) {
			if (c.discard.length === 0) break;
			c.drawPile = rng.shuffle(c.discard);
			c.discard = [];
		}
		c.hand.push(c.drawPile.pop()!);
		drawn++;
	}
	return drawn;
}

function damageDaemon(d: Daemon, amount: number): Hit {
	const absorbed = Math.min(d.mask, amount);
	d.mask -= absorbed;
	const damage = Math.min(d.hp, amount - absorbed);
	d.hp -= damage;
	return { uid: d.uid, absorbed, damage, killed: d.hp <= 0 };
}

/** Noise after shop mods: the baffle damps positive noise, the vent kit boosts venting. */
export function effectiveNoise(run: Run, noise: number): number {
	if (noise > 0 && run.mods.damper) return Math.max(0, noise - 2);
	if (noise < 0 && run.mods.ventBonus) return noise * 1.4;
	return noise;
}

export function canPlay(run: Run, index: number): boolean {
	const c = run.combat;
	if (!c || run.ending || living(c).length === 0) return false;
	const id = c.hand[index];
	return id !== undefined && CARDS[id].cost <= c.energy;
}

export function playCard(run: Run, index: number): PlayResult | null {
	if (!canPlay(run, index)) return null;
	const c = run.combat!;
	const card = CARDS[c.hand[index]];
	c.energy -= card.cost;
	c.hand.splice(index, 1);

	const hits: Hit[] = [];
	if (card.damage) {
		const alive = living(c);
		const targets = card.hitsAll ? alive : alive.slice(0, 1);
		for (const d of targets) hits.push(damageDaemon(d, card.damage));
	}
	if (card.mask) c.mask += card.mask;
	const cycles = card.cycles ?? 0;
	run.cycles += cycles;

	const noise = effectiveNoise(run, card.noise);
	addTrace(run, noise);

	const drawn = card.draw ? drawCards(c, card.draw, run.rng.combat) : 0;
	c.discard.push(card.id);
	run.stats.cardsPlayed++;
	run.stats.kills += hits.filter((h) => h.killed).length;

	return { card, hits, noise, cycles, drawn, booted: isBooted(run), cleared: living(c).length === 0 };
}

export function endTurn(run: Run): TurnResult | null {
	const c = run.combat;
	if (!c || run.ending || living(c).length === 0) return null;
	const rng = run.rng.combat;

	const attackers = living(c)
		.filter((d) => d.intent.kind === 'attack')
		.map((d) => ({ uid: d.uid, value: d.intent.value }));
	const incoming = attackers.reduce((sum, a) => sum + a.value, 0);
	const blocked = Math.min(incoming, c.mask);
	const through = incoming - blocked;
	addTrace(run, through);
	const booted = isBooted(run);

	if (!booted) {
		for (const d of living(c)) rollIntent(d, rng);
		c.mask = 0;
		c.energy = ENERGY;
		c.turn++;
		c.discard.push(...c.hand);
		c.hand = [];
		drawCards(c, HAND_DRAW, rng);
	}
	return { attackers, incoming, blocked, through, booted };
}
