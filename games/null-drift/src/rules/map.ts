import type { LayerDef } from '../data/layers.ts';
import type { NodeType, RolledType } from '../data/nodes.ts';
import { childRng } from './rng.ts';

export const ROWS = 4;
export const COLS = 5;
export const END_COL = 2;
export const FLOORS = 4;

const MAX_SHORTCUTS = 2;
const SHORTCUT_CHANCE = 0.04;
/** 1-based row where elites may start to appear. */
const ELITE_ROW = 3;
/** 1-based row that turns into a market row on the market floor. */
const MARKET_ROW = 3;

export interface MapNode {
	id: string;
	row: number;
	col: number;
	type: NodeType;
	exits: string[];
}

export interface FloorMap {
	floor: number;
	nodes: MapNode[];
	endId: string;
}

const keyOf = (row: number, col: number) => `r${row}c${col}`;

type Edge = [from: number, to: number];

function crosses(edges: Edge[], from: number, to: number): boolean {
	return edges.some(([a, b]) => (a < from && b > to) || (a > from && b < to));
}

export function generateFloor(seed: number, floor: number, layer: LayerDef, marketFloor: number): FloorMap {
	const rng = childRng(seed, `map${floor}`);
	const byKey = new Map<string, MapNode>();
	const ensure = (row: number, col: number) => {
		const id = keyOf(row, col);
		let node = byKey.get(id);
		if (!node) {
			node = { id, row, col, type: 'combat', exits: [] };
			byKey.set(id, node);
		}
		return node;
	};
	const link = (a: MapNode, b: MapNode) => {
		if (!a.exits.includes(b.id)) a.exits.push(b.id);
	};

	// Pass 1: topology. edges[r] holds column pairs between row r and r + 1.
	const edges: Edge[][] = [[], [], []];
	const end = ensure(ROWS - 1, END_COL);
	const routes = rng.int(7, 10);
	const first = rng.int(0, COLS - 1);
	let second = rng.int(0, COLS - 1);
	while (second === first) second = rng.int(0, COLS - 1);

	for (let i = 0; i < routes; i++) {
		let col = i === 0 ? first : i === 1 ? second : rng.int(0, COLS - 1);
		let node = ensure(0, col);
		for (let row = 0; row < ROWS - 2; row++) {
			// A straight step never crosses, so the list is never empty.
			const options = [col - 1, col, col + 1].filter((c) => c >= 0 && c < COLS && !crosses(edges[row], col, c));
			const nextCol = rng.pick(options);
			if (!edges[row].some(([a, b]) => a === col && b === nextCol)) edges[row].push([col, nextCol]);
			const child = ensure(row + 1, nextCol);
			link(node, child);
			node = child;
			col = nextCol;
		}
		link(node, end);
	}

	const sorted = () => [...byKey.values()].sort((a, b) => a.row - b.row || a.col - b.col);

	// Shortcuts: a rare edge that skips two columns. Never from the last two rows.
	let shortcuts = 0;
	for (const node of sorted()) {
		if (shortcuts >= MAX_SHORTCUTS) break;
		if (node.row >= ROWS - 2) continue;
		if (!rng.chance(SHORTCUT_CHANCE)) continue;
		const dirs = rng.chance(0.5) ? [2, -2] : [-2, 2];
		for (const d of dirs) {
			const target = byKey.get(keyOf(node.row + 1, node.col + d));
			if (!target || node.exits.includes(target.id)) continue;
			if (crosses(edges[node.row], node.col, target.col)) continue;
			link(node, target);
			edges[node.row].push([node.col, target.col]);
			shortcuts++;
			break;
		}
	}

	const nodes = sorted();
	for (const node of nodes) {
		node.exits.sort((a, b) => byKey.get(a)!.col - byKey.get(b)!.col);
	}

	// Pass 2: node types, row by row so parents are typed first.
	const parentsOf = (node: MapNode) => nodes.filter((p) => p.exits.includes(node.id));
	for (const node of nodes) {
		const row1 = node.row + 1;
		if (node.row === 0) node.type = 'combat';
		else if (node.row === ROWS - 1) node.type = floor === FLOORS ? 'boss' : 'gate';
		else if (floor === marketFloor && row1 === MARKET_ROW) node.type = 'merchant';
		else {
			const w: Record<RolledType, number> = { ...layer.weights };
			if (row1 < ELITE_ROW) w.elite = 0;
			else w.elite += 7 * (row1 - ELITE_ROW);
			const parents = parentsOf(node);
			for (const t of ['cache', 'elite'] as const) {
				if (parents.some((p) => p.type === t)) w[t] = 0;
			}
			node.type = rng.weighted(w);
		}
	}

	return { floor, nodes, endId: end.id };
}

export function nodeById(map: FloorMap, id: string): MapNode | undefined {
	return map.nodes.find((n) => n.id === id);
}
