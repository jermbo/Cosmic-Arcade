// What Plunks buy that lasts: themes, block styles and a bigger power-up bag.
// (Boosts for one game are in screens/boosts-screen.js, rerolls and second wind in play/second-chances.js. Prices are in prices.js.)

import { BAG_UPGRADE_COSTS, THEME_PRICES, STYLE_PRICES } from './prices.js';
import { FREE_THEMES, THEMES as KIT_THEMES } from '../../kit/themes.js';

// The cozy kit's themes (shared with the arcade's other cozy games), then Random. The kit's FREE_THEMES are always free.
export const THEMES = [
	...KIT_THEMES.map((t) => ({ id: t.id, name: t.name, price: FREE_THEMES.includes(t.id) ? 0 : (THEME_PRICES[t.id] ?? 150), text: t.blurb })),
	{ id: 'random', name: 'Random', price: THEME_PRICES.random, text: 'A new look each game. Tap New look for another.' },
];

export const STYLES = [
	{ id: 'patterns', name: 'Patterns', price: STYLE_PRICES.patterns, text: 'Stripes, dots, plain, checks, rings.' },
	{ id: 'symbols', name: 'Symbols', price: STYLE_PRICES.symbols, text: 'A shape on each color.' },
	{ id: 'pips', name: 'Dice pips', price: STYLE_PRICES.pips, text: 'One to five dots.' },
	{ id: 'silhouettes', name: 'Silhouettes', price: STYLE_PRICES.silhouettes, text: 'Each color has its own outline.' },
	{ id: 'faces', name: 'Faces', price: STYLE_PRICES.faces, text: 'Five moods. They blink.' },
];

export const BAG_MAX_UPGRADES = BAG_UPGRADE_COSTS.length;
