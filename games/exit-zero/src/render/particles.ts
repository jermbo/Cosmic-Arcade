import * as THREE from 'three';
import { shared } from './psx.ts';

// Square, unfiltered points: sparks, steam, splashes and dust.

const vertex = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
uniform vec2 uSnap;
varying vec4 vColor;
void main() {
	vec4 view = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * view;
	gl_PointSize = max(1.0, aSize * uSnap.y * 0.9 / max(-view.z, 0.1));
	vColor = aColor;
}
`;

const fragment = /* glsl */ `
varying vec4 vColor;
void main() {
	if (vColor.a <= 0.01) discard;
	gl_FragColor = vColor;
}
`;

interface P {
	x: number; y: number; z: number;
	vx: number; vy: number; vz: number;
	life: number; max: number;
	r: number; g: number; b: number;
	size: number;
	grav: number;
	drag: number;
}

export interface Emit {
	at: THREE.Vector3;
	count: number;
	speed: number;
	up?: number;
	color: [number, number, number];
	size: number;
	life: number;
	grav?: number;
	drag?: number;
	spread?: number;
}

export class Particles {
	readonly points: THREE.Points;
	private list: P[] = [];
	private max: number;
	private pos: Float32Array;
	private col: Float32Array;
	private size: Float32Array;

	constructor(max: number, additive: boolean) {
		this.max = max;
		this.pos = new Float32Array(max * 3);
		this.col = new Float32Array(max * 4);
		this.size = new Float32Array(max);
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
		g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
		g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
		const m = new THREE.ShaderMaterial({
			uniforms: { uSnap: shared.uSnap },
			vertexShader: vertex,
			fragmentShader: fragment,
			transparent: true,
			depthWrite: false,
			blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		this.points = new THREE.Points(g, m);
		this.points.frustumCulled = false;
		this.points.renderOrder = 3;
	}

	emit(e: Emit): void {
		for (let i = 0; i < e.count; i++) {
			if (this.list.length >= this.max) this.list.shift();
			const a = Math.random() * Math.PI * 2;
			const s = e.speed * (0.4 + Math.random() * 0.6);
			const sp = e.spread ?? 1;
			this.list.push({
				x: e.at.x + (Math.random() - 0.5) * 0.1 * sp,
				y: e.at.y,
				z: e.at.z + (Math.random() - 0.5) * 0.1 * sp,
				vx: Math.cos(a) * s * sp,
				vy: (e.up ?? 0) * (0.6 + Math.random() * 0.6),
				vz: Math.sin(a) * s * sp,
				life: e.life * (0.6 + Math.random() * 0.4),
				max: e.life,
				r: e.color[0], g: e.color[1], b: e.color[2],
				size: e.size,
				grav: e.grav ?? 0,
				drag: e.drag ?? 0,
			});
		}
	}

	update(dt: number): void {
		const keep: P[] = [];
		for (const p of this.list) {
			p.life -= dt;
			if (p.life <= 0) continue;
			p.vy -= p.grav * dt;
			const d = Math.max(0, 1 - p.drag * dt);
			p.vx *= d;
			p.vz *= d;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.z += p.vz * dt;
			if (p.y < 0.02 && p.grav > 0) {
				p.y = 0.02;
				p.vy *= -0.3;
			}
			keep.push(p);
		}
		this.list = keep;
		const fog = shared.uFogColor.value;
		for (let i = 0; i < this.max; i++) {
			const p = this.list[i];
			if (!p) {
				this.col[i * 4 + 3] = 0;
				continue;
			}
			this.pos[i * 3] = p.x;
			this.pos[i * 3 + 1] = p.y;
			this.pos[i * 3 + 2] = p.z;
			const k = p.life / p.max;
			this.col[i * 4] = p.r * 0.85 + fog.r * 0.15;
			this.col[i * 4 + 1] = p.g * 0.85 + fog.g * 0.15;
			this.col[i * 4 + 2] = p.b * 0.85 + fog.b * 0.15;
			this.col[i * 4 + 3] = Math.min(1, k * 1.5);
			this.size[i] = p.size;
		}
		const g = this.points.geometry;
		g.attributes.position.needsUpdate = true;
		g.attributes.aColor.needsUpdate = true;
		g.attributes.aSize.needsUpdate = true;
		g.setDrawRange(0, this.max);
	}

	clear(): void {
		this.list.length = 0;
	}
}
