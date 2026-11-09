// The planets.

import type { MachineType } from './machines.ts';

export type PlanetId = 'cinder' | 'glacia' | 'verdance' | 'solara' | 'umbra' | 'halcyon';

export interface PlanetDef {
	/** The name that content uses for the planet. Saves keep a planet by its place in PLANETS. */
	id: PlanetId;
	name: string;
	ore: string;
	color: string;
	light: string;
	dark: string;
	/** Price scale: item values and machine prices on this planet. */
	value: number;
	unlock: number;
	/** One-way flight time in seconds at ship speed level 0. */
	travel: number;
	/** The machine this planet brings. It can be built here and on each planet after it. */
	newMachine: MachineType | null;
	pad: [number, number];
	seed: number;
	rings: boolean;
}

export const PLANETS: PlanetDef[] = [
	{ id: 'cinder', name: 'Cinder', ore: 'Rustite', color: '#ff7a45', light: '#ffc29e', dark: '#7a2a12', value: 1, unlock: 0, travel: 5, newMachine: null, pad: [20, 20], seed: 11, rings: false },
	{ id: 'glacia', name: 'Glacia', ore: 'Cryon', color: '#4fd8ff', light: '#b8f1ff', dark: '#11507a', value: 8, unlock: 3000, travel: 6, newMachine: 'crusher', pad: [21, 20], seed: 23, rings: true },
	{ id: 'verdance', name: 'Verdance', ore: 'Verdite', color: '#5dff8f', light: '#c2ffd4', dark: '#126b3a', value: 64, unlock: 25e3, travel: 7, newMachine: 'polisher', pad: [20, 21], seed: 37, rings: false },
	{ id: 'solara', name: 'Solara', ore: 'Sunstone', color: '#ffd23f', light: '#fff0b0', dark: '#7a5a0a', value: 512, unlock: 600e3, travel: 8, newMachine: 'pylon', pad: [21, 21], seed: 41, rings: true },
	{ id: 'umbra', name: 'Umbra', ore: 'Voidglass', color: '#b47cff', light: '#e2ccff', dark: '#45227a', value: 4096, unlock: 12e6, travel: 9, newMachine: 'compactor', pad: [20, 20], seed: 53, rings: false },
	{ id: 'halcyon', name: 'Halcyon', ore: 'Helionite', color: '#ff5fae', light: '#ffc2e2', dark: '#7a1450', value: 32768, unlock: 600e6, travel: 10, newMachine: 'forge', pad: [21, 21], seed: 67, rings: true },
];
