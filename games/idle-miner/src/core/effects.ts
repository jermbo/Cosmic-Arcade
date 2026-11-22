// What the research and the perks that a player owns add up to.

import type { Effect, Power, Stat } from '../content/effects.ts';
import { PERKS } from '../content/perks.ts';
import type { PerkId } from '../content/perks.ts';
import { RESEARCH } from '../content/research.ts';
import type { ResearchId } from '../content/research.ts';
import type { Game } from './game.ts';

/** What a player owns: research levels and perks. */
export type Owned = Pick<Game, 'research' | 'perks'>;

/** The sum of every "add" effect on a stat. 0 when nothing adds to it. */
export function statAdd(owned: Owned, stat: Stat): number {
	let sum = 0;
	for (const [effect, level] of ownedEffects(owned)) if ('stat' in effect && effect.stat === stat && 'add' in effect) sum += effect.add * level;
	return sum;
}

/** The product of every "times" effect on a stat. 1 when nothing multiplies it. */
export function statTimes(owned: Owned, stat: Stat): number {
	let product = 1;
	for (const [effect, level] of ownedEffects(owned)) if ('stat' in effect && effect.stat === stat && 'times' in effect) product *= Math.pow(effect.times, level);
	return product;
}

export function hasPower(owned: Owned, power: Power): boolean {
	for (const [effect, level] of ownedEffects(owned)) if ('power' in effect && effect.power === power && level > 0) return true;
	return false;
}

/** The features that the owned perks and research open at the start of each run. */
export function startUnlocks(owned: Owned): string[] {
	const out: string[] = [];
	for (const [effect, level] of ownedEffects(owned)) if ('startUnlocks' in effect && level > 0) out.push(...effect.startUnlocks);
	return out;
}

/** True when an entry has this power, owned or not. */
export function grantsPower(effects: Effect[], power: Power): boolean {
	return effects.some((e) => 'power' in e && e.power === power);
}

/** Each effect of the research and perks, with its level: the research level, or 1 for an owned perk. */
function* ownedEffects(owned: Owned): Generator<[Effect, number]> {
	for (const id of Object.keys(RESEARCH) as ResearchId[]) for (const effect of RESEARCH[id].effects) yield [effect, owned.research[id]];
	for (const id of Object.keys(PERKS) as PerkId[]) for (const effect of PERKS[id].effects) yield [effect, owned.perks[id] ? 1 : 0];
}
