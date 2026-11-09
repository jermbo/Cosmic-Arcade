// Which machines the player can build.

import { MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { anyMet } from './checks.ts';
import type { Game } from './game.ts';

export function machineUnlocked(g: Game, t: MachineType): boolean {
	const unlock = MACHINES[t].unlock;
	if (unlock === 'start') return true;
	if (unlock) return anyMet(g, unlock);
	const i = introPlanet(t);
	return i >= 0 && g.planets[i].unlocked;
}

/** The planet that brings a machine, or -1 when no planet does. */
export function introPlanet(t: MachineType): number {
	return PLANETS.findIndex((p) => p.newMachine === t);
}
