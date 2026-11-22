import * as THREE from 'three';

/** Frame-rate independent smoothing factor: use as lerp(a, b, damp(k, dt)). */
export function damp(k: number, dt: number): number {
	return 1 - Math.exp(-k * dt);
}

export function clamp(v: number, lo: number, hi: number): number {
	if (!Number.isFinite(v)) return (lo + hi) * 0.5;
	return v < lo ? lo : v > hi ? hi : v;
}

/** Like normalize(), but keeps `fallback` when `v` is too short or invalid. */
export function safeNormalize(out: THREE.Vector3, v: THREE.Vector3, fallback: THREE.Vector3): THREE.Vector3 {
	const l = v.length();
	if (l > 1e-5 && Number.isFinite(l)) return out.copy(v).multiplyScalar(1 / l);
	const f = fallback.lengthSq() > 1e-8 ? fallback : _y;
	return out.copy(f).normalize();
}

/** Small seeded random, so each planet looks the same on every run. */
export function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Unit vector from latitude/longitude in degrees. Latitude 90 is local "north" (+Y). */
export function dirFromLatLon(lat: number, lon: number): THREE.Vector3 {
	const la = THREE.MathUtils.degToRad(lat);
	const lo = THREE.MathUtils.degToRad(lon);
	return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** Any unit vector at a right angle to `v`. */
export function anyPerpendicular(v: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
	const a = Math.abs(v.y) < 0.9 ? _y : _x;
	return out.crossVectors(v, a).normalize();
}
const _x = new THREE.Vector3(1, 0, 0);
const _y = new THREE.Vector3(0, 1, 0);

/** Removes the part of `v` along unit `n` and keeps the old length (parallel transport). */
export function projectKeepLength(v: THREE.Vector3, n: THREE.Vector3): THREE.Vector3 {
	if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.z)) return v;
	const len = v.length();
	if (len < 1e-6) return v;
	v.addScaledVector(n, -v.dot(n));
	const l2 = v.length();
	if (l2 < 1e-6) return v.set(0, 0, 0);
	return v.multiplyScalar(len / l2);
}

/** Quaternion that turns a model (up = +Y, front = +Z) to stand on `up` and look at `front`. */
export function basisQuat(up: THREE.Vector3, front: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
	_z.copy(front).addScaledVector(up, -front.dot(up));
	if (_z.lengthSq() < 1e-8) anyPerpendicular(up, _z);
	_z.normalize();
	_r.crossVectors(up, _z).normalize();
	_m.makeBasis(_r, up, _z);
	return out.setFromRotationMatrix(_m);
}
const _z = new THREE.Vector3();
const _r = new THREE.Vector3();
const _m = new THREE.Matrix4();

export function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	const t = Math.floor((seconds * 10) % 10);
	return `${m}:${s.toString().padStart(2, '0')}.${t}`;
}

export const isTouchDevice = (): boolean =>
	matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches;
