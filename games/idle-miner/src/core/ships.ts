// The cargo route of a planet: how much a ship carries, how long it flies, and how much the pad holds.

import { PLANETS } from '../content/planets.ts';
import { PAD } from '../content/ships.ts';
import { shipCargo, shipSpeed } from './levels.ts';
import type { PlanetState } from './game.ts';
import { crewOf } from './crew.ts';

export function travelTime(p: PlanetState, pi: number) {
	return PLANETS[pi].travel / (shipSpeed(p.up.speed) * crewOf(p).shipSpeed);
}

/** How much one ship on this route carries. */
export function shipCap(p: PlanetState) {
	return Math.round(shipCargo(p.up.cargo) * crewOf(p).cargo);
}

export function padCap(p: PlanetState) {
	return PAD.items + shipCap(p) * PAD.shipLoads;
}
