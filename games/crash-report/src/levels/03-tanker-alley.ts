import type { LevelDef } from './types.ts';

export const tankerAlley: LevelDef = {
	id: 'tanker-alley',
	name: 'Tanker Alley',
	hint: 'Fast traffic, no lights. A tanker blast wrecks everything near it.',
	theme: 'sunset',
	timeLimit: 40,
	roads: [
		{ a: [-125, 6.2], b: [125, 6.2], lanes: 3 },
		{ a: [-125, -6.2], b: [125, -6.2], lanes: 3 },
		{ a: [-56, 58], b: [-8, 12], lanes: 1 },
	],
	lanes: [
		{ path: [[-115, 2.6], [115, 2.6]], speed: 18, vehicles: ['car', 'car', 'van', 'car', 'car'], offset: 0.1 },
		{ path: [[-115, 6.2], [115, 6.2]], speed: 15, vehicles: ['car', 'tanker', 'car', 'bus'], offset: 0.55 },
		{ path: [[-115, 9.8], [115, 9.8]], speed: 13, vehicles: ['van', 'car', 'car', 'van', 'car'], offset: 0.8 },
		{ path: [[115, -2.6], [-115, -2.6]], speed: 18, vehicles: ['car', 'van', 'car', 'car'], offset: 0.35 },
		{ path: [[115, -6.2], [-115, -6.2]], speed: 15, vehicles: ['tanker', 'car', 'car', 'van'], offset: 0.7 },
		{ path: [[115, -9.8], [-115, -9.8]], speed: 13, vehicles: ['car', 'bus', 'car', 'car', 'van'], offset: 0.15 },
	],
	barrels: [[6, 0], [7.2, 0], [-16, 0], [22, 0], [23.2, 0], [9, -13.2], [10.2, -13.4]],
	buildings: [
		{ at: [0, -26], size: [90, 5, 5] },
		{ at: [-70, -30], size: [34, 10, 16] },
		{ at: [72, -32], size: [36, 14, 18] },
		{ at: [18, 34], size: [40, 9, 22] },
		{ at: [78, 30], size: [30, 7, 18] },
		{ at: [-84, 26], size: [24, 12, 14] },
		{ at: [0, -50], size: [44, 18, 20] },
	],
	launch: { at: [-50, 52.3], heading: 133.8, arc: 13, speed: 31 },
	goals: [
		{ kind: 'money', target: 120000 },
		{ kind: 'chain', target: 12 },
		{ kind: 'bonus', what: 'tanker', target: 2 },
	],
};
