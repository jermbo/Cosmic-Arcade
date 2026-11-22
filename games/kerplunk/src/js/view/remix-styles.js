// How a Remix moves the blocks: one style for each look.
//
// Each style says how long the blocks rattle first (charge, in seconds), how hard (rattle), and how
// each block flies from its old cell to its new one. A style can also set:
//   swell   how much blocks grow while rattling (the same as rattle unless given)
//   sound   'rattle' for a shaking sound
//   events  [{ at, name, value }] sent to the view's onRemix after the launch
// plan() gets { from, to, mid, cols, rows, order } in cell coordinates and returns
// { delay, dur, at(u) }. at(u) takes the progress 0..1 and returns { x, y, rot, s }:
// the cell position, the turn in radians, and the size. The view keeps every block inside the well.

import { lerp, lerpPoint, easeInOutCubic, easeOutCubic, easeOutBack, easeOutBounce, hump } from './easing.js';

const between = (low, high) => low + Math.random() * (high - low);
const randomSide = () => (Math.random() < 0.5 ? -1 : 1);
const FULL_TURN = Math.PI * 2;

export const REMIX_STYLES = {
	// Every block swings on its own curve, at its own time, spinning as it goes.
	scatter: {
		label: 'Scatter',
		charge: 0.9,
		rattle: 1,
		plan({ from, to }) {
			const side = randomSide();
			const bend = { x: (to.y - from.y) * 0.35 * side + between(-1, 1), y: (from.x - to.x) * 0.35 * side + between(-1, 1) };
			const spin = randomSide() * Math.PI * (2 + Math.floor(Math.random() * 3));
			return {
				delay: between(0, 0.35),
				dur: between(0.55, 0.85),
				at: (u) => {
					const eased = easeInOutCubic(u);
					const swing = hump(u);
					return { x: lerp(from.x, to.x, eased) + bend.x * swing, y: lerp(from.y, to.y, eased) + bend.y * swing, rot: spin * eased, s: 1 + 0.22 * swing };
				},
			};
		},
	},
	// Blocks near the middle go first and the rest follow, like a ripple.
	wave: {
		label: 'Wave',
		charge: 0.7,
		rattle: 1,
		plan({ from, to, mid }) {
			return {
				delay: Math.hypot(from.x - mid.x, from.y - mid.y) * 0.09,
				dur: 0.7,
				at: (u) => ({ ...lerpPoint(from, to, easeInOutCubic(u)), rot: FULL_TURN * easeInOutCubic(u), s: 1 + 0.3 * hump(u) }),
			};
		},
	},
	// Every block circles the middle of the well on its way.
	swirl: {
		label: 'Swirl',
		charge: 0.6,
		rattle: 1,
		plan({ from, to, mid }) {
			const startRadius = Math.hypot(from.x - mid.x, from.y - mid.y);
			const endRadius = Math.hypot(to.x - mid.x, to.y - mid.y);
			const startAngle = Math.atan2(from.y - mid.y, from.x - mid.x);
			const endAngle = Math.atan2(to.y - mid.y, to.x - mid.x);
			// Always at least one whole turn, plus the part to the new cell.
			const turn = ((((endAngle - startAngle) % FULL_TURN) + FULL_TURN) % FULL_TURN) + FULL_TURN;
			return {
				delay: between(0, 0.12),
				dur: 1.05,
				at: (u) => {
					const eased = easeInOutCubic(u);
					const radius = lerp(startRadius, endRadius, eased) * (1 + 0.25 * hump(u));
					const angle = startAngle + turn * eased;
					return { x: mid.x + Math.cos(angle) * radius, y: mid.y + Math.sin(angle) * radius, rot: 0.6 * hump(u), s: 1 };
				},
			};
		},
	},
	// Blocks are tossed toward you and land with a little bounce, left column first.
	toss: {
		label: 'Toss',
		charge: 0.6,
		rattle: 1,
		plan({ from, to }) {
			return {
				delay: to.x * 0.045 + between(0, 0.08),
				dur: 0.7,
				at: (u) => ({ ...lerpPoint(from, to, easeOutBack(u)), rot: 0, s: 1 + 0.55 * hump(u) }),
			};
		},
	},
	// No wind-up. A quick, tidy swap.
	snap: {
		label: 'Snap',
		charge: 0,
		rattle: 0,
		plan({ from, to }) {
			return { delay: between(0, 0.1), dur: 0.32, at: (u) => ({ ...lerpPoint(from, to, easeInOutCubic(u)), rot: 0, s: 1 }) };
		},
	},
	// Like an Etch A Sketch: shake it loose, the blocks drop to the bottom, then fall back into place.
	// (The well hangs from the ceiling, so the bottom is the open end.)
	shake: {
		label: 'Shake',
		charge: 0.8,
		rattle: 2.4,
		swell: 0.25,
		sound: 'rattle',
		plan({ from, to, cols, rows }) {
			const dropEnds = 0.4;
			const leavesPile = dropEnds + between(0, 0.08); // each block leaves the pile a moment apart
			const pile = { x: Math.min(cols - 1, Math.max(0, from.x + between(-1.2, 1.2))), y: rows - 1 - between(0, 1.7) };
			const tilt = between(-0.7, 0.7);
			return {
				delay: between(0, 0.15),
				dur: 1.9,
				at: (u) => {
					if (u < dropEnds) {
						const k = u / dropEnds;
						return { x: lerp(from.x, pile.x, easeOutCubic(k)), y: lerp(from.y, pile.y, easeOutBounce(k)), rot: tilt * k, s: 1 };
					}
					if (u < leavesPile) return { ...pile, rot: tilt, s: 1 };
					const k = (u - leavesPile) / (1 - leavesPile);
					return { x: lerp(pile.x, to.x, easeOutCubic(k)), y: lerp(pile.y, to.y, k * k), rot: tilt * (1 - k), s: 1 + 0.1 * hump(k) };
				},
			};
		},
	},
	// Blocks burst outward toward the walls, then come back in to their new cells.
	explode: {
		label: 'Explode',
		charge: 0.6,
		rattle: 1,
		plan({ from, to, mid }) {
			const outward = { x: from.x + (from.x - mid.x) * 0.8 + between(-0.8, 0.8), y: from.y + (from.y - mid.y) * 0.8 + between(-0.8, 0.8) };
			const spin = randomSide() * FULL_TURN;
			return {
				delay: between(0, 0.12),
				dur: 1.15,
				at: (u) => {
					const point = u < 0.4 ? lerpPoint(from, outward, easeOutCubic(u / 0.4)) : lerpPoint(outward, to, easeInOutCubic((u - 0.4) / 0.6));
					return { ...point, rot: spin * u, s: 1 + 0.2 * hump(u) };
				},
			};
		},
	},
	// Blocks drop in one after another, in reading order, tilting like dealt cards.
	cards: {
		label: 'Cards',
		charge: 0.3,
		rattle: 0.5,
		plan({ from, to, order, cols, rows }) {
			const tilt = randomSide() * between(0.15, 0.35);
			return {
				delay: (order / (cols * rows)) * 0.7,
				dur: 0.42,
				at: (u) => ({ ...lerpPoint(from, to, easeOutCubic(u)), rot: tilt * hump(u), s: 1 + 0.08 * hump(u) }),
			};
		},
	},
	// Blocks shrink into the middle, then grow back out into their new cells.
	implode: {
		label: 'Implode',
		charge: 0.5,
		rattle: 1,
		plan({ from, to, mid }) {
			const hub = { x: mid.x + between(-0.4, 0.4), y: mid.y + between(-0.4, 0.4) };
			const spin = randomSide() * FULL_TURN;
			return {
				delay: between(0, 0.08),
				dur: 1.05,
				at: (u) => {
					if (u < 0.5) {
						const eased = easeInOutCubic(u / 0.5);
						return { ...lerpPoint(from, hub, eased), rot: spin * u, s: 1 - 0.75 * eased };
					}
					const eased = easeInOutCubic((u - 0.5) / 0.5);
					return { ...lerpPoint(hub, to, eased), rot: spin * u, s: 0.25 + 0.75 * eased };
				},
			};
		},
	},
};

// The order Shift+7 shows them in: favorites first.
const FAVORITES = ['scatter', 'explode', 'implode', 'shake'];
export const REMIX_STYLE_NAMES = [...FAVORITES, ...Object.keys(REMIX_STYLES).filter((name) => !FAVORITES.includes(name))];
