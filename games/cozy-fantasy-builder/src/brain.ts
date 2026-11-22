/**
 * The minds of the elves: a plan for the day, and what to do next.
 *
 * A day is a list of blocks (sleep, work, lunch, free time, festival). In each block the elf
 * picks a goal from the options that the sources of that block offer. To add a new behaviour,
 * such as visiting a friend, push a source into `SOURCES` for the blocks where it can happen.
 */

import { DAY, JOB, PIECE, TUNE } from './content.ts';
import type { Visit } from './content.ts';
import type { Folk } from './folk.ts';
import { hasTrait } from './folk.ts';
import { env } from './sky.ts';
import { S } from './state.ts';
import { DX, DZ, key, unkey } from './util.ts';
import { doorCell, pathTo, reachFrom } from './walk.ts';
import type { Reach } from './walk.ts';

export type Act = Visit | 'stroll' | 'home' | 'dance' | 'work' | 'eat';
export type BlockKind = 'sleep' | 'work' | 'meal' | 'free' | 'fest';

export interface Block {
	kind: BlockKind;
	from: number;
	to: number;
}

/** Something an elf sets out to do. */
export interface Goal {
	act: Act;
	/** The cell to walk to. */
	cell: string;
	/** Where to look on arrival. */
	look: [number, number] | null;
	/** What the elf does, for the villager card. */
	label: string;
	/** The name of the place, for the villager card. */
	place: string;
	/** Seconds to stay. */
	stay: number;
}

export interface Option extends Goal {
	weight: number;
}

/** What a source of options knows. */
export interface Mind {
	f: Folk;
	reach: Reach;
	from: string;
	block: Block;
	dusk: boolean;
}

export type Source = (m: Mind) => Option[];

/** The night festival. The festival module sets this, and the elves follow it. */
export const fest = {
	on: false,
	/** The cell of the town tree. */
	x: 0,
	z: 0,
	/** The eight cells around the tree are free, so the elves can dance in a ring. */
	ring: false,
};

/* The day */

/** The plan of one day, from waking up to waking up. Times run past 1 for the night. */
export function dayPlan(f: Folk): Block[] {
	const wake = DAY.wake + (hasTrait(f, 'early') ? -0.03 : hasTrait(f, 'owl') ? 0.05 : 0);
	const bed = DAY.bed + (hasTrait(f, 'early') ? -0.05 : hasTrait(f, 'owl') ? 0.1 : 0);
	const spans: Block[] = JOB[f.job].shift.map(([a, b]) => ({ kind: 'work' as const, from: Math.max(a, wake), to: Math.min(b, bed) }));
	spans.push({ kind: 'meal', from: DAY.lunch, to: DAY.back });
	spans.sort((a, b) => a.from - b.from);
	const out: Block[] = [];
	let t = wake;
	for (const s of spans) {
		const from = Math.max(s.from, t);
		if (s.to <= from) continue;
		if (from > t) out.push({ kind: 'free', from: t, to: from });
		out.push({ kind: s.kind, from, to: s.to });
		t = s.to;
	}
	if (t < bed) out.push({ kind: 'free', from: t, to: bed });
	out.push({ kind: 'sleep', from: bed, to: wake + 1 });
	return out;
}

export function blockAt(f: Folk, clock = S.clock): Block {
	if (fest.on) return { kind: 'fest', from: TUNE.festStart, to: TUNE.festEnd };
	const plan = dayPlan(f);
	for (const b of plan) if ((clock >= b.from && clock < b.to) || (clock + 1 >= b.from && clock + 1 < b.to)) return b;
	return plan[plan.length - 1];
}

/** The block after the one at a time. */
export function nextBlock(f: Folk, clock = S.clock): Block {
	const plan = dayPlan(f);
	const now = blockAt(f, clock);
	const i = plan.findIndex((b) => b.kind === now.kind && b.from === now.from);
	return plan[(i + 1) % plan.length];
}

export function blockName(f: Folk, b: Block): string {
	switch (b.kind) {
		case 'sleep':
			return 'Sleep';
		case 'work':
			return `Work: ${JOB[f.job].name.toLowerCase()}`;
		case 'meal':
			return 'Lunch';
		case 'free':
			return 'Free time';
		case 'fest':
			return 'Night festival';
	}
}

/** A time of the day as a clock: dawn is 6 am. */
export function clockText(t: number): string {
	const h = (((t % 1) * 24 + 6) % 24 + 24) % 24;
	const hour = Math.floor(h);
	const min = Math.floor((h - hour) * 4) * 15;
	const twelve = hour % 12 === 0 ? 12 : hour % 12;
	return `${twelve}:${String(min).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

/* Options */

/** Cells where an elf stands to use a piece, and where it looks. */
function standCells(k: string, m: Mind): [string, [number, number]][] {
	const p = S.pieces.get(k)!;
	const [x, z] = unkey(k);
	if (PIECE[p.t].walk) return m.reach.has(k) ? [[k, [x + DX[p.r], z + DZ[p.r]]]] : [];
	const out: [string, [number, number]][] = [];
	for (let i = 0; i < 4; i++) {
		// The door side first.
		const d = (p.r + i) % 4;
		const nk = key(x + DX[d], z + DZ[d]);
		if (m.reach.has(nk) && nk !== m.from) out.push([nk, [x, z]]);
	}
	return out;
}

const VISIT_LABEL: Record<Visit, string> = {
	rest: 'Resting by the water',
	sit: 'Sitting a while',
	gather: 'Gathering at the lights',
	shop: 'Shopping',
	sniff: 'Smelling the flowers',
	wish: 'Making a wish',
	gaze: 'Looking out at the sky',
	feast: 'Sharing treats',
	read: 'Reading a book',
};

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** Options at one piece: one for each place to stand. The weight is shared. */
function at(k: string, m: Mind, act: Act, label: string, weight: number, stay: number): Option[] {
	const cells = standCells(k, m);
	const place = PIECE[S.pieces.get(k)!.t].name;
	// The door side is the first cell. It gets a little more weight.
	return cells.map(([cell, look], i) => ({ act, cell, look, label, place, stay, weight: (weight * (i === 0 ? 1.6 : 1)) / (cells.length + 0.6) }));
}

const homeOption = (m: Mind, label: string, weight: number, stay: number): Option[] => {
	const door = m.f.home ? doorCell(m.f.home) : null;
	if (!door) return [];
	const cell = key(door[0], door[1]);
	if (!m.reach.has(cell)) return [];
	return [{ act: 'home', cell, look: null, label, place: 'Home', stay, weight }];
};

/** Free time: the old wandering, shaped by traits. */
const wander: Source = (m) => {
	const out: Option[] = [];
	const f = m.f;
	for (const [k, p] of S.pieces) {
		const def = PIECE[p.t];
		if (!def.visit) continue;
		let w = def.visit === 'gather' ? (m.dusk ? 6 : 1) : 2;
		if (hasTrait(f, 'social') && (def.visit === 'gather' || def.visit === 'shop' || def.visit === 'feast')) w *= 2.5;
		if (hasTrait(f, 'shy') && (def.visit === 'sit' || def.visit === 'rest')) w *= 2.5;
		if (hasTrait(f, 'shy') && (def.visit === 'shop' || def.visit === 'gather')) w *= 0.4;
		if (hasTrait(f, 'green') && def.visit === 'sniff') w *= 3;
		if (hasTrait(f, 'bookish') && def.visit === 'read') w *= 4;
		if (hasTrait(f, 'dreamer') && (def.visit === 'wish' || def.visit === 'gaze')) w *= 3;
		if (hasTrait(f, 'sweet') && p.t === 'bakery') w *= 3;
		out.push(...at(k, m, def.visit, VISIT_LABEL[def.visit], w, rand(4, 10)));
	}
	// Walks along the paths and on the grass.
	for (const [k, r] of m.reach) {
		const p = S.pieces.get(k);
		if (p && PIECE[p.t].walk && r.cost > 2) out.push({ act: 'stroll', cell: k, look: null, label: 'Out for a walk', place: PIECE[p.t].name, stay: rand(2, 5), weight: 0.35 });
		else if (!p && r.cost > 2 && r.cost < 9) out.push({ act: 'stroll', cell: k, look: null, label: 'Out for a walk', place: 'The meadow', stay: rand(2, 5), weight: 0.12 });
	}
	out.push(...homeOption(m, 'Resting at home', hasTrait(f, 'shy') ? 2 : 0.8, rand(10, 20)));
	return out;
};

const work: Source = (m) => {
	const f = m.f;
	const def = JOB[f.job];
	if (f.job === 'none') return wander(m);
	const out: Option[] = [];
	if (f.work && S.pieces.has(f.work)) out.push(...at(f.work, m, 'work', def.verb, 6, rand(12, 20)));
	// The rounds: pieces near the workplace, or near home for a job with no workplace.
	const [cx, cz] = unkey(f.work ?? f.home ?? '0,0');
	for (const [k, p] of S.pieces) {
		if (!def.tour?.includes(p.t)) continue;
		const [x, z] = unkey(k);
		if (Math.hypot(x - cx, z - cz) > (def.perTour ? 14 : 8)) continue;
		out.push(...at(k, m, 'work', def.verb, def.perTour ? 2 : 1, rand(5, 9)));
	}
	if (!out.length) return wander(m).map((o) => ({ ...o, label: `Looking for work (${o.label.toLowerCase()})` }));
	return out;
};

const FOOD = new Set(['bakery', 'market', 'teahouse', 'picnic']);

const meal: Source = (m) => {
	const out: Option[] = [];
	for (const [k, p] of S.pieces) {
		if (!FOOD.has(p.t)) continue;
		const w = p.t === 'bakery' && hasTrait(m.f, 'sweet') ? 9 : 3;
		out.push(...at(k, m, 'eat', 'Having lunch', w, rand(7, 12)));
	}
	out.push(...homeOption(m, 'Lunch at home', out.length ? 2 : 5, rand(10, 16)));
	return out;
};

const festival: Source = (m) => {
	const out = wander(m).map((o) => {
		const [x, z] = unkey(o.cell);
		const w = o.act === 'feast' ? 7 : o.act === 'shop' ? 5 : Math.hypot(x - fest.x, z - fest.z) < 5 ? o.weight : o.weight * 0.3;
		return { ...o, weight: o.act === 'home' ? 0 : w };
	});
	// The dance: a place in the ring around the town tree.
	for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
		const k = key(fest.x + dx, fest.z + dz);
		if ((dx || dz) && m.reach.has(k)) out.push({ act: 'dance', cell: k, look: [fest.x, fest.z], label: 'Dancing round the town tree', place: 'Town tree', stay: 999, weight: 3.5 });
	}
	return out;
};

/** The sources of options for each block. Push more here to add behaviours. */
export const SOURCES: Record<BlockKind, Source[]> = {
	sleep: [(m) => homeOption(m, 'Going to bed', 1, 999)],
	work: [work],
	meal: [meal],
	free: [wander],
	fest: [festival],
};

/** Picks a goal and the way to it. Returns null when there is nowhere to go. */
export function chooseGoal(f: Folk, from: [number, number]): { goal: Goal; path: [number, number][] } | null {
	const reach = reachFrom(from[0], from[1]);
	const block = blockAt(f);
	const m: Mind = { f, reach, from: key(from[0], from[1]), block, dusk: env.night > 0.25 };
	const options = SOURCES[block.kind].flatMap((s) => s(m)).filter((o) => o.weight > 0);
	if (!options.length) return null;
	let roll = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
	const pick = options.find((o) => (roll -= o.weight) <= 0) ?? options[options.length - 1];
	const { weight: _w, ...goal } = pick;
	return { goal, path: pathTo(reach, goal.cell) };
}
