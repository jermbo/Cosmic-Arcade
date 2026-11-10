import type { LevelDef } from './types.ts';

export const fourCorners: LevelDef = {
	id: 'four-corners',
	name: 'Four Corners',
	hint: 'Watch the lights. Go when the cross traffic has green.',
	theme: 'noon',
	timeLimit: 35,
	roads: [
		{ a: [-110, 0], b: [110, 0], lanes: 4 },
		{ a: [0, 105], b: [0, -105], lanes: 2 },
		{ a: [5.4, 75], b: [5.4, 7], lanes: 1 },
	],
	lights: { green: 7, clear: 2.5 },
	lanes: [
		{ path: [[-100, 1.8], [100, 1.8]], speed: 13, vehicles: ['car', 'car', 'van', 'car'], offset: 0.3, phase: 0, stopAt: 94 },
		{ path: [[-100, 5.4], [100, 5.4]], speed: 12, vehicles: ['van', 'car', 'bus', 'car'], offset: 0.7, phase: 0, stopAt: 94 },
		{ path: [[100, -1.8], [-100, -1.8]], speed: 13, vehicles: ['car', 'van', 'car', 'car'], offset: 0.5, phase: 0, stopAt: 90.5 },
		{ path: [[100, -5.4], [-100, -5.4]], speed: 12, vehicles: ['car', 'bus', 'car'], offset: 0.2, phase: 0, stopAt: 90.5 },
		{ path: [[1.8, 95], [1.8, -95]], speed: 11, vehicles: ['car', 'car', 'van'], offset: 0.4, phase: 1, stopAt: 85.5 },
		{ path: [[-1.8, -95], [-1.8, 95]], speed: 11, vehicles: ['car', 'van', 'car'], offset: 0.8, phase: 1, stopAt: 85.5 },
	],
	barrels: [[-9.5, -10], [-10.6, -9.2], [-9.8, -11.2], [11, 10.5]],
	parked: [
		{ kind: 'van', at: [-14, -10.2], heading: 90 },
		{ kind: 'car', at: [16, 10.4], heading: 270 },
	],
	buildings: [
		{ at: [-26, -27], size: [26, 12, 26] },
		{ at: [24, -27], size: [22, 8, 26] },
		{ at: [-26, 28], size: [26, 7, 28] },
		{ at: [28, 30], size: [26, 15, 30] },
		{ at: [-64, -24], size: [30, 6, 18] },
		{ at: [66, -22], size: [30, 10, 16] },
		{ at: [-66, 24], size: [28, 9, 18] },
		{ at: [68, 24], size: [26, 6, 18] },
	],
	launch: { at: [5.4, 64], heading: 180, arc: 12, speed: 29 },
	goals: [
		{ kind: 'money', target: 70000 },
		{ kind: 'chain', target: 8 },
		{ kind: 'bonus', what: 'bus', target: 1 },
	],
};
