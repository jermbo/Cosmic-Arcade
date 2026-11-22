import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothCopy } from './toon';

export interface PartOpts {
	/** 0 = never changes, 1 = grows from a small bud when the ground wakes. */
	grow?: number;
	/** How much the piece glows when awake. */
	glow?: number;
	/** Draw an ink outline around this piece. */
	ink?: boolean;
	/** Override the anchor (local point on the ground) used for waking. */
	base?: THREE.Vector3;
	/** Random brightness change per piece. */
	vary?: number;
}

/**
 * Collects many small pieces and merges them into one decor mesh, plus one outline mesh.
 * Each piece remembers its anchor on the ground, so the shader can grow it when that spot wakes.
 */
export class Parts {
	private fill: THREE.BufferGeometry[] = [];
	private hull: THREE.BufferGeometry[] = [];
	private random: () => number;

	constructor(random: () => number) {
		this.random = random;
	}

	add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, matrix: THREE.Matrix4, o: PartOpts = {}): void {
		const base = o.base ?? new THREE.Vector3().setFromMatrixPosition(matrix);
		const c = new THREE.Color(color).multiplyScalar(1 + (this.random() - 0.5) * (o.vary ?? 0.1));
		this.fill.push(this.piece(geo, matrix, base, c, o));
		if (o.ink) this.hull.push(this.piece(smoothCopy(geo), matrix, base, c, o));
	}

	private piece(src: THREE.BufferGeometry, matrix: THREE.Matrix4, base: THREE.Vector3, c: THREE.Color, o: PartOpts): THREE.BufferGeometry {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', src.attributes.position.clone());
		if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone());
		if (src.index) g.setIndex(src.index.clone());
		if (!g.attributes.normal) g.computeVertexNormals();
		g.applyMatrix4(matrix);
		const n = g.attributes.position.count;
		const col = new Float32Array(n * 3);
		const bs = new Float32Array(n * 3);
		const grow = new Float32Array(n).fill(o.grow ?? 0);
		const glow = new Float32Array(n).fill(o.glow ?? 0);
		for (let i = 0; i < n; i++) {
			col.set([c.r, c.g, c.b], i * 3);
			bs.set([base.x, base.y, base.z], i * 3);
		}
		g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aBase', new THREE.BufferAttribute(bs, 3));
		g.setAttribute('aGrow', new THREE.BufferAttribute(grow, 1));
		g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
		return g;
	}

	private merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
		if (!list.length) return null;
		// Mixed indexed and plain pieces cannot merge, so make them all plain.
		const plain = list.map((g) => (g.index ? g.toNonIndexed() : g));
		const merged = mergeGeometries(plain, false);
		merged?.computeBoundingSphere();
		return merged;
	}

	build(fillMat: THREE.Material, inkMat: THREE.Material): THREE.Group {
		const group = new THREE.Group();
		const f = this.merge(this.fill);
		if (f) group.add(new THREE.Mesh(f, fillMat));
		const h = this.merge(this.hull);
		if (h) group.add(new THREE.Mesh(h, inkMat));
		this.fill = [];
		this.hull = [];
		return group;
	}
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);

/** Matrix that stands a piece on a sphere: local +Y along `dir`. */
export function onSurface(dir: THREE.Vector3, radius: number, yaw = 0, scale: THREE.Vector3 | number = 1, out = new THREE.Matrix4()): THREE.Matrix4 {
	_q.setFromUnitVectors(_y, dir);
	_q2.setFromAxisAngle(_y, yaw);
	_q.multiply(_q2);
	const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
	return out.compose(dir.clone().multiplyScalar(radius), _q, s);
}

/** Same as onSurface, then a local offset inside that frame. */
export function local(base: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: THREE.Vector3 | number = 1): THREE.Matrix4 {
	const m = new THREE.Matrix4();
	const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : s;
	m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), sc);
	return base.clone().multiply(m);
}
