export type EnemyId = 'scout' | 'tank' | 'skimmer' | 'splitter' | 'shard' | 'boss';

export interface EnemyDef {
	id: EnemyId;
	name: string;
	blurb: string;
	model: string;
	eliteModel: string;
	hp: number;
	speed: number;
	reward: number;
	lives: number;
	scale: number;
	/** Height above the path. */
	hover: number;
	flying?: boolean;
	splits?: number;
	boss?: boolean;
	/** Color of the pieces when it breaks. */
	color: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
	scout: {
		id: 'scout',
		name: 'Scout',
		blurb: 'Fast and fragile.',
		model: 'enemy-ufo-a',
		eliteModel: 'enemy-ufo-a-weapon',
		hp: 30,
		speed: 2.0,
		reward: 5,
		lives: 1,
		scale: 0.46,
		hover: 0.35,
		color: 0xf2804a,
	},
	tank: {
		id: 'tank',
		name: 'Hauler',
		blurb: 'Slow, with thick armor.',
		model: 'enemy-ufo-b',
		eliteModel: 'enemy-ufo-b-weapon',
		hp: 170,
		speed: 0.85,
		reward: 14,
		lives: 2,
		scale: 0.6,
		hover: 0.3,
		color: 0x6fcf73,
	},
	skimmer: {
		id: 'skimmer',
		name: 'Skimmer',
		blurb: 'Flies high and straight to the crystal. Catapults cannot hit it.',
		model: 'enemy-ufo-c',
		eliteModel: 'enemy-ufo-c-weapon',
		hp: 55,
		speed: 1.15,
		reward: 9,
		lives: 1,
		scale: 0.48,
		hover: 1.6,
		flying: true,
		color: 0xa37bff,
	},
	splitter: {
		id: 'splitter',
		name: 'Splitter',
		blurb: 'Breaks into three small fast UFOs.',
		model: 'enemy-ufo-d',
		eliteModel: 'enemy-ufo-d-weapon',
		hp: 85,
		speed: 1.15,
		reward: 7,
		lives: 1,
		scale: 0.55,
		hover: 0.35,
		splits: 3,
		color: 0xc9cbe0,
	},
	shard: {
		id: 'shard',
		name: 'Shard',
		blurb: 'A piece of a Splitter.',
		model: 'enemy-ufo-d',
		eliteModel: 'enemy-ufo-d',
		hp: 20,
		speed: 2.1,
		reward: 2,
		lives: 1,
		scale: 0.28,
		hover: 0.3,
		color: 0xc9cbe0,
	},
	boss: {
		id: 'boss',
		name: 'Mothership',
		blurb: 'The fleet leader. Very tough. Cannot be frozen.',
		model: 'enemy-ufo-b-weapon',
		eliteModel: 'enemy-ufo-b-weapon',
		hp: 2600,
		speed: 0.5,
		reward: 150,
		lives: 10,
		scale: 1.05,
		hover: 0.55,
		boss: true,
		color: 0xff6f6f,
	},
};

export const ELITE = { hp: 2.2, reward: 2, lives: 1, scale: 1.12 };
