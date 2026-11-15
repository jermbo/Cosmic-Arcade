/** The sky: day and night, lights, clouds, stars and the wish lanterns. */

import * as THREE from 'three';
import { TUNE } from './content.ts';
import { glowSprites, makeGlow, softTexture, spark } from './fx.ts';
import { MAT } from './models.ts';
import { S } from './state.ts';
import { clamp, lerp, rng, smooth } from './util.ts';

/** What the rest of the game reads about the sky. */
export const env = {
	/** 0 by day, 1 at night. */
	night: 0,
	time: 0,
	/** Shooting stars are a late reward. */
	shootingStars: false,
};

interface Key {
	at: number;
	top: number;
	horizon: number;
	bottom: number;
	sun: number;
	sunPower: number;
	skyPower: number;
	night: number;
}

const DAY: Omit<Key, 'at'> = { top: 0x4f9fe6, horizon: 0xcdeaf5, bottom: 0x8fc6ec, sun: 0xfff0d2, sunPower: 2.7, skyPower: 1.2, night: 0 };
const DUSK: Omit<Key, 'at'> = { top: 0x6a5fc0, horizon: 0xffb98f, bottom: 0xe88fb0, sun: 0xffc090, sunPower: 2.0, skyPower: 1.25, night: 0.55 };
const NIGHT: Omit<Key, 'at'> = { top: 0x141a4a, horizon: 0x4a4a9c, bottom: 0x2a2a6c, sun: 0xa9b4ff, sunPower: 1.2, skyPower: 0.85, night: 1 };
const DAWN: Omit<Key, 'at'> = { top: 0x8db1ea, horizon: 0xffdcc8, bottom: 0xf6c8d8, sun: 0xffd3b5, sunPower: 2.1, skyPower: 1.1, night: 0.45 };

const KEYS: Key[] = [
	{ at: 0, ...DAWN },
	{ at: 0.09, ...DAY },
	{ at: 0.52, ...DAY },
	{ at: 0.61, ...DUSK },
	{ at: 0.69, ...NIGHT },
	{ at: 0.93, ...NIGHT },
	{ at: 1, ...DAWN },
];

const group = new THREE.Group();
const hemi = new THREE.HemisphereLight(0xffffff, 0xd9c8e8, 1.5);
export const sun = new THREE.DirectionalLight(0xffffff, 2);
const fog = new THREE.Fog(0xdff3f8, 70, 260);

const dome = new THREE.Mesh(
	new THREE.SphereGeometry(220, 24, 12),
	new THREE.ShaderMaterial({
		uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
		vertexShader: `varying float h; void main() { h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: `
			uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying float h;
			void main() {
				vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.5));
				gl_FragColor = vec4(c, 1.0);
				#include <colorspace_fragment>
			}`,
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
	}),
);
dome.renderOrder = -10;

const stars = makeStars();
const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('rgba(255,250,225,1)', 'rgba(255,240,200,0)', 0.25), fog: false, depthWrite: false, transparent: true }));
const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('rgba(240,244,255,1)', 'rgba(200,215,255,0)', 0.42), fog: false, depthWrite: false, transparent: true }));
sunDisc.scale.setScalar(46);
moonDisc.scale.setScalar(26);
sunDisc.renderOrder = moonDisc.renderOrder = -8;

const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0xbfd0ff, emissiveIntensity: 0.05 });
const clouds: { mesh: THREE.Mesh; speed: number }[] = [];

interface WishLantern {
	obj: THREE.Group;
	glow: THREE.Sprite;
	life: number;
	vx: number;
	vz: number;
	phase: number;
}
const wishes: WishLantern[] = [];
let wishTimer = 2;
let starTimer = 20;

/** Where wish lanterns can start. The view fills this list. */
export const wishSources: { x: number; y: number; z: number; strong: boolean }[] = [];

function makeStars(): THREE.Points {
	const rand = rng(99);
	const n = 420;
	const p = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const a = rand() * Math.PI * 2;
		const y = rand() * 1.5 - 0.5;
		const r = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y)));
		p.set([Math.cos(a) * r * 200, clamp(y, -1, 1) * 200, Math.sin(a) * r * 200], i * 3);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(p, 3));
	const m = new THREE.PointsMaterial({ color: 0xfff7e0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
	const pts = new THREE.Points(g, m);
	pts.renderOrder = -9;
	return pts;
}

/** A puffy low-poly cloud. The islands use it too, for the clouds at their base. */
export function makeCloud(rand: () => number): THREE.Mesh {
	const parts: THREE.BufferGeometry[] = [];
	const n = 3 + Math.floor(rand() * 3);
	for (let i = 0; i < n; i++) {
		const g = new THREE.IcosahedronGeometry(1.2 + rand() * 1.4, 0);
		g.scale(1.5, 0.6, 1);
		g.translate((i - n / 2) * 2 + rand(), rand() * 0.5, rand() * 1.5 - 0.7);
		parts.push(g);
	}
	// Merge by hand: the shapes share one layout.
	const total = parts.reduce((sum, g) => sum + g.getAttribute('position').count, 0);
	const p = new Float32Array(total * 3);
	let o = 0;
	for (const g of parts) {
		p.set(g.getAttribute('position').array, o);
		o += g.getAttribute('position').count * 3;
		g.dispose();
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
	geo.computeVertexNormals();
	return new THREE.Mesh(geo, cloudMat);
}

export function initSky(scene: THREE.Scene): void {
	scene.fog = fog;
	scene.add(group, hemi, sun, sun.target);
	group.add(dome, stars, sunDisc, moonDisc);

	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 110;
	const sc = sun.shadow.camera;
	sc.left = sc.bottom = -24;
	sc.right = sc.top = 24;
	sun.shadow.bias = -0.0006;
	sun.shadow.normalBias = 0.03;

	const rand = rng(5);
	for (let i = 0; i < 26; i++) {
		const mesh = makeCloud(rand);
		const below = i < 17;
		const a = rand() * Math.PI * 2;
		const r = below ? 14 + rand() * 70 : 85 + rand() * 50;
		mesh.position.set(Math.cos(a) * r, below ? -24 - rand() * 14 : 16 + rand() * 20, Math.sin(a) * r);
		mesh.scale.setScalar(below ? 0.7 + rand() * 1.1 : 2 + rand() * 1.6);
		clouds.push({ mesh, speed: 0.25 + rand() * 0.45 });
		group.add(mesh);
	}
}

function sample(clock: number): Key {
	let i = 0;
	while (i < KEYS.length - 2 && clock >= KEYS[i + 1].at) i++;
	const a = KEYS[i];
	const b = KEYS[i + 1];
	const t = smooth(clamp((clock - a.at) / (b.at - a.at), 0, 1));
	const mix = (x: number, y: number): number => _a.set(x).lerp(_b.set(y), t).getHex();
	return {
		at: clock,
		top: mix(a.top, b.top),
		horizon: mix(a.horizon, b.horizon),
		bottom: mix(a.bottom, b.bottom),
		sun: mix(a.sun, b.sun),
		sunPower: lerp(a.sunPower, b.sunPower, t),
		skyPower: lerp(a.skyPower, b.skyPower, t),
		night: lerp(a.night, b.night, t),
	};
}

const _a = new THREE.Color();
const _b = new THREE.Color();

function launchWish(x: number, y: number, z: number): void {
	let w = wishes.find((l) => l.life <= 0);
	if (!w) {
		if (wishes.length >= 22) return;
		const obj = new THREE.Group();
		const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.065, 0.16, 6), MAT.lamp);
		const colors = new Float32Array(body.geometry.getAttribute('position').count * 3);
		for (let i = 0; i < colors.length; i += 3) colors.set([1, 0.82, 0.55], i);
		body.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		const glow = makeGlow(0xffc070, 1.1);
		obj.add(body, glow);
		group.add(obj);
		w = { obj, glow, life: 0, vx: 0, vz: 0, phase: 0 };
		wishes.push(w);
	}
	w.obj.position.set(x, y, z);
	w.obj.visible = true;
	w.life = 26;
	w.vx = (Math.random() - 0.5) * 0.3 + 0.15;
	w.vz = (Math.random() - 0.5) * 0.3;
	w.phase = Math.random() * 6;
}

export function updateSky(dt: number, camera: THREE.PerspectiveCamera, target: THREE.Vector3, yaw: number, frozen: boolean): void {
	env.time += dt;
	if (!frozen) S.clock = (S.clock + dt / TUNE.dayLength) % 1;
	const k = sample(S.clock);
	env.night = k.night;

	// Colours of the sky.
	const u = (dome.material as THREE.ShaderMaterial).uniforms;
	(u.top.value as THREE.Color).set(k.top);
	(u.horizon.value as THREE.Color).set(k.horizon);
	(u.bottom.value as THREE.Color).set(k.bottom);
	fog.color.copy(u.horizon.value as THREE.Color);
	hemi.color.set(k.top).lerp(_a.set(0xffffff), 0.6);
	hemi.groundColor.set(k.bottom).lerp(_a.set(0xffffff), 0.3);
	hemi.intensity = k.skyPower;
	sun.color.set(k.sun);
	sun.intensity = k.sunPower;

	// The light turns slowly around the islands. It never jumps.
	const az = S.clock * Math.PI * 2 + 0.6;
	const el = 0.9 + Math.sin(S.clock * Math.PI * 2) * 0.15;
	sun.position.set(target.x + Math.cos(az) * Math.cos(el) * 40, Math.sin(el) * 40, target.z + Math.sin(az) * Math.cos(el) * 40);
	sun.target.position.set(target.x, 0, target.z);

	// The sun and the moon cross the sky in turn.
	group.position.set(0, 0, 0);
	dome.position.copy(camera.position);
	stars.position.copy(camera.position);
	const dayT = S.clock / 0.64;
	const nightT = (S.clock - 0.64) / 0.36;
	placeDisc(sunDisc, dayT, camera, 1);
	placeDisc(moonDisc, nightT, camera, 1);
	(stars.material as THREE.PointsMaterial).opacity = clamp((k.night - 0.5) * 2, 0, 1);
	stars.rotation.y = env.time * 0.004;

	MAT.glow.emissiveIntensity = clamp((k.night - 0.3) * 2.2, 0, 1) * 1.25;
	const glow = 0.1 + clamp((k.night - 0.25) * 1.6, 0, 1) * 0.55;
	for (const s of glowSprites) s.material.opacity = glow;

	for (const c of clouds) {
		c.mesh.position.x += c.speed * dt;
		if (c.mesh.position.x > 140) c.mesh.position.x = -140;
	}

	// Wish lanterns rise at night.
	if (k.night > 0.75) {
		wishTimer -= dt;
		if (wishTimer <= 0) {
			const strong = wishSources.filter((s) => s.strong);
			const src = strong.length && Math.random() < 0.75 ? strong[Math.floor(Math.random() * strong.length)] : wishSources[Math.floor(Math.random() * wishSources.length)];
			if (src) launchWish(src.x, src.y, src.z);
			else launchWish((Math.random() - 0.5) * 14, -1, (Math.random() - 0.5) * 14);
			wishTimer = strong.length ? 1.6 + Math.random() * 2 : 4 + Math.random() * 5;
		}
		if (env.shootingStars) {
			starTimer -= dt;
			if (starTimer <= 0) {
				starTimer = 9 + Math.random() * 14;
				const a = yaw + Math.PI + (Math.random() - 0.5) * 1.2;
				const sx = target.x + Math.sin(a) * 45;
				const sz = target.z + Math.cos(a) * 45;
				for (let i = 0; i < 26; i++) {
					spark({ x: sx + i * 0.45, y: 24 - i * 0.22, z: sz, vx: -16, vy: -8, life: 0.5 + i * 0.03, size: 0.9 - i * 0.025, color: 0xfff6d0, alpha: 0.9 - i * 0.03 });
				}
			}
		}
	}
	for (const w of wishes) {
		if (w.life <= 0) continue;
		w.life -= dt;
		const p = w.obj.position;
		p.y += dt * 0.42;
		p.x += (w.vx + Math.sin(env.time * 0.7 + w.phase) * 0.12) * dt;
		p.z += (w.vz + Math.cos(env.time * 0.6 + w.phase) * 0.12) * dt;
		w.obj.scale.setScalar(clamp(Math.min((26 - w.life) * 1.5, w.life / 4), 0, 1));
		if (w.life <= 0) w.obj.visible = false;
	}
}

function placeDisc(disc: THREE.Sprite, t: number, camera: THREE.Camera, power: number): void {
	const visible = t > -0.02 && t < 1.02;
	disc.visible = visible;
	if (!visible) return;
	const a = t * Math.PI;
	disc.position.set(camera.position.x + Math.cos(a) * 170, camera.position.y - 30 + Math.sin(a) * 130, camera.position.z - 95);
	disc.material.opacity = clamp(Math.sin(a) * 4, 0, 1) * power;
}
