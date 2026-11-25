// Events: a short scene with choices. Each choice rolls one weighted outcome.
// `locked` events need their unlock node ("event:<unlock>") in the upgrade tree.

import type { Rarity } from './boosts.ts';

export type Effect =
	| { type: 'gold'; amount: number }
	| { type: 'hp'; amount: number }
	| { type: 'maxHp'; amount: number }
	| { type: 'boostChoice'; rarity: Rarity }
	| { type: 'boost'; id: string }
	| { type: 'upgradeRandom' }
	| { type: 'loseRandomBoost' }
	| { type: 'slot'; amount: number }
	| { type: 'feathers'; amount: number }
	| { type: 'fight'; kind: 'fight' | 'elite' };

export interface Outcome {
	weight: number;
	text: string;
	effects: Effect[];
}

export interface Choice {
	label: string;
	/** The choice is greyed out without these. */
	needs?: { gold?: number; boosts?: number; hp?: number };
	outcomes: Outcome[];
}

export interface EventDef {
	id: string;
	title: string;
	text: string;
	/** Acts (0 based) where it can appear. */
	acts: number[];
	weight: number;
	unlock?: string;
	choices: Choice[];
}

export const EVENTS: Record<string, EventDef> = {
	cart: {
		id: 'cart',
		title: "The Fletcher's Cart",
		text: 'A cart lies on its side. Arrows spill out of a cracked crate. Something moves under the tarp.',
		acts: [0, 1, 2],
		weight: 10,
		choices: [
			{
				label: 'Take the arrows and go',
				outcomes: [{ weight: 1, text: 'Good arrows. You choose one bundle.', effects: [{ type: 'boostChoice', rarity: 'common' }] }],
			},
			{
				label: 'Lift the tarp',
				outcomes: [
					{ weight: 1, text: "The fletcher's purse. Nobody needs it now.", effects: [{ type: 'gold', amount: 45 }] },
					{ weight: 1, text: 'Wild dogs. You fight your way out.', effects: [{ type: 'fight', kind: 'fight' }] },
				],
			},
		],
	},
	well: {
		id: 'well',
		title: 'The Wishing Well',
		text: 'A dry well hums when you lean over it. Coins glint far below.',
		acts: [0, 1, 2],
		weight: 8,
		choices: [
			{
				label: 'Drop 20 gold',
				needs: { gold: 20 },
				outcomes: [
					{ weight: 3, text: 'Warm air rises. You feel whole.', effects: [{ type: 'gold', amount: -20 }, { type: 'hp', amount: 18 }] },
					{ weight: 1, text: 'Nothing. The well keeps the coin.', effects: [{ type: 'gold', amount: -20 }] },
				],
			},
			{
				label: 'Drop 60 gold',
				needs: { gold: 60 },
				outcomes: [{ weight: 1, text: 'The hum turns to a chord. One of your boosts grows.', effects: [{ type: 'gold', amount: -60 }, { type: 'upgradeRandom' }] }],
			},
			{ label: 'Walk on', outcomes: [{ weight: 1, text: 'You keep your coins.', effects: [] }] },
		],
	},
	shrine: {
		id: 'shrine',
		title: 'The Burnt Shrine',
		text: 'An old shrine still smoulders. A coal glows in the bowl, red as the sky.',
		acts: [0, 1],
		weight: 7,
		choices: [
			{
				label: 'Pray',
				outcomes: [{ weight: 1, text: 'You rest a while in the warmth.', effects: [{ type: 'hp', amount: 14 }] }],
			},
			{
				label: 'Take the coal (lose 6 max health)',
				needs: { hp: 7 },
				outcomes: [{ weight: 1, text: 'It burns your hand. Your arrows burn too.', effects: [{ type: 'maxHp', amount: -6 }, { type: 'boost', id: 'fire' }] }],
			},
		],
	},
	crows: {
		id: 'crows',
		title: 'The Crow Market',
		text: 'Crows in cloaks trade shiny things on a stump. They eye your quiver.',
		acts: [0, 1, 2],
		weight: 6,
		choices: [
			{
				label: 'Trade a random boost for 70 gold',
				needs: { boosts: 1 },
				outcomes: [{ weight: 1, text: 'A crow flies off with it. You count the coins.', effects: [{ type: 'loseRandomBoost' }, { type: 'gold', amount: 70 }] }],
			},
			{
				label: 'Buy a mystery bundle (40 gold)',
				needs: { gold: 40 },
				outcomes: [
					{ weight: 2, text: 'An odd bundle. Pick one.', effects: [{ type: 'gold', amount: -40 }, { type: 'boostChoice', rarity: 'uncommon' }] },
					{ weight: 1, text: 'A rare find. Pick one.', effects: [{ type: 'gold', amount: -40 }, { type: 'boostChoice', rarity: 'rare' }] },
				],
			},
			{ label: 'Leave', outcomes: [{ weight: 1, text: 'The crows laugh as you go.', effects: [] }] },
		],
	},
	tree: {
		id: 'tree',
		title: 'The Hollow Tree',
		text: 'A huge tree, hollow inside. Dry, quiet, safe.',
		acts: [0, 1, 2],
		weight: 8,
		choices: [
			{ label: 'Sleep', outcomes: [{ weight: 1, text: 'You wake with the stars.', effects: [{ type: 'hp', amount: 20 }] }] },
			{
				label: 'Climb to the top',
				outcomes: [
					{ weight: 2, text: 'A nest of lost coins.', effects: [{ type: 'gold', amount: 30 }] },
					{ weight: 1, text: 'You find a feather worth keeping.', effects: [{ type: 'feathers', amount: 8 }] },
				],
			},
		],
	},
	duel: {
		id: 'duel',
		title: 'The Wandering Archer',
		text: 'A thin figure with a bow taller than itself bows to you. It points at a far target.',
		acts: [1, 2],
		weight: 6,
		choices: [
			{
				label: 'Learn from it (35 gold)',
				needs: { gold: 35 },
				outcomes: [{ weight: 1, text: 'A small trick of the wrist. One boost grows.', effects: [{ type: 'gold', amount: -35 }, { type: 'upgradeRandom' }] }],
			},
			{
				label: 'Challenge it',
				outcomes: [
					{ weight: 1, text: 'You win. It leaves you its spare string.', effects: [{ type: 'boost', id: 'heavystring' }] },
					{ weight: 1, text: 'You lose. Its last arrow grazes you.', effects: [{ type: 'hp', amount: -10 }, { type: 'feathers', amount: 6 }] },
				],
			},
		],
	},
	statue: {
		id: 'statue',
		title: 'The Cracked Statue',
		text: 'A stone archer, split down the middle. Something bright sits in the crack.',
		acts: [0, 1, 2],
		weight: 6,
		unlock: 'statue',
		choices: [
			{
				label: 'Reach in (lose 12 health)',
				needs: { hp: 13 },
				outcomes: [{ weight: 1, text: 'The stone bites. The prize is yours.', effects: [{ type: 'hp', amount: -12 }, { type: 'boostChoice', rarity: 'rare' }] }],
			},
			{ label: 'Leave it', outcomes: [{ weight: 1, text: 'Some things should stay where they are.', effects: [] }] },
		],
	},
	quiver: {
		id: 'quiver',
		title: 'The Lost Quiver',
		text: 'A fine quiver hangs on a branch. A note says: "Ten coins, or it bites."',
		acts: [0, 1, 2],
		weight: 4,
		unlock: 'statue',
		choices: [
			{
				label: 'Pay 30 gold',
				needs: { gold: 30 },
				outcomes: [{ weight: 1, text: 'It fits like it was made for you. +1 boost slot.', effects: [{ type: 'gold', amount: -30 }, { type: 'slot', amount: 1 }] }],
			},
			{
				label: 'Just take it',
				outcomes: [
					{ weight: 1, text: 'Nothing bites. +1 boost slot.', effects: [{ type: 'slot', amount: 1 }] },
					{ weight: 1, text: 'Its owner was waiting.', effects: [{ type: 'fight', kind: 'elite' }] },
				],
			},
		],
	},
};
