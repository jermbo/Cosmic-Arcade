// Drawing helpers on top of KAPLAY: cached colors, thick ink strokes, blends.

import type { Color, Vec2 } from 'kaplay';
import { k } from '../../game/k.ts';

const cache = new Map<string, Color>();

/** A KAPLAY color from a hex string, cached. */
export function col(hex: string): Color {
	let c = cache.get(hex);
	if (!c) {
		c = k.rgb(hex);
		cache.set(hex, c);
	}
	return c;
}

const asColor = (c: string | Color) => (typeof c === 'string' ? col(c) : c);

export function mix(a: string | Color, b: string | Color, t: number): Color {
	return asColor(a).lerp(asColor(b), Math.max(0, Math.min(1, t)));
}

/** A color as '#rrggbb'. */
export function hex(c: Color): string {
	const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
	return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export const v = (x: number, y: number): Vec2 => k.vec2(x, y);

/** A thick ink line through points, with round ends. */
export function stroke(pts: [number, number][], width: number, color: Color, opacity = 1) {
	if (pts.length < 2) return;
	k.drawLines({ pts: pts.map(([x, y]) => v(x, y)), width, color, opacity, join: 'round', cap: 'round' });
}

export function dot(x: number, y: number, r: number, color: Color, opacity = 1) {
	k.drawCircle({ pos: v(x, y), radius: r, color, opacity });
}

export function poly(pts: [number, number][], color: Color, opacity = 1) {
	if (pts.length < 3) return;
	k.drawPolygon({ pts: pts.map(([x, y]) => v(x, y)), color, opacity, triangulate: true });
}

/** A convex polygon: faster, no triangulation. */
export function fan(pts: [number, number][], color: Color, opacity = 1) {
	if (pts.length < 3) return;
	k.drawPolygon({ pts: pts.map(([x, y]) => v(x, y)), color, opacity });
}

/**
 * A filled band under a ridge line down to `bottom`. Works for any ridge shape.
 * `colors` can tint top and bottom for a soft gradient.
 */
export function ridge(points: [number, number][], bottom: number, color: Color, opacity = 1, bottomColor?: Color) {
	const pts: Vec2[] = [];
	for (const [x, y] of points) pts.push(v(x, y), v(x, bottom));
	const indices: number[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const a = i * 2;
		indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
	}
	if (bottomColor) {
		const colors = pts.map((_, i) => (i % 2 === 0 ? color : bottomColor));
		k.drawPolygon({ pts, colors, color: col('#ffffff'), opacity, indices });
	} else {
		k.drawPolygon({ pts, color, opacity, indices });
	}
}

/** Value noise in [-1, 1], smooth in x. */
export function noise1(x: number, seed = 0): number {
	const i = Math.floor(x);
	const f = x - i;
	const h = (n: number) => {
		const s = Math.sin((n + seed * 101.7) * 127.1) * 43758.5453;
		return (s - Math.floor(s)) * 2 - 1;
	};
	const u = f * f * (3 - 2 * f);
	return h(i) * (1 - u) + h(i + 1) * u;
}

/** A stable pseudo random number in [0, 1) for a seed. */
export function hash(n: number): number {
	const s = Math.sin(n * 91.345 + 47.853) * 43758.5453;
	return s - Math.floor(s);
}

export const deg = (rad: number) => (rad * 180) / Math.PI;
