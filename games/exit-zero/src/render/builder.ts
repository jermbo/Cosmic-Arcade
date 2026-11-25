import * as THREE from 'three';
import { psx, type PsxMaterial, type PsxOptions } from './psx.ts';
import { texture } from './textures.ts';

// Collects quads, boxes and cylinders into one mesh per material, so a room is a few draw calls.

export interface Look {
	/** Texture id from textures.ts, or a texture. Null for flat color. */
	tex?: string | THREE.Texture | null;
	color?: [number, number, number];
	emissive?: boolean;
	alphaTest?: number;
	transparent?: boolean;
	alpha?: number;
	doubleSide?: boolean;
	/** Texture repeats per meter. 0 maps 0..1 on each face. */
	uvScale?: number;
}

interface Bucket {
	look: Look;
	map: THREE.Texture | null;
	pos: number[];
	nrm: number[];
	uv: number[];
	col: number[];
	zone: number[];
}

const tmp = new THREE.Vector3();
const tmpN = new THREE.Vector3();

export class Builder {
	private buckets = new Map<string, Bucket>();
	private stack: THREE.Matrix4[] = [];
	private normalMat = new THREE.Matrix3();
	m = new THREE.Matrix4();
	zone = 0;

	push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1): void {
		this.stack.push(this.m.clone());
		const local = new THREE.Matrix4().compose(
			new THREE.Vector3(x, y, z),
			new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
			new THREE.Vector3(s, s, s),
		);
		this.m.multiply(local);
	}

	pop(): void {
		this.m = this.stack.pop() ?? new THREE.Matrix4();
	}

	private bucket(look: Look): Bucket {
		const texKey = typeof look.tex === 'string' ? look.tex : look.tex ? look.tex.uuid : 'none';
		const key = `${texKey}|${look.emissive ? 1 : 0}|${look.alphaTest ?? 0}|${look.transparent ? look.alpha : 1}|${look.doubleSide ? 1 : 0}`;
		let b = this.buckets.get(key);
		if (!b) {
			const map = typeof look.tex === 'string' ? texture(look.tex) : (look.tex ?? null);
			b = { look, map, pos: [], nrm: [], uv: [], col: [], zone: [] };
			this.buckets.set(key, b);
		}
		return b;
	}

	/** A quad from four corners (counter-clockwise seen from the front), in local space. */
	quad(look: Look, p: THREE.Vector3[], uv: [number, number][], shade: number[] = [1, 1, 1, 1]): void {
		const b = this.bucket(look);
		const c = look.color ?? [1, 1, 1];
		this.normalMat.getNormalMatrix(this.m);
		const e1 = p[1].clone().sub(p[0]);
		const e2 = p[2].clone().sub(p[0]);
		tmpN.crossVectors(e1, e2).normalize().applyMatrix3(this.normalMat).normalize();
		for (const i of [0, 1, 2, 0, 2, 3]) {
			tmp.copy(p[i]).applyMatrix4(this.m);
			b.pos.push(tmp.x, tmp.y, tmp.z);
			b.nrm.push(tmpN.x, tmpN.y, tmpN.z);
			b.uv.push(uv[i][0], uv[i][1]);
			b.col.push(c[0] * shade[i], c[1] * shade[i], c[2] * shade[i]);
			b.zone.push(this.zone);
		}
	}

	/** A box sitting on y, centered on x and z. */
	box(look: Look, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): void {
		this.push(x, y, z, ry);
		const hw = w / 2;
		const hd = d / 2;
		const s = look.uvScale ?? 0;
		const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
		const uvq = (uw: number, vh: number): [number, number][] =>
			s ? [[0, 0], [uw * s, 0], [uw * s, vh * s], [0, vh * s]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
		// shade the bottom of the sides darker, a cheap contact shadow
		const sideShade = [0.72, 0.72, 1, 1];
		this.quad(look, [V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)], uvq(w, h), sideShade);
		this.quad(look, [V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)], uvq(w, h), sideShade);
		this.quad(look, [V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)], uvq(d, h), sideShade);
		this.quad(look, [V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)], uvq(d, h), sideShade);
		this.quad(look, [V(-hw, h, hd), V(hw, h, hd), V(hw, h, -hd), V(-hw, h, -hd)], uvq(w, d));
		this.quad(look, [V(-hw, 0, -hd), V(hw, 0, -hd), V(hw, 0, hd), V(-hw, 0, hd)], uvq(w, d), [0.5, 0.5, 0.5, 0.5]);
		this.pop();
	}

	/** A cylinder along local y from y to y + h. */
	cyl(look: Look, r: number, h: number, seg = 6, x = 0, y = 0, z = 0, rx = 0, rz = 0, caps = true): void {
		this.push(x, y, z, 0, rx, rz);
		const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
		for (let i = 0; i < seg; i++) {
			const a0 = (i / seg) * Math.PI * 2;
			const a1 = ((i + 1) / seg) * Math.PI * 2;
			const p0 = V(Math.cos(a0) * r, 0, Math.sin(a0) * r);
			const p1 = V(Math.cos(a1) * r, 0, Math.sin(a1) * r);
			this.quad(look, [p1, p0, V(p0.x, h, p0.z), V(p1.x, h, p1.z)], [[(i + 1) / seg, 0], [i / seg, 0], [i / seg, h], [(i + 1) / seg, h]]);
			if (caps) {
				const c0 = V(0, h, 0);
				this.quad(look, [V(p1.x, h, p1.z), V(p0.x, h, p0.z), c0, c0.clone()], [[0, 0], [1, 0], [0.5, 1], [0.5, 1]]);
				const c1 = V(0, 0, 0);
				this.quad(look, [p0, p1, c1, c1.clone()], [[0, 0], [1, 0], [0.5, 1], [0.5, 1]], [0.6, 0.6, 0.6, 0.6]);
			}
		}
		this.pop();
	}

	/** A flat plate facing +z, centered on x, y. */
	plate(look: Look, w: number, h: number, x = 0, y = 0, z = 0, ry = 0): void {
		this.push(x, y, z, ry);
		const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c);
		this.quad(look, [V(-w / 2, -h / 2, 0), V(w / 2, -h / 2, 0), V(w / 2, h / 2, 0), V(-w / 2, h / 2, 0)], [[0, 0], [1, 0], [1, 1], [0, 1]]);
		this.pop();
	}

	get empty(): boolean {
		return this.buckets.size === 0;
	}

	/** Makes the meshes. Dynamic meshes share one ambient uniform, set by the caller. */
	build(o: { dynamic?: boolean } = {}): { group: THREE.Group; materials: PsxMaterial[] } {
		const group = new THREE.Group();
		const materials: PsxMaterial[] = [];
		const amb = new THREE.Vector4(0.2, 0.2, 0.2, o.dynamic ? 1 : 0);
		for (const b of this.buckets.values()) {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
			g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
			g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
			g.setAttribute('aZone', new THREE.Float32BufferAttribute(b.zone, 1));
			g.computeBoundingSphere();
			const opts: PsxOptions = {
				map: b.map,
				emissive: b.look.emissive,
				alphaTest: b.look.alphaTest,
				transparent: b.look.transparent,
				alpha: b.look.alpha,
				side: b.look.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
				dynamic: o.dynamic,
			};
			const mat = psx(opts);
			if (o.dynamic) mat.uniforms.uAmbDyn.value = amb;
			materials.push(mat);
			const mesh = new THREE.Mesh(g, mat);
			if (b.look.transparent) mesh.renderOrder = 2;
			group.add(mesh);
		}
		return { group, materials };
	}
}
