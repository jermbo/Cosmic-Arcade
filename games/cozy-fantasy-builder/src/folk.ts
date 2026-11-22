/**
 * The elves as saved records: who they are, where they live, their job and their ties.
 * Their bodies live in life.ts. Their daily plans live in brain.ts.
 */

import { JOB, JOBS, PIECE, TRAITS, VILLAGER_NAMES } from './content.ts';
import type { JobId, PieceId, TraitId } from './content.ts';
import { S } from './state.ts';
import { rng, unkey } from './util.ts';

/** A tie between two elves. Nothing sets these yet. They are here so the game can grow. */
export type RelationKind = 'friend' | 'family' | 'partner' | 'neighbor';

export interface Relation {
	to: number;
	kind: RelationKind;
	/** How close they are, 0..1. */
	bond: number;
}

export interface Folk {
	id: number;
	name: string;
	/** A seed for the look of the elf. */
	seed: number;
	/** The cell of the home. */
	home: string | null;
	job: JobId;
	/** The cell of the workplace, when the job has one. */
	work: string | null;
	/** The player chose the job. The game does not change it. */
	pinned: boolean;
	traits: TraitId[];
	relations: Relation[];
}

export const hasTrait = (f: Folk, t: TraitId): boolean => f.traits.includes(t);

/** A new elf moves into a home. */
export function makeFolk(home: string): Folk {
	const id = S.nextFolk++;
	const seed = Math.floor(Math.random() * 100000);
	const rand = rng(seed);
	const traits: TraitId[] = [];
	const count = rand() < 0.45 ? 2 : 1;
	while (traits.length < count) {
		const t = TRAITS[Math.floor(rand() * TRAITS.length)].id;
		// An early bird is never a night owl.
		if (traits.includes(t) || (t === 'early' && traits.includes('owl')) || (t === 'owl' && traits.includes('early'))) continue;
		traits.push(t);
	}
	const f: Folk = { id, name: VILLAGER_NAMES[id % VILLAGER_NAMES.length], seed, home, job: 'none', work: null, pinned: false, traits, relations: [] };
	S.folk.set(id, f);
	return f;
}

/** The elves that live in a home now. */
export function folkOf(home: string): Folk[] {
	const p = S.pieces.get(home);
	if (!p?.who) return [];
	return p.who.map((id) => S.folk.get(id)).filter((f): f is Folk => !!f);
}

/** Every elf that has a home on the islands now. */
export function livingFolk(): Folk[] {
	const out: Folk[] = [];
	for (const [k, p] of S.pieces) {
		if (!PIECE[p.t].home || !p.who) continue;
		for (const id of p.who) {
			const f = S.folk.get(id);
			if (f) {
				f.home = k;
				out.push(f);
			}
		}
	}
	return out;
}

/** The workplaces of a job, as cells. */
function placesOf(job: JobId): string[] {
	const out: string[] = [];
	for (const [k, p] of S.pieces) if (PIECE[p.t].work === job) out.push(k);
	return out;
}

/** Pieces that a job without a workplace walks round to. */
function tourCount(job: JobId): number {
	const tour = JOB[job].tour ?? [];
	let n = 0;
	for (const p of S.pieces.values()) if (tour.includes(p.t)) n++;
	return n;
}

/** How many more elves a job can take. Infinity for a free elf. */
export function openSlots(job: JobId, folk = livingFolk()): number {
	if (job === 'none') return Infinity;
	const def = JOB[job];
	const taken = folk.filter((f) => f.job === job).length;
	if (def.perTour) return Math.max(0, Math.floor(tourCount(job) * def.perTour) - taken);
	return placesOf(job).length * def.slots - taken;
}

/** A workplace of a job with a free place, the nearest to a cell first. */
function freePlace(job: JobId, near: string | null, folk: Folk[]): string | null {
	const def = JOB[job];
	const [hx, hz] = near ? unkey(near) : [0, 0];
	const list = placesOf(job)
		.filter((k) => folk.filter((f) => f.work === k).length < def.slots)
		.sort((a, b) => {
			const [ax, az] = unkey(a);
			const [bx, bz] = unkey(b);
			return Math.hypot(ax - hx, az - hz) - Math.hypot(bx - hx, bz - hz);
		});
	return list[0] ?? null;
}

/** Gives jobs to free elves and takes jobs away when a workplace is gone. Returns true when anything changed. */
export function assignJobs(): boolean {
	const folk = livingFolk();
	let changed = false;
	// Lost workplaces.
	for (const f of folk) {
		if (!f.work) continue;
		const p = S.pieces.get(f.work);
		if (p && PIECE[p.t].work === f.job) continue;
		f.work = null;
		changed = true;
	}
	for (const f of folk) {
		const def = JOB[f.job];
		const needsPlace = f.job !== 'none' && !def.perTour;
		if (needsPlace && !f.work) {
			const k = freePlace(f.job, f.home, folk);
			if (k) {
				f.work = k;
				changed = true;
			} else if (!f.pinned) {
				f.job = 'none';
				changed = true;
			}
		}
	}
	// A job with no workplace holds too many elves when its tour got smaller.
	for (const j of JOBS) {
		if (!j.perTour) continue;
		let extra = -openSlots(j.id, folk);
		for (const f of folk) {
			if (extra <= 0) break;
			if (f.job !== j.id || f.pinned) continue;
			f.job = 'none';
			extra--;
			changed = true;
		}
	}
	// Free elves take open places. A job that fits a trait goes first to an elf who has it.
	for (const j of JOBS) {
		if (j.id === 'none') continue;
		while (openSlots(j.id, folk) > 0) {
			const free = folk.filter((f) => f.job === 'none' && !f.pinned);
			if (!free.length) break;
			const f = free.find((o) => j.trait && hasTrait(o, j.trait)) ?? free[0];
			f.job = j.id;
			f.work = j.perTour ? null : freePlace(j.id, f.home, folk);
			changed = true;
		}
	}
	return changed;
}

/** The player gives an elf a job. Returns a reason when it cannot take it. */
export function setJob(f: Folk, job: JobId): string | null {
	const folk = livingFolk();
	if (job === f.job) {
		f.pinned = true;
		return null;
	}
	if (job !== 'none' && openSlots(job, folk) <= 0) {
		const def = JOB[job];
		if (def.perTour) return `Build more ${(def.tour ?? []).map((t) => PIECE[t].name.toLowerCase()).join(' or ')}s first.`;
		const where = (Object.keys(PIECE) as PieceId[]).find((id) => PIECE[id].work === job);
		return where ? `Every ${PIECE[where].name.toLowerCase()} is full. Build another one.` : 'There is no place for this job.';
	}
	f.job = job;
	f.work = null;
	f.pinned = true;
	if (job !== 'none' && !JOB[job].perTour) f.work = freePlace(job, f.home, folk);
	return null;
}

/** Drops records of elves that no home holds. Runs after a load. */
export function pruneFolk(): void {
	const keep = new Set<number>();
	for (const p of S.pieces.values()) for (const id of p.who ?? []) keep.add(id);
	for (const id of [...S.folk.keys()]) if (!keep.has(id)) S.folk.delete(id);
}
