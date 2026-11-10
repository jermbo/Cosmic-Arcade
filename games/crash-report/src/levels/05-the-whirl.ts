import type { LevelDef, Point } from './types.ts';

/** The points of a circle lane, in the order that traffic drives. */
function circle(radius: number, points: number): Point[] {
	const path: Point[] = [];
	for (let i = 0; i < points; i++) {
		const angle = (-i / points) * Math.PI * 2;
		path.push([Math.round(Math.sin(angle) * radius * 100) / 100, Math.round(Math.cos(angle) * radius * 100) / 100]);
	}
	return path;
}

export const theWhirl: LevelDef = {
	id: 'the-whirl',
	name: 'The Whirl',
	hint: 'The ring never stops. Break it, and the queues do the rest.',
	theme: 'overcast',
	timeLimit: 45,
	roads: [
		{ a: [0, 105], b: [0, 18], lanes: 2 },
		{ a: [0, -18], b: [0, -105], lanes: 2 },
		{ a: [-105, 0], b: [-18, 0], lanes: 2 },
		{ a: [18, 0], b: [105, 0], lanes: 2 },
	],
	rings: [{ centre: [0, 0], radius: 16, lanes: 2 }],
	lanes: [
		{ path: circle(14.2, 20), loop: true, speed: 8, vehicles: ['car', 'van', 'car', 'car', 'car'], offset: 0.2 },
		{ path: circle(17.8, 24), loop: true, speed: 9.5, vehicles: ['car', 'car', 'bus', 'car', 'van', 'car'], offset: 0.6 },
	],
	parked: [
		{ kind: 'car', at: [1.8, 26], heading: 180 },
		{ kind: 'bus', at: [1.8, 36], heading: 180 },
		{ kind: 'car', at: [1.8, 46], heading: 180 },
		{ kind: 'tanker', at: [-1.8, -29], heading: 0 },
		{ kind: 'car', at: [-1.8, -39], heading: 0 },
		{ kind: 'van', at: [-1.8, -46], heading: 0 },
		{ kind: 'van', at: [-26, 1.8], heading: 90 },
		{ kind: 'car', at: [-33, 1.8], heading: 90 },
		{ kind: 'tanker', at: [-43, 1.8], heading: 90 },
		{ kind: 'car', at: [26, -1.8], heading: 270 },
		{ kind: 'bus', at: [36, -1.8], heading: 270 },
		{ kind: 'car', at: [46, -1.8], heading: 270 },
	],
	barrels: [[0, 8.6], [8.6, 0], [0, -8.6], [-8.6, 0], [6.2, 6.2], [-6.2, -6.2], [22.5, 22.5], [-22.5, 22.5]],
	buildings: [
		{ at: [0, 0], size: [8, 7, 8], heading: 45 },
		{ at: [-34, -34], size: [28, 10, 28] },
		{ at: [35, -35], size: [28, 14, 28] },
		{ at: [-36, 36], size: [28, 8, 28] },
		{ at: [36, 37], size: [28, 11, 30] },
		{ at: [-76, -22], size: [26, 7, 20] },
		{ at: [78, 24], size: [26, 9, 20] },
	],
	launch: { at: [-1.8, 66], heading: 180, arc: 13, speed: 30 },
	goals: [
		{ kind: 'money', target: 220000 },
		{ kind: 'chain', target: 16 },
		{ kind: 'wrecks', target: 14 },
	],
};
