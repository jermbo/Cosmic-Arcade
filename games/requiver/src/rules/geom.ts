// Small geometry helpers for hits and aiming. Y grows down.

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Circle {
	x: number;
	y: number;
	r: number;
}

/** Where along the segment a->b (0..1) it first enters the circle, or null. */
export function segCircle(ax: number, ay: number, bx: number, by: number, c: Circle): number | null {
	const dx = bx - ax;
	const dy = by - ay;
	const fx = ax - c.x;
	const fy = ay - c.y;
	const a = dx * dx + dy * dy;
	const cc = fx * fx + fy * fy - c.r * c.r;
	if (cc <= 0) return 0;
	if (a === 0) return null;
	const b = 2 * (fx * dx + fy * dy);
	const disc = b * b - 4 * a * cc;
	if (disc < 0) return null;
	const t = (-b - Math.sqrt(disc)) / (2 * a);
	return t >= 0 && t <= 1 ? t : null;
}

/** Where along the segment a->b (0..1) it first enters the box, or null. */
export function segBox(ax: number, ay: number, bx: number, by: number, r: Box): number | null {
	let t0 = 0;
	let t1 = 1;
	const dx = bx - ax;
	const dy = by - ay;
	const clip = (p: number, q: number) => {
		if (p === 0) return q >= 0;
		const t = q / p;
		if (p < 0) {
			if (t > t1) return false;
			if (t > t0) t0 = t;
		} else {
			if (t < t0) return false;
			if (t < t1) t1 = t;
		}
		return true;
	};
	if (
		clip(-dx, ax - r.x) &&
		clip(dx, r.x + r.w - ax) &&
		clip(-dy, ay - r.y) &&
		clip(dy, r.y + r.h - ay)
	) {
		return t0;
	}
	return null;
}

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

/**
 * Launch angle (radians, screen space, so negative is up) to hit (tx, ty) from (sx, sy) at speed v.
 * `high` picks the lob. Returns null when out of reach.
 */
export function solveAim(sx: number, sy: number, tx: number, ty: number, v: number, g: number, high = false): number | null {
	const x = tx - sx;
	const y = sy - ty; // up is positive here
	const v2 = v * v;
	const disc = v2 * v2 - g * (g * x * x + 2 * y * v2);
	if (disc < 0 || x <= 0) return null;
	const root = Math.sqrt(disc);
	const up = Math.atan2(v2 + (high ? root : -root), g * x);
	return -up;
}

/** Flight time to reach horizontal distance x at angle a (screen space) and speed v. */
export const flightTime = (x: number, angle: number, v: number) => x / Math.max(1, v * Math.cos(angle));

/** The launch velocity that lands on (tx, ty) after `t` seconds under gravity g. */
export function lobVelocity(sx: number, sy: number, tx: number, ty: number, t: number, g: number) {
	return { vx: (tx - sx) / t, vy: (ty - sy - 0.5 * g * t * t) / t };
}
