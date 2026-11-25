// The three acts. Each is one evening: the sun sets as you cross the map.
// Colors live in the art module; this is the rules side only.

export interface ActDef {
	id: string;
	name: string;
	/** Foes that can spawn in normal waves, with their weights. */
	foes: Record<string, number>;
	/** Wave budget at row 0, in foe cost units. */
	budget: number;
	/** Foe hp is multiplied by this (rounded up). */
	hpMult: number;
	boss: string;
	/** The map: how many spots in each row (the last row is the boss). */
	rows: [number, number][];
	/** Every path to the boss has at least this many fights. */
	minFights: number;
	/** Rows with a fixed spot type. Row index to spot id. */
	fixed: Record<number, string>;
}

export const ACTS: ActDef[] = [
	{
		id: 'ember',
		name: 'The Ember Fields',
		foes: { walker: 10, runner: 4, thrower: 2, brute: 1, flyer: 2 },
		budget: 6,
		hpMult: 1,
		boss: 'gatewarden',
		rows: [[2, 3], [2, 4], [3, 4], [2, 4], [3, 4], [2, 3], [2, 3], [1, 1]],
		minFights: 3,
		fixed: { 0: 'fight', 6: 'rest', 7: 'boss' },
	},
	{
		id: 'rose',
		name: 'The Rose Marsh',
		foes: { walker: 6, runner: 5, flyer: 6, shield: 3, thrower: 3, brute: 2, splitter: 2 },
		budget: 13,
		hpMult: 1.2,
		boss: 'kitequeen',
		rows: [[2, 3], [2, 4], [3, 4], [2, 4], [3, 4], [2, 3], [2, 3], [1, 1]],
		minFights: 3,
		fixed: { 0: 'fight', 6: 'rest', 7: 'boss' },
	},
	{
		id: 'violet',
		name: 'The Violet Peaks',
		foes: { walker: 4, runner: 5, flyer: 5, shield: 5, thrower: 4, brute: 4, splitter: 4 },
		budget: 21,
		hpMult: 1.6,
		boss: 'hollowking',
		rows: [[2, 3], [2, 4], [3, 4], [2, 4], [3, 4], [2, 3], [2, 3], [1, 1]],
		minFights: 3,
		fixed: { 0: 'fight', 6: 'rest', 7: 'boss' },
	},
];
