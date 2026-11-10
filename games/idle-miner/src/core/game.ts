// The shape of a game: what a save holds and what the rules read.

import type { CrewId } from '../content/crew.ts';
import type { MachineType } from '../content/machines.ts';
import type { PerkId } from '../content/perks.ts';
import type { ResearchId } from '../content/research.ts';
import type { ShipUpgrade } from '../content/ships.ts';
import type { Dir } from './direction.ts';

export interface BeltItem {
	/** item kind */
	k: number;
	/** progress along the belt, 0..1 */
	p: number;
	/** direction it moved when it came in */
	e: Dir;
}

export interface Machine {
	t: MachineType;
	d: Dir;
	lv: number;
	/** input buffer */
	inb: number[];
	/** output buffer */
	out: number[];
	/** job progress 0..1 */
	prog: number;
	job: boolean;
	/** belt items, front first */
	items: BeltItem[];
	/** item kind the current job makes */
	kind?: number;
	/** view only: glow 0..1, not saved */
	glow?: number;
	/** view only: input side for belt curves, -1 for straight */
	bend?: number;
	/** items passing through that this machine cannot use, front first */
	thru?: BeltItem[];
	/** blocked for a while (seconds), for hints */
	stuck?: number;
	/** bridge only: the cell of the other end */
	link?: number;
	/** bridge only: true for the end items come out of */
	end?: boolean;
}

export interface Ship {
	/** 0 at planet, 1 flying home, 2 flying back */
	ph: 0 | 1 | 2;
	t: number;
	cargo: number[];
	wait: number;
}

export interface PlanetState {
	unlocked: boolean;
	cells: (Machine | null)[];
	pad: number[];
	ships: Ship[];
	up: Record<ShipUpgrade, number>;
	/** counts of each machine bought, for prices */
	built: Partial<Record<MachineType, number>>;
	/** Owned land plots (see grid.ts). Always includes the center plot. */
	plots: number[];
}

export interface Settings {
	sfx: number;
	music: number;
	vibrate: boolean;
	reduceMotion: boolean;
}

export interface Stats {
	taps: number;
	shipped: number;
	flights: number;
	playTime: number;
	resets: number;
	allEarned: number;
}

export interface Game {
	v: 1;
	/** which map generator the layout was built on */
	map: number;
	/** per planet: rock cells that were blasted away. Kept through a nova. */
	blasted: number[][];
	credits: number;
	/** earned this run */
	runEarned: number;
	stardust: number;
	perks: Partial<Record<PerkId, boolean>>;
	/** hired crew, by level. Kept through a nova. */
	crew: Partial<Record<CrewId, number>>;
	/** where each crew member works: a planet index. Missing means resting. Kept through a nova. */
	crewAt: Partial<Record<CrewId, number>>;
	/** crew slots bought with stardust. Kept through a nova. */
	slots: number;
	research: Record<ResearchId, number>;
	planets: PlanetState[];
	goals: string[];
	unlocks: string[];
	stats: Stats;
	settings: Settings;
	tutorial: number;
	beaconLit: boolean;
	peakIncome: number;
	savedAt: number;
}
