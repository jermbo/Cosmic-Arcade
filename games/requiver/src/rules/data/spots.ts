// Spot types on the map. `resolve` names the code that runs the spot.
// To add a spot type that reuses a resolver, add an entry here only.

export type Resolver = 'battle' | 'shop' | 'rest' | 'event' | 'treasure';

export interface SpotDef {
	id: string;
	name: string;
	blurb: string;
	/** Art key for its map icon. */
	icon: string;
	resolve: Resolver;
	/** For battles: the fight kind. */
	fight?: 'fight' | 'elite' | 'boss';
	/** Weight when a row picks a random spot. 0 means only placed by `fixed` rows. */
	weight: number;
	/** First and last row (0 based) where it can be picked at random. */
	rows: [number, number];
	/** At most this many per act. */
	max: number;
	/** It never follows a spot of the same type on a path. */
	noRepeat: boolean;
}

export const SPOTS: Record<string, SpotDef> = {
	fight: {
		id: 'fight',
		name: 'Fight',
		blurb: 'A few waves. Pick a boost after.',
		icon: 'fight',
		resolve: 'battle',
		fight: 'fight',
		weight: 46,
		rows: [0, 6],
		max: 99,
		noRepeat: false,
	},
	elite: {
		id: 'elite',
		name: 'Elite',
		blurb: 'Hard waves with elite foes. Better rewards.',
		icon: 'elite',
		resolve: 'battle',
		fight: 'elite',
		weight: 13,
		rows: [2, 5],
		max: 2,
		noRepeat: true,
	},
	shop: {
		id: 'shop',
		name: 'Shop',
		blurb: 'Buy boosts, healing and upgrades.',
		icon: 'shop',
		resolve: 'shop',
		weight: 11,
		rows: [2, 5],
		max: 2,
		noRepeat: true,
	},
	rest: {
		id: 'rest',
		name: 'Rest',
		blurb: 'Heal, or train a boost one level up.',
		icon: 'rest',
		resolve: 'rest',
		weight: 9,
		rows: [3, 5],
		max: 2,
		noRepeat: true,
	},
	event: {
		id: 'event',
		name: 'Event',
		blurb: 'Something odd on the road.',
		icon: 'event',
		resolve: 'event',
		weight: 18,
		rows: [1, 5],
		max: 4,
		noRepeat: false,
	},
	treasure: {
		id: 'treasure',
		name: 'Treasure',
		blurb: 'Gold and a rare boost.',
		icon: 'treasure',
		resolve: 'treasure',
		weight: 6,
		rows: [2, 5],
		max: 1,
		noRepeat: true,
	},
	boss: {
		id: 'boss',
		name: 'Boss',
		blurb: 'The master of this land.',
		icon: 'boss',
		resolve: 'battle',
		fight: 'boss',
		weight: 0,
		rows: [7, 7],
		max: 1,
		noRepeat: true,
	},
};
