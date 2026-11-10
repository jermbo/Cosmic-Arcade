import type { LaneDef } from '../levels/types.ts';

/** A lane with its lengths worked out, so a distance along it gives a place. */
export interface LanePath {
	def: LaneDef;
	xs: number[];
	zs: number[];
	/** Distance from the start to each point. */
	at: number[];
	length: number;
}

export interface LanePlace {
	x: number;
	z: number;
	dx: number;
	dz: number;
}

export function makeLanePath(def: LaneDef): LanePath {
	const points = def.loop ? [...def.path, def.path[0]] : def.path;
	const xs = points.map((p) => p[0]);
	const zs = points.map((p) => p[1]);
	const at = [0];
	for (let i = 1; i < points.length; i++) {
		at.push(at[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]));
	}
	return { def, xs, zs, at, length: at[at.length - 1] };
}

/** The place and the direction of a lane at the distance `s` from its start. */
export function lanePlace(lane: LanePath, s: number, out: LanePlace): LanePlace {
	let d = s;
	if (lane.def.loop) d = ((s % lane.length) + lane.length) % lane.length;
	let i = 1;
	while (i < lane.at.length - 1 && lane.at[i] < d) i++;
	const segment = lane.at[i] - lane.at[i - 1] || 1;
	const t = (d - lane.at[i - 1]) / segment;
	const ax = lane.xs[i - 1];
	const az = lane.zs[i - 1];
	const bx = lane.xs[i];
	const bz = lane.zs[i];
	out.x = ax + (bx - ax) * t;
	out.z = az + (bz - az) * t;
	out.dx = (bx - ax) / segment;
	out.dz = (bz - az) / segment;
	return out;
}
