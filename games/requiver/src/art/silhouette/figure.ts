// Stick figures as data: strokes, dots and shapes. Render them in ink, in a glow, or as a flash.
// Building first and drawing after lets one pose be drawn twice (outline glow, then ink).

import type { Color } from 'kaplay';
import { k } from '../../game/k.ts';
import { dot, poly, stroke, v } from './draw.ts';

type P = [number, number];

export interface Figure {
	lines: { pts: P[]; w: number }[];
	dots: { x: number; y: number; r: number }[];
	shapes: P[][];
	/** Parts drawn on top in their own color (eyes, sheen, glow). */
	extras: { draw: (opacity: number) => void }[];
}

export const newFigure = (): Figure => ({ lines: [], dots: [], shapes: [], extras: [] });

/** Draws a figure. `grow` widens every part, for an outline glow behind the ink. */
export function render(f: Figure, color: Color, opacity = 1, grow = 0, extras = true) {
	for (const s of f.shapes) {
		if (grow > 0) stroke([...s, s[0]], grow * 2, color, opacity);
		poly(s, color, opacity);
	}
	for (const l of f.lines) stroke(l.pts, l.w + grow * 2, color, opacity);
	for (const d of f.dots) dot(d.x, d.y, d.r + grow, color, opacity);
	if (extras) for (const e of f.extras) e.draw(opacity);
}

/** Rotates every point of a figure around (cx, cy). */
export function rotate(f: Figure, cx: number, cy: number, angle: number): Figure {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const r = ([x, y]: P): P => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
	return {
		lines: f.lines.map((l) => ({ pts: l.pts.map(r), w: l.w })),
		dots: f.dots.map((d) => {
			const [x, y] = r([d.x, d.y]);
			return { x, y, r: d.r };
		}),
		shapes: f.shapes.map((s) => s.map(r)),
		extras: [],
	};
}

/** A limb of two segments from `a`, with angles from straight down (radians), facing `dir`. */
export function limb(a: P, len1: number, ang1: number, len2: number, ang2: number, dir: number): P[] {
	const b: P = [a[0] + Math.sin(ang1) * len1 * dir, a[1] + Math.cos(ang1) * len1];
	const c: P = [b[0] + Math.sin(ang2) * len2 * dir, b[1] + Math.cos(ang2) * len2];
	return [a, b, c];
}

export interface BipedPose {
	/** Feet center. */
	x: number;
	y: number;
	s: number;
	/** -1 faces left. */
	dir: number;
	/** Walk phase in radians, and how much the legs swing (0 stands). */
	phase: number;
	stride: number;
	/** Forward lean in radians. */
	lean: number;
	/** Extra arm angles (from down) for actions; null swings with the walk. */
	armFront: [number, number] | null;
	armBack: [number, number] | null;
	/** Head offset from the hit box spot. */
	headDx: number;
	limbW: number;
	torsoW: number;
	headR: number;
	/** Shoulder width for bulky foes; 0 is a plain stick torso. */
	bulk: number;
}

export function defaultPose(x: number, y: number, s: number, dir: number): BipedPose {
	return {
		x,
		y,
		s,
		dir,
		phase: 0,
		stride: 0,
		lean: 0,
		armFront: null,
		armBack: null,
		headDx: 1,
		limbW: 4.6,
		torsoW: 6,
		headR: 9,
		bulk: 0,
	};
}

/** Joint positions of a biped, so weapons and armor can attach to them. */
export interface Joints {
	head: P;
	neck: P;
	shoulder: P;
	hip: P;
	handFront: P;
	handBack: P;
	footFront: P;
	footBack: P;
	headR: number;
}

/** Builds a walking stick figure. The head sits where the hit box says. */
export function biped(f: Figure, p: BipedPose): Joints {
	const { s, dir } = p;
	const bob = p.stride > 0 ? -Math.abs(Math.cos(p.phase)) * 2.2 * s : 0;
	const head: P = [p.x + p.headDx * s, p.y - 63 * s + bob * 0.5];
	const neck: P = [head[0] - Math.sin(p.lean) * 2 * s * dir, p.y - 54 * s + bob];
	const hip: P = [neck[0] - Math.sin(p.lean) * 24 * s * dir, p.y - 30 * s + bob];
	const shoulder: P = [neck[0] + (hip[0] - neck[0]) * 0.18, neck[1] + (hip[1] - neck[1]) * 0.18];

	// Legs: thigh then shin. Forward is `dir`.
	const leg = (ph: number) => {
		const swing = Math.sin(ph) * 0.55 * p.stride;
		const bend = Math.max(0, -Math.cos(ph)) * 0.9 * p.stride + 0.08;
		return limb(hip, 15 * s, swing + p.lean * 0.3, 15.5 * s, swing - bend + p.lean * 0.2, dir);
	};
	const legA = leg(p.phase);
	const legB = leg(p.phase + Math.PI);
	// Ground the lower foot so the figure does not float.
	const low = Math.max(legA[2][1], legB[2][1]);
	const drop = p.y - low;
	for (const pt of [...legA, ...legB]) if (pt !== hip) pt[1] += drop * 0.6;

	const arm = (ph: number, fixed: [number, number] | null) => {
		const swing = fixed ? fixed[0] : -Math.sin(ph) * 0.5 * p.stride + 0.15;
		const bend = fixed ? fixed[1] : 0.35 + Math.max(0, Math.sin(ph)) * 0.5 * p.stride;
		return limb(shoulder, 12 * s, swing, 12 * s, swing + bend, dir);
	};
	const armBack = arm(p.phase + Math.PI, p.armBack);
	const armFront = arm(p.phase, p.armFront);

	const w = p.limbW * s;
	f.lines.push({ pts: armBack, w: w * 0.9 });
	f.lines.push({ pts: legB, w });
	if (p.bulk > 0) {
		const b = p.bulk * s;
		f.shapes.push([
			[neck[0] - b * 0.55, neck[1] - 2 * s],
			[neck[0] + b * 0.55, neck[1] - 2 * s],
			[hip[0] + b * 0.32, hip[1] + 3 * s],
			[hip[0] - b * 0.32, hip[1] + 3 * s],
		]);
	}
	f.lines.push({ pts: [neck, hip], w: p.torsoW * s });
	f.lines.push({ pts: legA, w });
	f.lines.push({ pts: armFront, w });
	f.dots.push({ x: head[0], y: head[1], r: p.headR * s });
	return {
		head,
		neck,
		shoulder,
		hip,
		handFront: armFront[2],
		handBack: armBack[2],
		footFront: legA[2],
		footBack: legB[2],
		headR: p.headR * s,
	};
}

/** A quadratic curve as points. */
export function curve(a: P, c: P, b: P, n = 10): P[] {
	const out: P[] = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const u = 1 - t;
		out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
	}
	return out;
}

/** A thin line drawn as an extra (string, rope), in a given color. */
export function extraLine(f: Figure, pts: P[], w: number, color: Color) {
	f.extras.push({ draw: (o) => stroke(pts, w, color, o) });
}

export function extraDot(f: Figure, x: number, y: number, r: number, color: Color, glow = 0) {
	f.extras.push({
		draw: (o) => {
			if (glow > 0) k.drawCircle({ pos: v(x, y), radius: r * (1.8 + glow), color, opacity: 0.25 * o * glow });
			dot(x, y, r, color, o);
		},
	});
}
