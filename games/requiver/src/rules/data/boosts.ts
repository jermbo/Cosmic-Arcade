// Run boosts. Each level holds the full effect at that level (levels do not stack).
// `locked` boosts appear only after their unlock node in the upgrade tree is bought.

import type { StatMod } from '../stats.ts';

export type BoostKind = 'arrow' | 'bow' | 'armor' | 'defense';
export type Rarity = 'common' | 'uncommon' | 'rare';

export interface BoostDef {
	id: string;
	name: string;
	kind: BoostKind;
	rarity: Rarity;
	/** Art key for its icon. */
	icon: string;
	/** One line per level. */
	text: string[];
	levels: StatMod[];
	locked?: boolean;
	/** Shown on the card: boosts it combines well with. */
	combos: string[];
}

export const BOOSTS: Record<string, BoostDef> = {
	split: {
		id: 'split',
		name: 'Splitting Head',
		kind: 'arrow',
		rarity: 'uncommon',
		icon: 'split',
		text: ['At the top of its arc, an arrow splits in 2.', 'Splits in 3.', 'Splits in 4.'],
		levels: [{ set: { split: 2 } }, { set: { split: 3 } }, { set: { split: 4 } }],
		combos: ['explosive', 'fire'],
	},
	fire: {
		id: 'fire',
		name: 'Ember Tips',
		kind: 'arrow',
		rarity: 'common',
		icon: 'fire',
		text: ['Hits set foes on fire for 3s.', 'Burns hotter. Burning foes spread fire when they fall.', 'Burns hotter and longer. Spreads.'],
		levels: [
			{ set: { fire: 0.6, fireTime: 3 } },
			{ set: { fire: 0.8, fireTime: 3.5, fireSpread: 1 } },
			{ set: { fire: 1.1, fireTime: 4, fireSpread: 1 } },
		],
		combos: ['split', 'pierce'],
	},
	ice: {
		id: 'ice',
		name: 'Frost Fletching',
		kind: 'arrow',
		rarity: 'common',
		icon: 'ice',
		text: ['Hits slow foes by 35% for 2.5s.', 'Slows by 50% for 3s.', 'Slows by 60%. Chilled foes take +1 damage.'],
		levels: [{ set: { ice: 0.35, iceTime: 2.5 } }, { set: { ice: 0.5, iceTime: 3 } }, { set: { ice: 0.6, iceTime: 3.5, brittle: 1 } }],
		combos: ['spikes', 'extranock'],
	},
	pierce: {
		id: 'pierce',
		name: 'Needle Point',
		kind: 'arrow',
		rarity: 'common',
		icon: 'pierce',
		text: ['Arrows go through 1 foe.', 'Through 2 foes.', 'Through 4 foes.'],
		levels: [{ add: { pierce: 1 } }, { add: { pierce: 2 } }, { add: { pierce: 4 } }],
		combos: ['fire', 'heavystring'],
	},
	bounce: {
		id: 'bounce',
		name: 'Skipping Stone',
		kind: 'arrow',
		rarity: 'uncommon',
		icon: 'bounce',
		text: ['Arrows skip off the ground once.', 'Skip twice.', 'Skip twice. Each skip adds +1 damage.'],
		levels: [{ add: { bounce: 1 } }, { add: { bounce: 2 } }, { add: { bounce: 2, bounceDamage: 1 } }],
		locked: true,
		combos: ['explosive', 'pierce'],
	},
	homing: {
		id: 'homing',
		name: 'Seeker Feathers',
		kind: 'arrow',
		rarity: 'rare',
		icon: 'homing',
		text: ['Arrows bend a little toward heads.', 'Bend more.', 'Bend hard toward heads.'],
		levels: [{ set: { homing: 70 } }, { set: { homing: 120 } }, { set: { homing: 190 } }],
		locked: true,
		combos: ['extranock', 'quickdraw'],
	},
	explosive: {
		id: 'explosive',
		name: 'Blast Cap',
		kind: 'arrow',
		rarity: 'rare',
		icon: 'explosive',
		text: ['Arrows burst where they land. Blasts knock off armor.', 'Bigger burst.', 'Bigger burst, 2 damage.'],
		levels: [{ set: { explosive: 46, blast: 1 } }, { set: { explosive: 62, blast: 1 } }, { set: { explosive: 78, blast: 2 } }],
		locked: true,
		combos: ['split', 'bounce'],
	},
	quickdraw: {
		id: 'quickdraw',
		name: 'Quick Draw',
		kind: 'bow',
		rarity: 'common',
		icon: 'quickdraw',
		text: ['Pull 22% faster. Shorter wait between shots.', 'Pull 38% faster.', 'Pull 50% faster.'],
		levels: [
			{ mult: { drawTime: 0.78, cooldown: 0.85 } },
			{ mult: { drawTime: 0.62, cooldown: 0.72 } },
			{ mult: { drawTime: 0.5, cooldown: 0.6 } },
		],
		combos: ['homing', 'fire'],
	},
	heavystring: {
		id: 'heavystring',
		name: 'Heavy String',
		kind: 'bow',
		rarity: 'common',
		icon: 'power',
		text: ['+50% damage. Arrows fly a bit faster.', '+100% damage.', '+150% damage, faster arrows.'],
		levels: [
			{ add: { damage: 0.5 }, mult: { speedMult: 1.05 } },
			{ add: { damage: 1 }, mult: { speedMult: 1.07 } },
			{ add: { damage: 1.5 }, mult: { speedMult: 1.12 } },
		],
		combos: ['pierce', 'bounce'],
	},
	extranock: {
		id: 'extranock',
		name: 'Extra Nock',
		kind: 'bow',
		rarity: 'uncommon',
		icon: 'multishot',
		text: ['Shoot 2 arrows at once.', 'Shoot 3 arrows.', 'Shoot 4 arrows.'],
		levels: [{ add: { arrows: 1 } }, { add: { arrows: 2 } }, { add: { arrows: 3 } }],
		combos: ['homing', 'ice'],
	},
	stoutheart: {
		id: 'stoutheart',
		name: 'Stout Heart',
		kind: 'armor',
		rarity: 'common',
		icon: 'heart',
		text: ['+15 max health.', '+30 max health.', '+45 max health.'],
		levels: [{ add: { maxHp: 15 } }, { add: { maxHp: 30 } }, { add: { maxHp: 45 } }],
		combos: ['dressing', 'bramble'],
	},
	ward: {
		id: 'ward',
		name: 'Ward Charm',
		kind: 'armor',
		rarity: 'uncommon',
		icon: 'ward',
		text: ['Block the first hit of each fight.', 'Block the first 2 hits.', 'Block the first 3 hits.'],
		levels: [{ add: { block: 1 } }, { add: { block: 2 } }, { add: { block: 3 } }],
		combos: ['bramble', 'palisade'],
	},
	bramble: {
		id: 'bramble',
		name: 'Bramble Coat',
		kind: 'armor',
		rarity: 'common',
		icon: 'thorns',
		text: ['Foes that hit you or your wall take 1 damage.', 'They take 2.', 'They take 3.'],
		levels: [{ add: { thorns: 1 } }, { add: { thorns: 2 } }, { add: { thorns: 3 } }],
		combos: ['palisade', 'stoutheart'],
	},
	dressing: {
		id: 'dressing',
		name: 'Field Dressing',
		kind: 'armor',
		rarity: 'common',
		icon: 'mend',
		text: ['Heal 5 after each fight.', 'Heal 9 after each fight.', 'Heal 14 after each fight.'],
		levels: [{ add: { mend: 5 } }, { add: { mend: 9 } }, { add: { mend: 14 } }],
		combos: ['stoutheart', 'ward'],
	},
	palisade: {
		id: 'palisade',
		name: 'Palisade',
		kind: 'defense',
		rarity: 'uncommon',
		icon: 'wall',
		text: ['A wall with 30 health stops walkers each fight.', 'Wall with 50 health.', 'Wall with 80 health.'],
		levels: [{ set: { wall: 30 } }, { set: { wall: 50 } }, { set: { wall: 80 } }],
		combos: ['bramble', 'caltrops'],
	},
	caltrops: {
		id: 'caltrops',
		name: 'Caltrops',
		kind: 'defense',
		rarity: 'common',
		icon: 'spikes',
		text: ['Spikes in front of you hurt and slow foes.', 'Sharper spikes.', 'Cruel spikes. Foes crawl.'],
		levels: [
			{ set: { spikes: 0.5, spikesSlow: 0.3 } },
			{ set: { spikes: 0.8, spikesSlow: 0.4 } },
			{ set: { spikes: 1.2, spikesSlow: 0.55 } },
		],
		combos: ['palisade', 'ice'],
	},
	squire: {
		id: 'squire',
		name: 'Squire',
		kind: 'defense',
		rarity: 'uncommon',
		icon: 'helper',
		text: ['A squire shoots the nearest foe every 2.6s.', 'Shoots every 2s.', 'Shoots every 1.5s, with your arrow boosts.'],
		levels: [{ set: { helper: 2.6 } }, { set: { helper: 2 } }, { set: { helper: 1.5, helperInherit: 1 } }],
		locked: true,
		combos: ['fire', 'explosive'],
	},
};

export const BOOST_KIND_NAMES: Record<BoostKind, string> = {
	arrow: 'Arrow',
	bow: 'Bow',
	armor: 'Armor',
	defense: 'Defense',
};
