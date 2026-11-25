import * as THREE from 'three';
import type { Grid } from '../core/grid.ts';
import type { Cond, LevelDef } from '../core/types.ts';
import { Builder, type Look } from './builder.ts';
import { psx, type PsxMaterial } from './psx.ts';
import { texture, textureSize } from './textures.ts';

export interface LightSource {
	pos: THREE.Vector3;
	color: THREE.Color;
	range: number;
	cond?: Cond;
	flicker: number;
	phase: number;
	dead: boolean;
	/** 0..1, eased toward the target each frame. */
	on: number;
	/** Extra flicker from outside, like the creature walking by. 0..1. */
	disturb: number;
	/** Index into a panel instanced mesh, or -1. */
	panel: number;
	panelMesh: THREE.InstancedMesh | null;
	zoneChar: string;
}

export interface LevelVisual {
	group: THREE.Group;
	lights: LightSource[];
	zoneIndex: Record<string, number>;
	waterMaterials: Map<string, PsxMaterial>;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildLevel(level: LevelDef, grid: Grid): LevelVisual {
	const b = new Builder();
	const c = grid.cell;
	const zoneIndex: Record<string, number> = {};
	Object.keys(level.zones).forEach((ch, i) => (zoneIndex[ch] = i));

	const isSolid = (x: number, y: number) => grid.solid(x, y);

	for (let y = 0; y < grid.h; y++) {
		for (let x = 0; x < grid.w; x++) {
			const z = grid.zone(x, y);
			if (!z || z.solid) continue;
			b.zone = zoneIndex[grid.char(x, y)];
			const x0 = x * c;
			const z0 = y * c;
			floorAndCeiling(b, x, y, x0, z0, c, z.floor, z.ceiling, z.height, isSolid);
			const sides: [number, number, THREE.Vector3, THREE.Vector3][] = [
				[x, y - 1, V(x0, 0, z0), V(x0 + c, 0, z0)],
				[x, y + 1, V(x0 + c, 0, z0 + c), V(x0, 0, z0 + c)],
				[x + 1, y, V(x0 + c, 0, z0), V(x0 + c, 0, z0 + c)],
				[x - 1, y, V(x0, 0, z0 + c), V(x0, 0, z0)],
			];
			for (const [nx, ny, a, bb] of sides) {
				const nz = grid.zone(nx, ny);
				if (!nz || nz.solid) {
					if (nz?.window) windowWall(b, z.wall, a, bb, z.height, nx > x || ny > y);
					else wall(b, z.wall, a, bb, 0, z.height);
				} else if (nz.height < z.height) {
					// a strip of wall between the lower ceiling next door and ours
					wall(b, z.wall, a, bb, nz.height, z.height);
				}
			}
		}
	}

	// window glass, one pane in the middle of each window cell
	const glass = new Builder();
	for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
		if (!grid.zone(x, y)?.window) continue;
		const horizontal = !grid.solid(x - 1, y) || !grid.solid(x + 1, y);
		glass.zone = 0;
		glass.plate({ tex: null, color: [0.7, 0.8, 0.78], transparent: true, alpha: 0.1, emissive: true, doubleSide: true }, 1.6, 1.2, (x + 0.5) * c, 1.45, (y + 0.5) * c, horizontal ? Math.PI / 2 : 0);
	}

	const group = new THREE.Group();
	group.add(b.build().group);
	group.add(glass.build().group);

	// water surfaces
	const waterMaterials = new Map<string, PsxMaterial>();
	for (const [ch, z] of Object.entries(level.zones)) {
		if (!z.water) continue;
		const wb = new Builder();
		wb.zone = zoneIndex[ch];
		const look: Look = { tex: 'water' };
		for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
			if (grid.char(x, y) !== ch) continue;
			for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
				const ax = x * c + i;
				const az = y * c + j;
				wb.quad(look, [V(ax, z.water, az + 1), V(ax + 1, z.water, az + 1), V(ax + 1, z.water, az), V(ax, z.water, az)], [
					[ax / 2, (az + 1) / 2], [(ax + 1) / 2, (az + 1) / 2], [(ax + 1) / 2, az / 2], [ax / 2, az / 2],
				]);
			}
		}
		const built = wb.build();
		const mat = psx({ map: texture('water'), transparent: true, alpha: 0.88, scroll: [0.03, 0.012], scroll2: [-0.02, 0.025], wave: 1 });
		for (const mesh of built.group.children as THREE.Mesh[]) {
			mesh.material = mat;
			mesh.renderOrder = 1;
		}
		waterMaterials.set(ch, mat);
		group.add(built.group);
	}

	const lights = buildLights(level, grid, group);
	return { group, lights, zoneIndex, waterMaterials };
}

function floorAndCeiling(
	b: Builder, x: number, y: number, x0: number, z0: number, c: number,
	floorTex: string, ceilTex: string, h: number, isSolid: (x: number, y: number) => boolean,
) {
	const fs = textureSize(floorTex);
	const cs = textureSize(ceilTex);
	const half = c / 2;
	// a vertex that touches a wall is darker: fake ambient occlusion
	const shadeAt = (sx: number, sz: number) => {
		let s = 1;
		if (sx === 0 && isSolid(x - 1, y)) s -= 0.3;
		if (sx === 2 && isSolid(x + 1, y)) s -= 0.3;
		if (sz === 0 && isSolid(x, y - 1)) s -= 0.3;
		if (sz === 2 && isSolid(x, y + 1)) s -= 0.3;
		return Math.max(0.45, s);
	};
	for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
		const ax = x0 + i * half;
		const az = z0 + j * half;
		const bx = ax + half;
		const bz = az + half;
		const sh = [shadeAt(i, j + 1), shadeAt(i + 1, j + 1), shadeAt(i + 1, j), shadeAt(i, j)];
		b.quad({ tex: floorTex }, [V(ax, 0, bz), V(bx, 0, bz), V(bx, 0, az), V(ax, 0, az)], [
			[ax / fs[0], bz / fs[1]], [bx / fs[0], bz / fs[1]], [bx / fs[0], az / fs[1]], [ax / fs[0], az / fs[1]],
		], sh);
		const ch = [shadeAt(i, j), shadeAt(i + 1, j), shadeAt(i + 1, j + 1), shadeAt(i, j + 1)].map((s) => 0.55 + s * 0.45);
		b.quad({ tex: ceilTex }, [V(ax, h, az), V(bx, h, az), V(bx, h, bz), V(ax, h, bz)], [
			[ax / cs[0], az / cs[1]], [bx / cs[0], az / cs[1]], [bx / cs[0], bz / cs[1]], [ax / cs[0], bz / cs[1]],
		], ch);
	}
}

/** A wall from a to b (left to right seen from the room), from y0 up to y1. */
function wall(b: Builder, tex: string, a: THREE.Vector3, bb: THREE.Vector3, y0: number, y1: number) {
	const size = textureSize(tex);
	const len = a.distanceTo(bb);
	const cols = Math.max(1, Math.round(len));
	const rows = Math.max(1, Math.ceil((y1 - y0) / 0.9));
	const dir = bb.clone().sub(a).normalize();
	// u runs with the world position, so neighbors line up
	const u0 = (Math.abs(dir.x) > 0.5 ? a.x * Math.sign(dir.x) : a.z * Math.sign(dir.z)) / size[0];
	const shade = (y: number) => (y < 0.01 ? 0.62 : 1) * (y1 - y < 0.01 && y0 === 0 ? 0.82 : 1);
	for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
			const t0 = (i / cols) * len;
			const t1 = ((i + 1) / cols) * len;
			const ya = y0 + ((y1 - y0) * j) / rows;
			const yb = y0 + ((y1 - y0) * (j + 1)) / rows;
			const p0 = a.clone().addScaledVector(dir, t0);
			const p1 = a.clone().addScaledVector(dir, t1);
			b.quad({ tex }, [V(p0.x, ya, p0.z), V(p1.x, ya, p1.z), V(p1.x, yb, p1.z), V(p0.x, yb, p0.z)], [
				[u0 + t0 / size[0], ya / size[1]], [u0 + t1 / size[0], ya / size[1]], [u0 + t1 / size[0], yb / size[1]], [u0 + t0 / size[0], yb / size[1]],
			], [shade(ya), shade(ya), shade(yb), shade(yb)]);
		}
	}
}

/** A wall with a window hole. The reveal is drawn once, from one side. */
function windowWall(b: Builder, tex: string, a: THREE.Vector3, bb: THREE.Vector3, h: number, farSide: boolean) {
	const dir = bb.clone().sub(a).normalize();
	const len = a.distanceTo(bb);
	const w0 = 0.2;
	const w1 = len - 0.2;
	const sill = 0.85;
	const top = 2.05;
	const at = (t: number) => a.clone().addScaledVector(dir, t);
	wall(b, tex, a, at(w0), 0, h);
	wall(b, tex, at(w1), bb, 0, h);
	wall(b, tex, at(w0), at(w1), 0, sill);
	wall(b, tex, at(w0), at(w1), top, h);
	if (farSide) return;
	// the reveal: four faces through the 2 m thick wall
	const n = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(-1);
	const depth = 2;
	const look: Look = { tex: 'metalPanel', color: [0.75, 0.75, 0.7] };
	const p = (t: number, y: number, d: number) => at(t).addScaledVector(n, d).setY(y);
	const uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
	b.quad(look, [p(w0, sill, 0), p(w1, sill, 0), p(w1, sill, depth), p(w0, sill, depth)], uvs);
	b.quad(look, [p(w0, top, 0), p(w1, top, 0), p(w1, top, depth), p(w0, top, depth)].reverse(), uvs);
	b.quad(look, [p(w0, sill, 0), p(w0, sill, depth), p(w0, top, depth), p(w0, top, 0)], uvs);
	b.quad(look, [p(w1, sill, 0), p(w1, sill, depth), p(w1, top, depth), p(w1, top, 0)].reverse(), uvs);
}

function buildLights(level: LevelDef, grid: Grid, group: THREE.Group): LightSource[] {
	const c = grid.cell;
	type Spot = { x: number; y: number; ch: string };
	const panels: Spot[] = [];
	const cages: Spot[] = [];
	const lights: LightSource[] = [];
	let seed = 7;
	const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
		const ch = grid.char(x, y);
		const z = level.zones[ch];
		if (!z || z.solid || !z.lights) continue;
		const L = z.lights;
		if ((x + 2 * y) % L.every !== 0) continue;
		const dead = !!L.dead?.some(([dx, dy]) => dx === x && dy === y);
		const style = z.height > 2.8 ? cages : panels;
		style.push({ x, y, ch });
		lights.push({
			pos: new THREE.Vector3((x + 0.5) * c, z.height - (style === cages ? 0.45 : 0.08), (y + 0.5) * c),
			color: new THREE.Color(...L.color),
			range: L.range,
			cond: L.cond,
			flicker: rand() < (L.flicker ?? 0) ? 1 : 0,
			phase: rand() * 100,
			dead,
			on: 1,
			disturb: 0,
			panel: style.length - 1,
			panelMesh: null,
			zoneChar: ch,
		});
	}
	const panelMat = psx({ map: texture('lightPanel'), emissive: true, vertexColors: false });
	const panelGeo = new THREE.PlaneGeometry(1.2, 0.6).rotateX(Math.PI / 2);
	const cageGeo = new THREE.BoxGeometry(0.5, 0.16, 0.22);
	const make = (geo: THREE.BufferGeometry, spots: Spot[], isCage: boolean) => {
		const mesh = new THREE.InstancedMesh(geo, panelMat, Math.max(1, spots.length));
		const m = new THREE.Matrix4();
		spots.forEach((s, i) => {
			const z = level.zones[s.ch];
			m.makeTranslation((s.x + 0.5) * c, z.height - (isCage ? 0.4 : 0.01), (s.y + 0.5) * c);
			mesh.setMatrixAt(i, m);
			mesh.setColorAt(i, new THREE.Color(1, 1, 1));
		});
		mesh.count = spots.length;
		mesh.frustumCulled = false;
		group.add(mesh);
		return mesh;
	};
	const panelMesh = make(panelGeo, panels, false);
	const cageMesh = make(cageGeo, cages, true);
	// cage lights hang from a short rod
	const rods = new Builder();
	for (const s of cages) {
		const z = level.zones[s.ch];
		rods.box({ tex: null, color: [0.2, 0.2, 0.2] }, 0.04, 0.4, 0.04, (s.x + 0.5) * c, z.height - 0.4, (s.y + 0.5) * c);
	}
	if (!rods.empty) group.add(rods.build().group);
	let pi = 0;
	let ci = 0;
	for (const l of lights) {
		const isCage = level.zones[l.zoneChar].height > 2.8;
		l.panelMesh = isCage ? cageMesh : panelMesh;
		l.panel = isCage ? ci++ : pi++;
	}
	return lights;
}
