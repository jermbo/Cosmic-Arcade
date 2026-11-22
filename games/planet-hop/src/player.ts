import * as THREE from 'three';
import type { Planet } from './world/planets';
import { anyPerpendicular, basisQuat, clamp, damp, projectKeepLength, safeNormalize } from './util';
import { glowSprite } from './world/glow';
import { inked, toon } from './world/toon';

export const RUN_SPEED = 6.6;
const AIR_ACCEL = 18;
const GRAVITY = 30;
const JUMP_SPEED = 10.5;
const HOLD_TIME = 0.3;
const HOLD_GRAVITY = 0.45;
const COYOTE = 0.11;
const BUFFER = 0.13;
export const BODY_RADIUS = 0.46;
/** Slight lift so Pip draws in front of the planet sphere at the same radius. */
const SURFACE_LIFT = 0.06;
const _Y = new THREE.Vector3(0, 1, 0);
const _rel = new THREE.Vector3();

export interface PlayerEvents {
	jump(): void;
	land(speed: number): void;
	step(): void;
}

/** Pip, a small sheep astronaut with a lantern. */
export class Player {
	readonly root = new THREE.Group();
	readonly pos = new THREE.Vector3();
	readonly up = new THREE.Vector3(0, 1, 0);
	readonly vT = new THREE.Vector3(); // velocity along the ground
	vr = 0; // velocity away from the planet
	readonly facing = new THREE.Vector3(0, 0, 1);
	grounded = false;
	groundLevel = 0;
	height = 0; // above the ground of the planet sphere
	sparks = 3;
	invuln = 0;
	frozen = false;
	curled = 0; // 0..1 ball pose for flight
	lanternRaise = 0;
	readonly lanternWorld = new THREE.Vector3();

	private coyote = 0;
	private buffer = 0;
	private holdT = 0;
	private cut = false;
	private runPhase = 0;
	private lastStep = 0;
	private squash = 0; // + stretch, - squash
	private squashV = 0;
	private lean = new THREE.Vector2();
	private swing = new THREE.Vector2();
	private swingV = new THREE.Vector2();
	private prevVT = new THREE.Vector3();
	private blinkT = 2;

	private model = new THREE.Group();
	private body = new THREE.Group();
	private ears: THREE.Object3D[] = [];
	private scarfTail = new THREE.Group();
	private scarfSwing = 0;
	private beacon: THREE.Mesh;
	private lanternGlow: THREE.Sprite;
	private center = new THREE.Vector3();
	private time = 0;
	readonly shadow: THREE.Mesh;
	lanternOn = 1;
	private legs: THREE.Object3D[] = [];
	private head = new THREE.Group();
	private arm = new THREE.Group();
	private lantern = new THREE.Group();
	private lanternCore: THREE.Mesh;
	private eyes: THREE.Object3D[] = [];
	private targetQuat = new THREE.Quaternion();

	constructor() {
		// Pip is mostly seen from behind, so the back has to read on its own:
		// a bright suit, a wool head with curly horns, a star backpack, an antenna and a long scarf.
		const suit = toon('#ff6a4d', { rim: '#ffd0b8', rimK: 0.45, lantern: 0.25 });
		const suitDark = toon('#d94a3c', { rim: '#ffd0b8', rimK: 0.4, lantern: 0.25 });
		const wool = toon('#fbf4e6', { rim: '#fff3d0', rimK: 0.3, lantern: 0.12 });
		const woolShade = toon('#ece2cf', { rim: '#fff3d0', rimK: 0.3, lantern: 0.12 });
		const skin = toon('#4a3a5c', { rim: '#b9a6ff', rimK: 0.5, lantern: 0.3 });
		const snout = toon('#6b5880', { rim: '#b9a6ff', lantern: 0.3 });
		const teal = toon('#2fbfb8', { rim: '#c8fff6', rimK: 0.45, lantern: 0.25 });
		const gold = toon('#ffc93f', { rim: '#fff0b0', emissive: 0.12, lantern: 0.25 });
		const scarfMat = toon('#8b6cff', { rim: '#e0d6ff', rimK: 0.45, lantern: 0.25 });
		const horn = toon('#f2d29a', { rim: '#fff3d0', rimK: 0.35, lantern: 0.25 });
		const cream = toon('#fff3df', { rim: '#ffffff', lantern: 0.2 });
		const wood = toon('#8a5a3e', { lantern: 0.3 });
		const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
		const black = new THREE.MeshBasicMaterial({ color: '#16122a' });
		const blush = new THREE.MeshBasicMaterial({ color: '#ff9fb4', transparent: true, opacity: 0.75, depthWrite: false });
		const glass = toon('#d6f1ff', { opacity: 0.12, rim: '#e6f8ff', rimK: 1.3 });

		const sphere = (r: number, seg = 18) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7));
		const add = <T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x: number, y: number, z: number): T => {
			o.position.set(x, y, z);
			parent.add(o);
			return o;
		};

		this.model.scale.setScalar(1.4);
		this.root.add(this.model);
		this.model.add(this.body);

		// Suit: a round coral body with a cream belt
		const torso = add(this.body, inked(sphere(0.4, 24), suit), 0, 0.6, 0);
		torso.scale.set(1, 1.02, 0.92);
		const belt = add(this.body, inked(new THREE.TorusGeometry(0.385, 0.05, 8, 28), cream), 0, 0.5, 0);
		belt.rotation.x = Math.PI / 2;
		add(this.body, inked(new THREE.BoxGeometry(0.14, 0.11, 0.06), gold), 0, 0.5, 0.38);
		// Wool spills out of the collar and the tail
		for (let i = 0; i < 9; i++) {
			const a = (i / 9) * Math.PI * 2;
			add(this.body, inked(sphere(0.1, 12), i % 2 ? wool : woolShade), Math.sin(a) * 0.27, 0.93, Math.cos(a) * 0.25);
		}
		add(this.body, inked(sphere(0.12, 12), wool), 0, 0.36, -0.36);

		// Backpack: teal, with a big gold star on the back and two little thrusters
		const pack = add(this.body, inked(new THREE.CapsuleGeometry(0.2, 0.2, 4, 12), teal), 0, 0.68, -0.36);
		pack.scale.set(1.2, 1, 0.62);
		const star = add(this.body, inked(starGeometry(0.15, 0.065, 0.05), gold), 0, 0.7, -0.5);
		star.rotation.y = Math.PI;
		for (const sx of [1, -1]) {
			const n = add(this.body, inked(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 8), suitDark), 0.11 * sx, 0.36, -0.4);
			n.rotation.x = 0.2;
		}

		// Purple scarf with a long tail that streams behind
		const scarf = add(this.body, inked(new THREE.TorusGeometry(0.27, 0.06, 8, 22), scarfMat), 0, 0.98, 0.02);
		scarf.rotation.x = Math.PI / 2;
		this.scarfTail.position.set(0.24, 0.98, -0.16);
		this.body.add(this.scarfTail);
		add(this.scarfTail, inked(new THREE.BoxGeometry(0.13, 0.045, 0.3), scarfMat), 0, 0, -0.15);
		const tip = add(this.scarfTail, inked(new THREE.BoxGeometry(0.13, 0.045, 0.26), scarfMat), 0, -0.03, -0.4);
		tip.rotation.x = 0.25;

		// Head: big and round, on top, so it shows over the body from behind
		this.head.position.set(0, 1.24, 0.03);
		this.body.add(this.head);
		const face = add(this.head, inked(sphere(0.29, 22), skin), 0, 0, 0.02);
		face.scale.set(0.98, 0.95, 1);
		const muzzle = add(this.head, inked(sphere(0.16, 16), snout), 0, -0.09, 0.2);
		muzzle.scale.set(1.1, 0.75, 0.8);
		add(this.head, new THREE.Mesh(sphere(0.03, 8), black), 0.055, -0.05, 0.33);
		add(this.head, new THREE.Mesh(sphere(0.03, 8), black), -0.055, -0.05, 0.33);
		// Wool cap over the top and back of the head
		const cap: [number, number, number, number][] = [
			[0, 0.24, -0.02, 0.17], [0.15, 0.18, -0.06, 0.13], [-0.15, 0.18, -0.06, 0.13], [0, 0.13, -0.2, 0.16],
			[0.15, 0.03, -0.19, 0.12], [-0.15, 0.03, -0.19, 0.12], [0, -0.06, -0.22, 0.13], [0.09, 0.22, 0.12, 0.1], [-0.09, 0.22, 0.12, 0.1],
		];
		cap.forEach(([x, y, z, r], i) => add(this.head, inked(sphere(r, 14), i % 3 ? wool : woolShade), x, y, z));
		for (const sx of [1, -1]) {
			// Curly horns give Pip a shape you can spot from any side
			const h = add(this.head, inked(new THREE.TorusGeometry(0.12, 0.055, 8, 18, Math.PI * 1.6), horn), 0.33 * sx, 0.1, -0.08);
			h.rotation.set(0, (Math.PI / 2) * sx, 0.6);
			// Floppy ears below the horns
			const earPivot = add(this.head, new THREE.Group(), 0.24 * sx, -0.06, 0.08);
			const ear = add(earPivot, inked(sphere(0.1, 12), skin), 0.1 * sx, -0.02, 0);
			ear.scale.set(1.6, 0.55, 0.85);
			earPivot.rotation.z = -0.45 * sx;
			this.ears.push(earPivot);
			const eye = add(this.head, new THREE.Mesh(sphere(0.085, 14), white), 0.11 * sx, 0.05, 0.22);
			eye.scale.set(0.9, 1.1, 0.6);
			const pupil = add(eye, new THREE.Mesh(sphere(0.056, 12), black), 0, -0.005, 0.05);
			pupil.scale.z = 0.6;
			add(pupil, new THREE.Mesh(sphere(0.018, 6), white), 0.016, 0.022, 0.045);
			this.eyes.push(eye);
			const cheek = add(this.head, new THREE.Mesh(sphere(0.05, 8), blush), 0.19 * sx, -0.07, 0.19);
			cheek.scale.z = 0.3;
		}
		// Glass helmet, gold collar and an antenna with a beacon on top
		const helmet = new THREE.Mesh(sphere(0.5, 28), glass);
		helmet.position.set(0, 0.03, 0.02);
		helmet.renderOrder = 12;
		this.head.add(helmet);
		const collar = add(this.head, inked(new THREE.TorusGeometry(0.4, 0.06, 8, 26), gold), 0, -0.3, 0.02);
		collar.rotation.x = Math.PI / 2;
		add(this.head, inked(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 6), cream), 0.12, 0.62, -0.08).rotation.z = -0.2;
		this.beacon = add(this.head, inked(sphere(0.075, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a6e').multiplyScalar(1.5) })), 0.15, 0.78, -0.08);

		// Short legs with teal boots
		for (const x of [0.17, -0.17]) {
			const pivot = new THREE.Group();
			pivot.position.set(x, 0.3, 0);
			add(pivot, inked(new THREE.CapsuleGeometry(0.09, 0.1, 4, 10), suit), 0, -0.1, 0);
			const boot = add(pivot, inked(sphere(0.12, 14), teal), 0, -0.23, 0.03);
			boot.scale.set(1, 0.7, 1.3);
			this.body.add(pivot);
			this.legs.push(pivot);
		}

		// Left arm, a stubby wave
		const left = add(this.body, new THREE.Group(), -0.38, 0.74, 0.02);
		left.rotation.set(0.2, 0, 0.7);
		add(left, inked(new THREE.CapsuleGeometry(0.075, 0.14, 4, 8), suit), 0, -0.1, 0);
		add(left, inked(sphere(0.09, 12), cream), 0, -0.22, 0);

		// Right arm holds the lantern on a crook, out in front
		this.arm.position.set(0.38, 0.8, 0.06);
		this.body.add(this.arm);
		const upper = add(this.arm, inked(new THREE.CapsuleGeometry(0.075, 0.12, 4, 8), suit), 0.02, -0.06, 0.06);
		upper.rotation.x = 1.0;
		add(this.arm, inked(sphere(0.09, 12), cream), 0.03, -0.1, 0.17);
		const pole = add(this.arm, inked(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), wood), 0.03, 0.24, 0.26);
		pole.rotation.x = 0.35;
		const hook = add(this.arm, inked(new THREE.TorusGeometry(0.1, 0.028, 6, 12, Math.PI * 1.2), wood), 0.03, 0.66, 0.45);
		hook.rotation.y = Math.PI / 2;
		this.lantern.position.set(0.03, 0.6, 0.53);
		this.arm.add(this.lantern);
		add(this.lantern, inked(new THREE.ConeGeometry(0.15, 0.12, 8), gold), 0, -0.08, 0);
		this.lanternCore = new THREE.Mesh(sphere(0.09, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.6) }));
		this.lanternCore.position.y = -0.24;
		this.lantern.add(this.lanternCore);
		for (let i = 0; i < 4; i++) {
			const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
			add(this.lantern, new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.22, 4), black), Math.cos(a) * 0.12, -0.24, Math.sin(a) * 0.12);
		}
		add(this.lantern, inked(new THREE.CylinderGeometry(0.14, 0.11, 0.05, 8), gold), 0, -0.37, 0);
		this.lanternGlow = glowSprite('#ffb257', 0.9, 0.4);
		this.lanternGlow.position.y = -0.24;
		this.lantern.add(this.lanternGlow);

		// Silhouette that shows through walls, so Pip is never lost behind a tree.
		const xray = new THREE.MeshBasicMaterial({ color: '#7a6cff', depthFunc: THREE.GreaterDepth, depthWrite: false });
		const meshes: THREE.Mesh[] = [];
		this.model.traverse((o) => {
			if (o instanceof THREE.Mesh && o.name !== 'ink' && o !== helmet && !(o.material as THREE.Material).transparent) meshes.push(o);
		});
		for (const m of meshes) {
			m.renderOrder = 10;
			const mat = m.material as THREE.Material;
			mat.polygonOffset = true;
			mat.polygonOffsetFactor = -3;
			mat.polygonOffsetUnits = -3;
			const x = new THREE.Mesh(m.geometry, xray);
			x.renderOrder = 5;
			m.add(x);
			m.children.forEach((c) => c.name === 'ink' && (c.renderOrder = 10));
		}

		// Soft round shadow, the key cue for where a jump will land
		this.shadow = new THREE.Mesh(
			new THREE.CircleGeometry(0.62, 24).rotateX(-Math.PI / 2),
			new THREE.MeshBasicMaterial({ color: '#140f2a', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
		);
		this.shadow.renderOrder = 3;
	}

	/** Put Pip on a planet at a direction, standing still. */
	place(planet: Planet, dir: THREE.Vector3, facing?: THREE.Vector3): void {
		this.up.copy(dir).normalize();
		this.pos.copy(planet.center).addScaledVector(this.up, planet.R + SURFACE_LIFT);
		this.vT.set(0, 0, 0);
		this.vr = 0;
		this.grounded = true;
		this.height = SURFACE_LIFT;
		this.groundLevel = planet.R;
		if (facing) this.facing.copy(facing);
		this.facing.addScaledVector(this.up, -this.facing.dot(this.up));
		if (this.facing.lengthSq() < 1e-6) anyPerpendicular(this.up, this.facing);
		this.facing.normalize();
		basisQuat(this.up, this.facing, this.root.quaternion);
		this.root.position.copy(this.pos);
		this.prevVT.set(0, 0, 0);
		this.resetPose();
	}

	/** Local run/bounce/lean state — reset whenever Pip is placed or recovered from bad math. */
	private resetPose(): void {
		this.runPhase = 0;
		this.lastStep = 0;
		this.squash = 0;
		this.squashV = 0;
		this.lean.set(0, 0);
		this.swing.set(0, 0);
		this.swingV.set(0, 0);
		this.scarfSwing = 0;
		this.body.position.set(0, 0, 0);
		this.body.rotation.set(0, 0, 0);
		this.body.scale.set(1, 1, 1);
		this.head.rotation.set(0, 0, 0);
		this.arm.rotation.set(0, 0, 0);
		this.arm.position.set(0.38, 0.8, 0.06);
		this.lantern.rotation.set(0, 0, 0);
		for (const l of this.legs) l.rotation.set(0, 0, 0);
	}

	private saneVec(v: THREE.Vector3): boolean {
		return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
	}

	/** Snap Pip back to the surface if physics or animation produced NaN. */
	private recover(planet: Planet, dir: THREE.Vector3): void {
		this.up.copy(dir).normalize();
		this.pos.copy(planet.center).addScaledVector(this.up, planet.R + SURFACE_LIFT);
		this.vT.set(0, 0, 0);
		this.vr = 0;
		this.grounded = true;
		this.height = SURFACE_LIFT;
		projectKeepLength(this.facing, this.up);
		if (this.facing.lengthSq() < 1e-6) anyPerpendicular(this.up, this.facing);
		this.facing.normalize();
		this.prevVT.set(0, 0, 0);
		this.resetPose();
	}

	update(dt: number, planet: Planet, move: THREE.Vector3, jumpPressed: boolean, jumpHeld: boolean, ev: PlayerEvents): void {
		if (!Number.isFinite(dt) || dt <= 0) return;
		const c = planet.center;
		this.center.copy(c);
		if (!this.saneVec(this.pos) || !this.saneVec(this.up) || !this.saneVec(this.vT) || !Number.isFinite(this.vr)) {
			this.recover(planet, planet.landingDir);
		}
		this.invuln = Math.max(0, this.invuln - dt);
		_rel.copy(this.pos).sub(c);
		safeNormalize(this.up, _rel, planet.landingDir);

		if (!this.frozen) {
			// Ground speed
			projectKeepLength(this.vT, this.up);
			const want = move.clone().multiplyScalar(RUN_SPEED);
			const hasInput = move.lengthSq() > 0.0025;
			let accel = this.grounded ? planet.style.accel : AIR_ACCEL;
			if (!hasInput) accel = this.grounded ? planet.style.decel : 5;
			const diff = want.sub(this.vT);
			const dl = diff.length();
			const step = accel * dt;
			if (dl <= step) this.vT.add(diff);
			else this.vT.addScaledVector(diff, step / dl);

			// Jump with coyote time and a short input buffer
			this.coyote = this.grounded ? COYOTE : this.coyote - dt;
			this.buffer = jumpPressed ? BUFFER : this.buffer - dt;
			if (this.buffer > 0 && this.coyote > 0) {
				this.vr = JUMP_SPEED;
				this.grounded = false;
				this.coyote = 0;
				this.buffer = 0;
				this.holdT = 0;
				this.cut = false;
				this.squashV += 9;
				ev.jump();
			}
		}

		// Gravity, lighter while the jump is held
		let g = GRAVITY;
		if (this.vr > 0 && jumpHeld && this.holdT < HOLD_TIME && !this.cut) g *= HOLD_GRAVITY;
		this.holdT += dt;
		if (!jumpHeld && this.vr > 0 && !this.cut && this.holdT > 0.06) {
			this.vr *= 0.55;
			this.cut = true;
		}
		if (!this.grounded) this.vr = Math.max(-32, this.vr - g * dt);

		// Move
		this.pos.addScaledVector(this.vT, dt).addScaledVector(this.up, this.vr * dt);
		_rel.copy(this.pos).sub(c);
		safeNormalize(this.up, _rel, planet.landingDir);

		// Colliders
		const rel = this.pos.clone().sub(c);
		let ground = planet.R;
		for (const col of planet.colliders) {
			const along = rel.dot(col.dir);
			if (along < 0) continue;
			const perpV = rel.clone().addScaledVector(col.dir, -along);
			const perp = perpV.length();
			const reach = col.r + BODY_RADIUS;
			if (perp > reach + 0.5) continue;
			const h = along - planet.R;
			if (col.landable && perp < col.r + 0.12 && h >= col.top - 0.45 && this.vr <= 0.5) {
				ground = Math.max(ground, planet.R + col.top);
				continue;
			}
			if (perp < reach && h < col.top - 0.05) {
				const n = perp > 1e-4 ? perpV.multiplyScalar(1 / perp) : anyPerpendicular(col.dir);
				this.pos.addScaledVector(n, reach - perp);
				const into = this.vT.dot(n);
				if (into < 0) this.vT.addScaledVector(n, -into);
				rel.copy(this.pos).sub(c);
			}
		}
		this.groundLevel = ground;
		const dist = rel.length();
		safeNormalize(this.up, rel, planet.landingDir);

		if (this.vr <= 0 && dist <= ground + (this.grounded ? 0.3 : 0.001)) {
			if (!this.grounded) {
				ev.land(-this.vr);
				this.squashV -= Math.min(14, -this.vr * 0.9);
			}
			this.grounded = true;
			this.vr = 0;
			this.pos.copy(c).addScaledVector(this.up, ground + SURFACE_LIFT);
		} else if (this.grounded && dist > ground + 0.3) {
			this.grounded = false;
		} else if (this.vr > 0) {
			this.grounded = false;
		}
		this.height = Math.max(0, this.pos.distanceTo(c) - planet.R);

		// Facing follows the ground speed
		projectKeepLength(this.facing, this.up);
		if (this.facing.lengthSq() < 1e-6) anyPerpendicular(this.up, this.facing);
		this.facing.normalize();
		if (!this.saneVec(this.vT)) this.vT.set(0, 0, 0);
		const speed = this.vT.length();
		if (speed > 0.4 && !this.frozen) {
			const want = this.vT.clone().normalize();
			this.facing.lerp(want, damp(14, dt)).normalize();
		}

		if (!this.saneVec(this.pos) || !this.saneVec(this.up)) {
			this.recover(planet, planet.landingDir);
		}
		this.animate(dt, speed, ev);
	}

	private animate(dt: number, speed: number, ev: PlayerEvents): void {
		if (!Number.isFinite(this.runPhase) || !Number.isFinite(this.lean.x) || !Number.isFinite(this.lean.y)) this.resetPose();
		const spd = Number.isFinite(speed) ? speed : 0;
		basisQuat(this.up, this.facing, this.targetQuat);
		this.root.quaternion.slerp(this.targetQuat, damp(20, dt));
		this.root.position.copy(this.pos);

		// Squash and stretch spring
		this.squashV += (-this.squash * 220 - this.squashV * 16) * dt;
		this.squash += this.squashV * dt;
		const sq = clamp(this.squash * 0.04, -0.25, 0.22);
		const cur = this.curled;
		this.body.scale.set(1 - sq * 0.5 + cur * 0.05, 1 + sq - cur * 0.15, 1 - sq * 0.5 + cur * 0.05);

		// Run cycle
		const runK = this.grounded ? clamp(spd / 6, 0, 1) : 0;
		this.runPhase += dt * (4 + spd * 2.0) * (this.grounded ? 1 : 0.3);
		const s = Math.sin(this.runPhase);
		this.legs.forEach((l, i) => {
			const side = i === 0 || i === 3 ? 1 : -1;
			const airPose = this.grounded ? 0 : (i < 2 ? -0.6 : 0.6);
			l.rotation.x = s * side * 0.9 * runK + airPose * (1 - cur) + cur * (i < 2 ? -1.2 : 1.2);
		});
		this.body.position.y = Math.abs(Math.cos(this.runPhase)) * 0.08 * runK;
		if (this.grounded && runK > 0.2) {
			const st = Math.floor(this.runPhase / Math.PI);
			if (st !== this.lastStep) {
				this.lastStep = st;
				ev.step();
			}
		}

		// Lean into acceleration (in Pip's own frame)
		const acc = this.vT.clone().sub(this.prevVT).divideScalar(Math.max(dt, 1e-4));
		this.prevVT.copy(this.vT);
		const right = new THREE.Vector3().crossVectors(this.up, this.facing);
		const af = acc.dot(this.facing);
		const ar = acc.dot(right);
		this.lean.x += (clamp(af * 0.012, -0.18, 0.18) + runK * 0.08 - this.lean.x) * damp(10, dt);
		this.lean.y += (clamp(-ar * 0.01, -0.2, 0.2) - this.lean.y) * damp(10, dt);
		this.body.rotation.x = this.lean.x + cur * 0.3;
		this.body.rotation.z = this.lean.y;

		// Lantern swings like a pendulum
		this.swingV.x += (-this.swing.x * 60 - this.swingV.x * 5 - af * 0.08) * dt;
		this.swingV.y += (-this.swing.y * 60 - this.swingV.y * 5 + ar * 0.08) * dt;
		this.swing.x += this.swingV.x * dt;
		this.swing.y += this.swingV.y * dt;
		this.swing.x = clamp(this.swing.x, -0.8, 0.8);
		this.swing.y = clamp(this.swing.y, -0.8, 0.8);
		this.lantern.rotation.x = this.swing.x;
		this.lantern.rotation.z = this.swing.y;
		this.arm.rotation.x = -this.lanternRaise * 1.4;
		this.arm.position.y = 0.8 + this.lanternRaise * 0.25;
		this.head.rotation.x = -runK * 0.1 + (this.grounded ? 0 : -0.15) - this.lanternRaise * 0.4;

		// Blink
		this.blinkT -= dt;
		const blink = this.blinkT < 0.12;
		if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
		for (const e of this.eyes) e.scale.y = blink ? 0.15 : 1;

		// Ears flop with the bounce, the scarf trails behind.
		this.time += dt;
		const flop = clamp(-this.squashV * 0.02, -0.4, 0.4) + (this.grounded ? 0 : 0.25) + s * 0.08 * runK;
		this.ears.forEach((e, i) => (e.rotation.z = (i === 0 ? -1 : 1) * (0.45 - flop)));
		const wantSwing = clamp(spd / 6, 0, 1) * 0.9 + (this.grounded ? 0 : clamp(-this.vr * 0.05, -0.5, 0.6));
		this.scarfSwing += (wantSwing - this.scarfSwing) * damp(6, dt);
		this.scarfTail.rotation.x = -this.scarfSwing * 0.9 + Math.sin(this.time * 14) * 0.12 * this.scarfSwing - 0.5;
		this.scarfTail.rotation.y = Math.sin(this.time * 9) * 0.15 * this.scarfSwing;
		this.beacon.visible = Math.sin(this.time * 3) > -0.4;

		// Lantern glow breathes a little
		const on = this.lanternOn;
		this.lanternGlow.visible = on > 0.05;
		this.lanternGlow.scale.setScalar((0.9 + Math.sin(this.time * 3.1) * 0.06) * on);

		// Hurt blink
		this.root.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0;
		this.lanternCore.getWorldPosition(this.lanternWorld);

		// Shadow on the ground below
		const above = Math.max(0, this.pos.distanceTo(this.center) - this.groundLevel);
		const k = clamp(1 - above / 7, 0.25, 1);
		this.shadow.position.copy(this.center).addScaledVector(this.up, this.groundLevel + 0.03);
		this.shadow.quaternion.setFromUnitVectors(_Y, this.up);
		this.shadow.scale.setScalar(k * (1 - this.curled * 0.4));
		(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.42 * k;
		this.shadow.visible = this.curled < 0.5;
	}

	/** Spring kick for landings from outside, like a bounce. */
	kick(v: number): void {
		this.squashV += v;
	}

	/** Push Pip away from a hazard. */
	knock(away: THREE.Vector3, up: number, speed: number): void {
		const t = away.clone().addScaledVector(this.up, -away.dot(this.up));
		if (t.lengthSq() < 1e-6) anyPerpendicular(this.up, t);
		safeNormalize(t, t, this.facing);
		this.vT.copy(t).multiplyScalar(speed);
		this.vr = up;
		this.grounded = false;
		this.cut = true;
	}

	launchUp(v: number): void {
		this.vr = v;
		this.grounded = false;
		this.holdT = 0;
		this.cut = false;
		this.coyote = 0;
		this.squashV += 14;
	}

	setLantern(on: number): void {
		this.lanternOn = on;
	}
}

/** A flat five-point star, extruded a little, facing +Z. */
function starGeometry(outer: number, inner: number, depth: number): THREE.BufferGeometry {
	const s = new THREE.Shape();
	for (let i = 0; i < 10; i++) {
		const r = i % 2 ? inner : outer;
		const a = (i / 10) * Math.PI * 2;
		const x = Math.sin(a) * r;
		const y = Math.cos(a) * r;
		if (i === 0) s.moveTo(x, y);
		else s.lineTo(x, y);
	}
	s.closePath();
	const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
	g.translate(0, 0, -depth / 2);
	return g;
}
