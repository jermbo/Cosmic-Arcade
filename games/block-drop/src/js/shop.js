// What Glints buy that lasts: block color skins and a bigger power-up bag.
// (Boosts for one game, rerolls and second wind are in engine.js and main.js.)

import { PALETTE } from './sprites.js';
import { BAG_UPGRADE_COSTS } from './engine.js';

/** Mixes a #rrggbb color toward a target color. t is 0 (the color) to 1 (the target). */
function mix(hex, target, t) {
	const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
	const a = n(hex);
	const b = n(target);
	return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const fromBases = (names, bases) => bases.map((base, i) => ({ name: names[i], base, light: mix(base, '#ffffff', 0.62), dark: mix(base, '#000000', 0.5) }));

// Classic is the palette the game starts with. The others only change the colors.
const CLASSIC = PALETTE.map(({ name, base, light, dark }) => ({ name, base, light, dark }));

export const SKINS = [
	{ id: 'classic', name: 'Classic', price: 0, colors: CLASSIC },
	{ id: 'sunset', name: 'Sunset', price: 100, colors: fromBases(['Rose', 'Flame', 'Gold', 'Orchid', 'Plum'], ['#ff4d6d', '#ff8a1c', '#ffd23f', '#d68cff', '#8a3fd1']) },
	{ id: 'ocean', name: 'Ocean', price: 100, colors: fromBases(['Reef', 'Wave', 'Kelp', 'Deep', 'Pearl'], ['#4cc9f0', '#3a86ff', '#06d6a0', '#7b3fe4', '#f4efe6']) },
	{ id: 'neon', name: 'Neon', price: 150, colors: fromBases(['Pink', 'Volt', 'Mint', 'Cyan', 'Ultra'], ['#ff2e93', '#f0ff00', '#00f5a0', '#00c2ff', '#a45cff']) },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

/** Paints the shared palette. Rebuild the sprites afterwards (view.sprites = null; view.layout()). */
export function applySkin(id) {
	skinById(id).colors.forEach((c, i) => Object.assign(PALETTE[i], c));
}

export const BAG_BASE = 3;
export const BAG_MAX_UPGRADES = BAG_UPGRADE_COSTS.length;
