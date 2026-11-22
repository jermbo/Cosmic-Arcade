import * as THREE from 'three';
import type { Input } from './input';
import type { Player } from './player';
import type { Planet } from './world/planets';
import { anyPerpendicular, clamp, damp } from './util';

export const DEFAULT_PITCH = 0.42;
const MIN_PITCH = -0.12;
const MAX_PITCH = 1.05;

/**
 * A third-person camera for round worlds.
 * The camera keeps its own "up" that eases toward the hero's up, and its heading is carried
 * along the sphere without twisting (parallel transport). That keeps the horizon calm.
 */
export class CameraRig {
	readonly up = new THREE.Vector3(0, 1, 0);
	readonly fwd = new THREE.Vector3(0, 0, -1);
	readonly right = new THREE.Vector3(1, 0, 0);
	readonly target = new THREE.Vector3();
	pitch = DEFAULT_PITCH;
	dist = 7.6;
	/** The arm shortens when something stands between the camera and Pip. */
	private arm = 8.8;
	baseFov = 62;
	fovKick = 0;
	reduceMotion = false;
	assist = true;
	private smoothH = 0;
	private shake = 0;
	private noLookT = 0;

	readonly camera: THREE.PerspectiveCamera;

	constructor(camera: THREE.PerspectiveCamera) {
		this.camera = camera;
	}

	snap(up: THREE.Vector3, heading: THREE.Vector3, height = 0): void {
		this.up.copy(up).normalize();
		this.fwd.copy(heading).addScaledVector(this.up, -heading.dot(this.up));
		if (this.fwd.lengthSq() < 1e-6) anyPerpendicular(this.up, this.fwd);
		this.fwd.normalize();
		this.right.crossVectors(this.fwd, this.up).normalize();
		this.smoothH = height;
		this.pitch = DEFAULT_PITCH;
		this.arm = this.dist;
	}

	addShake(v: number): void {
		if (!this.reduceMotion) this.shake = Math.max(this.shake, v);
	}

	update(dt: number, input: Input | null, player: Player, planet: Planet): void {
		// Ease the camera's up toward the hero's up.
		const k = this.reduceMotion ? 3.5 : 5;
		this.up.lerp(player.up, damp(k, dt)).normalize();
		// Carry the heading along without twist.
		this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up));
		if (this.fwd.lengthSq() < 1e-6) anyPerpendicular(this.up, this.fwd);
		this.fwd.normalize();

		if (input) {
			this.fwd.applyAxisAngle(this.up, -input.lookX).normalize();
			this.pitch = clamp(this.pitch - input.lookY, MIN_PITCH, MAX_PITCH);
			this.noLookT = input.lookActiveTime;
		}

		// Gentle assist: swing behind the hero when running sideways, and ease the pitch back.
		const speed = player.vT.length();
		if (this.assist && this.noLookT > 1.0 && speed > 1.5) {
			const dir = player.vT.clone().addScaledVector(this.up, -player.vT.dot(this.up)).normalize();
			const side = dir.dot(this.right);
			const ahead = dir.dot(this.fwd);
			if (ahead > -0.5) {
				const ang = Math.atan2(side, ahead);
				const rate = ang * 0.6 * clamp(speed / 6.6, 0, 1) * clamp((this.noLookT - 1) * 2, 0, 1);
				this.fwd.applyAxisAngle(this.up, -rate * dt).normalize();
			}
		}
		if (this.assist && this.noLookT > 2.5) this.pitch += (DEFAULT_PITCH - this.pitch) * damp(0.8, dt);
		this.right.crossVectors(this.fwd, this.up).normalize();

		// The target height lags in the air, so jumps don't bob the view.
		const h = player.height;
		const rate = player.grounded ? 9 : h < this.smoothH ? 8 : 2.2;
		this.smoothH += (h - this.smoothH) * damp(rate, dt);
		this.target.copy(player.pos).addScaledVector(player.up, this.smoothH - h).addScaledVector(this.up, 1.4);

		const want = this.clearDistance(planet);
		this.arm += (want - this.arm) * damp(want < this.arm ? 16 : 2.2, dt);
		this.place(planet.center, planet.R);
	}

	/** How far back the camera can sit before a tree, pillar or tower blocks the view of Pip. */
	private clearDistance(planet: Planet): number {
		const cp = Math.cos(this.pitch);
		const sp = Math.sin(this.pitch);
		const back = this.fwd.clone().multiplyScalar(-cp).addScaledVector(this.up, sp);
		const s = new THREE.Vector3();
		const rel = new THREE.Vector3();
		const steps = 12;
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			s.copy(this.target).addScaledVector(back, t * this.dist);
			rel.copy(s).sub(planet.center);
			for (const c of planet.colliders) {
				if (c.top < 0.7) continue;
				const along = rel.dot(c.dir);
				if (along <= 0) continue;
				const h = along - planet.R;
				if (h > c.top + 0.5) continue;
				const perp = Math.sqrt(Math.max(0, rel.lengthSq() - along * along));
				if (perp < c.r + 0.55) return Math.max(2.6, t * this.dist - 0.6);
			}
		}
		return this.dist;
	}

	/** Position the camera from target, heading and pitch, kept outside the ground. */
	place(center: THREE.Vector3, R: number): void {
		const cp = Math.cos(this.pitch);
		const sp = Math.sin(this.pitch);
		const look = this.fwd.clone().multiplyScalar(cp).addScaledVector(this.up, -sp);
		const pos = this.target.clone().addScaledVector(look, -Math.min(this.dist, this.arm));
		const rel = pos.clone().sub(center);
		const minR = R + 1.1;
		if (rel.length() < minR) pos.copy(center).addScaledVector(rel.normalize(), minR);
		if (this.shake > 0) {
			pos.x += (Math.random() - 0.5) * this.shake;
			pos.y += (Math.random() - 0.5) * this.shake;
			pos.z += (Math.random() - 0.5) * this.shake;
			this.shake = Math.max(0, this.shake - 0.016 * 4);
		}
		this.camera.position.copy(pos);
		this.camera.up.copy(this.up);
		this.camera.lookAt(this.target);
		const fov = this.baseFov + (this.reduceMotion ? 0 : this.fovKick);
		if (Math.abs(this.camera.fov - fov) > 0.01) {
			this.camera.fov = fov;
			this.camera.updateProjectionMatrix();
		}
	}

	/** Where the camera would rest for this target/up/heading. Used to blend out of flights. */
	restPose(target: THREE.Vector3, up: THREE.Vector3, heading: THREE.Vector3, center: THREE.Vector3, R: number): THREE.Vector3 {
		const cp = Math.cos(DEFAULT_PITCH);
		const sp = Math.sin(DEFAULT_PITCH);
		const look = heading.clone().multiplyScalar(cp).addScaledVector(up, -sp);
		const pos = target.clone().addScaledVector(look, -this.dist);
		const rel = pos.clone().sub(center);
		if (rel.length() < R + 1.1) pos.copy(center).addScaledVector(rel.normalize(), R + 1.1);
		return pos;
	}
}
