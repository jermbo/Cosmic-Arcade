// The branching map of one act. Rows go left to right; the last row is the boss.

import { ACTS } from './data/acts.ts';
import { SPOTS } from './data/spots.ts';
import type { Rng } from './rng.ts';

export interface MapNode {
	id: number;
	row: number;
	/** Height on the map, 0 (top) to 1 (bottom). */
	y: number;
	type: string;
	next: number[];
}

export interface ActMap {
	act: number;
	rows: number;
	nodes: MapNode[];
}

export function generateMap(rng: Rng, act: number): ActMap {
	// Retry until every path has enough fights. Almost always the first or second try.
	let map = buildMap(rng, act);
	for (let i = 0; i < 40 && !enoughFights(map); i++) map = buildMap(rng, act);
	return map;
}

function enoughFights(map: ActMap) {
	const min = ACTS[map.act].minFights;
	return allPaths(map).every((p) => p.filter((t) => SPOTS[t]?.resolve === 'battle' && t !== 'boss').length >= min);
}

function buildMap(rng: Rng, act: number): ActMap {
	const def = ACTS[act];
	const rows: MapNode[][] = [];
	let id = 0;
	for (let r = 0; r < def.rows.length; r++) {
		const [lo, hi] = def.rows[r];
		const n = rng.int(lo, hi);
		const row: MapNode[] = [];
		for (let i = 0; i < n; i++) {
			const base = n === 1 ? 0.5 : 0.14 + (0.72 * i) / (n - 1);
			const y = n === 1 ? 0.5 : base + rng.range(-0.05, 0.05);
			row.push({ id: id++, row: r, y, type: 'fight', next: [] });
		}
		rows.push(row);
	}
	for (let r = 0; r < rows.length - 1; r++) connect(rng, rows[r], rows[r + 1]);
	assignTypes(rng, act, rows);
	return { act, rows: rows.length, nodes: rows.flat() };
}

/** Links two rows with no crossing lines. Every node gets at least one link each way. */
function connect(rng: Rng, a: MapNode[], b: MapNode[]) {
	const link = (x: MapNode, y: MapNode) => {
		if (!x.next.includes(y.id)) x.next.push(y.id);
	};
	let i = 0;
	let j = 0;
	link(a[0], b[0]);
	while (i < a.length - 1 || j < b.length - 1) {
		if (i === a.length - 1) j++;
		else if (j === b.length - 1) i++;
		else {
			const da = a[i + 1].y;
			const db = b[j + 1].y;
			if (da < db - 0.1) i++;
			else if (db < da - 0.1) j++;
			else if (rng.chance(0.35)) {
				// A fork: one side moves first, so one node links to two.
				if (rng.chance(0.5)) i++;
				else j++;
			} else {
				i++;
				j++;
			}
		}
		link(a[i], b[j]);
	}
}

function parents(rows: MapNode[][], node: MapNode): MapNode[] {
	if (node.row === 0) return [];
	return rows[node.row - 1].filter((p) => p.next.includes(node.id));
}

function assignTypes(rng: Rng, act: number, rows: MapNode[][]) {
	const def = ACTS[act];
	const used: Record<string, number> = {};
	for (const row of rows) {
		for (const node of row) {
			const fixed = def.fixed[node.row];
			if (fixed) {
				node.type = fixed;
				used[fixed] = (used[fixed] ?? 0) + 1;
				continue;
			}
			const before = parents(rows, node).map((p) => p.type);
			const siblings = row.filter((n) => n !== node && n.id < node.id).map((n) => n.type);
			const pick = rng.weighted(Object.values(SPOTS), (s) => {
				if (s.weight <= 0) return 0;
				if (node.row < s.rows[0] || node.row > s.rows[1]) return 0;
				if ((used[s.id] ?? 0) >= s.max) return 0;
				if (s.noRepeat && before.includes(s.id)) return 0;
				// Rest right before the fixed rest row is wasted.
				if (s.id === 'rest' && def.fixed[node.row + 1] === 'rest') return 0;
				// Spread kinds across a row.
				if (s.id !== 'fight' && siblings.includes(s.id)) return s.weight * 0.3;
				return s.weight;
			});
			node.type = pick?.id ?? 'fight';
			used[node.type] = (used[node.type] ?? 0) + 1;
		}
	}
}

export const nodeById = (map: ActMap, id: number) => map.nodes.find((n) => n.id === id)!;

/** Problems with a map: unreachable spots, dead ends, crossing lines. Empty when fine. */
export function checkMap(map: ActMap): string[] {
	const problems: string[] = [];
	const last = map.rows - 1;
	const byRow = (r: number) => map.nodes.filter((n) => n.row === r);
	const reach = new Set<number>(byRow(0).map((n) => n.id));
	for (let r = 0; r < last; r++) for (const n of byRow(r)) if (reach.has(n.id)) n.next.forEach((x) => reach.add(x));
	for (const n of map.nodes) {
		if (!reach.has(n.id)) problems.push(`spot ${n.id} (row ${n.row}) cannot be reached`);
		if (n.row < last && n.next.length === 0) problems.push(`spot ${n.id} (row ${n.row}) is a dead end`);
		if (!SPOTS[n.type]) problems.push(`spot ${n.id} has unknown type ${n.type}`);
	}
	if (byRow(last).length !== 1 || byRow(last)[0].type !== 'boss') problems.push('the last row is not one boss');
	for (let r = 0; r < last; r++) {
		const edges = byRow(r).flatMap((a) => a.next.map((b) => [a.y, nodeById(map, b).y]));
		for (const [a1, b1] of edges)
			for (const [a2, b2] of edges) if ((a1 < a2 && b1 > b2) || (a1 > a2 && b1 < b2)) problems.push(`lines cross after row ${r}`);
	}
	return [...new Set(problems)];
}

/** Every path from a row 0 spot to the boss, as lists of spot types. */
export function allPaths(map: ActMap): string[][] {
	const out: string[][] = [];
	const walk = (n: MapNode, path: string[]) => {
		const p = [...path, n.type];
		if (n.next.length === 0) out.push(p);
		for (const id of n.next) walk(nodeById(map, id), p);
	};
	for (const n of map.nodes.filter((x) => x.row === 0)) walk(n, []);
	return out;
}
