// A fresh game: its planets, machines and ships, at the start or after a nova.

import type { CrewId } from '../content/crew.ts';
import type { MachineType } from '../content/machines.ts';
import { NOVA_KIT } from '../content/nova.ts';
import { PLANETS } from '../content/planets.ts';
import { RESEARCH } from '../content/research.ts';
import type { ResearchId } from '../content/research.ts';
import type { Dir } from './direction.ts';
import type { Game, Machine, PlanetState, Settings, Ship } from './game.ts';
import { CENTER_PLOT, MAX_CELLS, cellIdx } from './grid.ts';
import { MAP_VERSION } from './planet-map.ts';
import { hasPower, startUnlocks, statAdd } from './effects.ts';

export function makeShip(): Ship {
	return { ph: 0, t: 0, cargo: [], wait: 0 };
}

export function makeMachine(t: MachineType, d: Dir): Machine {
	return { t, d, lv: 1, inb: [], out: [], prog: 0, job: false, items: [] };
}

export function makePlanet(index: number, unlocked: boolean, extraShips: number): PlanetState {
	const cells: (Machine | null)[] = new Array(MAX_CELLS).fill(null);
	const [px, py] = PLANETS[index].pad;
	cells[cellIdx(px, py)] = makeMachine('pad', 0);
	const ships: Ship[] = [];
	for (let i = 0; i < 1 + extraShips; i++) ships.push(makeShip());
	return { unlocked, cells, pad: [], ships, up: { ships: 0, speed: 0, cargo: 0 }, built: {}, plots: [CENTER_PLOT] };
}

export function defaultSettings(): Settings {
	return { sfx: 0.8, music: 0.5, vibrate: true, reduceMotion: false };
}

/** After a nova only Cinder is open, so working crew go back there. */
function crewHome(at: Partial<Record<CrewId, number>>) {
	const out: Partial<Record<CrewId, number>> = {};
	for (const id of Object.keys(at) as CrewId[]) if (at[id] !== undefined) out[id] = 0;
	return out;
}

/** Each research at level 0. */
export function noResearch(): Record<ResearchId, number> {
	return Object.fromEntries(Object.keys(RESEARCH).map((id) => [id, 0])) as Record<ResearchId, number>;
}

export function newGame(keep?: Game): Game {
	const perks = keep ? keep.perks : {};
	// A new run has no research yet, so only the perks count.
	const owned = { research: noResearch(), perks };
	const extra = statAdd(owned, 'extraShips');
	const g: Game = {
		v: 1,
		map: MAP_VERSION,
		credits: statAdd(owned, 'startCredits') + (keep ? keep.stardust * NOVA_KIT : 0),
		runEarned: 0,
		stardust: keep ? keep.stardust : 0,
		perks,
		crew: keep ? { ...keep.crew } : {},
		crewAt: keep ? crewHome(keep.crewAt) : {},
		slots: keep ? keep.slots : 0,
		research: noResearch(),
		blasted: keep ? keep.blasted.map((a) => a.slice()) : PLANETS.map(() => []),
		planets: PLANETS.map((_, i) => makePlanet(i, i === 0, extra)),
		goals: [],
		unlocks: [],
		stats: keep ? keep.stats : { taps: 0, shipped: 0, flights: 0, playTime: 0, resets: 0, allEarned: 0 },
		settings: keep ? keep.settings : defaultSettings(),
		tutorial: keep ? 99 : 0,
		beaconLit: keep ? keep.beaconLit : false,
		peakIncome: 0,
		savedAt: Date.now(),
	};
	if (keep && hasPower(owned, 'keepFactory')) {
		const old = keep.planets[0];
		const p = g.planets[0];
		// The layout comes back at level 1. Kept machines keep their count for prices.
		p.cells = old.cells.map((m) => (m ? makeMachine(m.t, m.d) : null));
		p.built = { ...old.built };
		p.plots = old.plots.slice();
	}
	if (keep) g.unlocks.push(...startUnlocks(owned));
	return g;
}
