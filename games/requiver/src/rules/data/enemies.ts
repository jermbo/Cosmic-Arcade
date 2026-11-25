// Every foe is one entry. `hp` counts body hits: a body hit deals 1 before boosts.
// A head shot kills any of them at once, once the helmet is off.

export type EnemyShape = 'biped' | 'flyer';

export interface ProjectileDef {
	/** Art key. */
	kind: 'rock' | 'spear' | 'feather' | 'arrow' | 'boulder';
	radius: number;
	/** Arrow hits needed to shoot it down. */
	hp: number;
	damage: number;
	/** Seconds from throw to impact. Longer is easier to shoot down. */
	flight: number;
	/** Gravity scale for its arc. */
	gravity: number;
}

export interface EnemyDef {
	id: string;
	name: string;
	blurb: string;
	shape: EnemyShape;
	/** 1 is a 72-unit tall figure. */
	size: number;
	hp: number;
	/** Units per second. */
	speed: number;
	/** Hits the helmet and chest plate take before they fall off. */
	helmet: number;
	plate: number;
	/** A front shield that blocks arrows. Only blasts and Crown Shots break it: this many. 0 means none. */
	shield: number;
	melee: { damage: number; interval: number };
	flying?: { altitude: [number, number]; bob: number; dive: number };
	thrower?: { range: [number, number]; interval: number; windup: number; projectile: ProjectileDef };
	splits?: { into: string; count: number };
	/** Wave budget cost. 0 means it never spawns on its own. */
	cost: number;
	/** Score and combo are the same for all; gold comes from the fight. */
	art: string;
}

export const ENEMIES: Record<string, EnemyDef> = {
	walker: {
		id: 'walker',
		name: 'Walker',
		blurb: 'Slow and steady. Two body hits, or one to the head.',
		shape: 'biped',
		size: 1,
		hp: 2,
		speed: 44,
		helmet: 0,
		plate: 0,
		shield: 0,
		melee: { damage: 5, interval: 1.6 },
		cost: 1,
		art: 'walker',
	},
	runner: {
		id: 'runner',
		name: 'Runner',
		blurb: 'Fast and frail. Lead your shot.',
		shape: 'biped',
		size: 0.86,
		hp: 1,
		speed: 100,
		helmet: 0,
		plate: 0,
		shield: 0,
		melee: { damage: 4, interval: 1.1 },
		cost: 1.2,
		art: 'runner',
	},
	brute: {
		id: 'brute',
		name: 'Brute',
		blurb: 'Helmet and chest plate. Knock them off first.',
		shape: 'biped',
		size: 1.38,
		hp: 5,
		speed: 30,
		helmet: 1,
		plate: 2,
		shield: 0,
		melee: { damage: 11, interval: 2.1 },
		cost: 3.4,
		art: 'brute',
	},
	flyer: {
		id: 'flyer',
		name: 'Flyer',
		blurb: 'Flies high and dives. Aim up.',
		shape: 'flyer',
		size: 1,
		hp: 1,
		speed: 58,
		helmet: 0,
		plate: 0,
		shield: 0,
		melee: { damage: 5, interval: 2.2 },
		flying: { altitude: [190, 300], bob: 14, dive: 0.55 },
		cost: 1.5,
		art: 'flyer',
	},
	shield: {
		id: 'shield',
		name: 'Shield',
		blurb: 'A tall shield blocks flat shots. Lob over it.',
		shape: 'biped',
		size: 1.05,
		hp: 2,
		speed: 36,
		helmet: 0,
		plate: 0,
		shield: 3,
		melee: { damage: 6, interval: 1.7 },
		cost: 2.2,
		art: 'shield',
	},
	splitter: {
		id: 'splitter',
		name: 'Splitter',
		blurb: 'Bursts into two small runners when it falls.',
		shape: 'biped',
		size: 1.15,
		hp: 3,
		speed: 38,
		helmet: 0,
		plate: 0,
		shield: 0,
		melee: { damage: 6, interval: 1.7 },
		splits: { into: 'splitling', count: 2 },
		cost: 2.4,
		art: 'splitter',
	},
	splitling: {
		id: 'splitling',
		name: 'Splitling',
		blurb: 'Small, quick, one hit.',
		shape: 'biped',
		size: 0.62,
		hp: 1,
		speed: 70,
		helmet: 0,
		plate: 0,
		shield: 0,
		melee: { damage: 3, interval: 1 },
		cost: 0,
		art: 'splitling',
	},
	thrower: {
		id: 'thrower',
		name: 'Thrower',
		blurb: 'Stops far away and throws. Shoot the rocks down.',
		shape: 'biped',
		size: 1,
		hp: 2,
		speed: 46,
		helmet: 0,
		plate: 0,
		shield: 0,
		melee: { damage: 4, interval: 1.6 },
		thrower: {
			range: [560, 720],
			interval: 3.8,
			windup: 0.7,
			projectile: { kind: 'rock', radius: 9, hp: 1, damage: 6, flight: 1.9, gravity: 1 },
		},
		cost: 2.2,
		art: 'thrower',
	},
};
