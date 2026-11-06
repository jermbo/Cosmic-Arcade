import * as THREE from 'three';
import { model, tint } from '../assets';
import type { MapDef, Point } from '../data/maps';

/** Height of the top of a tile. */
export const TOP = 0.2;

// Directions as bits: north (-z), east (+x), south (+z), west (-x).
const STEPS: [number, number][] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
];
const N = 1;
const E = 2;
const S = 4;
const W = 8;

export type CellKind = 'ground' | 'blocked' | 'path' | 'river' | 'bridge' | 'spawn' | 'goal';

export interface Cell {
	c: number;
	r: number;
	kind: CellKind;
	pathMask: number;
	riverMask: number;
	tower: unknown;
}

/** A line that enemies follow, measured by distance from its start. */
export class Route {
	readonly points: THREE.Vector3[];
	readonly lengths: number[] = [0];
	readonly total: number;

	constructor(points: THREE.Vector3[]) {
		this.points = points;
		for (let i = 1; i < points.length; i++) {
			this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]));
		}
		this.total = this.lengths[this.lengths.length - 1];
	}

	at(distance: number, out: THREE.Vector3, tangent?: THREE.Vector3): THREE.Vector3 {
		const d = THREE.MathUtils.clamp(distance, 0, this.total);
		let low = 0;
		let high = this.lengths.length - 1;
		while (high - low > 1) {
			const mid = (low + high) >> 1;
			if (this.lengths[mid] <= d) low = mid;
			else high = mid;
		}
		const a = this.points[low];
		const b = this.points[high];
		const span = this.lengths[high] - this.lengths[low] || 1;
		out.lerpVectors(a, b, (d - this.lengths[low]) / span);
		if (tangent) tangent.subVectors(b, a).normalize();
		return out;
	}
}

function rotateMask(mask: number, turns: number): number {
	let out = 0;
	for (let d = 0; d < 4; d++) if (mask & (1 << d)) out |= 1 << ((d + 3 * turns) % 4);
	return out;
}

/** Finds the turn (in quarter turns) that makes the base openings match the wanted openings. */
function turnFor(base: number, wanted: number): number {
	for (let k = 0; k < 4; k++) if (rotateMask(base, k) === wanted) return k;
	return -1;
}

const PATH_SHAPES: [string, number][] = [
	['tile-straight', N | S],
	['tile-corner-square', E | S],
	['tile-split', W | E | S],
	['tile-crossing', N | E | S | W],
	['tile-end', S],
];

function expand(waypoints: Point[]): Point[] {
	const cells: Point[] = [waypoints[0]];
	for (let i = 1; i < waypoints.length; i++) {
		const [c0, r0] = waypoints[i - 1];
		const [c1, r1] = waypoints[i];
		const dc = Math.sign(c1 - c0);
		const dr = Math.sign(r1 - r0);
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

function dirBetween(a: Point, b: Point): number {
	const dc = b[0] - a[0];
	const dr = b[1] - a[1];
	return STEPS.findIndex(([x, y]) => x === dc && y === dr);
}

function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export class Board {
	readonly map: MapDef;
	readonly group = new THREE.Group();
	readonly cells: Cell[][] = [];
	readonly routes: Route[] = [];
	readonly flyRoutes: Route[] = [];
	readonly pathCells: Point[][] = [];
	readonly goal = new THREE.Vector3();
	readonly crystal = new THREE.Group();
	readonly portals: THREE.Object3D[] = [];
	private readonly prefix: string;

	constructor(map: MapDef) {
		this.map = map;
		this.prefix = map.theme === 'snow' ? 'snow-' : '';
		for (let c = 0; c < map.w; c++) {
			this.cells.push([]);
			for (let r = 0; r < map.h; r++) {
				this.cells[c].push({ c, r, kind: 'ground', pathMask: 0, riverMask: 0, tower: null });
			}
		}
		this.markRivers();
		this.markPaths();
		this.buildRoutes();
		this.placeTiles();
		this.buildIsland();
		this.buildCrystal();
	}

	get width(): number {
		return this.map.w;
	}

	get depth(): number {
		return this.map.h;
	}

	inside(c: number, r: number): boolean {
		return c >= 0 && r >= 0 && c < this.map.w && r < this.map.h;
	}

	cell(c: number, r: number): Cell | null {
		return this.inside(c, r) ? this.cells[c][r] : null;
	}

	world(c: number, r: number, out = new THREE.Vector3()): THREE.Vector3 {
		return out.set(c - (this.map.w - 1) / 2, TOP, r - (this.map.h - 1) / 2);
	}

	cellAtWorld(x: number, z: number): Cell | null {
		const c = Math.round(x + (this.map.w - 1) / 2);
		const r = Math.round(z + (this.map.h - 1) / 2);
		return this.cell(c, r);
	}

	buildable(cell: Cell | null): boolean {
		return !!cell && cell.kind === 'ground' && !cell.tower;
	}

	private markRivers(): void {
		for (const river of this.map.rivers) {
			const cells = expand(river);
			for (let i = 0; i < cells.length; i++) {
				const [c, r] = cells[i];
				const cell = this.cell(c, r);
				if (!cell) continue;
				cell.kind = 'river';
				if (i > 0) cell.riverMask |= 1 << dirBetween(cells[i], cells[i - 1]);
				if (i < cells.length - 1) cell.riverMask |= 1 << dirBetween(cells[i], cells[i + 1]);
			}
		}
	}

	private markPaths(): void {
		for (const path of this.map.paths) {
			const cells = expand(path);
			this.pathCells.push(cells);
			for (let i = 0; i < cells.length; i++) {
				const [c, r] = cells[i];
				const cell = this.cells[c][r];
				if (i > 0) cell.pathMask |= 1 << dirBetween(cells[i], cells[i - 1]);
				if (i < cells.length - 1) cell.pathMask |= 1 << dirBetween(cells[i], cells[i + 1]);
				if (i === 0) cell.kind = 'spawn';
				else if (i === cells.length - 1) cell.kind = 'goal';
				else if (cell.kind === 'river') cell.kind = 'bridge';
				else if (cell.kind !== 'spawn' && cell.kind !== 'goal' && cell.kind !== 'bridge') cell.kind = 'path';
			}
		}
	}

	private buildRoutes(): void {
		const spawns = new Map<string, THREE.Vector3>();
		for (const cells of this.pathCells) {
			const points: THREE.Vector3[] = [this.world(...cells[0])];
			for (let i = 1; i < cells.length - 1; i++) {
				const center = this.world(...cells[i]);
				const inDir = dirBetween(cells[i - 1], cells[i]);
				const outDir = dirBetween(cells[i], cells[i + 1]);
				if (inDir === outDir) {
					points.push(center);
					continue;
				}
				// Round the corner with a small curve.
				const start = center.clone().add(new THREE.Vector3(-STEPS[inDir][0] * 0.5, 0, -STEPS[inDir][1] * 0.5));
				const end = center.clone().add(new THREE.Vector3(STEPS[outDir][0] * 0.5, 0, STEPS[outDir][1] * 0.5));
				const curve = new THREE.QuadraticBezierCurve3(start, center, end);
				points.push(...curve.getPoints(6));
			}
			const last = cells[cells.length - 1];
			points.push(this.world(...last));
			this.goal.copy(points[points.length - 1]);
			this.routes.push(new Route(points));
			spawns.set(cells[0].join(','), points[0]);
		}
		for (const spawn of spawns.values()) this.flyRoutes.push(new Route([spawn.clone(), this.goal.clone()]));
	}

	/** The straight flight route that starts at the spawn of this path. */
	flyRouteFor(pathIndex: number): Route {
		const start = this.routes[pathIndex].points[0];
		return this.flyRoutes.find((route) => route.points[0].distanceTo(start) < 0.01) ?? this.flyRoutes[0];
	}

	private add(name: string, c: number, r: number, turns = 0): THREE.Object3D {
		const object = model(this.prefix + name);
		this.world(c, r, object.position);
		object.position.y = 0;
		object.rotation.y = (turns * Math.PI) / 2;
		this.group.add(object);
		return object;
	}

	private placeTiles(): void {
		const random = mulberry32(this.map.decorSeed);
		const nearPath = (c: number, r: number): boolean => {
			for (let dc = -1; dc <= 1; dc++) {
				for (let dr = -1; dr <= 1; dr++) {
					const other = this.cell(c + dc, r + dr);
					if (other && other.pathMask) return true;
				}
			}
			return false;
		};
		const decor = ['tile-tree', 'tile-tree', 'tile-tree-double', 'tile-tree-quad', 'tile-rock', 'tile-crystal', 'tile-hill'];

		for (let c = 0; c < this.map.w; c++) {
			for (let r = 0; r < this.map.h; r++) {
				const cell = this.cells[c][r];
				switch (cell.kind) {
					case 'ground': {
						const chance = nearPath(c, r) ? this.map.decorDensity * 0.2 : this.map.decorDensity;
						if (random() < chance) {
							cell.kind = 'blocked';
							this.add(decor[Math.floor(random() * decor.length)], c, r, Math.floor(random() * 4));
						} else {
							this.add('tile', c, r);
						}
						break;
					}
					case 'river': {
						const straight = turnFor(N | S, cell.riverMask);
						if (straight >= 0) this.add('tile-river-straight', c, r, straight);
						else this.add('tile-river-corner', c, r, Math.max(0, turnFor(E | S, cell.riverMask)));
						break;
					}
					case 'bridge':
						this.add('tile-river-bridge', c, r, cell.pathMask === (E | W) ? 0 : 1);
						break;
					case 'spawn': {
						const turns = turnFor(S, cell.pathMask);
						if (turns >= 0) this.add('tile-spawn-end', c, r, turns);
						else this.add('tile-spawn', c, r, Math.max(0, turnFor(N | S, cell.pathMask)));
						this.addPortal(c, r);
						break;
					}
					default: {
						for (const [name, base] of PATH_SHAPES) {
							const turns = turnFor(base, cell.pathMask);
							if (turns >= 0) {
								this.add(name, c, r, turns);
								break;
							}
						}
					}
				}
			}
		}
	}

	private addPortal(c: number, r: number): void {
		const portal = new THREE.Mesh(
			new THREE.TorusGeometry(0.32, 0.05, 8, 24),
			new THREE.MeshStandardMaterial({ color: 0xb06cff, emissive: 0x9b4dff, emissiveIntensity: 1.4 }),
		);
		this.world(c, r, portal.position);
		portal.position.y = TOP + 0.08;
		portal.rotation.x = Math.PI / 2;
		this.group.add(portal);
		this.portals.push(portal);
	}

	private buildIsland(): void {
		const snow = this.map.theme === 'snow';
		const top = new THREE.Mesh(
			new THREE.BoxGeometry(this.map.w + 0.2, 0.7, this.map.h + 0.2),
			new THREE.MeshStandardMaterial({ color: snow ? 0xb9c2e0 : 0xc9774a, roughness: 1 }),
		);
		top.position.y = -0.35 + 0.02;
		const bottom = new THREE.Mesh(
			new THREE.BoxGeometry(this.map.w - 0.3, 0.9, this.map.h - 0.3),
			new THREE.MeshStandardMaterial({ color: snow ? 0x7d84ad : 0x8a4a33, roughness: 1 }),
		);
		bottom.position.y = -1.1;
		top.receiveShadow = true;
		this.group.add(top, bottom);
	}

	private buildCrystal(): void {
		const big = model(this.prefix + 'detail-crystal-large');
		tint(big, 0xff7ad9, 0.55);
		big.scale.setScalar(1.25);
		this.crystal.add(big);
		for (let i = 0; i < 3; i++) {
			const small = model(this.prefix + 'detail-crystal');
			tint(small, 0x8fe3ff, 0.6);
			small.scale.setScalar(0.8);
			small.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.55, 0.5, Math.sin((i / 3) * Math.PI * 2) * 0.55);
			small.name = 'orbit';
			this.crystal.add(small);
		}
		this.crystal.position.copy(this.goal);
		this.crystal.position.y = TOP + 0.02;
		this.group.add(this.crystal);
	}

	update(time: number): void {
		this.crystal.children[0].rotation.y = time * 0.4;
		this.crystal.children[0].position.y = Math.sin(time * 1.6) * 0.04;
		for (let i = 1; i < this.crystal.children.length; i++) {
			const angle = time * 0.9 + (i / 3) * Math.PI * 2;
			const orbit = this.crystal.children[i];
			orbit.position.set(Math.cos(angle) * 0.6, 0.55 + Math.sin(time * 2 + i) * 0.1, Math.sin(angle) * 0.6);
			orbit.rotation.y = -angle;
		}
		for (const portal of this.portals) {
			portal.rotation.z = time * 1.5;
			const pulse = 1 + Math.sin(time * 4) * 0.08;
			portal.scale.set(pulse, pulse, pulse);
		}
	}
}
