// The upgrade tree between runs. Paid with Feathers.
// `cost` has one price per rank. `mod` applies once per rank bought.
// `unlock` adds a boost, bow or event to the pool: "boost:<id>", "bow:<id>", "event:<id>".

import type { StatMod } from '../stats.ts';

export type Branch = 'body' | 'bow' | 'pack' | 'lore';

export interface UpgradeDef {
	id: string;
	name: string;
	text: string;
	branch: Branch;
	/** Row in its branch, from the top. */
	tier: number;
	cost: number[];
	requires: string[];
	mod?: StatMod;
	unlock?: string;
}

export const BRANCH_NAMES: Record<Branch, string> = {
	body: 'Body',
	bow: 'Bow',
	pack: 'Pack',
	lore: 'Lore',
};

export const UPGRADES: Record<string, UpgradeDef> = {
	// Body: health and staying power.
	toughness: {
		id: 'toughness',
		name: 'Tough Hide',
		text: '+8 max health per rank.',
		branch: 'body',
		tier: 0,
		cost: [12, 20, 32],
		requires: [],
		mod: { add: { maxHp: 8 } },
	},
	firstaid: {
		id: 'firstaid',
		name: 'Old Bandage',
		text: 'Heal 3 after each fight per rank.',
		branch: 'body',
		tier: 1,
		cost: [22, 36],
		requires: ['toughness'],
		mod: { add: { mend: 3 } },
	},
	warding: {
		id: 'warding',
		name: 'Lucky Knot',
		text: 'Block the first hit of every fight.',
		branch: 'body',
		tier: 2,
		cost: [60],
		requires: ['firstaid'],
		mod: { add: { block: 1 } },
	},
	unlockSquire: {
		id: 'unlockSquire',
		name: 'Hire a Squire',
		text: 'Unlocks the Squire boost: a helper archer.',
		branch: 'body',
		tier: 3,
		cost: [70],
		requires: ['warding'],
		unlock: 'boost:squire',
	},

	// Bow: pull and aim.
	pull: {
		id: 'pull',
		name: 'Strong Pull',
		text: 'Pull 5% faster and shoot 3% harder per rank.',
		branch: 'bow',
		tier: 0,
		cost: [14, 24, 38],
		requires: [],
		mod: { mult: { drawTime: 0.95, speedMult: 1.03 } },
	},
	sight: {
		id: 'sight',
		name: 'Long Sight',
		text: 'The aim arc shows 35% more of the flight per rank.',
		branch: 'bow',
		tier: 1,
		cost: [16, 26, 40],
		requires: ['pull'],
		mod: { mult: { aimArc: 1.35 } },
	},
	unlockShort: {
		id: 'unlockShort',
		name: 'Hornet Shortbow',
		text: 'Unlocks a fast bow to start runs with.',
		branch: 'bow',
		tier: 2,
		cost: [40],
		requires: ['sight'],
		unlock: 'bow:short',
	},
	unlockLong: {
		id: 'unlockLong',
		name: 'Heron Longbow',
		text: 'Unlocks a heavy bow with a long aim arc.',
		branch: 'bow',
		tier: 2,
		cost: [40],
		requires: ['sight'],
		unlock: 'bow:long',
	},
	unlockTwin: {
		id: 'unlockTwin',
		name: 'Twin Spine',
		text: 'Unlocks a bow that shoots two arrows.',
		branch: 'bow',
		tier: 3,
		cost: [90],
		requires: ['unlockShort', 'unlockLong'],
		unlock: 'bow:twin',
	},

	// Pack: gold and boost slots.
	purse: {
		id: 'purse',
		name: 'Coin Purse',
		text: '+15 starting gold per rank.',
		branch: 'pack',
		tier: 0,
		cost: [10, 18, 28],
		requires: [],
		mod: { add: { startGold: 15 } },
	},
	strap: {
		id: 'strap',
		name: 'Second Strap',
		text: '+1 boost slot.',
		branch: 'pack',
		tier: 1,
		cost: [55],
		requires: ['purse'],
		mod: { add: { slots: 1 } },
	},
	unlockBounce: {
		id: 'unlockBounce',
		name: 'River Stones',
		text: 'Unlocks Skipping Stone: arrows bounce off the ground.',
		branch: 'pack',
		tier: 2,
		cost: [35],
		requires: ['strap'],
		unlock: 'boost:bounce',
	},
	strap2: {
		id: 'strap2',
		name: 'Third Strap',
		text: '+1 boost slot.',
		branch: 'pack',
		tier: 3,
		cost: [130],
		requires: ['unlockBounce'],
		mod: { add: { slots: 1 } },
	},

	// Lore: new things to find.
	unlockHoming: {
		id: 'unlockHoming',
		name: 'Owl Feathers',
		text: 'Unlocks Seeker Feathers: arrows bend toward heads.',
		branch: 'lore',
		tier: 0,
		cost: [30],
		requires: [],
		unlock: 'boost:homing',
	},
	unlockStatue: {
		id: 'unlockStatue',
		name: 'Old Maps',
		text: 'New events: the Cracked Statue and the Lost Quiver.',
		branch: 'lore',
		tier: 1,
		cost: [30],
		requires: ['unlockHoming'],
		unlock: 'event:statue',
	},
	unlockExplosive: {
		id: 'unlockExplosive',
		name: 'Black Powder',
		text: 'Unlocks Blast Cap: arrows burst where they land.',
		branch: 'lore',
		tier: 2,
		cost: [50],
		requires: ['unlockStatue'],
		unlock: 'boost:explosive',
	},
};
