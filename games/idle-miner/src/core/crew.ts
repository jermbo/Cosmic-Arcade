// The crew: hire, train and place crew members, and the boost they give a planet.

import { CREW, CREW_MAX, CREW_ORDER } from '../content/crew.ts';
import type { CrewId } from '../content/crew.ts';
import { BASE_SLOTS } from '../content/nova.ts';
import { NO_BOOST, addCrew } from './crew-boost.ts';
import type { CrewBoost } from './crew-boost.ts';
import type { Game, PlanetState } from './game.ts';
import { crewCost, slotCost } from './prices.ts';
import { perkPoints } from './nova.ts';

const crewMap = new WeakMap<PlanetState, CrewBoost>();

/** The boost from all crew working on this planet. Kept fresh by syncCrew. */
export function crewOf(p: PlanetState): Readonly<CrewBoost> {
	return crewMap.get(p) ?? NO_BOOST;
}

/** Works out each planet's crew boost. Cheap; runs every tick and after crew changes. */
export function syncCrew(g: Game) {
	const boosts = g.planets.map(() => ({ ...NO_BOOST }));
	for (const id of CREW_ORDER) {
		const lv = g.crew[id] || 0;
		const pi = g.crewAt[id];
		if (lv && pi !== undefined && g.planets[pi]?.unlocked) addCrew(boosts[pi], id, lv);
	}
	g.planets.forEach((p, i) => crewMap.set(p, boosts[i]));
}

export function slotCount(g: Game) {
	return BASE_SLOTS + g.slots;
}

/** How many crew are working now. */
export function slotsUsed(g: Game) {
	return CREW_ORDER.filter((id) => g.crew[id] && g.crewAt[id] !== undefined).length;
}

export function buySlot(g: Game): boolean {
	const cost = slotCost(g);
	if (!cost || perkPoints(g) < cost) return false;
	g.slots++;
	return true;
}

/** Hires a crew member, or trains one already hired. */
export function buyCrew(g: Game, id: CrewId): boolean {
	const lv = g.crew[id] || 0;
	if (!CREW[id] || lv >= CREW_MAX) return false;
	const cost = crewCost(g, id);
	if (g.credits < cost) return false;
	g.credits -= cost;
	g.crew[id] = lv + 1;
	syncCrew(g);
	return true;
}

/** Sends a hired crew member to work on a planet, or to rest with -1. Free. Needs a free slot unless already working. */
export function assignCrew(g: Game, id: CrewId, pi: number): boolean {
	if (!g.crew[id]) return false;
	const at = g.crewAt[id];
	if (pi < 0) {
		if (at === undefined) return false;
		delete g.crewAt[id];
	} else {
		if (at === pi || !g.planets[pi]?.unlocked) return false;
		if (at === undefined && slotsUsed(g) >= slotCount(g)) return false;
		g.crewAt[id] = pi;
	}
	syncCrew(g);
	return true;
}
