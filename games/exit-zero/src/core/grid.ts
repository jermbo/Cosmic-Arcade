import type { LevelDef, ZoneDef } from './types.ts';

/** The cell map of a level: which cells are solid, and the zone of each. */
export class Grid {
	readonly w: number;
	readonly h: number;
	readonly cell: number;
	readonly chars: string[];
	/** Cells that a closed door or gate blocks right now. Key: x,y. */
	readonly blocked = new Set<string>();
	readonly level: LevelDef;

	constructor(level: LevelDef) {
		this.level = level;
		this.cell = level.cell;
		this.h = level.map.length;
		this.w = Math.max(...level.map.map((r) => r.length));
		this.chars = level.map.map((r) => r.padEnd(this.w, '#'));
	}

	char(x: number, y: number): string {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#';
		return this.chars[y][x];
	}

	zone(x: number, y: number): ZoneDef | undefined {
		return this.level.zones[this.char(x, y)];
	}

	/** A wall or window: never walkable. */
	solid(x: number, y: number): boolean {
		const z = this.zone(x, y);
		return !z || !!z.solid;
	}

	/** Solid, or blocked by a closed door. */
	blocks(x: number, y: number): boolean {
		return this.solid(x, y) || this.blocked.has(`${x},${y}`);
	}

	/** The zone at a world position. */
	zoneAt(wx: number, wz: number): ZoneDef | undefined {
		return this.zone(Math.floor(wx / this.cell), Math.floor(wz / this.cell));
	}

	cellOf(wx: number, wz: number): [number, number] {
		return [Math.floor(wx / this.cell), Math.floor(wz / this.cell)];
	}

	/** World center of a cell. */
	center(x: number, y: number): [number, number] {
		return [(x + 0.5) * this.cell, (y + 0.5) * this.cell];
	}

	/** True when nothing solid lies on the straight line between two world points. */
	lineClear(ax: number, az: number, bx: number, bz: number, useBlocked = true): boolean {
		const dx = bx - ax;
		const dz = bz - az;
		const len = Math.hypot(dx, dz);
		const steps = Math.ceil(len / (this.cell * 0.2));
		for (let i = 1; i < steps; i++) {
			const t = i / steps;
			const [cx, cy] = this.cellOf(ax + dx * t, az + dz * t);
			if (useBlocked ? this.blocks(cx, cy) : this.solid(cx, cy)) return false;
		}
		return true;
	}

	/**
	 * Breadth-first path over walkable cells. When the goal can't be reached it returns the path to
	 * the reachable cell that is closest to the goal.
	 */
	path(from: [number, number], to: [number, number]): [number, number][] {
		const key = (x: number, y: number) => y * this.w + x;
		const prev = new Map<number, number>();
		const start = key(from[0], from[1]);
		prev.set(start, -1);
		const queue = [start];
		let best = start;
		let bestD = Infinity;
		for (let qi = 0; qi < queue.length; qi++) {
			const k = queue[qi];
			const x = k % this.w;
			const y = (k / this.w) | 0;
			const d = Math.abs(x - to[0]) + Math.abs(y - to[1]);
			if (d < bestD) {
				bestD = d;
				best = k;
				if (d === 0) break;
			}
			for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
				if (this.blocks(nx, ny)) continue;
				const nk = key(nx, ny);
				if (prev.has(nk)) continue;
				prev.set(nk, k);
				queue.push(nk);
			}
		}
		const out: [number, number][] = [];
		for (let k = best; k !== -1; k = prev.get(k) ?? -1) out.push([k % this.w, (k / this.w) | 0]);
		return out.reverse();
	}
}
