// How many machines of a type the player has built.

import type { MachineType } from '../content/machines.ts';
import type { Game } from './game.ts';

export function countOf(g: Game, pi: number, t: MachineType) {
	let n = 0;
	for (const m of g.planets[pi].cells) if (m && m.t === t) n++;
	return n;
}

export function countAll(g: Game, t: MachineType) {
	let n = 0;
	for (let pi = 0; pi < g.planets.length; pi++) n += countOf(g, pi, t);
	return n;
}
