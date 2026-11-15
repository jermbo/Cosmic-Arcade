/** Particles and soft glow sprites. One pool of points serves pollen, sparkles, mist and rain. */

import * as THREE from 'three';

const MAX = 2600;

export interface Spark {
	x: number;
	y: number;
	z: number;
	vx?: number;
	vy?: number;
	vz?: number;
	life: number;
	size: number;
	color: number;
	alpha?: number;
	gravity?: number;
	drag?: number;
	/** Side-to-side drift, for pollen and petals. */
	sway?: number;
}

const pos = new Float32Array(MAX * 3);
const vel = new Float32Array(MAX * 3);
const col = new Float32Array(MAX * 4);
const size = new Float32Array(MAX);
const baseSize = new Float32Array(MAX);
const life = new Float32Array(MAX);
const maxLife = new Float32Array(MAX);
const alpha = new Float32Array(MAX);
const gravity = new Float32Array(MAX);
const drag = new Float32Array(MAX);
const sway = new Float32Array(MAX);
let next = 0;

/** A scale from the quality setting. Low quality makes fewer particles. */
export const fxBudget = { amount: 1 };

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);

const material = new THREE.ShaderMaterial({
	uniforms: { uScale: { value: 600 } },
	vertexShader: `
		attribute float aSize;
		attribute vec4 aColor;
		varying vec4 vColor;
		uniform float uScale;
		void main() {
			vColor = aColor;
			vec4 mv = modelViewMatrix * vec4(position, 1.0);
			gl_PointSize = aSize * uScale / -mv.z;
			gl_Position = projectionMatrix * mv;
		}`,
	fragmentShader: `
		varying vec4 vColor;
		void main() {
			float d = length(gl_PointCoord - 0.5);
			float a = smoothstep(0.5, 0.12, d) * vColor.a;
			if (a < 0.01) discard;
			gl_FragColor = vec4(vColor.rgb, a);
			#include <colorspace_fragment>
		}`,
	transparent: true,
	depthWrite: false,
});

export const particles = new THREE.Points(geometry, material);
particles.frustumCulled = false;
particles.renderOrder = 5;

const _c = new THREE.Color();

export function spark(s: Spark): void {
	const i = next;
	next = (next + 1) % MAX;
	pos[i * 3] = s.x;
	pos[i * 3 + 1] = s.y;
	pos[i * 3 + 2] = s.z;
	vel[i * 3] = s.vx ?? 0;
	vel[i * 3 + 1] = s.vy ?? 0;
	vel[i * 3 + 2] = s.vz ?? 0;
	_c.set(s.color);
	col[i * 4] = _c.r;
	col[i * 4 + 1] = _c.g;
	col[i * 4 + 2] = _c.b;
	col[i * 4 + 3] = 0;
	baseSize[i] = s.size;
	life[i] = maxLife[i] = s.life;
	alpha[i] = s.alpha ?? 1;
	gravity[i] = s.gravity ?? 0;
	drag[i] = s.drag ?? 0;
	sway[i] = s.sway ?? 0;
}

/** A round puff of sparkles, for a new piece or a combo. */
export function burst(x: number, y: number, z: number, colors: number[], count: number, power = 1): void {
	const n = Math.ceil(count * fxBudget.amount);
	for (let i = 0; i < n; i++) {
		const a = Math.random() * Math.PI * 2;
		const up = 0.6 + Math.random() * 1.4;
		const out = (0.4 + Math.random() * 0.9) * power;
		spark({
			x,
			y,
			z,
			vx: Math.cos(a) * out,
			vy: up * power,
			vz: Math.sin(a) * out,
			life: 0.6 + Math.random() * 0.7,
			size: 0.07 + Math.random() * 0.09,
			color: colors[i % colors.length],
			gravity: 2.2,
			drag: 1.5,
		});
	}
}

export function updateParticles(dt: number, time: number, viewHeight: number, fov: number): void {
	material.uniforms.uScale.value = viewHeight / (2 * Math.tan((fov * Math.PI) / 360));
	for (let i = 0; i < MAX; i++) {
		if (life[i] <= 0) continue;
		life[i] -= dt;
		if (life[i] <= 0) {
			size[i] = 0;
			col[i * 4 + 3] = 0;
			continue;
		}
		const k = i * 3;
		const d = Math.max(0, 1 - drag[i] * dt);
		vel[k] *= d;
		vel[k + 1] = vel[k + 1] * d - gravity[i] * dt;
		vel[k + 2] *= d;
		const s = sway[i];
		pos[k] += (vel[k] + (s ? Math.sin(time * 1.3 + i) * s : 0)) * dt;
		pos[k + 1] += vel[k + 1] * dt;
		pos[k + 2] += (vel[k + 2] + (s ? Math.cos(time * 1.1 + i * 1.7) * s : 0)) * dt;
		// Fade in fast, fade out slow.
		const t = 1 - life[i] / maxLife[i];
		const fade = Math.min(1, t * 8) * Math.min(1, (1 - t) * 2.5);
		col[i * 4 + 3] = alpha[i] * fade;
		size[i] = baseSize[i];
	}
	geometry.attributes.position.needsUpdate = true;
	geometry.attributes.aColor.needsUpdate = true;
	geometry.attributes.aSize.needsUpdate = true;
}

/** A soft round texture, for glows, mist, the sun and the moon. */
export function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', hard = 0): THREE.CanvasTexture {
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grad.addColorStop(0, inner);
	if (hard) grad.addColorStop(hard, inner);
	grad.addColorStop(1, outer);
	g.fillStyle = grad;
	g.fillRect(0, 0, 64, 64);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

const glowTexture = softTexture('rgba(255,255,255,0.9)');

/** A glow that the night makes stronger. `list` keeps them for the sky to fade. */
export const glowSprites: THREE.Sprite[] = [];

export function makeGlow(color: number, scale: number): THREE.Sprite {
	const mat = new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
	const sprite = new THREE.Sprite(mat);
	sprite.scale.setScalar(scale);
	sprite.userData.glow = true;
	glowSprites.push(sprite);
	return sprite;
}

export function dropGlow(sprite: THREE.Sprite): void {
	const i = glowSprites.indexOf(sprite);
	if (i >= 0) glowSprites.splice(i, 1);
	sprite.material.dispose();
}
