// What Plunks buy that lasts: themes, block styles and a bigger power-up bag.
// (Boosts for one game, rerolls and second wind are in boosts.js and second-chances.js. Their prices are in prices.js.)

import { BAG_UPGRADE_COSTS, THEME_PRICES, STYLE_PRICES } from './prices.js';

export const THEMES = [
	{ id: 'light', name: 'Light', price: THEME_PRICES.light, text: 'Cream paper, black ink.' },
	{ id: 'dark', name: 'Dark', price: THEME_PRICES.dark, text: 'Near black, off-white ink.' },
	{ id: 'random', name: 'Random', price: THEME_PRICES.random, text: 'A new look each game.' },
];

export const STYLES = [
	{ id: 'patterns', name: 'Patterns', price: STYLE_PRICES.patterns, text: 'Stripes, dots, plain, checks, rings.' },
	{ id: 'symbols', name: 'Symbols', price: STYLE_PRICES.symbols, text: 'A shape on each color.' },
	{ id: 'pips', name: 'Dice pips', price: STYLE_PRICES.pips, text: 'One to five dots.' },
	{ id: 'silhouettes', name: 'Silhouettes', price: STYLE_PRICES.silhouettes, text: 'Each color has its own outline.' },
	{ id: 'faces', name: 'Faces', price: STYLE_PRICES.faces, text: 'Five moods. They blink.' },
];

export const BAG_MAX_UPGRADES = BAG_UPGRADE_COSTS.length;
