import * as THREE from 'three';
import { CONFIG } from '../config.ts';
import type { BuildingDef } from '../levels/types.ts';

/** Moves the camera: behind the car to aim and drive, a swing at the first impact, a slow orbit after it. */

export type CameraMode = 'menu' | 'aim' | 'chase' | 'impact' | 'crash';

const DEG = Math.PI / 180;

export class CameraRig {
	mode: CameraMode = 'menu';
	/** From 0 to 1: how much of the shake the player wants. */
	shakeScale = 1;
	private camera: THREE.PerspectiveCamera;
	private pos = new THREE.Vector3(0, 40, 70);
	private look = new THREE.Vector3();
	private wantPos = new THREE.Vector3();
	private wantLook = new THREE.Vector3();
	private angle = 0;
	private radius = 60;
	private height = 30;
	private trauma = 0;
	private impactAge = 0;
	private impactFrom = 0;
	private clock = 0;
	private snap = true;
	private swing = 1;
	private pickSwing = false;
	private walls: { x: number; z: number; halfW: number; halfD: number; top: number; cos: number; sin: number }[] = [];

	constructor(camera: THREE.PerspectiveCamera) {
		this.camera = camera;
	}

	/** Tells the camera where the buildings are, so it can stay out of them. */
	setBuildings(buildings: BuildingDef[]): void {
		this.walls = buildings.map((b) => {
			const yaw = ((b.heading ?? 0) * Math.PI) / 180;
			return { x: b.at[0], z: b.at[1], halfW: b.size[0] / 2 + 2, halfD: b.size[2] / 2 + 2, top: b.size[1] + 2.5, cos: Math.cos(yaw), sin: Math.sin(yaw) };
		});
	}

	/** The lowest height at which a camera at (x, z) sees the point `look` over the roofs. */
	private clearHeight(x: number, z: number, look: THREE.Vector3): number {
		let need = 0;
		for (let i = 2; i <= 10; i++) {
			const t = i / 10;
			const px = look.x + (x - look.x) * t;
			const pz = look.z + (z - look.z) * t;
			for (const wall of this.walls) {
				const dx = px - wall.x;
				const dz = pz - wall.z;
				const lx = dx * wall.cos - dz * wall.sin;
				const lz = dx * wall.sin + dz * wall.cos;
				if (Math.abs(lx) < wall.halfW && Math.abs(lz) < wall.halfD) need = Math.max(need, look.y + (wall.top - look.y) / t);
			}
		}
		return Math.min(70, need);
	}

	/** Makes the next update jump to its place, with no glide. */
	cut(): void {
		this.snap = true;
		this.trauma = 0;
	}

	setMode(mode: CameraMode): void {
		if (mode === this.mode) return;
		if (mode === 'impact' || mode === 'crash' || mode === 'menu') {
			// Start the orbit from where the camera is now, so there is no jump.
			if (this.mode !== 'impact' && this.mode !== 'crash') {
				this.angle = Math.atan2(this.pos.x - this.look.x, this.pos.z - this.look.z);
				this.radius = Math.hypot(this.pos.x - this.look.x, this.pos.z - this.look.z);
				this.height = this.pos.y - this.look.y;
			}
		}
		if (mode === 'impact') {
			this.impactAge = 0;
			this.impactFrom = this.angle;
			this.pickSwing = true;
		}
		this.mode = mode;
	}

	addShake(amount: number): void {
		this.trauma = Math.min(1, this.trauma + amount);
	}

	/** Left and forward on the screen, as directions on the ground. Used for the aftertouch push. */
	groundAxes(right: THREE.Vector3, forward: THREE.Vector3): void {
		forward.set(this.look.x - this.pos.x, 0, this.look.z - this.pos.z).normalize();
		right.set(-forward.z, 0, forward.x);
	}

	/**
	 * @param dt Real seconds since the last frame.
	 * @param car Where the player car is.
	 * @param heading Where the car points, in degrees.
	 * @param focus The middle of the action, for the crash orbit.
	 * @param spread How wide the action is, in metres.
	 */
	update(dt: number, car: THREE.Vector3, heading: number, focus: THREE.Vector3, spread: number): void {
		const c = CONFIG.camera;
		this.clock += dt;
		let follow = 6;
		let fov = c.fov;
		const yaw = heading * DEG;
		const fx = Math.sin(yaw);
		const fz = Math.cos(yaw);
		const tall = this.camera.aspect < 1.5 ? 1.25 : 1;

		if (this.mode === 'aim') {
			this.wantPos.set(car.x - fx * c.aimBack * tall, c.aimHeight * tall, car.z - fz * c.aimBack * tall);
			this.wantLook.set(car.x + fx * c.aimLookAhead, 0.5, car.z + fz * c.aimLookAhead);
			follow = 7;
		} else if (this.mode === 'chase') {
			this.wantPos.set(car.x - fx * c.chaseBack, car.y + c.chaseHeight, car.z - fz * c.chaseBack);
			this.wantLook.set(car.x + fx * 14, car.y + 0.6, car.z + fz * 14);
			follow = 12;
			fov = c.approachFov;
		} else if (this.mode === 'impact') {
			if (this.pickSwing) {
				// Swing to the side where no building is in the way.
				this.pickSwing = false;
				const left = this.impactFrom - c.impactSwing;
				const rightSide = this.impactFrom + c.impactSwing;
				const needLeft = this.clearHeight(car.x + Math.sin(left) * c.impactRadius, car.z + Math.cos(left) * c.impactRadius, car);
				const needRight = this.clearHeight(car.x + Math.sin(rightSide) * c.impactRadius, car.z + Math.cos(rightSide) * c.impactRadius, car);
				this.swing = needLeft < needRight ? -1 : 1;
			}
			this.impactAge += dt;
			const t = Math.min(1, this.impactAge / CONFIG.feel.impactCamTime);
			const eased = 1 - (1 - t) * (1 - t);
			this.angle = this.impactFrom + c.impactSwing * this.swing * eased;
			this.radius += (c.impactRadius - this.radius) * Math.min(1, dt * 5);
			this.height += (c.impactHeight - this.height) * Math.min(1, dt * 5);
			this.wantLook.copy(car);
			this.wantPos.set(car.x + Math.sin(this.angle) * this.radius, car.y + this.height, car.z + Math.cos(this.angle) * this.radius);
			follow = 9;
			fov = c.fov + 4;
		} else {
			const menu = this.mode === 'menu';
			const radius = menu ? 62 : Math.min(60, c.crashRadius + spread * 0.75) * tall;
			const height = menu ? 30 : Math.min(40, c.crashHeight + spread * 0.42) * tall;
			this.angle += (menu ? 0.07 : c.orbitSpeed * this.swing) * dt;
			this.radius += (radius - this.radius) * Math.min(1, dt * 1.6);
			this.height += (height - this.height) * Math.min(1, dt * 1.6);
			this.wantLook.copy(focus);
			this.wantPos.set(focus.x + Math.sin(this.angle) * this.radius, focus.y + this.height, focus.z + Math.cos(this.angle) * this.radius);
			follow = menu ? 2 : 3.5;
		}

		if (this.mode === 'impact' || this.mode === 'crash' || this.mode === 'menu') {
			this.wantPos.y = Math.max(this.wantPos.y, this.clearHeight(this.wantPos.x, this.wantPos.z, this.wantLook));
		}
		this.wantPos.y = Math.max(1.2, this.wantPos.y);
		if (this.snap) {
			this.pos.copy(this.wantPos);
			this.look.copy(this.wantLook);
			this.camera.fov = fov;
			this.snap = false;
		} else {
			const k = 1 - Math.exp(-follow * dt);
			this.pos.lerp(this.wantPos, k);
			this.look.lerp(this.wantLook, 1 - Math.exp(-follow * 1.4 * dt));
			this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-5 * dt));
		}
		this.camera.updateProjectionMatrix();

		this.trauma = Math.max(0, this.trauma - CONFIG.feel.shakeDecay * dt);
		const shake = this.trauma * this.trauma * this.shakeScale;
		const t = this.clock * 37;
		this.camera.position.set(
			this.pos.x + Math.sin(t * 1.3) * Math.cos(t * 0.7) * shake * CONFIG.feel.shakeMax,
			this.pos.y + Math.sin(t * 1.7 + 2) * shake * CONFIG.feel.shakeMax,
			this.pos.z + Math.cos(t * 1.1 + 1) * Math.sin(t * 0.9) * shake * CONFIG.feel.shakeMax,
		);
		this.camera.lookAt(this.look);
		this.camera.rotateZ(Math.sin(t * 1.9) * shake * CONFIG.feel.shakeAngle);
	}
}
