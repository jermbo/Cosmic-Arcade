import type { Grid } from '../core/grid.ts';
import type { Box } from './world.ts';

/** Pushes a circle out of solid cells and boxes. Returns the new position. */
export function collide(grid: Grid, boxes: Box[], x: number, z: number, r: number): [number, number] {
	for (let pass = 0; pass < 3; pass++) {
		const [cx, cz] = grid.cellOf(x, z);
		const c = grid.cell;
		for (let gz = cz - 1; gz <= cz + 1; gz++) {
			for (let gx = cx - 1; gx <= cx + 1; gx++) {
				if (!grid.solid(gx, gz)) continue;
				[x, z] = pushOut(x, z, r, gx * c, gz * c, (gx + 1) * c, (gz + 1) * c);
			}
		}
		for (const b of boxes) {
			if (b.active && !b.active()) continue;
			if (x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1) continue;
			[x, z] = pushOut(x, z, r, b.x0, b.z0, b.x1, b.z1);
		}
	}
	return [x, z];
}

function pushOut(x: number, z: number, r: number, x0: number, z0: number, x1: number, z1: number): [number, number] {
	const nx = Math.max(x0, Math.min(x, x1));
	const nz = Math.max(z0, Math.min(z, z1));
	const dx = x - nx;
	const dz = z - nz;
	const d2 = dx * dx + dz * dz;
	if (d2 >= r * r) return [x, z];
	if (d2 > 1e-9) {
		const d = Math.sqrt(d2);
		return [nx + (dx / d) * r, nz + (dz / d) * r];
	}
	// the center is inside the box: leave by the nearest side
	const left = x - x0;
	const right = x1 - x;
	const top = z - z0;
	const bottom = z1 - z;
	const m = Math.min(left, right, top, bottom);
	if (m === left) return [x0 - r, z];
	if (m === right) return [x1 + r, z];
	if (m === top) return [x, z0 - r];
	return [x, z1 + r];
}
