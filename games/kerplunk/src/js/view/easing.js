// Easing: ways to move from 0 to 1 that look natural. Each takes the progress u (0 to 1)
// and gives the eased progress. "In" starts slow, "out" ends slow.

/** The value a part of the way from a to b. t = 0 gives a, t = 1 gives b. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** A point a part of the way from one point to another. */
export const lerpPoint = (from, to, t) => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) });

/** The progress from 0 to 1 while `value` goes from `start` to `end`, kept between 0 and 1. */
export const progressBetween = (value, start, end) => Math.min(1, Math.max(0, (value - start) / (end - start)));

export const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const easeInOutQuad = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
export const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

/** Goes a little past 1, then comes back: an overshoot. */
export const easeOutBack = (u) => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2);

/** Lands at 1 and bounces three times, smaller each time, like a dropped ball. */
export function easeOutBounce(u) {
	if (u < 1 / 2.75) return 7.5625 * u * u;
	if (u < 2 / 2.75) return 7.5625 * (u -= 1.5 / 2.75) * u + 0.75;
	if (u < 2.5 / 2.75) return 7.5625 * (u -= 2.25 / 2.75) * u + 0.9375;
	return 7.5625 * (u -= 2.625 / 2.75) * u + 0.984375;
}

/** 0 at the start and the end, 1 in the middle: a hump for "grow, then shrink back". */
export const hump = (u) => Math.sin(Math.PI * u);
