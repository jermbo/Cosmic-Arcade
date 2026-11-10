import type { VehicleKind } from '../config.ts';

/** A point on the ground: x, then z. North is -z, east is +x. */
export type Point = [number, number];

export type ThemeId = 'morning' | 'noon' | 'sunset' | 'dusk' | 'overcast' | 'night';

export interface RoadDef {
	a: Point;
	b: Point;
	/** Count of lanes, for the width and the painted lines. */
	lanes: number;
}

export interface RingDef {
	centre: Point;
	/** Radius of the middle of the ring road. */
	radius: number;
	lanes: number;
}

export interface LaneDef {
	/** The line that traffic follows. Two points make a straight lane. */
	path: Point[];
	/** A closed lane: traffic goes round and round. */
	loop?: boolean;
	speed: number;
	/** Vehicles on the lane at the start, spread along it. */
	vehicles: VehicleKind[];
	/** Shifts the first vehicle along the lane, from 0 to 1 of one gap. */
	offset?: number;
	/** With lights: the group of this lane (0 or 1) and where it stops. */
	phase?: 0 | 1;
	/** Distance from the start of the lane to the stop line. */
	stopAt?: number;
}

export interface ParkedDef {
	kind: VehicleKind;
	at: Point;
	/** Heading in degrees. 0 points to +z, 90 points to +x. */
	heading: number;
}

export interface BuildingDef {
	at: Point;
	/** Width (x), height, depth (z). */
	size: [number, number, number];
	heading?: number;
}

export type GoalDef =
	| { kind: 'money'; target: number }
	| { kind: 'chain'; target: number }
	| { kind: 'wrecks'; target: number }
	| { kind: 'bonus'; what: 'bus' | 'tanker' | 'barrel'; target: number };

export interface LevelDef {
	id: string;
	name: string;
	/** One line of advice for the player. */
	hint: string;
	theme: ThemeId;
	/** The run stops this many seconds after the launch. */
	timeLimit: number;
	roads: RoadDef[];
	rings?: RingDef[];
	lanes: LaneDef[];
	/** Traffic lights: seconds of green for each group, and of all-red between. */
	lights?: { green: number; clear: number };
	parked?: ParkedDef[];
	barrels?: Point[];
	buildings: BuildingDef[];
	launch: {
		at: Point;
		heading: number;
		/** The player can aim this many degrees to each side. */
		arc: number;
		speed: number;
	};
	goals: GoalDef[];
}
