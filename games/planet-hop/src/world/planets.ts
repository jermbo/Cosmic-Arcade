import * as THREE from 'three';
import type { Surface, Theme } from '../audio';
import { dirFromLatLon, rng } from '../util';
import { beamMaterial, glowSprite } from './glow';
import { LitMap } from './litmap';
import { local, onSurface, Parts } from './parts';
import { decorInkMaterial, decorMaterial, groundMaterial, ink, inked, planetInkMaterial, toon, type GroundLook } from './toon';

export type Kind = 'garden' | 'ice' | 'lava';

export interface Collider {
	dir: THREE.Vector3; // world, unit
	r: number;
	top: number; // height above the ground
	landable: boolean;
}
export interface Dust {
	dir: THREE.Vector3;
	h: number;
	pos: THREE.Vector3;
	mesh: THREE.Object3D;
	taken: boolean;
	bonus: boolean;
	seed: number;
	pull: number;
}
export interface Blossom {
	dir: THREE.Vector3;
	r: number;
	mesh: THREE.Object3D;
	squash: number;
}
export interface Mite {
	axis: THREE.Vector3;
	a: THREE.Vector3;
	b: THREE.Vector3;
	rho: number;
	theta: number;
	speed: number;
	mesh: THREE.Group;
	alive: boolean;
	pos: THREE.Vector3;
	up: THREE.Vector3;
	legs: THREE.Object3D[];
	body: THREE.Object3D;
}
export interface Geyser {
	dir: THREE.Vector3;
	timer: number;
	state: 'idle' | 'warn' | 'erupt';
	idle: number;
	column: THREE.Mesh;
	glow: THREE.MeshBasicMaterial;
	r: number;
	height: number;
	sound: 0 | 1 | 2;
}
export interface Pool {
	dir: THREE.Vector3;
	r: number;
}

export interface PlanetStyle {
	name: string;
	subtitle: string;
	hint: string;
	theme: Theme;
	surface: Surface;
	R: number;
	quota: number;
	accel: number;
	decel: number;
	atmosphere: string;
	nebula: [string, string, string];
	dust: string;
	ambient: string;
	puff: string;
	look: GroundLook;
}

const STYLES: Record<Kind, PlanetStyle> = {
	garden: {
		name: 'Clover',
		subtitle: 'The sleeping garden',
		hint: 'Step on a pink blossom to bounce high.',
		theme: 'garden',
		surface: 'grass',
		R: 9,
		quota: 8,
		accel: 48,
		decel: 40,
		atmosphere: '#8fffc4',
		nebula: ['#0e1636', '#3a2c6e', '#0c4a55'],
		dust: '#ffd45e',
		ambient: '#b9c8ff',
		puff: '#e4f7cf',
		look: { kind: 0, pal: ['#4aa84a', '#5fbb52', '#7ccd5e', '#3b9446'], accent: '#ead08a', rim: '#b8ffd6' },
	},
	ice: {
		name: 'Rime',
		subtitle: 'The frozen music box',
		hint: 'The ground is slippery. Jump on frost mites to pop them.',
		theme: 'ice',
		surface: 'ice',
		R: 10,
		quota: 9,
		accel: 13,
		decel: 5,
		atmosphere: '#9fe6ff',
		nebula: ['#0a1534', '#1c3d7a', '#3a2b7c'],
		dust: '#ffe27a',
		ambient: '#c4dcff',
		puff: '#ffffff',
		look: { kind: 1, pal: ['#cfe6f6', '#b6d8f1', '#9cc8ec', '#e9f5ff'], accent: '#6faee0', rim: '#c8f2ff' },
	},
	lava: {
		name: 'Cinder',
		subtitle: 'The cold forge',
		hint: 'Vents glow before they erupt. Keep off the lava.',
		theme: 'lava',
		surface: 'rock',
		R: 11,
		quota: 9,
		accel: 46,
		decel: 38,
		atmosphere: '#ff9d6a',
		nebula: ['#170b1d', '#521c32', '#2a1352'],
		dust: '#ffe48a',
		ambient: '#ffc8b0',
		puff: '#8a7a80',
		look: { kind: 2, pal: ['#5a4658', '#665060', '#4c3c50', '#7a5a58'], accent: '#ff7a2a', rim: '#ffb890' },
	},
};

const Y = new THREE.Vector3(0, 1, 0);

// Shared shapes, reused for every piece.
const G = {
	blob: new THREE.IcosahedronGeometry(1, 2),
	rock: new THREE.IcosahedronGeometry(1, 1),
	cone: new THREE.ConeGeometry(1, 1, 8, 1),
	cone5: new THREE.ConeGeometry(1, 1, 5, 1),
	cyl: new THREE.CylinderGeometry(1, 1, 1, 9, 1),
	taper: new THREE.CylinderGeometry(0.7, 1, 1, 7, 1),
	hex: new THREE.CylinderGeometry(1, 1, 1, 6, 1),
	cap: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
	petal: new THREE.SphereGeometry(1, 8, 6),
	blade: new THREE.ConeGeometry(1, 1, 3, 1),
};

function starShape(points: number, outer: number, inner: number): THREE.Shape {
	const s = new THREE.Shape();
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 ? inner : outer;
		const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
		const x = Math.cos(a) * r;
		const y = Math.sin(a) * r;
		if (i === 0) s.moveTo(x, y);
		else s.lineTo(x, y);
	}
	s.closePath();
	return s;
}
const dustGeo = new THREE.ExtrudeGeometry(starShape(4, 0.42, 0.15), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 1 });
dustGeo.center();
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class Planet {
	readonly style: PlanetStyle;
	readonly group = new THREE.Group();
	readonly R: number;
	readonly colliders: Collider[] = [];
	readonly dust: Dust[] = [];
	readonly blossoms: Blossom[] = [];
	readonly mites: Mite[] = [];
	readonly geysers: Geyser[] = [];
	readonly pools: Pool[] = [];
	readonly lit = new LitMap();
	/** World direction where the hero lands. Local north. */
	readonly landingDir: THREE.Vector3;
	/** World direction of the launch pad, or the lighthouse rune. */
	goalDir!: THREE.Vector3;
	goalRadius = 1.35;
	padSegments: THREE.MeshBasicMaterial[] = [];
	padRing: THREE.MeshBasicMaterial | null = null;
	padBeam: THREE.Mesh | null = null;
	padCore: THREE.Object3D | null = null;
	lighthouse: THREE.Group | null = null;
	lighthouseLamp: THREE.MeshBasicMaterial | null = null;
	lighthouseBeams: THREE.Group | null = null;
	collected = 0;
	/** Hidden after launch, so the camera does not fly up inside it. */
	beamOff = false;
	private random: () => number;
	private reserved: { dir: THREE.Vector3; ang: number }[] = [];
	private animated: { obj: THREE.Object3D; spin: number }[] = [];
	private decor: Parts;

	readonly kind: Kind;
	readonly index: number;
	readonly center: THREE.Vector3;
	readonly quality: 'high' | 'low';

	constructor(kind: Kind, index: number, center: THREE.Vector3, landingWorld: THREE.Vector3, goalWorld: THREE.Vector3 | null, quality: 'high' | 'low') {
		this.kind = kind;
		this.index = index;
		this.center = center;
		this.quality = quality;
		this.style = STYLES[kind];
		this.R = this.style.R;
		this.random = rng(1000 + index * 77);
		this.decor = new Parts(this.random);
		this.landingDir = landingWorld.clone().normalize();
		this.group.position.copy(center);
		this.group.quaternion.setFromUnitVectors(Y, this.landingDir);
		this.group.updateMatrixWorld(true);
		const goalLocal = goalWorld ? this.toLocalDir(goalWorld.clone().normalize()) : new THREE.Vector3(0, -1, 0);
		this.goalDir = this.toWorldDir(goalLocal);
		this.reserve(new THREE.Vector3(0, 1, 0), 14);
		this.reserve(goalLocal, kind === 'lava' ? 30 : 16);

		this.buildGround();
		this.buildAtmosphere();
		if (kind === 'garden') this.buildGarden();
		if (kind === 'ice') this.buildIce();
		if (kind === 'lava') this.buildLava(goalLocal);
		if (kind !== 'lava') this.buildPad(goalLocal);
		const d = this.decor.build(decorMaterial(this.lit.texture, this.style.look.rim), decorInkMaterial(this.lit.texture));
		this.group.add(d);
		this.finishDust();
	}

	get quota(): number {
		return this.style.quota;
	}
	/** Stardust on the planet at the start, plus one per mite. */
	get totalDust(): number {
		return this.dust.filter((d) => !d.bonus).length + this.mites.length;
	}
	/** Where stardust is pulled to, near the hero. */
	readonly magnet = new THREE.Vector3();
	get charged(): boolean {
		return this.collected >= this.quota;
	}

	toWorldDir(v: THREE.Vector3): THREE.Vector3 {
		return v.clone().applyQuaternion(this.group.quaternion).normalize();
	}
	toLocalDir(v: THREE.Vector3): THREE.Vector3 {
		return v.clone().applyQuaternion(this.group.quaternion.clone().invert()).normalize();
	}
	worldPoint(dir: THREE.Vector3, h: number, out = new THREE.Vector3()): THREE.Vector3 {
		return out.copy(dir).multiplyScalar(this.R + h).add(this.center);
	}

	private ll(lat: number, lon: number): THREE.Vector3 {
		return dirFromLatLon(lat, lon);
	}

	private reserve(localDir: THREE.Vector3, deg: number): void {
		this.reserved.push({ dir: localDir.clone(), ang: THREE.MathUtils.degToRad(deg) });
	}

	/** A random local direction away from all reserved spots. */
	private freeDir(minDeg: number): THREE.Vector3 | null {
		for (let tries = 0; tries < 40; tries++) {
			const v = new THREE.Vector3(this.random() * 2 - 1, this.random() * 2 - 1, this.random() * 2 - 1);
			if (v.lengthSq() > 1 || v.lengthSq() < 0.05) continue;
			v.normalize();
			const ok = this.reserved.every((r) => v.angleTo(r.dir) > r.ang + THREE.MathUtils.degToRad(minDeg));
			if (ok) return v;
		}
		return null;
	}

	private pick<T>(list: T[]): T {
		return list[Math.floor(this.random() * list.length)];
	}

	// ---------- Ground ----------

	private buildGround(): void {
		const hi = this.quality === 'high';
		const geo = new THREE.SphereGeometry(this.R, hi ? 160 : 96, hi ? 110 : 64);
		const mesh = new THREE.Mesh(geo, groundMaterial(this.lit.texture, this.style.look));
		this.group.add(mesh);
		const hull = new THREE.Mesh(new THREE.SphereGeometry(this.R, 64, 40), planetInkMaterial());
		this.group.add(hull);
	}

	private buildAtmosphere(): void {
		const mat = new THREE.ShaderMaterial({
			uniforms: { uColor: { value: new THREE.Color(this.style.atmosphere) } },
			vertexShader: /* glsl */ `
				varying vec3 vN; varying vec3 vV;
				void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
			fragmentShader: /* glsl */ `
				varying vec3 vN; varying vec3 vV; uniform vec3 uColor;
				void main(){ float f = abs(dot(vN, vV)); gl_FragColor = vec4(uColor, pow(f, 3.0) * 0.5); }`,
			side: THREE.BackSide,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});
		const m = new THREE.Mesh(new THREE.SphereGeometry(this.R * 1.2, 48, 24), mat);
		m.renderOrder = 2;
		this.group.add(m);
	}

	// ---------- Shared pieces ----------

	private addDust(localDir: THREE.Vector3, h: number, bonus = false): Dust {
		const dir = this.toWorldDir(localDir);
		const g = this.dustMesh();
		const pos = this.worldPoint(dir, h);
		g.position.copy(pos);
		g.quaternion.setFromUnitVectors(Y, dir);
		const d: Dust = { dir, h, pos, mesh: g, taken: false, bonus, seed: this.random() * 6.28, pull: 0 };
		this.dust.push(d);
		this.reserve(localDir, 5);
		return d;
	}

	private dustMesh(): THREE.Group {
		const g = new THREE.Group();
		const spin = new THREE.Group();
		const star = ink(new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(this.style.dust).multiplyScalar(1.25) })), 0.006);
		const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2) }));
		core.position.z = 0.12;
		spin.add(star, core);
		spin.position.y = 0.15;
		g.add(spin, glowSprite(this.style.dust, 1.9, 0.55));
		return g;
	}

	/** Stardust objects live in world space (not in the planet group) so they are easy to move. */
	dustRoot = new THREE.Group();

	private finishDust(): void {
		for (const d of this.dust) this.dustRoot.add(d.mesh);
	}

	/** A column you can stand on. */
	private pillar(localDir: THREE.Vector3, r: number, top: number, color: string, topColor: string, sides = 7, landable = true): void {
		const m = onSurface(localDir, this.R - 0.3, this.random() * 6.28);
		const h = top + 0.3;
		const geo = sides === 6 ? G.hex : G.cyl;
		this.decor.add(geo, color, local(m, 0, h / 2, 0, 0, 0, 0, v3(r, h, r)), { ink: true, vary: 0.05 });
		// A soft cap, so the top reads as a place to land.
		this.decor.add(G.cap, topColor, local(m, 0, h - 0.1, 0, 0, 0, 0, v3(r * 1.06, 0.13, r * 1.06)), { ink: true, vary: 0.04 });
		this.colliders.push({ dir: this.toWorldDir(localDir), r, top, landable });
		this.reserve(localDir, THREE.MathUtils.radToDeg(r / this.R) + 4);
	}

	private buildPad(goalLocal: THREE.Vector3): void {
		const m = onSurface(goalLocal, this.R);
		const g = new THREE.Group();
		g.applyMatrix4(m);
		const base = inked(new THREE.CylinderGeometry(1.5, 1.7, 0.36, 8), toon('#2f2a5c', { rim: '#8f86ff' }));
		base.position.y = 0.06;
		const top = inked(new THREE.CylinderGeometry(1.28, 1.28, 0.08, 24), toon('#fff3dc'));
		top.position.y = 0.26;
		// One segment per stardust needed: they fill up as you collect.
		const n = this.quota;
		for (let i = 0; i < n; i++) {
			const mat = new THREE.MeshBasicMaterial({ color: '#4c4680' });
			const seg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.46), mat);
			const a = (i / n) * Math.PI * 2;
			seg.position.set(Math.sin(a) * 1.0, 0.31, Math.cos(a) * 1.0);
			seg.rotation.y = a;
			g.add(seg);
			this.padSegments.push(mat);
		}
		this.padRing = new THREE.MeshBasicMaterial({ color: '#5a5480' });
		const core = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(4, 0.55, 0.2), { depth: 0.06, bevelEnabled: false }), this.padRing);
		core.geometry.rotateX(-Math.PI / 2);
		const coreHolder = new THREE.Group();
		coreHolder.position.y = 0.3;
		coreHolder.add(core);
		this.padCore = coreHolder;
		const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 26, 16, 1, true), beamMaterial('#ffd23f'));
		beam.position.y = 13.2;
		beam.visible = false;
		this.padBeam = beam;
		g.add(base, top, coreHolder, beam);
		this.group.add(g);
	}

	private tree(m: THREE.Matrix4, s: number): void {
		const trunk = '#8a5a3e';
		const greens = ['#3f9a4a', '#4fae52', '#62c05c', '#2f8546'];
		const grow = { grow: 0.55, ink: true, base: new THREE.Vector3().setFromMatrixPosition(m) };
		this.decor.add(G.taper, trunk, local(m, 0, 0.8 * s, 0, 0, 0, 0, v3(0.2 * s, 1.6 * s, 0.2 * s)), grow);
		if (this.random() < 0.55) {
			const c = this.pick(greens);
			this.decor.add(G.blob, c, local(m, 0, 2.05 * s, 0, 0, 0, 0, v3(1.0 * s, 0.9 * s, 1.0 * s)), grow);
			this.decor.add(G.blob, this.pick(greens), local(m, 0.45 * s, 2.55 * s, 0.1 * s, 0, 0, 0, 0.6 * s), grow);
			this.decor.add(G.blob, this.pick(greens), local(m, -0.4 * s, 2.4 * s, -0.25 * s, 0, 0, 0, 0.55 * s), grow);
			// Fruit, for a spot of color
			for (let i = 0; i < 3; i++) {
				const a = this.random() * 6.28;
				this.decor.add(G.blob, '#ff6b6b', local(m, Math.cos(a) * 0.85 * s, 1.85 * s + this.random() * 0.6 * s, Math.sin(a) * 0.85 * s, 0, 0, 0, 0.12 * s), { grow: 1, glow: 0.25, base: grow.base });
			}
		} else {
			const c = this.pick(greens);
			this.decor.add(G.cone, c, local(m, 0, 1.7 * s, 0, 0, 0, 0, v3(1.05 * s, 1.4 * s, 1.05 * s)), grow);
			this.decor.add(G.cone, c, local(m, 0, 2.4 * s, 0, 0, 0, 0, v3(0.8 * s, 1.2 * s, 0.8 * s)), grow);
			this.decor.add(G.cone, c, local(m, 0, 3.0 * s, 0, 0, 0, 0, v3(0.52 * s, 0.9 * s, 0.52 * s)), grow);
		}
	}

	private flower(m: THREE.Matrix4, color: string, s = 1): void {
		const base = new THREE.Vector3().setFromMatrixPosition(m);
		const o = { grow: 1, base };
		this.decor.add(G.cyl, '#3f8a3a', local(m, 0, 0.2 * s, 0, 0, 0, 0, v3(0.025, 0.4 * s, 0.025)), o);
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * Math.PI * 2;
			this.decor.add(G.petal, color, local(m, Math.cos(a) * 0.1 * s, 0.42 * s, Math.sin(a) * 0.1 * s, 0, -a, 0.35, v3(0.11 * s, 0.035 * s, 0.07 * s)), { ...o, glow: 0.15 });
		}
		this.decor.add(G.petal, '#ffe27a', local(m, 0, 0.44 * s, 0, 0, 0, 0, 0.055 * s), { ...o, glow: 0.6 });
	}

	private tuft(m: THREE.Matrix4, color: string): void {
		const base = new THREE.Vector3().setFromMatrixPosition(m);
		for (let k = 0; k < 3; k++) {
			const a = (k / 3) * 6.28 + this.random();
			this.decor.add(G.blade, color, local(m, Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3, v3(0.06, 0.36 + this.random() * 0.15, 0.06)), { grow: 1, base, vary: 0.15 });
		}
	}

	// ---------- Garden ----------

	private buildGarden(): void {
		// Hand-placed stones you can stand on
		this.pillar(this.ll(10, 280), 1.1, 2.1, '#9b95b8', '#6cc35a');
		this.pillar(this.ll(-2, 330), 0.95, 1.4, '#9b95b8', '#6cc35a');
		this.pillar(this.ll(-6, 343), 0.95, 2.7, '#a7a2c4', '#7ccd5e');
		this.pillar(this.ll(-12, 356), 0.95, 3.9, '#a7a2c4', '#86d566');
		this.pillar(this.ll(-42, 120), 1.2, 1.6, '#9b95b8', '#6cc35a');

		for (const [lat, lon] of [[18, 60], [-22, 205], [48, 222]]) this.addBlossom(this.ll(lat, lon));

		// Stardust: a tutorial line, then spread out
		this.addDust(this.ll(74, 0), 1);
		this.addDust(this.ll(64, 10), 1);
		this.addDust(this.ll(54, 20), 1);
		this.addDust(this.ll(18, 60), 6.2); // above a blossom
		this.addDust(this.ll(30, 150), 1);
		this.addDust(this.ll(-22, 205), 5); // above a blossom
		this.addDust(this.ll(10, 280), 2.1 + 1);
		this.addDust(this.ll(-12, 356), 3.9 + 1);
		this.addDust(this.ll(-42, 120), 1.6 + 1);
		this.addDust(this.ll(48, 222), 5.6);
		this.addDust(this.ll(-55, 300), 1);
		this.addDust(this.ll(-30, 60), 1);

		for (let i = 0; i < 15; i++) {
			const d = this.freeDir(5);
			if (!d) continue;
			const s = 0.8 + this.random() * 0.45;
			this.tree(onSurface(d, this.R - 0.1, this.random() * 6.28), s);
			this.colliders.push({ dir: this.toWorldDir(d), r: 0.45 * s, top: 3.2 * s, landable: false });
			this.reserve(d, 6);
		}
		// Mushrooms in small rings
		for (let i = 0; i < 6; i++) {
			const d = this.freeDir(2);
			if (!d) continue;
			const m0 = onSurface(d, this.R - 0.05, this.random() * 6.28);
			const base = new THREE.Vector3().setFromMatrixPosition(m0);
			for (let k = 0; k < 3; k++) {
				const a = (k / 3) * 6.28;
				const s = 0.5 + this.random() * 0.4;
				const mm = local(m0, Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45, 0, a, 0);
				this.decor.add(G.cyl, '#f3e6d0', local(mm, 0, 0.25 * s, 0, 0, 0, 0, v3(0.09 * s, 0.5 * s, 0.09 * s)), { grow: 1, ink: true, base });
				this.decor.add(G.cap, this.pick(['#ff6b6b', '#ff8a5c', '#c77dff']), local(mm, 0, 0.46 * s, 0, 0, 0, 0, v3(0.32 * s, 0.26 * s, 0.32 * s)), { grow: 1, glow: 0.2, ink: true, base });
				this.decor.add(G.blob, '#fff6ea', local(mm, 0.12 * s, 0.62 * s, 0.05 * s, 0, 0, 0, 0.05 * s), { grow: 1, base });
			}
			this.reserve(d, 3);
		}
		// Bushes and boulders
		for (let i = 0; i < 20; i++) {
			const d = this.freeDir(1);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.1, this.random() * 6.28);
			if (this.random() < 0.6) {
				const c = this.pick(['#4fa03f', '#3f9a4a', '#5fb84e']);
				const base = new THREE.Vector3().setFromMatrixPosition(m);
				this.decor.add(G.blob, c, local(m, 0, 0.3, 0, 0, 0, 0, v3(0.55, 0.45, 0.55)), { grow: 0.5, ink: true, base });
				this.decor.add(G.blob, c, local(m, 0.42, 0.2, 0.1, 0, 0, 0, 0.34), { grow: 0.5, ink: true, base });
				this.decor.add(G.blob, '#ffd23f', local(m, 0.2, 0.62, 0.2, 0, 0, 0, 0.07), { grow: 1, glow: 0.8, base });
			} else {
				this.decor.add(G.rock, '#a7a3c0', local(m, 0, 0.15, 0, this.random(), this.random(), 0, v3(0.5, 0.32, 0.6)), { ink: true });
			}
		}
		// Flowers in little patches
		for (let i = 0; i < 26; i++) {
			const d = this.freeDir(-3);
			if (!d) continue;
			const c = this.pick(['#ffffff', '#ffd23f', '#ff8fb8', '#b48cff', '#ff6b6b', '#7fd6ff']);
			const m0 = onSurface(d, this.R - 0.02, this.random() * 6.28);
			const n = 2 + Math.floor(this.random() * 4);
			for (let k = 0; k < n; k++) this.flower(local(m0, (this.random() - 0.5) * 0.9, 0, (this.random() - 0.5) * 0.9, 0, this.random() * 6, 0), c, 0.8 + this.random() * 0.5);
		}
		for (let i = 0; i < 90; i++) {
			const d = this.freeDir(-5);
			if (!d) continue;
			this.tuft(onSurface(d, this.R - 0.04, this.random() * 6.28), this.pick(['#3f8f3a', '#56a846', '#4b9d40']));
		}
	}

	private addBlossom(localDir: THREE.Vector3): void {
		const m = onSurface(localDir, this.R);
		const g = new THREE.Group();
		g.applyMatrix4(m);
		const petal = toon('#ff7fb0', { rim: '#ffd0e6', emissive: 0.15 });
		const inner = toon('#ffd23f', { emissive: 0.35 });
		const head = new THREE.Group();
		for (let i = 0; i < 6; i++) {
			const pivot = new THREE.Group();
			pivot.rotation.y = (i / 6) * Math.PI * 2;
			const p = inked(new THREE.SphereGeometry(1, 12, 8), petal);
			p.scale.set(0.62, 0.14, 0.4);
			p.position.set(0.72, 0.24, 0);
			p.rotation.z = 0.28;
			pivot.add(p);
			head.add(pivot);
		}
		const c = inked(new THREE.SphereGeometry(0.48, 14, 8), inner);
		c.scale.y = 0.45;
		c.position.y = 0.3;
		head.add(c);
		const stem = inked(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 8), toon('#3f8a3a'));
		stem.position.y = 0.05;
		g.add(stem, head);
		head.position.y = 0.12;
		this.group.add(g);
		this.blossoms.push({ dir: this.toWorldDir(localDir), r: 1.0, mesh: head, squash: 0 });
		this.reserve(localDir, 9);
	}

	// ---------- Ice ----------

	private crystal(m: THREE.Matrix4, s: number, grow: number, inkIt: boolean): void {
		const base = new THREE.Vector3().setFromMatrixPosition(m);
		const n = 3 + Math.floor(this.random() * 3);
		for (let k = 0; k < n; k++) {
			const h = (1.0 + this.random() * 1.6) * s * (k === 0 ? 1.5 : 1);
			const r = (0.2 + this.random() * 0.14) * s;
			const ang = (k / n) * 6.28;
			const off = k === 0 ? 0 : 0.32 * s;
			const tilt = k === 0 ? 0 : 0.4;
			const mm = local(m, Math.cos(ang) * off, 0, Math.sin(ang) * off, Math.sin(ang) * tilt, 0, -Math.cos(ang) * tilt);
			const c = this.pick(['#8fe6ff', '#b8f0ff', '#7fc8ff', '#c9b8ff']);
			this.decor.add(G.hex, c, local(mm, 0, h / 2, 0, 0, 0, 0, v3(r, h, r)), { grow, glow: 0.35, ink: inkIt, base });
			this.decor.add(G.cone5.clone().rotateY(Math.PI / 10), c, local(mm, 0, h + r * 0.9, 0, 0, 0, 0, v3(r, r * 1.8, r)), { grow, glow: 0.5, ink: inkIt, base });
		}
	}

	private buildIce(): void {
		// Ice pillars you can stand on
		this.pillar(this.ll(30, 90), 1.1, 1.6, '#a9d4f0', '#f4fbff', 6);
		this.pillar(this.ll(24, 101), 1.0, 2.9, '#95c8ec', '#f4fbff', 6);
		this.pillar(this.ll(-20, 250), 1.2, 2.2, '#a9d4f0', '#f4fbff', 6);
		this.pillar(this.ll(-48, 30), 1.1, 1.8, '#a9d4f0', '#f4fbff', 6);

		// Frost mites patrol small loops
		this.addMite(this.ll(40, 180), 22, 0.9);
		this.addMite(this.ll(0, 40), 20, -1.0);
		this.addMite(this.ll(-35, 150), 24, 1.1);
		this.addMite(this.ll(-10, 310), 20, -0.9);

		this.addDust(this.ll(72, 30), 1);
		this.addDust(this.ll(55, 60), 1);
		this.addDust(this.ll(24, 101), 2.9 + 1);
		this.addDust(this.ll(40, 180), 1);
		this.addDust(this.ll(10, 210), 1);
		this.addDust(this.ll(-20, 250), 2.2 + 1);
		this.addDust(this.ll(0, 40), 1);
		this.addDust(this.ll(-35, 150), 1);
		this.addDust(this.ll(-48, 30), 1.8 + 1);
		this.addDust(this.ll(-10, 310), 1);
		this.addDust(this.ll(30, 330), 1);
		this.addDust(this.ll(-60, 220), 1);

		for (let i = 0; i < 13; i++) {
			const d = this.freeDir(5);
			if (!d) continue;
			const s = 0.8 + this.random() * 0.6;
			this.crystal(onSurface(d, this.R - 0.2, this.random() * 6.28), s, 0.35, true);
			this.colliders.push({ dir: this.toWorldDir(d), r: 0.65 * s, top: 3 * s, landable: false });
			this.reserve(d, 6);
		}
		// Frosted pines
		for (let i = 0; i < 9; i++) {
			const d = this.freeDir(4);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.1, this.random() * 6.28);
			const s = 0.7 + this.random() * 0.4;
			const base = new THREE.Vector3().setFromMatrixPosition(m);
			const o = { grow: 0.5, ink: true, base };
			this.decor.add(G.taper, '#6b5a7a', local(m, 0, 0.4 * s, 0, 0, 0, 0, v3(0.14 * s, 0.8 * s, 0.14 * s)), o);
			this.decor.add(G.cone, '#3f7f8a', local(m, 0, 1.3 * s, 0, 0, 0, 0, v3(0.85 * s, 1.3 * s, 0.85 * s)), o);
			this.decor.add(G.cone, '#f2fbff', local(m, 0, 1.75 * s, 0, 0, 0, 0, v3(0.6 * s, 0.7 * s, 0.6 * s)), o);
			this.decor.add(G.cone, '#3f7f8a', local(m, 0, 2.2 * s, 0, 0, 0, 0, v3(0.5 * s, 0.9 * s, 0.5 * s)), o);
			this.decor.add(G.cone, '#f2fbff', local(m, 0, 2.55 * s, 0, 0, 0, 0, v3(0.3 * s, 0.4 * s, 0.3 * s)), o);
			this.colliders.push({ dir: this.toWorldDir(d), r: 0.45 * s, top: 2.6 * s, landable: false });
			this.reserve(d, 5);
		}
		// Snow drifts
		for (let i = 0; i < 22; i++) {
			const d = this.freeDir(0);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.12, this.random() * 6.28);
			this.decor.add(G.blob, '#f2f8ff', local(m, 0, 0, 0, 0, 0, 0, v3(0.9 + this.random() * 0.5, 0.35, 0.7)), { ink: true, vary: 0.04 });
		}
		// Little glowing shards
		for (let i = 0; i < 34; i++) {
			const d = this.freeDir(-3);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.05, this.random() * 6.28);
			this.crystal(m, 0.22 + this.random() * 0.15, 1, false);
		}
	}

	private addMite(localCenter: THREE.Vector3, rhoDeg: number, speed: number): void {
		const axis = this.toWorldDir(localCenter);
		const a = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? Y : new THREE.Vector3(1, 0, 0)).normalize();
		const b = new THREE.Vector3().crossVectors(axis, a).normalize();
		const g = new THREE.Group();
		const bodyG = new THREE.Group();
		const fur = toon('#e9f6ff', { rim: '#8fe6ff', rimK: 0.6 });
		const ice = toon('#7fd8ff', { emissive: 0.45, rim: '#ffffff' });
		const dark = toon('#28224a');
		const body = inked(new THREE.SphereGeometry(0.5, 16, 12), fur);
		body.scale.set(1, 0.82, 1);
		body.position.y = 0.48;
		bodyG.add(body);
		for (const [x, z, rz, h] of [[0, -0.05, 0, 0.55], [0.2, -0.15, -0.45, 0.42], [-0.2, -0.15, 0.45, 0.42]] as const) {
			const sp = inked(new THREE.ConeGeometry(0.13, h, 5), ice);
			sp.position.set(x, 0.9 + h * 0.3, z);
			sp.rotation.z = rz;
			bodyG.add(sp);
		}
		const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
		const pupilM = new THREE.MeshBasicMaterial({ color: '#1d1733' });
		for (const sx of [1, -1]) {
			const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), white);
			eye.position.set(0.17 * sx, 0.55, 0.38);
			eye.scale.z = 0.6;
			const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6), pupilM);
			pupil.position.set(0, -0.01, 0.1);
			eye.add(pupil);
			bodyG.add(eye);
			// Angry little brow
			const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), pupilM);
			brow.position.set(0.17 * sx, 0.7, 0.42);
			brow.rotation.z = 0.35 * sx;
			bodyG.add(brow);
		}
		g.add(bodyG);
		const legs: THREE.Object3D[] = [];
		for (let i = 0; i < 4; i++) {
			const leg = inked(new THREE.SphereGeometry(0.1, 8, 6), dark);
			leg.scale.set(1, 0.7, 1.4);
			leg.position.set(i % 2 ? 0.26 : -0.26, 0.08, i < 2 ? 0.2 : -0.2);
			g.add(leg);
			legs.push(leg);
		}
		this.dustRoot.add(g);
		this.mites.push({ axis, a, b, rho: THREE.MathUtils.degToRad(rhoDeg), theta: this.random() * 6.28, speed, mesh: g, alive: true, pos: new THREE.Vector3(), up: new THREE.Vector3(), legs, body: bodyG });
		this.reserve(localCenter, rhoDeg + 4);
	}

	// ---------- Lava ----------

	private buildLava(goalLocal: THREE.Vector3): void {
		// Pools first, so the rest stays clear of them
		for (const [lat, lon, r] of [[40, 120, 2.1], [-5, 200, 2.4], [5, 20, 1.8], [-40, 300, 2.2]] as const) this.addPool(this.ll(lat, lon), r);
		const vents: [number, number, number][] = [[52, 40, 0], [20, 90, 1.5], [10, 160, 3], [-25, 240, 0.8], [-30, 60, 2.2], [-50, 160, 1.2], [30, 280, 2.8]];
		for (const [lat, lon, off] of vents) this.addGeyser(this.ll(lat, lon), off);
		// Basalt steps
		this.pillar(this.ll(60, 200), 1.0, 1.5, '#43364a', '#6a5462', 6);
		this.pillar(this.ll(55, 212), 1.0, 2.8, '#43364a', '#6a5462', 6);
		this.pillar(this.ll(-10, 115), 1.2, 2.0, '#43364a', '#6a5462', 6);
		this.pillar(this.ll(-12, 330), 1.1, 1.7, '#43364a', '#6a5462', 6);
		this.pillar(this.ll(-20, 341), 1.0, 3.0, '#43364a', '#6a5462', 6);

		this.addDust(this.ll(74, 0), 1);
		this.addDust(this.ll(52, 40), 3.2); // over a vent: grab it between eruptions
		this.addDust(this.ll(55, 212), 2.8 + 1);
		this.addDust(this.ll(40, 120), 2.6); // over a pool
		this.addDust(this.ll(20, 90), 1);
		this.addDust(this.ll(10, 160), 1);
		this.addDust(this.ll(-10, 115), 2 + 1);
		this.addDust(this.ll(-5, 200), 2.6); // over a pool
		this.addDust(this.ll(-25, 240), 1);
		this.addDust(this.ll(-20, 341), 3 + 1);
		this.addDust(this.ll(30, 280), 1);
		this.addDust(this.ll(-50, 160), 1);

		this.buildLighthouse(goalLocal);

		// Basalt clusters
		for (let i = 0; i < 12; i++) {
			const d = this.freeDir(3);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.2, this.random() * 6.28);
			const s = 0.6 + this.random() * 0.6;
			for (let k = 0; k < 4; k++) {
				const a = (k / 4) * 6.28 + this.random();
				const off = k === 0 ? 0 : 0.42 * s;
				const h = (k === 0 ? 1.6 : 0.6 + this.random() * 0.9) * s;
				this.decor.add(G.hex, this.pick(['#43364a', '#4d3d52', '#3a2f42']), local(m, Math.cos(a) * off, h / 2, Math.sin(a) * off, 0, a, 0, v3(0.32 * s, h, 0.32 * s)), { ink: true, vary: 0.05 });
			}
			this.colliders.push({ dir: this.toWorldDir(d), r: 0.7 * s, top: 1.6 * s, landable: false });
			this.reserve(d, 5);
		}
		// Obsidian spikes
		for (let i = 0; i < 18; i++) {
			const d = this.freeDir(1);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.1, this.random() * 6.28);
			const h = 0.7 + this.random() * 1.1;
			this.decor.add(G.cone5, '#2e2440', local(m, 0, h / 2, 0, this.random() * 0.3, 0, this.random() * 0.3, v3(0.26, h, 0.26)), { ink: true });
		}
		// Ember lilies: they open when the forge wakes
		for (let i = 0; i < 30; i++) {
			const d = this.freeDir(-2);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.02, this.random() * 6.28);
			const base = new THREE.Vector3().setFromMatrixPosition(m);
			const s = 0.8 + this.random() * 0.6;
			this.decor.add(G.cyl, '#5a3a3a', local(m, 0, 0.22 * s, 0, 0, 0, 0, v3(0.03, 0.44 * s, 0.03)), { grow: 1, base });
			const c = this.pick(['#ff8a3a', '#ffb24a', '#ff5a5a']);
			for (let k = 0; k < 4; k++) {
				const a = (k / 4) * Math.PI * 2;
				this.decor.add(G.cone, c, local(m, Math.cos(a) * 0.08 * s, 0.5 * s, Math.sin(a) * 0.08 * s, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7, v3(0.07 * s, 0.26 * s, 0.07 * s)), { grow: 1, glow: 0.9, base });
			}
		}
		// Ash mounds
		for (let i = 0; i < 16; i++) {
			const d = this.freeDir(0);
			if (!d) continue;
			const m = onSurface(d, this.R - 0.12, this.random() * 6.28);
			this.decor.add(G.rock, '#6a5866', local(m, 0, 0.05, 0, 0, this.random(), 0, v3(0.8, 0.3, 0.6)), { ink: true });
		}
	}

	private addPool(localDir: THREE.Vector3, r: number): void {
		const m = onSurface(localDir, this.R + 0.03, this.random() * 6.28);
		const g = new THREE.Group();
		g.applyMatrix4(m);
		const lava = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1a').multiplyScalar(1.1) }));
		lava.rotation.x = -Math.PI / 2;
		const crust = inked(new THREE.TorusGeometry(r + 0.12, 0.2, 6, 28), toon('#3a2c40'));
		crust.rotation.x = -Math.PI / 2;
		crust.scale.z = 0.6;
		const hot = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd06a').multiplyScalar(1.3) }));
		hot.rotation.x = -Math.PI / 2;
		hot.position.y = 0.01;
		g.add(lava, crust, hot);
		this.animated.push({ obj: hot, spin: 0.2 });
		this.group.add(g);
		this.pools.push({ dir: this.toWorldDir(localDir), r });
		this.reserve(localDir, THREE.MathUtils.radToDeg(r / this.R) + 6);
	}

	private addGeyser(localDir: THREE.Vector3, offset: number): void {
		const m = onSurface(localDir, this.R - 0.1, this.random() * 6.28);
		const g = new THREE.Group();
		g.applyMatrix4(m);
		const cone = inked(new THREE.CylinderGeometry(0.55, 1.1, 0.6, 9, 1, true), toon('#3a2c40', { rim: '#ff8a5a' }));
		(cone.material as THREE.ShaderMaterial).side = THREE.DoubleSide;
		cone.position.y = 0.3;
		const glow = new THREE.MeshBasicMaterial({ color: '#ff5a1a' });
		const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.56, 12), glow);
		mouth.rotation.x = -Math.PI / 2;
		mouth.position.y = 0.45;
		const colMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a3a').multiplyScalar(1.4), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
		const column = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1, 12, 1, true), colMat);
		column.geometry.translate(0, 0.5, 0);
		column.position.y = 0.4;
		column.scale.set(1, 0.01, 1);
		column.visible = false;
		g.add(cone, mouth, column);
		this.group.add(g);
		this.geysers.push({ dir: this.toWorldDir(localDir), timer: offset, state: 'idle', idle: 3.2, column, glow, r: 0.9, height: 6, sound: 0 });
		this.colliders.push({ dir: this.toWorldDir(localDir), r: 0.75, top: 0.5, landable: true });
		this.reserve(localDir, 9);
	}

	private buildLighthouse(goalLocal: THREE.Vector3): void {
		// The tower stands a little away from the rune you step on.
		const side = new THREE.Vector3().crossVectors(goalLocal, new THREE.Vector3(1, 0, 0)).normalize();
		const towerLocal = goalLocal.clone().applyAxisAngle(side, THREE.MathUtils.degToRad(16)).normalize();
		const m = onSurface(towerLocal, this.R - 0.2, 0);
		const g = new THREE.Group();
		g.applyMatrix4(m);
		const cream = toon('#fff3dc', { rim: '#ffd9b0' });
		const coral = toon('#ff6b6b', { rim: '#ffc0a0' });
		const dark = toon('#2f2a5c', { rim: '#8f86ff' });
		const base = inked(new THREE.CylinderGeometry(2.0, 2.4, 0.9, 10), dark);
		base.position.y = 0.45;
		g.add(base);
		let y = 0.9;
		for (let i = 0; i < 5; i++) {
			const r0 = 1.55 - i * 0.14;
			const r1 = r0 - 0.14;
			const seg = inked(new THREE.CylinderGeometry(r1, r0, 1.3, 16), i % 2 ? coral : cream);
			seg.position.y = y + 0.65;
			g.add(seg);
			y += 1.3;
		}
		const gallery = inked(new THREE.CylinderGeometry(1.35, 1.35, 0.22, 16), dark);
		gallery.position.y = y + 0.11;
		g.add(gallery);
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2;
			const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), dark);
			post.position.set(Math.cos(a) * 1.25, y + 0.45, Math.sin(a) * 1.25);
			g.add(post);
		}
		this.lighthouseLamp = new THREE.MeshBasicMaterial({ color: '#4a4470' });
		const lamp = inked(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 12), this.lighthouseLamp);
		lamp.position.y = y + 0.77;
		g.add(lamp);
		const roof = inked(new THREE.ConeGeometry(1.1, 1.1, 12), coral);
		roof.position.y = y + 1.85;
		g.add(roof);
		const tip = inked(new THREE.SphereGeometry(0.2, 10, 8), cream);
		tip.position.y = y + 2.5;
		g.add(tip);
		const door = inked(new THREE.BoxGeometry(0.75, 1.15, 0.2), dark);
		const toRune = goalLocal.clone().sub(towerLocal).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, towerLocal).invert());
		const doorAng = Math.atan2(toRune.x, toRune.z);
		door.position.set(Math.sin(doorAng) * 1.47, 1.45, Math.cos(doorAng) * 1.47);
		door.rotation.y = doorAng;
		g.add(door);
		// Beams, hidden until lit
		const beams = new THREE.Group();
		beams.position.y = y + 0.77;
		for (let i = 0; i < 2; i++) {
			const b = new THREE.Mesh(new THREE.ConeGeometry(2.6, 40, 24, 1, true), beamMaterial('#fff1a8', true));
			b.geometry.translate(0, -20, 0);
			b.rotation.z = Math.PI / 2 + (i ? Math.PI : 0);
			beams.add(b);
		}
		beams.visible = false;
		g.add(beams);
		this.lighthouseBeams = beams;
		this.lighthouse = g;
		this.group.add(g);
		this.colliders.push({ dir: this.toWorldDir(towerLocal), r: 2.0, top: 8, landable: false });
		this.reserve(towerLocal, 16);

		// The rune circle
		const rm = onSurface(goalLocal, this.R + 0.04);
		const rune = new THREE.Group();
		rune.applyMatrix4(rm);
		this.padRing = new THREE.MeshBasicMaterial({ color: '#5a5480', side: THREE.DoubleSide });
		const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 32), this.padRing);
		ring.rotation.x = -Math.PI / 2;
		const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape(8, 0.7, 0.3)), this.padRing);
		star.rotation.x = -Math.PI / 2;
		const stone = inked(new THREE.CylinderGeometry(1.4, 1.5, 0.14, 24), dark);
		stone.position.y = -0.04;
		ring.position.y = star.position.y = 0.05;
		const starHolder = new THREE.Group();
		starHolder.add(star);
		this.padCore = starHolder;
		rune.add(stone, ring, starHolder);
		const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 22, 16, 1, true), beamMaterial('#ffd23f'));
		beam.position.y = 11;
		beam.visible = false;
		rune.add(beam);
		this.padBeam = beam;
		this.group.add(rune);
		this.goalRadius = 1.2;
	}

	// ---------- Per frame ----------

	update(time: number, dt: number): void {
		this.lit.update(dt);
		for (const d of this.dust) {
			if (d.taken) continue;
			const spin = d.mesh.children[0];
			spin.rotation.y += dt * 2.2;
			const bob = Math.sin(time * 2.2 + d.seed) * 0.12;
			d.mesh.position.copy(d.dir).multiplyScalar(this.R + d.h + bob).add(this.center);
			if (d.pull > 0) d.mesh.position.lerp(this.magnet, d.pull * d.pull);
		}
		for (const b of this.blossoms) {
			b.squash = Math.max(0, b.squash - dt * 3);
			const s = 1 - Math.sin(b.squash * Math.PI * 2) * 0.25 * b.squash;
			const breathe = 1 + Math.sin(time * 2 + b.dir.x * 5) * 0.03;
			b.mesh.scale.set((1 + (1 - s) * 0.6) * breathe, s / breathe, (1 + (1 - s) * 0.6) * breathe);
			b.mesh.rotation.y += dt * 0.3;
		}
		for (const mt of this.mites) {
			if (!mt.alive) continue;
			mt.theta += (mt.speed / (this.R * Math.sin(mt.rho))) * dt;
			const ring = mt.a.clone().multiplyScalar(Math.cos(mt.theta)).addScaledVector(mt.b, Math.sin(mt.theta));
			const dir = mt.axis.clone().multiplyScalar(Math.cos(mt.rho)).addScaledVector(ring, Math.sin(mt.rho)).normalize();
			const tangent = mt.a.clone().multiplyScalar(-Math.sin(mt.theta)).addScaledVector(mt.b, Math.cos(mt.theta)).multiplyScalar(Math.sign(mt.speed));
			mt.up.copy(dir);
			const hopT = time * 9 + mt.rho * 10;
			const hop = Math.abs(Math.sin(hopT)) * 0.14;
			mt.pos.copy(dir).multiplyScalar(this.R).add(this.center);
			mt.mesh.position.copy(mt.pos);
			mt.body.position.y = hop;
			const sq = 1 + Math.cos(hopT * 2) * 0.06;
			mt.body.scale.set(1 / sq, sq, 1 / sq);
			const zf = tangent.addScaledVector(dir, -tangent.dot(dir)).normalize();
			const xr = new THREE.Vector3().crossVectors(dir, zf);
			mt.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xr, dir, zf));
			mt.legs.forEach((l, i) => (l.position.z = (i < 2 ? 0.2 : -0.2) + Math.sin(time * 14 + i * Math.PI) * 0.08));
		}
		for (const a of this.animated) a.obj.rotation.z += a.spin * dt;
		const p = this.collected / this.quota;
		this.padSegments.forEach((m, i) => {
			if (i < this.collected) {
				const k = this.charged ? 0.8 + Math.sin(time * 5 + i) * 0.2 : 1;
				m.color.setRGB(1.5 * k, 1.1 * k, 0.3 * k);
			} else m.color.set('#4c4680');
		});
		if (this.padRing) {
			if (this.charged) {
				const k = 0.8 + Math.sin(time * 5) * 0.2;
				this.padRing.color.setRGB(1.6 * k, 1.2 * k, 0.3 * k);
			} else this.padRing.color.setRGB(0.35 + p * 0.4, 0.33 + p * 0.3, 0.5 - p * 0.1);
		}
		if (this.padBeam) {
			this.padBeam.visible = this.charged && !this.beamOff;
			(this.padBeam.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
		}
		if (this.padCore) this.padCore.rotation.y += dt * (this.charged ? 2 : 0.3);
	}

	/** Mark a stardust as gone. Returns true if it was there. */
	take(d: Dust): boolean {
		if (d.taken) return false;
		d.taken = true;
		d.mesh.visible = false;
		this.collected++;
		return true;
	}

	/** A stomped mite leaves a stardust behind. */
	dropDust(at: THREE.Vector3): Dust {
		const dir = at.clone().sub(this.center).normalize();
		const g = this.dustMesh();
		g.position.copy(at);
		g.quaternion.setFromUnitVectors(Y, dir);
		this.dustRoot.add(g);
		const d: Dust = { dir, h: 1.2, pos: this.worldPoint(dir, 1.2), mesh: g, taken: false, bonus: true, seed: 0, pull: 0 };
		this.dust.push(d);
		return d;
	}

	reset(): void {
		// Stardust and mites come back when a run restarts.
		for (let i = this.dust.length - 1; i >= 0; i--) {
			const d = this.dust[i];
			if (d.bonus) {
				this.dustRoot.remove(d.mesh);
				this.dust.splice(i, 1);
				continue;
			}
			d.taken = false;
			d.mesh.visible = true;
		}
		for (const m of this.mites) {
			m.alive = true;
			m.mesh.visible = true;
			m.mesh.scale.setScalar(1);
		}
		this.collected = 0;
		this.beamOff = false;
		this.lit.clear();
		for (const g of this.geysers) {
			g.state = 'idle';
			g.column.visible = false;
		}
	}
}

/** The chain of planets, placed nearly in a line so each pad faces the next world. */
export function buildPlanets(quality: 'high' | 'low'): Planet[] {
	const kinds: Kind[] = ['garden', 'ice', 'lava'];
	const d1 = new THREE.Vector3(0.25, 0.3, -1).normalize();
	const d2 = new THREE.Vector3(0.45, 0.12, -1).normalize();
	const centers = [new THREE.Vector3(0, 0, 0)];
	centers.push(centers[0].clone().addScaledVector(d1, 82));
	centers.push(centers[1].clone().addScaledVector(d2, 88));
	return kinds.map((k, i) => {
		const prev = centers[i - 1];
		const next = centers[i + 1];
		const landing = prev ? prev.clone().sub(centers[i]) : centers[i].clone().sub(next!);
		const goal = next ? next.clone().sub(centers[i]) : null;
		return new Planet(k, i, centers[i], landing, goal, quality);
	});
}
