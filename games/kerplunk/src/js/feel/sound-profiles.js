// The sound profiles the player can buy in the shop. A profile is a whole matched set:
// the instrument, the clear, the mood, the chain, the power-ups and the small sounds.
// The first one ("Wooden") changes nothing: it plays the tuning the game loaded.

import { SOUND_PRICES } from '../shop/prices.js';

// The sound keys a profile sets. Everything else (volumes, echo, the thud) stays as tuned.
export const PROFILE_KEYS = ['body', 'clearStyle', 'scale', 'chainStyle', 'powerStyle', 'smallStyle'];

const profile = (id, name, text, values) => ({ id, name, text, price: SOUND_PRICES[id], values });

export const SOUND_PROFILES = [
	profile('wooden', 'Wooden', 'Warm wooden bars. The sound Kerplunk was born with.', {}),
	profile('bubbles', 'Bubbles', 'Round water blips that swoop up. Bubbly taps too.', {
		body: 'bubble',
		clearStyle: 'hop',
		scale: 'pentatonic',
		chainStyle: 'climb',
		powerStyle: 'instrument',
		smallStyle: 'bubbly',
	}),
	profile('thumbPiano', 'Thumb piano', 'A soft kalimba. Chains get a sparkle on top.', {
		body: 'kalimba',
		clearStyle: 'strum',
		scale: 'pentatonic',
		chainStyle: 'shine',
		powerStyle: 'instrument',
		smallStyle: 'soft',
	}),
	profile('woodshop', 'Woodshop', 'Dry wooden tocks with a cheeky tune.', {
		body: 'woodblock',
		clearStyle: 'rise',
		scale: 'blues',
		chainStyle: 'leap',
		powerStyle: 'instrument',
		smallStyle: 'clicky',
	}),
	profile('musicBox', 'Music box', 'Tiny, sweet and a bit magic.', {
		body: 'musicBox',
		clearStyle: 'sparkle',
		scale: 'dreamy',
		chainStyle: 'shine',
		powerStyle: 'magic',
		smallStyle: 'soft',
	}),
	profile('glass', 'Glass', 'Clear glass bells that swell as a chain grows.', {
		body: 'glassBell',
		clearStyle: 'rise',
		scale: 'dreamy',
		chainStyle: 'swell',
		powerStyle: 'magic',
		smallStyle: 'soft',
	}),
	profile('island', 'Island', 'Sunny steel drums that bounce.', {
		body: 'steelDrum',
		clearStyle: 'bounce',
		scale: 'major',
		chainStyle: 'leap',
		powerStyle: 'instrument',
		smallStyle: 'clicky',
	}),
	profile('cozyKeys', 'Cozy keys', 'A hushed felt piano. Easy on the ears.', {
		body: 'feltPiano',
		clearStyle: 'chord',
		scale: 'major',
		chainStyle: 'stack',
		powerStyle: 'instrument',
		smallStyle: 'hush',
	}),
	profile('zen', 'Zen', 'A plucked koto in a calm, moody key.', {
		body: 'koto',
		clearStyle: 'strum',
		scale: 'minor',
		chainStyle: 'shine',
		powerStyle: 'magic',
		smallStyle: 'hush',
	}),
	profile('cartoon', 'Cartoon', 'Boings, whaps, a laser Blast and a slide-whistle Remix.', {
		body: 'boing',
		clearStyle: 'bounce',
		scale: 'blues',
		chainStyle: 'leap',
		powerStyle: 'cartoon',
		smallStyle: 'cartoon',
	}),
	profile('arcade', 'Arcade', 'Coin blips and 8-bit sweeps.', {
		body: 'coin',
		clearStyle: 'sparkle',
		scale: 'major',
		chainStyle: 'leap',
		powerStyle: 'arcade',
		smallStyle: 'soft',
	}),
	profile('space', 'Space', 'Pew pew. Every drop is a laser.', {
		body: 'laser',
		clearStyle: 'cascade',
		scale: 'minor',
		chainStyle: 'swell',
		powerStyle: 'arcade',
		smallStyle: 'hush',
	}),
];

/** The profile with this id. An unknown id gets the first (free) one. */
export const findSound = (id) => SOUND_PROFILES.find((item) => item.id === id) || SOUND_PROFILES[0];
