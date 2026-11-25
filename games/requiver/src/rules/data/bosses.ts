// One boss per act. Each has one weak spot and a few patterns with a clear wind-up.
// Hitting the weak spot `staggerHits` times during a wind-up breaks the attack.

import type { ProjectileDef } from './enemies.ts';

export type BossPattern =
	| { kind: 'summon'; weight: number; windup: number; foes: [string, number][]; cooldown: number }
	| { kind: 'hurl'; weight: number; windup: number; count: number; gap: number; projectile: ProjectileDef; cooldown: number }
	| { kind: 'charge'; weight: number; windup: number; staggerHits: number; damage: number; cooldown: number }
	| { kind: 'guard'; weight: number; duration: number; cooldown: number };

export interface BossDef {
	id: string;
	name: string;
	title: string;
	/** Art key. */
	art: string;
	hp: number;
	/** Body hits deal this share of normal damage (the hide is thick). */
	bodyArmor: number;
	/** Speed when it walks or flies in. */
	speed: number;
	/** Where the boss stops to fight. */
	holdX: number;
	/** Flying bosses hover at this height above the ground. 0 walks. */
	altitude: number;
	/** Hit boxes relative to the boss anchor (feet for walkers, center for flyers). */
	body: { x: number; y: number; w: number; h: number };
	head: { x: number; y: number; r: number };
	/** The weak spot takes `mult` times damage. It is always open unless the boss guards. */
	weak: { x: number; y: number; r: number; mult: number };
	/** Damage when it reaches the archer. */
	contact: number;
	patterns: BossPattern[];
	/** Below this share of hp, wind-ups and cooldowns get shorter by `enrage`. */
	enrageAt: number;
	enrage: number;
	/** Foes that come with it at the start. */
	escort: [string, number][];
}

export const BOSSES: Record<string, BossDef> = {
	gatewarden: {
		id: 'gatewarden',
		name: 'The Gatewarden',
		title: 'Keeper of the Ember Fields',
		art: 'gatewarden',
		hp: 60,
		bodyArmor: 0.5,
		speed: 90,
		holdX: 640,
		altitude: 0,
		body: { x: -26, y: -150, w: 52, h: 150 },
		head: { x: 4, y: -176, r: 20 },
		weak: { x: -2, y: -112, r: 13, mult: 2.5 },
		contact: 14,
		patterns: [
			{ kind: 'summon', weight: 2, windup: 1.2, foes: [['walker', 2], ['runner', 1]], cooldown: 3.5 },
			{
				kind: 'hurl',
				weight: 3,
				windup: 1.1,
				count: 1,
				gap: 0,
				projectile: { kind: 'boulder', radius: 16, hp: 2, damage: 8, flight: 2.2, gravity: 1 },
				cooldown: 2.6,
			},
			{ kind: 'charge', weight: 2, windup: 2, staggerHits: 2, damage: 10, cooldown: 3 },
		],
		enrageAt: 0.5,
		enrage: 0.75,
		escort: [['walker', 2]],
	},
	kitequeen: {
		id: 'kitequeen',
		name: 'The Kite Queen',
		title: 'She Who Rides the Marsh Wind',
		art: 'kitequeen',
		hp: 105,
		bodyArmor: 0.5,
		speed: 110,
		holdX: 620,
		altitude: 250,
		body: { x: -44, y: -22, w: 88, h: 44 },
		head: { x: -46, y: -20, r: 15 },
		weak: { x: 6, y: 14, r: 13, mult: 2.5 },
		contact: 13,
		patterns: [
			{ kind: 'summon', weight: 2, windup: 1, foes: [['flyer', 3]], cooldown: 3.5 },
			{
				kind: 'hurl',
				weight: 3,
				windup: 0.9,
				count: 4,
				gap: 0.32,
				projectile: { kind: 'feather', radius: 8, hp: 1, damage: 4, flight: 1.7, gravity: 0.7 },
				cooldown: 2.8,
			},
			{ kind: 'charge', weight: 2, windup: 1.7, staggerHits: 2, damage: 11, cooldown: 3 },
		],
		enrageAt: 0.5,
		enrage: 0.75,
		escort: [['flyer', 2]],
	},
	hollowking: {
		id: 'hollowking',
		name: 'The Hollow King',
		title: 'Last Bow of the Violet Peaks',
		art: 'hollowking',
		hp: 280,
		bodyArmor: 0.45,
		speed: 80,
		holdX: 700,
		altitude: 0,
		body: { x: -28, y: -170, w: 56, h: 170 },
		head: { x: 0, y: -196, r: 20 },
		weak: { x: 0, y: -226, r: 12, mult: 2.2 },
		contact: 16,
		patterns: [
			{ kind: 'summon', weight: 2, windup: 1.2, foes: [['shield', 1], ['splitter', 1]], cooldown: 3.5 },
			{
				kind: 'hurl',
				weight: 3,
				windup: 1,
				count: 3,
				gap: 0.4,
				projectile: { kind: 'arrow', radius: 7, hp: 1, damage: 6, flight: 1.6, gravity: 1 },
				cooldown: 2.6,
			},
			{ kind: 'guard', weight: 1, duration: 3, cooldown: 1.5 },
			{ kind: 'charge', weight: 2, windup: 1.7, staggerHits: 3, damage: 16, cooldown: 3 },
		],
		enrageAt: 0.5,
		enrage: 0.7,
		escort: [['shield', 1], ['walker', 2]],
	},
};
