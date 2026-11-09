import { DEFAULT_ROSTERS, DEFAULT_WEIGHTS, type FightType, type RolledType } from './nodes.ts';

export interface LayerDef {
	index: number;
	code: string;
	name: string;
	blurb: string;
	rosters: Record<FightType, string[]>;
	weights: Record<RolledType, number>;
}

type LayerInput = Omit<LayerDef, 'rosters' | 'weights' | 'index'> & {
	rosters: Partial<Record<FightType, string[]>>;
	weights?: Partial<Record<RolledType, number>>;
};

const input: LayerInput[] = [
	{
		code: 'L1',
		name: 'THE GALLERY',
		blurb: 'Public showroom. Soft ICE, loud alarms.',
		rosters: {
			combat: ['crawler', 'crawler'],
			cache: ['crawler', 'lockjaw'],
			unknown: ['unknown_a', 'crawler'],
			elite: ['sentry', 'crawler', 'crawler'],
			gate: ['sentry', 'sentry'],
		},
		weights: { combat: 46, cache: 20, unknown: 18, elite: 12 },
	},
	{
		code: 'L2',
		name: 'THE SUMP',
		blurb: 'Waste routing. Lone heavies in the runoff.',
		rosters: {
			combat: ['sentry'],
			cache: ['lockjaw'],
			unknown: ['sentry'],
			elite: ['hunter'],
			gate: ['hunter'],
		},
		weights: { combat: 44, cache: 22, unknown: 16, elite: 18 },
	},
	{
		code: 'L3',
		name: 'THE WATCH',
		blurb: 'Surveillance mesh. Every packet logged.',
		rosters: {
			combat: ['sentry', 'crawler'],
			cache: ['lockjaw', 'crawler'],
			unknown: ['unknown_a', 'unknown_b'],
			elite: ['hunter', 'sentry'],
			gate: ['sentry', 'lockjaw'],
		},
		weights: { combat: 50, cache: 18, unknown: 16, elite: 16 },
	},
	{
		code: 'L4',
		name: 'THE PURGE',
		blurb: 'Deletion floor. Lockjaw packs chew everything.',
		rosters: {
			combat: ['lockjaw', 'lockjaw'],
			cache: ['lockjaw'],
			unknown: ['unknown_b', 'lockjaw'],
			elite: ['hunter', 'lockjaw'],
			gate: ['lockjaw', 'lockjaw'],
		},
		weights: { combat: 42, cache: 20, unknown: 20, elite: 18 },
	},
	{
		code: 'L5',
		name: 'THE CORE',
		blurb: 'Root vault. The Warden keeps the keys.',
		rosters: {
			combat: ['sentry', 'crawler'],
			cache: ['lockjaw', 'sentry'],
			unknown: ['unknown_a', 'unknown_b'],
			elite: ['hunter', 'sentry', 'crawler'],
			gate: ['hunter', 'sentry'],
		},
		weights: { combat: 40, cache: 18, unknown: 18, elite: 24 },
	},
];

export const LAYERS: LayerDef[] = input.map((layer, index) => ({
	...layer,
	index,
	rosters: { ...DEFAULT_ROSTERS, ...layer.rosters, boss: ['warden'] },
	weights: { ...DEFAULT_WEIGHTS, ...layer.weights },
}));
