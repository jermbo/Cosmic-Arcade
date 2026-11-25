// The archer's numbers for one fight: base values, then the bow, the upgrade tree and the run boosts.

import { BOW, DAMAGE, PLAYER } from './data/balance.ts';

export interface Stats {
	maxHp: number;
	startGold: number;
	slots: number;
	/** Seconds of flight the aim arc shows. */
	aimArc: number;
	drawTime: number;
	cooldown: number;
	speedMult: number;
	/** Body hit damage. */
	damage: number;
	/** Arrows per shot. */
	arrows: number;

	// Arrow boosts. 0 means off.
	split: number;
	fire: number;
	fireTime: number;
	fireSpread: number;
	ice: number;
	iceTime: number;
	brittle: number;
	pierce: number;
	bounce: number;
	bounceDamage: number;
	homing: number;
	explosive: number;
	blast: number;

	// Armor boosts.
	block: number;
	thorns: number;
	mend: number;

	// Defenses.
	wall: number;
	spikes: number;
	spikesSlow: number;
	helper: number;
	helperInherit: number;
}

export type StatKey = keyof Stats;

/** A change to stats: values to add, factors to multiply, values to raise to. */
export interface StatMod {
	add?: Partial<Stats>;
	mult?: Partial<Stats>;
	set?: Partial<Stats>;
}

export function baseStats(): Stats {
	return {
		maxHp: PLAYER.maxHp,
		startGold: PLAYER.startGold,
		slots: PLAYER.slots,
		aimArc: BOW.aimArc,
		drawTime: BOW.drawTime,
		cooldown: BOW.cooldown,
		speedMult: 1,
		damage: DAMAGE.body,
		arrows: 1,
		split: 0,
		fire: 0,
		fireTime: 0,
		fireSpread: 0,
		ice: 0,
		iceTime: 0,
		brittle: 0,
		pierce: 0,
		bounce: 0,
		bounceDamage: 0,
		homing: 0,
		explosive: 0,
		blast: 0,
		block: 0,
		thorns: 0,
		mend: 0,
		wall: 0,
		spikes: 0,
		spikesSlow: 0,
		helper: 0,
		helperInherit: 0,
	};
}

/** Applies a mod `times` times (for upgrade ranks). */
export function applyMod(stats: Stats, mod: StatMod, times = 1) {
	for (let n = 0; n < times; n++) {
		for (const [key, value] of Object.entries(mod.add ?? {})) stats[key as StatKey] += value as number;
		for (const [key, value] of Object.entries(mod.mult ?? {})) stats[key as StatKey] *= value as number;
		for (const [key, value] of Object.entries(mod.set ?? {})) stats[key as StatKey] = Math.max(stats[key as StatKey], value as number);
	}
}
