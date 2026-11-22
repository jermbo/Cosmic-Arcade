// Hints for a stuck player: find a line that is blocked or slow, say why, and turn a dead end.

import { BUF_OUT, MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { opposite } from './direction.ts';
import type { Dir } from './direction.ts';
import { TILE_ROCK } from './tiles.ts';
import { MAX_CELLS, buyablePlots, cellIdx, cellX, cellY, nextPlotCost, ownedBounds } from './grid.ts';
import { tilesOf } from './planet-map.ts';
import type { Game } from './game.ts';
import { targetOf, bridgeOk, uses } from './layout.ts';
import { rotateAt } from './build.ts';
import { padCap } from './ships.ts';

/** Seconds stuck before a machine shows as blocked on the board. */
export const STUCK_SHOW = 2;

/** Seconds stuck before a dead end shows in the banner. */
export const STUCK_DEAD = 4;

/** Seconds stuck before a backup shows in the banner. Backups are normal, so wait longer. */
export const STUCK_SLOW = 15;

/**
 * Why a machine cannot hand off its output.
 * - dead: `cell` points somewhere items cannot go (`target`, -1 when off the map). Turning `cell` fixes it.
 * - slow: the line works, but `cell` (a machine or the pad) takes items slower than they arrive.
 * `from` is the stuck machine that started the trace.
 */
export type Block = { kind: 'dead'; from: number; cell: number; target: number; dir: Dir; why: string } | { kind: 'slow'; from: number; cell: number };

/** Why cell c facing d is a dead end, or null if items can go that way. */
function deadWhy(g: Game, pi: number, c: number, d: Dir): string | null {
	const planet = g.planets[pi];
	const t = targetOf(c, d, planet, pi);
	if (t < 0) return 'points off the map';
	const n = g.planets[pi].cells[t];
	if (!n) return tilesOf(pi, g.blasted[pi])[t] === TILE_ROCK ? 'points at a rock' : 'points at empty ground';
	if (n.t === 'drill') return 'points into a drill';
	if (n.t === 'pylon') return 'points into a pylon';
	if (n.t === 'belt' && n.d === opposite(d)) return 'points into a belt going the other way';
	if (n.t === 'bridge' && n.d === opposite(d)) return 'points into the wrong end of a bridge';
	return null;
}

/** Follows the line out of a stuck machine to find what holds it up. */
export function traceBlock(g: Game, pi: number, from: number): Block | null {
	const p = g.planets[pi];
	const start = p.cells[from];
	if (!start || start.t === 'belt' || start.t === 'pad' || !start.out.length) return null;
	let k = start.out[0];
	let c = from;
	let dir = start.d;
	// Cell and way in, since a line may pass one crossing twice.
	const seen = new Set<number>([from * 4 + dir]);
	for (let step = 0; step <= MAX_CELLS * 2; step++) {
		const why = deadWhy(g, pi, c, dir);
		const t = targetOf(c, dir, p, pi);
		if (why) return { kind: 'dead', from, cell: c, target: t, dir, why };
		if (seen.has(t * 4 + dir)) return { kind: 'dead', from, cell: c, target: t, dir, why: 'feeds back into its own line' };
		seen.add(t * 4 + dir);
		const n = p.cells[t]!;
		c = t;
		if (n.t === 'belt') {
			// The front item is the one that has to get off this belt.
			if (n.items.length) k = n.items[0].k;
			dir = n.d;
			continue;
		}
		if (n.t === 'cross') {
			// Straight on, in the lane we came in by.
			const front = n.items.find((it) => it.e === dir);
			if (front) k = front.k;
			continue;
		}
		if (n.t === 'bridge') {
			if (n.items.length) k = n.items[0].k;
			dir = n.d;
			if (n.end) continue;
			// Hop to the far end.
			if (!bridgeOk(p, t, n)) return { kind: 'dead', from, cell: t, target: -1, dir: n.d, why: 'has no far end' };
			c = n.link!;
			continue;
		}
		if (n.t === 'pad') return { kind: 'slow', from, cell: t };
		// A machine with a full output is held up too, so keep following.
		if (uses(n, k) && n.out.length < BUF_OUT) return { kind: 'slow', from, cell: t };
		if (n.out.length) k = n.out[0];
		dir = n.d;
	}
	return null;
}

/** Every machine on a planet stuck longer than `min` seconds, with its cause. */
export function planetBlocks(g: Game, pi: number, min = STUCK_SHOW): (Block & { stuck: number })[] {
	const p = g.planets[pi];
	const list: (Block & { stuck: number })[] = [];
	const box = ownedBounds(p);
	for (let y = box.y0; y <= box.y1; y++) {
		for (let x = box.x0; x <= box.x1; x++) {
			const i = cellIdx(x, y);
			const m = p.cells[i];
			const stuck = m?.stuck || 0;
			if (stuck <= min) continue;
			const b = traceBlock(g, pi, i);
			if (b) list.push({ ...b, stuck });
		}
	}
	return list;
}

/** A way to turn cell c so its items can leave, or null if there is none. */
export function fixDir(g: Game, pi: number, c: number): Dir | null {
	const p = g.planets[pi];
	const m = p.cells[c];
	if (!m || m.t === 'pad' || m.t === 'pylon' || m.t === 'cross' || m.t === 'bridge') return null;
	const k = m.t === 'belt' ? m.items[0]?.k : m.out[0];
	let best: Dir | null = null;
	let bestScore = 0;
	for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
		if (deadWhy(g, pi, c, d)) continue;
		const n = p.cells[targetOf(c, d, p, pi)]!;
		// Skip anything that feeds into us, or items would go round in a circle.
		if (n.t !== 'pad' && n.d === opposite(d)) continue;
		const score = n.t === 'pad' || (k !== undefined && n.t !== 'belt' && uses(n, k)) ? 3 : n.t === 'belt' ? 2 : 1;
		if (score > bestScore) {
			best = d;
			bestScore = score;
		}
	}
	return best;
}

/** Turns a dead end toward the best open side. Returns false if nothing works. */
export function fixAt(g: Game, pi: number, c: number): boolean {
	const d = fixDir(g, pi, c);
	if (d === null) return false;
	rotateAt(g, pi, cellX(c), cellY(c), d);
	return true;
}

export function blockText(pi: number, b: Block, t: MachineType): string {
	const name = MACHINES[t].short;
	if (b.kind === 'dead') return `A ${name.toLowerCase()} on ${PLANETS[pi].name} ${b.why}.`;
	if (t === 'pad') return `${PLANETS[pi].name} pad is full. Buy ships or cargo space.`;
	return `${name} on ${PLANETS[pi].name} can't keep up. Upgrade it or build more.`;
}

export interface Problem {
	kind: 'dead' | 'slow' | 'pad';
	planet: number;
	/** the cell to fix: the dead end, the slow machine, or the pad */
	cell: number;
	text: string;
}

export function findProblem(g: Game): Problem | null {
	let slow: Problem | null = null;
	for (let pi = 0; pi < g.planets.length; pi++) {
		const p = g.planets[pi];
		if (!p.unlocked) continue;
		if (p.pad.length >= padCap(p)) {
			const cell = p.cells.findIndex((m) => m?.t === 'pad');
			return { kind: 'pad', planet: pi, cell, text: `${PLANETS[pi].name} pad is full. Buy ships or cargo space.` };
		}
		for (const b of planetBlocks(g, pi, STUCK_DEAD)) {
			const t = p.cells[b.cell]!.t;
			if (b.kind === 'dead') return { kind: 'dead', planet: pi, cell: b.cell, text: blockText(pi, b, t) };
			if (!slow && b.stuck > STUCK_SLOW) slow = { kind: t === 'pad' ? 'pad' : 'slow', planet: pi, cell: b.cell, text: blockText(pi, b, t) };
		}
	}
	return slow;
}

export type PlanetBadge = 'warn' | 'full' | 'survey' | null;

/** Small space-map hint on a planet. */
export function planetBadge(g: Game, pi: number): PlanetBadge {
	const p = g.planets[pi];
	if (!p.unlocked) return null;
	if (p.pad.length >= padCap(p)) return 'full';
	if (buyablePlots(p).length && g.credits >= nextPlotCost(pi, p)) return 'survey';
	for (const b of planetBlocks(g, pi, STUCK_DEAD)) {
		if (b.kind === 'dead') return 'warn';
	}
	return null;
}
