import type { EnemyId } from './enemies';

export type MapId = 'meadow' | 'river' | 'frost';
export type Point = [number, number];

export interface Group {
	type: EnemyId;
	count: number;
	/** Seconds between two enemies of the group. */
	gap: number;
	/** Seconds after the wave starts. */
	delay: number;
	elite?: boolean;
	/** Index of the path. Without it, the group takes turns over all paths. */
	path?: number;
}

export interface MapDef {
	id: MapId;
	name: string;
	blurb: string;
	theme: 'grass' | 'snow';
	w: number;
	h: number;
	/** Each path is a list of corner cells [column, row]: the spawn first, the crystal last. */
	paths: Point[][];
	/** Rivers may start and end outside the grid. */
	rivers: Point[][];
	decorSeed: number;
	decorDensity: number;
	startGold: number;
	/** Health of every enemy, bosses too. */
	hpScale: number;
	/** How fast health grows with each wave. */
	hpGrowth: number;
	waves: Group[][];
}

const g = (type: EnemyId, count: number, gap: number, delay = 0, extra: Partial<Group> = {}): Group => ({
	type,
	count,
	gap,
	delay,
	...extra,
});
const elite = { elite: true };

export const MAPS: MapDef[] = [
	{
		id: 'meadow',
		name: 'Meadow',
		blurb: 'One road. Learn the ropes.',
		theme: 'grass',
		w: 14,
		h: 9,
		paths: [
			[
				[0, 1],
				[3, 1],
				[3, 6],
				[7, 6],
				[7, 2],
				[11, 2],
				[11, 6],
				[13, 6],
			],
		],
		rivers: [],
		decorSeed: 7,
		decorDensity: 0.3,
		startGold: 200,
		hpScale: 1,
		hpGrowth: 0.14,
		waves: [
			[g('scout', 8, 1.1)],
			[g('scout', 12, 0.85)],
			[g('scout', 8, 0.8), g('tank', 2, 3, 5)],
			[g('scout', 14, 0.55), g('tank', 3, 2.4, 4)],
			[g('splitter', 5, 1.8), g('scout', 8, 0.6, 5)],
			[g('tank', 6, 1.7), g('scout', 16, 0.4, 3)],
			[g('skimmer', 5, 1.6), g('scout', 12, 0.5, 3), g('tank', 3, 2, 9)],
			[g('splitter', 8, 1.2), g('skimmer', 5, 1.4, 4), g('scout', 4, 1, 10, elite)],
			[g('scout', 26, 0.28), g('tank', 6, 1.6, 5), g('skimmer', 6, 1.1, 9)],
			[g('scout', 12, 0.5), g('boss', 1, 0, 5), g('tank', 6, 2, 7), g('splitter', 4, 2, 12)],
		],
	},
	{
		id: 'river',
		name: 'River Fork',
		blurb: 'The road splits around the river.',
		theme: 'grass',
		w: 15,
		h: 10,
		paths: [
			[
				[0, 4],
				[3, 4],
				[3, 1],
				[11, 1],
				[11, 4],
				[14, 4],
			],
			[
				[0, 4],
				[3, 4],
				[3, 8],
				[11, 8],
				[11, 4],
				[14, 4],
			],
		],
		rivers: [
			[
				[6, -1],
				[6, 4],
				[8, 4],
				[8, 10],
			],
		],
		decorSeed: 21,
		decorDensity: 0.32,
		startGold: 260,
		hpScale: 1.05,
		hpGrowth: 0.15,
		waves: [
			[g('scout', 10, 0.9)],
			[g('scout', 10, 0.7), g('splitter', 3, 2, 6)],
			[g('tank', 4, 2.2), g('scout', 10, 0.6, 3)],
			[g('skimmer', 6, 1.3), g('scout', 10, 0.5, 4)],
			[g('splitter', 8, 1.2), g('tank', 3, 2.5, 6)],
			[g('scout', 24, 0.3), g('skimmer', 4, 1.5, 5)],
			[g('tank', 8, 1.4), g('splitter', 6, 1.5, 6), g('scout', 4, 1, 3, elite)],
			[g('skimmer', 10, 0.9), g('tank', 3, 2.5, 6, elite)],
			[g('scout', 30, 0.25), g('splitter', 8, 1, 4), g('tank', 4, 2, 10)],
			[g('tank', 8, 1.3), g('skimmer', 8, 1, 5), g('splitter', 5, 1.3, 10, elite)],
			[g('scout', 16, 0.4, 0, elite), g('tank', 8, 1.2, 4), g('skimmer', 10, 0.8, 8)],
			[g('boss', 1, 0, 4), g('scout', 20, 0.35), g('tank', 6, 1.8, 8), g('skimmer', 8, 1, 12), g('splitter', 6, 1.5, 16)],
		],
	},
	{
		id: 'frost',
		name: 'Frost Pass',
		blurb: 'Two spawns, one long cold road.',
		theme: 'snow',
		w: 17,
		h: 11,
		paths: [
			[
				[0, 1],
				[6, 1],
				[6, 4],
				[10, 4],
				[10, 1],
				[14, 1],
				[14, 5],
				[16, 5],
			],
			[
				[0, 9],
				[3, 9],
				[3, 6],
				[8, 6],
				[8, 9],
				[12, 9],
				[12, 7],
				[14, 7],
				[14, 5],
				[16, 5],
			],
		],
		rivers: [
			[
				[15, 11],
				[15, 8],
				[17, 8],
			],
		],
		decorSeed: 5,
		decorDensity: 0.32,
		startGold: 340,
		hpScale: 1.1,
		hpGrowth: 0.18,
		waves: [
			[g('scout', 8, 1, 0, { path: 0 }), g('scout', 8, 1, 2, { path: 1 })],
			[g('splitter', 4, 1.8), g('scout', 12, 0.6, 3)],
			[g('tank', 5, 2), g('skimmer', 4, 1.6, 6)],
			[g('scout', 20, 0.4), g('tank', 4, 2, 6)],
			[g('splitter', 10, 1), g('skimmer', 6, 1.2, 6)],
			[g('tank', 8, 1.3), g('scout', 16, 0.35, 4)],
			[g('skimmer', 12, 0.8), g('splitter', 6, 1.2, 6)],
			[g('scout', 30, 0.22), g('tank', 2, 3, 6, elite)],
			[g('tank', 10, 1.1), g('splitter', 8, 1, 6), g('skimmer', 8, 1, 10)],
			[g('boss', 1, 0, 0, { path: 0 }), g('scout', 20, 0.4, 0, { path: 1 }), g('tank', 6, 1.5, 8)],
			[g('splitter', 4, 2, 0, elite), g('splitter', 10, 0.8, 4), g('skimmer', 12, 0.7, 8)],
			[g('scout', 40, 0.18), g('tank', 10, 1.1, 6)],
			[g('tank', 3, 2, 0, elite), g('tank', 8, 1, 4), g('skimmer', 12, 0.7, 6), g('splitter', 8, 1, 12)],
			[g('scout', 20, 0.3, 0, elite), g('splitter', 12, 0.8, 6), g('skimmer', 16, 0.5, 12)],
			[
				g('boss', 1, 0, 6, { path: 0 }),
				g('boss', 1, 0, 6, { path: 1 }),
				g('tank', 12, 1, 4),
				g('scout', 30, 0.3, 8),
				g('skimmer', 12, 0.7, 12),
				g('splitter', 10, 1, 16),
			],
		],
	},
];

export function mapById(id: MapId): MapDef {
	return MAPS.find((map) => map.id === id) ?? MAPS[0];
}

/** Numbers that tune the difficulty of every map. */
export const BALANCE = {
	hpCurve: 0.022,
	clearBonus: 10,
	clearPerWave: 1,
};

/** Health grows with each wave. Bosses do not grow; each map sets their size. */
export function waveHpScale(map: MapDef, wave: number): number {
	const w = wave - 1;
	return (1 + map.hpGrowth * w + BALANCE.hpCurve * w * w) * map.hpScale;
}
