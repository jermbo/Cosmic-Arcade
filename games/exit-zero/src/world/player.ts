import * as THREE from 'three';
import { Builder } from '../render/builder.ts';
import { MOVE, NOISE } from '../tuning.ts';
import { collide } from './collide.ts';
import { syncAmbient } from './components/util.ts';
import type { PlayerView, World } from './world.ts';

/** The body you control. Moves, collides, makes footstep noise, and has a model for third person. */
export class Player implements PlayerView {
	pos = new THREE.Vector3();
	eye = new THREE.Vector3();
	vel = new THREE.Vector2();
	yaw = 0;
	pitch = 0;
	inWater = false;
	alive = true;
	sprinting = false;
	/** Radius of the last footstep noise, for the HUD. */
	lastNoise = 0;
	noiseShow = 0;
	bobPhase = 0;
	moving = 0;
	private stepAcc = 0;
	readonly model: THREE.Group;
	private materials;
	private legL: THREE.Group;
	private legR: THREE.Group;
	private armL: THREE.Group;
	private armR: THREE.Group;
	onStep: (kind: keyof typeof NOISE, loud: boolean) => void = () => {};

	constructor() {
		const mk = (draw: (b: Builder) => void) => {
			const b = new Builder();
			draw(b);
			return b.build({ dynamic: true });
		};
		const hoodie = { tex: 'fabric', color: [0.86, 0.26, 0.2] as [number, number, number] };
		const jeans = { tex: 'fabric', color: [0.3, 0.4, 0.62] as [number, number, number] };
		const skinC = { tex: 'grain', color: [0.95, 0.76, 0.6] as [number, number, number] };
		const torso = mk((b) => {
			b.box(hoodie, 0.42, 0.6, 0.24, 0, 0.82, 0);
			b.box(hoodie, 0.3, 0.2, 0.06, 0, 0.9, -0.14);
			b.box(skinC, 0.22, 0.24, 0.22, 0, 1.44, 0);
			b.box({ tex: 'grain', color: [0.22, 0.16, 0.12] }, 0.24, 0.1, 0.24, 0, 1.6, 0.01);
			b.box(hoodie, 0.32, 0.12, 0.08, 0, 1.36, 0.14);
		});
		const leg = () => mk((b) => {
			b.box(jeans, 0.15, 0.8, 0.16, 0, -0.8, 0);
			b.box({ tex: 'grain', color: [0.92, 0.92, 0.9] }, 0.16, 0.08, 0.26, 0, -0.84, -0.04);
		});
		const arm = () => mk((b) => {
			b.box(hoodie, 0.11, 0.58, 0.12, 0, -0.58, 0);
			b.box(skinC, 0.09, 0.08, 0.09, 0, -0.66, 0);
		});
		const parts = [torso, leg(), leg(), arm(), arm()];
		this.materials = parts.flatMap((p) => p.materials);
		this.model = new THREE.Group();
		this.model.add(torso.group);
		this.legL = parts[1].group;
		this.legR = parts[2].group;
		this.armL = parts[3].group;
		this.armR = parts[4].group;
		this.legL.position.set(-0.1, 0.82, 0);
		this.legR.position.set(0.1, 0.82, 0);
		this.armL.position.set(-0.28, 1.38, 0);
		this.armR.position.set(0.28, 1.38, 0);
		this.model.add(this.legL, this.legR, this.armL, this.armR);
	}

	place(x: number, z: number, yaw: number): void {
		this.pos.set(x, 0, z);
		this.yaw = yaw;
		this.pitch = 0;
		this.vel.set(0, 0);
		this.stepAcc = 0;
		this.alive = true;
		this.updateEye();
	}

	private updateEye(): void {
		this.eye.set(this.pos.x, this.pos.y + MOVE.eye, this.pos.z);
	}

	update(dt: number, world: World, move: [number, number], sprint: boolean, bobOn: boolean): void {
		const zone = world.grid.zoneAt(this.pos.x, this.pos.z);
		this.inWater = !!zone?.water;
		this.sprinting = sprint && move[1] > 0.3;
		let speed = this.sprinting ? MOVE.sprint : MOVE.walk;
		if (this.inWater) speed *= MOVE.wade;
		const fx = Math.sin(this.yaw);
		const fz = -Math.cos(this.yaw);
		const wx = (fx * move[1] + -fz * move[0]) * speed;
		const wz = (fz * move[1] + fx * move[0]) * speed;
		const k = Math.min(1, dt * MOVE.accel);
		this.vel.x += (wx - this.vel.x) * k;
		this.vel.y += (wz - this.vel.y) * k;
		const ox = this.pos.x;
		const oz = this.pos.z;
		const [nx, nz] = collide(world.grid, world.colliders, ox + this.vel.x * dt, oz + this.vel.y * dt, MOVE.radius);
		this.pos.x = nx;
		this.pos.z = nz;
		const moved = Math.hypot(nx - ox, nz - oz);
		this.moving = Math.min(1, moved / dt / MOVE.walk);

		// footsteps: sound and noise that the creature can hear
		this.stepAcc += moved;
		const stride = this.sprinting ? MOVE.stepSprint : MOVE.stepWalk;
		if (this.stepAcc >= stride) {
			this.stepAcc -= stride;
			const kind = (zone?.step ?? 'concrete') as keyof typeof NOISE;
			const radius = NOISE[kind][this.sprinting ? 'sprint' : 'walk'];
			this.lastNoise = radius;
			this.noiseShow = 0.6;
			world.noise(this.pos.clone().setY(0.2), radius);
			this.onStep(kind, this.sprinting);
		}
		this.noiseShow = Math.max(0, this.noiseShow - dt);
		if (this.moving > 0.1) this.bobPhase += moved * (Math.PI / stride);
		this.updateEye();
		if (bobOn) this.eye.y += Math.sin(this.bobPhase) * MOVE.bob * this.moving * (this.sprinting ? 1.5 : 1);
		if (this.inWater) this.eye.y -= 0.05;

		// the model, for third person
		this.model.position.copy(this.pos);
		this.model.rotation.y = -this.yaw;
		const swing = Math.sin(this.bobPhase) * 0.55 * this.moving;
		this.legL.rotation.x = swing;
		this.legR.rotation.x = -swing;
		this.armL.rotation.x = -swing * 0.8;
		this.armR.rotation.x = swing * 0.8;
		syncAmbient(world, this.pos.clone().setY(1), this.materials, 1.5);
	}
}
