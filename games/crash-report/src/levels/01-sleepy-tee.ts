import type { LevelDef } from './types.ts';

export const sleepyTee: LevelDef = {
	id: 'sleepy-tee',
	name: 'Sleepy Tee',
	hint: 'A quiet road. Hit the first car, then push your wreck into the next one.',
	theme: 'morning',
	timeLimit: 30,
	roads: [
		{ a: [-110, 0], b: [110, 0], lanes: 2 },
		{ a: [0, 70], b: [0, 0], lanes: 2 },
		{ a: [-22, -5.6], b: [22, -5.6], lanes: 1 },
	],
	lanes: [
		{ path: [[-100, 1.8], [100, 1.8]], speed: 12, vehicles: ['car', 'car', 'van', 'car', 'car', 'car'], offset: 0.2 },
		{ path: [[100, -1.8], [-100, -1.8]], speed: 11, vehicles: ['car', 'van', 'car', 'bus', 'car'], offset: 0.6 },
	],
	parked: [
		{ kind: 'car', at: [-12, -5.6], heading: 90 },
		{ kind: 'van', at: [10, -5.6], heading: 90 },
		{ kind: 'car', at: [17, -5.6], heading: 90 },
	],
	barrels: [[-4, -5.4], [-2.8, -5.8], [3.2, -5.6]],
	buildings: [
		{ at: [0, -17], size: [34, 9, 12] },
		{ at: [-36, -18], size: [24, 6, 13] },
		{ at: [36, -19], size: [26, 13, 14] },
		{ at: [-24, 24], size: [22, 7, 18] },
		{ at: [25, 26], size: [24, 11, 20] },
		{ at: [-62, 20], size: [20, 8, 16] },
		{ at: [66, 22], size: [22, 6, 16] },
	],
	launch: { at: [0, 60], heading: 180, arc: 14, speed: 27 },
	goals: [
		{ kind: 'money', target: 50000 },
		{ kind: 'chain', target: 7 },
	],
};
