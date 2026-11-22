import type { Point } from './maps';

/** Walk corner waypoints and return every cell on the road. */
export function expand(waypoints: Point[]): Point[] {
	if (!waypoints.length) return [];
	const cells: Point[] = [waypoints[0]];
	for (let i = 1; i < waypoints.length; i++) {
		const [c0, r0] = waypoints[i - 1];
		const [c1, r1] = waypoints[i];
		const dc = Math.sign(c1 - c0);
		const dr = Math.sign(r1 - r0);
		if (dc === 0 && dr === 0) continue;
		if (dc !== 0 && dr !== 0) return [];
		let c = c0;
		let r = r0;
		while (c !== c1 || r !== r1) {
			c += dc;
			r += dr;
			cells.push([c, r]);
		}
	}
	return cells;
}

/** Collapse a cell walk into corner waypoints the game understands. */
export function simplifyToWaypoints(cells: Point[]): Point[] {
	if (!cells.length) return [];
	if (cells.length === 1) return [cells[0], [cells[0][0] + 1, cells[0][1]]];
	const out: Point[] = [cells[0]];
	for (let i = 1; i < cells.length; i++) {
		const prev = cells[i - 1];
		const next = cells[i + 1];
		if (!next) {
			out.push(cells[i]);
			break;
		}
		const inDc = cells[i][0] - prev[0];
		const inDr = cells[i][1] - prev[1];
		const outDc = next[0] - cells[i][0];
		const outDr = next[1] - cells[i][1];
		if (inDc !== outDc || inDr !== outDr) out.push(cells[i]);
	}
	return out;
}

export type Dir = 'n' | 'e' | 's' | 'w';

export function dirBetween(a: Point, b: Point): Dir | null {
	const dc = b[0] - a[0];
	const dr = b[1] - a[1];
	if (dc === 1 && dr === 0) return 'e';
	if (dc === -1 && dr === 0) return 'w';
	if (dc === 0 && dr === 1) return 's';
	if (dc === 0 && dr === -1) return 'n';
	return null;
}

export function isAdjacent(a: Point, b: Point): boolean {
	return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

export function cellKey(c: number, r: number): string {
	return `${c},${r}`;
}