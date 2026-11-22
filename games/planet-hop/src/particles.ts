import * as THREE from 'three';

export interface Burst {
	pos: THREE.Vector3;
	count: number;
	color: THREE.ColorRepresentation;
	color2?: THREE.ColorRepresentation;
	speed: number;
	size: number;
	life: number;
	/** Main direction; particles spread around it. */
	dir?: THREE.Vector3;
	spread?: number; // 0 = along dir, 1 = any direction
	/** Pull toward this point (planet center). Negative pushes away. */
	center?: THREE.Vector3;
	gravity?: number;
	drag?: number;
	jitter?: number; // start position noise
}

const vert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
	vAlpha = aAlpha;
	vColor = aColor;
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	// Fade and cap points close to the camera, so they never fill the view.
	float z = -mv.z;
	vAlpha *= smoothstep(0.6, 2.5, z);
	gl_PointSize = min(aSize * uScale / max(0.1, z), 90.0);
	gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
	vec2 p = gl_PointCoord * 2.0 - 1.0;
	float d = dot(p, p);
	if (d > 1.0) discard;
	float a = mix(1.0 - smoothstep(0.55, 1.0, d), pow(1.0 - d, 2.0), uSoft);
	gl_FragColor = vec4(vColor, a * vAlpha);
}`;

/** A pool of camera-facing points. One draw call each. */
export class Particles {
	readonly points: THREE.Points;
	private n: number;
	private pos: Float32Array;
	private vel: Float32Array;
	private col: Float32Array;
	private size: Float32Array;
	private baseSize: Float32Array;
	private alpha: Float32Array;
	private life: Float32Array;
	private maxLife: Float32Array;
	private grav: Float32Array;
	private center: Float32Array;
	private drag: Float32Array;
	private next = 0;
	private geo: THREE.BufferGeometry;
	private material: THREE.ShaderMaterial;

	constructor(max: number, additive: boolean) {
		this.n = max;
		this.pos = new Float32Array(max * 3);
		this.vel = new Float32Array(max * 3);
		this.col = new Float32Array(max * 3);
		this.size = new Float32Array(max);
		this.baseSize = new Float32Array(max);
		this.alpha = new Float32Array(max);
		this.life = new Float32Array(max);
		this.maxLife = new Float32Array(max);
		this.grav = new Float32Array(max);
		this.center = new Float32Array(max * 3);
		this.drag = new Float32Array(max);
		this.geo = new THREE.BufferGeometry();
		this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
		this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
		this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
		this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
		this.material = new THREE.ShaderMaterial({
			vertexShader: vert,
			fragmentShader: frag,
			uniforms: { uScale: { value: 300 }, uSoft: { value: additive ? 1 : 0 } },
			transparent: true,
			depthWrite: false,
			blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		this.points = new THREE.Points(this.geo, this.material);
		this.points.frustumCulled = false;
		this.points.renderOrder = 5;
	}

	setScale(viewHeight: number): void {
		this.material.uniforms.uScale.value = viewHeight * 0.9;
	}

	emit(b: Burst): void {
		const c1 = new THREE.Color(b.color);
		const c2 = new THREE.Color(b.color2 ?? b.color);
		const dir = b.dir;
		const spread = b.spread ?? 1;
		const v = new THREE.Vector3();
		for (let k = 0; k < b.count; k++) {
			const i = this.next;
			this.next = (this.next + 1) % this.n;
			v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
			if (v.lengthSq() > 1) v.normalize();
			if (dir) v.multiplyScalar(spread).add(dir).normalize();
			else v.normalize();
			const sp = b.speed * (0.5 + Math.random() * 0.7);
			const j = b.jitter ?? 0;
			this.pos[i * 3] = b.pos.x + (Math.random() - 0.5) * j;
			this.pos[i * 3 + 1] = b.pos.y + (Math.random() - 0.5) * j;
			this.pos[i * 3 + 2] = b.pos.z + (Math.random() - 0.5) * j;
			this.vel[i * 3] = v.x * sp;
			this.vel[i * 3 + 1] = v.y * sp;
			this.vel[i * 3 + 2] = v.z * sp;
			const t = Math.random();
			this.col[i * 3] = c1.r + (c2.r - c1.r) * t;
			this.col[i * 3 + 1] = c1.g + (c2.g - c1.g) * t;
			this.col[i * 3 + 2] = c1.b + (c2.b - c1.b) * t;
			this.baseSize[i] = b.size * (0.6 + Math.random() * 0.6);
			this.maxLife[i] = this.life[i] = b.life * (0.6 + Math.random() * 0.6);
			this.grav[i] = b.gravity ?? 0;
			this.drag[i] = b.drag ?? 1.5;
			const c = b.center;
			this.center[i * 3] = c ? c.x : 0;
			this.center[i * 3 + 1] = c ? c.y : 0;
			this.center[i * 3 + 2] = c ? c.z : 0;
			if (!c) this.grav[i] = 0;
		}
	}

	update(dt: number): void {
		for (let i = 0; i < this.n; i++) {
			if (this.life[i] <= 0) {
				this.alpha[i] = 0;
				continue;
			}
			this.life[i] -= dt;
			const i3 = i * 3;
			const g = this.grav[i];
			if (g !== 0) {
				const dx = this.center[i3] - this.pos[i3];
				const dy = this.center[i3 + 1] - this.pos[i3 + 1];
				const dz = this.center[i3 + 2] - this.pos[i3 + 2];
				const l = Math.hypot(dx, dy, dz) || 1;
				this.vel[i3] += (dx / l) * g * dt;
				this.vel[i3 + 1] += (dy / l) * g * dt;
				this.vel[i3 + 2] += (dz / l) * g * dt;
			}
			const dr = Math.exp(-this.drag[i] * dt);
			this.vel[i3] *= dr;
			this.vel[i3 + 1] *= dr;
			this.vel[i3 + 2] *= dr;
			this.pos[i3] += this.vel[i3] * dt;
			this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
			this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
			const t = Math.max(0, this.life[i] / this.maxLife[i]);
			this.alpha[i] = Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 8 + 0.2);
			this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
		}
		this.geo.attributes.position.needsUpdate = true;
		this.geo.attributes.aAlpha.needsUpdate = true;
		this.geo.attributes.aSize.needsUpdate = true;
		this.geo.attributes.aColor.needsUpdate = true;
	}

	clear(): void {
		this.life.fill(0);
		this.alpha.fill(0);
	}
}
