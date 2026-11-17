// How a Remix moves the blocks: one style for each look.

// Each style says how long the blocks rattle first, and how each block flies from its old cell to
// its new one. A style can also set swell (how much blocks grow while rattling, default 1), sound
// ('rattle' for a shaking sound) and events: [{ at, name, value }] sent to onRemix after the launch.
// plan() gets { from, to, mid, cols, rows, order } in cell coordinates and returns
// { delay, dur, at(u) }. at(u) takes the progress 0..1 and returns { x, y, rot, s } (cell position,
// turn in radians, size). The view keeps every block inside the well.
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const inOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const outCubic = (u) => 1 - Math.pow(1 - u, 3);
const outBack = (u) => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2);
const bounce = (u) => {
	if (u < 1 / 2.75) return 7.5625 * u * u;
	if (u < 2 / 2.75) return 7.5625 * (u -= 1.5 / 2.75) * u + 0.75;
	if (u < 2.5 / 2.75) return 7.5625 * (u -= 2.25 / 2.75) * u + 0.9375;
	return 7.5625 * (u -= 2.625 / 2.75) * u + 0.984375;
};
const mix = (from, to, e) => ({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) });

export const REMIX_STYLES = {
	// Every block swings on its own curve, at its own time, spinning as it goes.
	scatter: {
		label: 'Scatter',
		charge: 0.9,
		rattle: 1,
		plan({ from, to }) {
			const side = sign();
			const bend = { x: (to.y - from.y) * 0.35 * side + rand(-1, 1), y: (from.x - to.x) * 0.35 * side + rand(-1, 1) };
			const spin = sign() * Math.PI * (2 + Math.floor(Math.random() * 3));
			return {
				delay: rand(0, 0.35),
				dur: rand(0.55, 0.85),
				at: (u) => {
					const e = inOut(u);
					const sw = Math.sin(Math.PI * u);
					return { x: lerp(from.x, to.x, e) + bend.x * sw, y: lerp(from.y, to.y, e) + bend.y * sw, rot: spin * e, s: 1 + 0.22 * sw };
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
				at: (u) => ({ ...mix(from, to, inOut(u)), rot: Math.PI * 2 * inOut(u), s: 1 + 0.3 * Math.sin(Math.PI * u) }),
			};
		},
	},
	// Every block circles the middle of the well on its way.
	swirl: {
		label: 'Swirl',
		charge: 0.6,
		rattle: 1,
		plan({ from, to, mid }) {
			const r0 = Math.hypot(from.x - mid.x, from.y - mid.y);
			const r1 = Math.hypot(to.x - mid.x, to.y - mid.y);
			const a0 = Math.atan2(from.y - mid.y, from.x - mid.x);
			const a1 = Math.atan2(to.y - mid.y, to.x - mid.x);
			const turn = ((((a1 - a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) + Math.PI * 2;
			return {
				delay: rand(0, 0.12),
				dur: 1.05,
				at: (u) => {
					const e = inOut(u);
					const r = lerp(r0, r1, e) * (1 + 0.25 * Math.sin(Math.PI * u));
					const a = a0 + turn * e;
					return { x: mid.x + Math.cos(a) * r, y: mid.y + Math.sin(a) * r, rot: 0.6 * Math.sin(Math.PI * u), s: 1 };
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
				delay: to.x * 0.045 + rand(0, 0.08),
				dur: 0.7,
				at: (u) => ({ ...mix(from, to, outBack(u)), rot: 0, s: 1 + 0.55 * Math.sin(Math.PI * u) }),
			};
		},
	},
	// No wind-up. A quick, tidy swap.
	snap: {
		label: 'Snap',
		charge: 0,
		rattle: 0,
		plan({ from, to }) {
			return { delay: rand(0, 0.1), dur: 0.32, at: (u) => ({ ...mix(from, to, inOut(u)), rot: 0, s: 1 }) };
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
			const a = 0.4; // the drop ends
			const b = a + rand(0, 0.08); // each block leaves the pile a moment apart
			const pile = { x: Math.min(cols - 1, Math.max(0, from.x + rand(-1.2, 1.2))), y: rows - 1 - rand(0, 1.7) };
			const tilt = rand(-0.7, 0.7);
			return {
				delay: rand(0, 0.15),
				dur: 1.9,
				at: (u) => {
					if (u < a) {
						const k = u / a;
						return { x: lerp(from.x, pile.x, outCubic(k)), y: lerp(from.y, pile.y, bounce(k)), rot: tilt * k, s: 1 };
					}
					if (u < b) return { ...pile, rot: tilt, s: 1 };
					const k = (u - b) / (1 - b);
					return { x: lerp(pile.x, to.x, outCubic(k)), y: lerp(pile.y, to.y, k * k), rot: tilt * (1 - k), s: 1 + 0.1 * Math.sin(Math.PI * k) };
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
			const out = { x: from.x + (from.x - mid.x) * 0.8 + rand(-0.8, 0.8), y: from.y + (from.y - mid.y) * 0.8 + rand(-0.8, 0.8) };
			const spin = sign() * Math.PI * 2;
			return {
				delay: rand(0, 0.12),
				dur: 1.15,
				at: (u) => {
					const p = u < 0.4 ? mix(from, out, outCubic(u / 0.4)) : mix(out, to, inOut((u - 0.4) / 0.6));
					return { ...p, rot: spin * u, s: 1 + 0.2 * Math.sin(Math.PI * u) };
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
			const tilt = sign() * rand(0.15, 0.35);
			return {
				delay: (order / (cols * rows)) * 0.7,
				dur: 0.42,
				at: (u) => ({ ...mix(from, to, outCubic(u)), rot: tilt * Math.sin(Math.PI * u), s: 1 + 0.08 * Math.sin(Math.PI * u) }),
			};
		},
	},
	// Blocks shrink into the middle, then grow back out into their new cells.
	implode: {
		label: 'Implode',
		charge: 0.5,
		rattle: 1,
		plan({ from, to, mid }) {
			const hub = { x: mid.x + rand(-0.4, 0.4), y: mid.y + rand(-0.4, 0.4) };
			const spin = sign() * Math.PI * 2;
			return {
				delay: rand(0, 0.08),
				dur: 1.05,
				at: (u) => {
					if (u < 0.5) {
						const e = inOut(u / 0.5);
						return { ...mix(from, hub, e), rot: spin * u, s: 1 - 0.75 * e };
					}
					const e = inOut((u - 0.5) / 0.5);
					return { ...mix(hub, to, e), rot: spin * u, s: 0.25 + 0.75 * e };
				},
			};
		},
	},
};
// The order Shift+7 shows them in: favorites first.
const FAVORITES = ['scatter', 'explode', 'implode', 'shake'];
export const REMIX_STYLE_NAMES = [...FAVORITES, ...Object.keys(REMIX_STYLES).filter((name) => !FAVORITES.includes(name))];
