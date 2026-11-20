// The steps of the Sound Path. Each step picks one thing (key, a sound value), from its options.
// groups sort the options into sections. hear lists the play buttons of a card: [label, a key of SOUNDS].
// tap is what a tap on the card plays, and picture draws the card's picture.

import { BODIES } from '../../audio/instrument-bodies.js';
import { CLEAR_STYLES, CHAIN_STYLES, POWER_STYLES, SMALL_STYLES } from '../../feel/sound-styles.js';
import { drawBodyShape, drawClearNotes, drawChainNotes, drawPowerShape, drawSmallShape } from './card-pictures.js';

/** A step with all its options in one section. */
const oneGroup = (title) => [{ title, test: () => true }];

/** The mood picked on the clear step (it is part of what the clear step locks in). */
export const draft = { pick: null, mood: null };

export const STEPS = [
	{
		id: 'drop',
		label: 'The drop',
		title: 'Step 1 · The drop',
		intro: 'Pick the instrument. You hear it every time a piece lands, and the clear and the chain are built on it. Tap a card to hear a drop and then a clear.',
		key: 'body',
		groups: [
			{ title: 'You liked these', test: (option) => option.group === 'liked' },
			{ title: 'Cartoon', test: (option) => option.group === 'cartoon' },
			{ title: 'New to try', test: (option, name) => !option.group && name !== 'classic' },
			{ title: 'Today’s sound', test: (option, name) => name === 'classic' },
		],
		options: BODIES,
		values: (name) => ({ body: name }),
		hear: [
			['Drop', 'drop'],
			['Clear', 'clear'],
			['Chain', 'chain'],
		],
		tap: 'dropThenClear',
		picture: drawBodyShape,
	},
	{
		id: 'clear',
		label: 'Clear',
		title: 'Step 2 · The clear',
		intro: 'Pick how a clear plays its notes. Each card plays with your drop instrument. Pick a mood first: it sets the notes for every card.',
		key: 'clearStyle',
		mood: true,
		groups: oneGroup('Clear styles'),
		options: CLEAR_STYLES,
		values: (name) => ({ clearStyle: name, scale: draft.mood }),
		hear: [
			['Clear', 'clear'],
			['Big group', 'big'],
			['Chain', 'chain'],
		],
		tap: 'dropThenClear',
		picture: (card, name) => drawClearNotes(card, name, draft.mood),
	},
	{
		id: 'chain',
		label: 'Chain',
		title: 'Step 3 · The chain',
		intro: 'A chain is clears one after another. Pick how it builds, so a long chain feels bigger and bigger. Each card plays your clear.',
		key: 'chainStyle',
		groups: oneGroup('Chain styles'),
		options: CHAIN_STYLES,
		values: (name) => ({ chainStyle: name }),
		hear: [
			['Chain of 5', 'chain'],
			['Long chain', 'chainLong'],
		],
		tap: 'chain',
		picture: drawChainNotes,
	},
	{
		id: 'power',
		label: 'Power-ups',
		title: 'Step 4 · Power-ups and big moments',
		intro: 'The loud, special sounds: earning a power-up, a Blast, a Remix, an all clear, game over and a new best. Tap a card to hear a power-up earned and then a Blast.',
		key: 'powerStyle',
		groups: oneGroup('Power-up sets'),
		options: POWER_STYLES,
		values: (name) => ({ powerStyle: name }),
		hear: [
			['Earned', 'powerUpEarned'],
			['Blast', 'blast'],
			['Remix', 'remix'],
			['All clear', 'allClear'],
			['Game over', 'gameOver'],
			['New best', 'best'],
		],
		tap: 'earnedThenBlast',
		picture: drawPowerShape,
	},
	{
		id: 'small',
		label: 'Small sounds',
		title: 'Step 5 · The small sounds',
		intro: 'The little sounds you hear all the time: a button tap, picking up a piece, moving it, "no", and the clock tick in Timed. They should be easy on the ear. Tap a card to hear a few in a row.',
		key: 'smallStyle',
		groups: oneGroup('Small-sound sets'),
		options: SMALL_STYLES,
		values: (name) => ({ smallStyle: name }),
		hear: [
			['Tap', 'ui'],
			['Pick up', 'pick'],
			['Move', 'move'],
			['No', 'deny'],
			['Tick', 'tick'],
		],
		tap: 'smallDemo',
		picture: drawSmallShape,
	},
	{ id: 'done', label: 'Your sound', title: 'Your sound', summary: true },
];
