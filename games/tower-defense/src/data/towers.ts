export type TowerId = 'ballista' | 'cannon' | 'crystal' | 'catapult';
export type Branch = 'a' | 'b';
export type Targeting = 'first' | 'strong' | 'close';

export interface TowerStats {
	damage: number;
	range: number;
	/** Seconds between shots. */
	rate: number;
	pierce?: number;
	splash?: number;
	slow?: number;
	slowTime?: number;
	stun?: number;
	/** Extra damage that slowed enemies take from every tower, as a fraction. */
	shatter?: number;
	shots?: number;
	spread?: number;
	speed?: number;
}

export interface TowerLevel {
	cost: number;
	name: string;
	blurb: string;
	stats: TowerStats;
	parts: string[];
	/** Color of the branch flag at level 3. */
	flag?: number;
	/** Tint of the crystal top, for the crystal tower. */
	tint?: number;
}

export interface TowerDef {
	id: TowerId;
	name: string;
	role: string;
	key: string;
	hitsFlying: boolean;
	weapon: string;
	levels: [TowerLevel, TowerLevel];
	branches: Record<Branch, TowerLevel>;
}

export const BRANCH_A_COLOR = 0xffc23d;
export const BRANCH_B_COLOR = 0x4fd6ff;

export const TOWERS: Record<TowerId, TowerDef> = {
	ballista: {
		id: 'ballista',
		name: 'Ballista',
		role: 'Pierce',
		key: '1',
		hitsFlying: true,
		weapon: 'weapon-ballista',
		levels: [
			{
				cost: 70,
				name: 'Ballista',
				blurb: 'Bolts fly through a line of UFOs.',
				stats: { damage: 14, range: 3.2, rate: 0.95, pierce: 3, speed: 16 },
				parts: ['tower-round-bottom-a'],
			},
			{
				cost: 65,
				name: 'Heavy Ballista',
				blurb: 'Harder bolts that pierce more.',
				stats: { damage: 24, range: 3.5, rate: 0.85, pierce: 4, speed: 17 },
				parts: ['tower-round-bottom-a', 'tower-round-middle-a'],
			},
		],
		branches: {
			a: {
				cost: 140,
				name: 'Volley',
				blurb: 'Three bolts in a fan.',
				stats: { damage: 26, range: 3.7, rate: 0.8, pierce: 4, shots: 3, spread: 0.22, speed: 17 },
				parts: ['tower-round-bottom-b', 'tower-round-middle-b', 'tower-round-top-a'],
				flag: BRANCH_A_COLOR,
			},
			b: {
				cost: 160,
				name: 'Rail Bolt',
				blurb: 'Pierces everything. Huge range.',
				stats: { damage: 75, range: 5.5, rate: 1.5, pierce: 99, speed: 34 },
				parts: ['tower-round-bottom-c', 'tower-round-middle-c', 'tower-round-top-c'],
				flag: BRANCH_B_COLOR,
			},
		},
	},
	cannon: {
		id: 'cannon',
		name: 'Cannon',
		role: 'Splash',
		key: '2',
		hitsFlying: true,
		weapon: 'weapon-cannon',
		levels: [
			{
				cost: 90,
				name: 'Cannon',
				blurb: 'Shells burst and hit a small crowd.',
				stats: { damage: 20, range: 2.7, rate: 1.4, splash: 0.85, speed: 9 },
				parts: ['tower-square-bottom-a'],
			},
			{
				cost: 80,
				name: 'Mortar',
				blurb: 'Bigger shells, bigger bursts.',
				stats: { damage: 32, range: 2.9, rate: 1.3, splash: 1.0, speed: 9 },
				parts: ['tower-square-bottom-a', 'tower-square-middle-a'],
			},
		],
		branches: {
			a: {
				cost: 160,
				name: 'Big Bore',
				blurb: 'Massive blasts over a wide area.',
				stats: { damage: 60, range: 3.1, rate: 1.6, splash: 1.6, speed: 8 },
				parts: ['tower-square-bottom-b', 'tower-square-middle-b', 'tower-square-top-a'],
				flag: BRANCH_A_COLOR,
			},
			b: {
				cost: 150,
				name: 'Rapid Fire',
				blurb: 'Small shells, very fast.',
				stats: { damage: 26, range: 3.0, rate: 0.42, splash: 0.85, speed: 12 },
				parts: ['tower-square-bottom-c', 'tower-square-middle-c', 'tower-square-top-c'],
				flag: BRANCH_B_COLOR,
			},
		},
	},
	crystal: {
		id: 'crystal',
		name: 'Frost Crystal',
		role: 'Slow',
		key: '3',
		hitsFlying: true,
		weapon: 'tower-round-crystals',
		levels: [
			{
				cost: 80,
				name: 'Frost Crystal',
				blurb: 'Pulses that slow every UFO nearby.',
				stats: { damage: 4, range: 2.0, rate: 1.2, slow: 0.35, slowTime: 1.6 },
				parts: ['tower-square-bottom-b'],
			},
			{
				cost: 70,
				name: 'Glacier Crystal',
				blurb: 'Stronger slow, wider pulse.',
				stats: { damage: 7, range: 2.4, rate: 1.1, slow: 0.45, slowTime: 1.8 },
				parts: ['tower-square-bottom-b', 'tower-square-middle-a'],
			},
		],
		branches: {
			a: {
				cost: 130,
				name: 'Deep Freeze',
				blurb: 'Heavy slow. Pulses freeze UFOs for a moment.',
				stats: { damage: 10, range: 2.6, rate: 1.2, slow: 0.6, slowTime: 2, stun: 0.45 },
				parts: ['tower-square-bottom-b', 'tower-square-middle-b', 'tower-square-top-b'],
				flag: BRANCH_A_COLOR,
				tint: 0x9fe8ff,
			},
			b: {
				cost: 140,
				name: 'Shatter',
				blurb: 'Slowed UFOs take 40% more damage from all towers.',
				stats: { damage: 14, range: 2.6, rate: 1.0, slow: 0.45, slowTime: 2, shatter: 0.4 },
				parts: ['tower-square-bottom-b', 'tower-square-middle-c', 'tower-square-top-c'],
				flag: BRANCH_B_COLOR,
				tint: 0xff8ae6,
			},
		},
	},
	catapult: {
		id: 'catapult',
		name: 'Catapult',
		role: 'Long range',
		key: '4',
		hitsFlying: false,
		weapon: 'weapon-catapult',
		levels: [
			{
				cost: 110,
				name: 'Catapult',
				blurb: 'Huge range, heavy rocks. Cannot hit high flyers.',
				stats: { damage: 42, range: 4.6, rate: 2.4, splash: 0.7, speed: 6 },
				parts: ['tower-round-bottom-b'],
			},
			{
				cost: 95,
				name: 'Trebuchet',
				blurb: 'Heavier rocks, more range.',
				stats: { damage: 70, range: 5.1, rate: 2.3, splash: 0.75, speed: 6.5 },
				parts: ['tower-round-bottom-b', 'tower-round-middle-a'],
			},
		],
		branches: {
			a: {
				cost: 170,
				name: 'Boulder Storm',
				blurb: 'Throws three boulders at once.',
				stats: { damage: 58, range: 5.3, rate: 2.3, splash: 0.85, shots: 3, speed: 6.5 },
				parts: ['tower-round-bottom-b', 'tower-round-middle-b', 'tower-round-top-a'],
				flag: BRANCH_A_COLOR,
			},
			b: {
				cost: 180,
				name: 'Siege Arm',
				blurb: 'Map-wide range. One crushing rock.',
				stats: { damage: 190, range: 8, rate: 2.7, splash: 0.9, speed: 8 },
				parts: ['tower-round-bottom-c', 'tower-round-middle-c', 'tower-round-top-b'],
				flag: BRANCH_B_COLOR,
			},
		},
	},
};

export const TOWER_ORDER: TowerId[] = ['ballista', 'cannon', 'crystal', 'catapult'];

export const SELL_RATE = 0.7;
