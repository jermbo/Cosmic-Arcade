import RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../config.ts';
import type { VehicleKind } from '../config.ts';
import type { LevelDef } from '../levels/types.ts';
import { lanePlace, makeLanePath } from './lanes.ts';
import type { LanePath, LanePlace } from './lanes.ts';
import { hashText, makeRng } from './rng.ts';

/**
 * The rules of one run, with no drawing and no sound.
 * Each step takes one input and gives the same result for the same inputs,
 * so a replay is only the list of inputs.
 */

export type EntityKind = 'player' | VehicleKind | 'barrel';
export type EntityState = 'driving' | 'parked' | 'wrecked' | 'gone';
export type Phase = 'aim' | 'approach' | 'crash' | 'done';
export type BlastSource = 'barrel' | 'tanker' | 'breaker';
export type LightColor = 'green' | 'amber' | 'red';

export interface Entity {
	id: number;
	kind: EntityKind;
	state: EntityState;
	body: RAPIER.RigidBody;
	collider: RAPIER.Collider;
	size: [number, number, number];
	mass: number;
	lane: number;
	s: number;
	speed: number;
	yaw: number;
	/** Where the body is now, and where it was one step before. The view blends the two. */
	pos: Float32Array;
	quat: Float32Array;
	prevPos: Float32Array;
	prevQuat: Float32Array;
	speedBefore: number;
	lastPaid: number;
	lastFx: number;
	fuse: number;
	exploded: boolean;
	/** A number from 0 to 1 that picks the paint of the vehicle. */
	paint: number;
}

export interface StepInput {
	/** Aim offset in degrees, used in the aim phase. */
	aim: number;
	launch: boolean;
	/** Steering in the drive in, from -1 to 1. */
	steer: number;
	/** Aftertouch push on the ground plane, each from -1 to 1. */
	nx: number;
	nz: number;
	breaker: boolean;
}

export type SimEvent =
	| { type: 'launch' }
	| { type: 'firstHit'; x: number; y: number; z: number }
	| { type: 'wreck'; id: number; x: number; y: number; z: number; money: number; mult: number; bonus: boolean; label: string }
	| { type: 'impact'; x: number; y: number; z: number; force: number; big: boolean; money: number }
	| { type: 'blast'; x: number; y: number; z: number; radius: number; source: BlastSource; money: number; label: string }
	| { type: 'chainBreak'; chain: number }
	| { type: 'end' };

const GROUP_STATIC = 0x0001;
const GROUP_DRIVE = 0x0002;
const GROUP_FREE = 0x0004;
const GROUPS_STATIC = (GROUP_STATIC << 16) | 0xffff;
const GROUPS_DRIVE = (GROUP_DRIVE << 16) | GROUP_STATIC | GROUP_FREE;
const GROUPS_FREE = (GROUP_FREE << 16) | 0xffff;

const DEG = Math.PI / 180;
const FORCE_EVENT_FLOOR = 6;

interface Contact {
	a: Entity | undefined;
	b: Entity | undefined;
	ground: boolean;
	force: number;
}

export function initPhysics(): Promise<void> {
	return RAPIER.init();
}

export class Sim {
	readonly level: LevelDef;
	readonly entities: Entity[] = [];
	readonly player: Entity;
	readonly lanes: LanePath[];
	events: SimEvent[] = [];

	phase: Phase = 'aim';
	/** Steps since the sim began, with the aim phase. */
	clock = 0;
	/** Seconds since the launch. */
	time = 0;
	aim = 0;
	heading: number;
	money = 0;
	chain = 0;
	bestChain = 0;
	chainTimer = 0;
	wrecks = 0;
	bonus = { bus: 0, tanker: 0, barrel: 0 };
	meter = CONFIG.aftertouch.meter;
	aftertouchActive = false;
	breakerUsed = false;
	/** Seconds until the run ends for lack of hits, or -1 when no countdown runs. */
	settleLeft = -1;

	private world: RAPIER.World;
	private queue: RAPIER.EventQueue;
	private byCollider = new Map<number, Entity>();
	private groundHandle: number;
	private contacts: Contact[] = [];
	private rng: () => number;
	private lastHitTime = 0;
	private approachSpeed = 0;
	private place: LanePlace = { x: 0, z: 0, dx: 0, dz: 1 };

	constructor(level: LevelDef) {
		this.level = level;
		this.rng = makeRng(hashText(level.id));
		this.world = new RAPIER.World({ x: 0, y: CONFIG.physics.gravity, z: 0 });
		this.world.timestep = CONFIG.physics.step;
		this.queue = new RAPIER.EventQueue(true);
		this.heading = level.launch.heading;

		const ground = this.world.createCollider(
			RAPIER.ColliderDesc.cuboid(500, 1, 500).setTranslation(0, -1, 0).setFriction(0.9).setCollisionGroups(GROUPS_STATIC),
		);
		this.groundHandle = ground.handle;

		for (const b of level.buildings) {
			this.world.createCollider(
				RAPIER.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2)
					.setTranslation(b.at[0], b.size[1] / 2, b.at[1])
					.setRotation(yawQuat((b.heading ?? 0) * DEG))
					.setFriction(0.6)
					.setCollisionGroups(GROUPS_STATIC),
			);
		}

		this.lanes = level.lanes.map(makeLanePath);
		this.lanes.forEach((lane, index) => {
			const count = lane.def.vehicles.length;
			if (count === 0) return;
			const gap = lane.length / count;
			lane.def.vehicles.forEach((kind, i) => {
				const s = (i + (lane.def.offset ?? 0.5)) * gap;
				lanePlace(lane, s, this.place);
				const e = this.addVehicle(kind, this.place.x, this.place.z, Math.atan2(this.place.dx, this.place.dz), 'driving');
				e.lane = index;
				e.s = s % lane.length;
				e.speed = lane.def.speed;
			});
		});

		for (const p of level.parked ?? []) this.addVehicle(p.kind, p.at[0], p.at[1], p.heading * DEG, 'parked');
		for (const b of level.barrels ?? []) this.addBarrel(b[0], b[1]);

		const [w, h, l] = CONFIG.player.size;
		this.player = this.addBody('player', [w, h, l], CONFIG.player.mass, level.launch.at[0], level.launch.at[1], this.heading * DEG, 'parked');
		this.player.body.enableCcd(true);
		this.player.body.setEnabledRotations(false, false, false, true);
	}

	free(): void {
		this.queue.free();
		this.world.free();
	}

	/** The colour of the lights of one group now. */
	lightColor(phase: 0 | 1): LightColor {
		const lights = this.level.lights;
		if (!lights) return 'green';
		const half = lights.green + lights.clear;
		const t = (this.clock * CONFIG.physics.step) % (half * 2);
		const local = phase === 0 ? t : (t + half) % (half * 2);
		if (local < lights.green) return 'green';
		if (local < lights.green + Math.min(1, lights.clear * 0.5)) return 'amber';
		return 'red';
	}

	step(input: StepInput): void {
		const dt = CONFIG.physics.step;
		this.clock++;
		this.aftertouchActive = false;

		if (this.phase === 'aim') {
			const arc = this.level.launch.arc;
			this.aim = Math.max(-arc, Math.min(arc, input.aim));
			if (input.launch) {
				this.phase = 'approach';
				this.heading = this.level.launch.heading + this.aim;
				this.time = 0;
				this.events.push({ type: 'launch' });
			}
		} else if (this.phase !== 'done') {
			this.time += dt;
		}

		if (this.phase === 'approach') this.driveIn(input, dt);
		if (this.phase === 'crash') this.afterCrashInput(input, dt);

		this.driveTraffic(dt);

		for (const e of this.entities) {
			if (e.state === 'gone') continue;
			const v = e.body.linvel();
			e.speedBefore = Math.hypot(v.x, v.y, v.z);
		}

		this.world.step(this.queue);
		this.readContacts();
		this.burnFuses(dt);
		this.readBodies();
		this.runClock(dt);
	}

	private addVehicle(kind: VehicleKind, x: number, z: number, yaw: number, state: EntityState): Entity {
		const spec = CONFIG.vehicles[kind];
		return this.addBody(kind, spec.size, spec.mass, x, z, yaw, state);
	}

	private addBody(kind: EntityKind, size: [number, number, number], mass: number, x: number, z: number, yaw: number, state: EntityState): Entity {
		const y = size[1] / 2 + 0.25;
		const body = this.world.createRigidBody(
			RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(yawQuat(yaw)).setLinearDamping(0.05).setAngularDamping(0.3),
		);
		const collider = this.world.createCollider(
			RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
				.setMass(mass)
				.setFriction(CONFIG.physics.friction)
				.setRestitution(CONFIG.physics.restitution)
				.setCollisionGroups(state === 'driving' ? GROUPS_DRIVE : GROUPS_FREE)
				.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
				.setContactForceEventThreshold(FORCE_EVENT_FLOOR),
			body,
		);
		if (state === 'driving') body.setEnabledRotations(false, false, false, true);
		return this.register(kind, state, body, collider, size, mass, yaw);
	}

	private addBarrel(x: number, z: number): Entity {
		const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.62, z).setAngularDamping(0.8).setLinearDamping(0.3));
		const collider = this.world.createCollider(
			RAPIER.ColliderDesc.cylinder(0.6, 0.42)
				.setMass(CONFIG.barrel.mass)
				.setFriction(0.7)
				.setCollisionGroups(GROUPS_FREE)
				.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
				.setContactForceEventThreshold(FORCE_EVENT_FLOOR),
			body,
		);
		return this.register('barrel', 'parked', body, collider, [0.84, 1.2, 0.84], CONFIG.barrel.mass, 0);
	}

	private register(kind: EntityKind, state: EntityState, body: RAPIER.RigidBody, collider: RAPIER.Collider, size: [number, number, number], mass: number, yaw: number): Entity {
		const t = body.translation();
		const r = body.rotation();
		const e: Entity = {
			id: this.entities.length,
			kind,
			state,
			body,
			collider,
			size,
			mass,
			lane: -1,
			s: 0,
			speed: 0,
			yaw,
			pos: new Float32Array([t.x, t.y, t.z]),
			quat: new Float32Array([r.x, r.y, r.z, r.w]),
			prevPos: new Float32Array([t.x, t.y, t.z]),
			prevQuat: new Float32Array([r.x, r.y, r.z, r.w]),
			speedBefore: 0,
			lastPaid: -10,
			lastFx: -10,
			fuse: -1,
			exploded: false,
			paint: this.rng(),
		};
		this.entities.push(e);
		this.byCollider.set(collider.handle, e);
		return e;
	}

	private driveIn(input: StepInput, dt: number): void {
		const body = this.player.body;
		this.heading += Math.max(-1, Math.min(1, input.steer)) * CONFIG.player.steerRate * dt;
		this.approachSpeed = Math.min(this.level.launch.speed, this.approachSpeed + CONFIG.player.launchAccel * dt);
		const yaw = this.heading * DEG;
		const v = body.linvel();
		body.setLinvel({ x: Math.sin(yaw) * this.approachSpeed, y: v.y, z: Math.cos(yaw) * this.approachSpeed }, true);
		body.setRotation(yawQuat(yaw), true);
		if (this.time > CONFIG.player.approachMaxTime) this.startCrash(false);
	}

	private startCrash(hit: boolean): void {
		if (this.phase !== 'approach') return;
		this.phase = 'crash';
		this.lastHitTime = this.time;
		const body = this.player.body;
		body.setEnabledRotations(true, true, true, true);
		body.setLinearDamping(CONFIG.physics.wreckLinearDamping);
		body.setAngularDamping(CONFIG.physics.wreckAngularDamping);
		if (hit) this.events.push({ type: 'firstHit', x: this.player.pos[0], y: this.player.pos[1], z: this.player.pos[2] });
	}

	private afterCrashInput(input: StepInput, dt: number): void {
		const body = this.player.body;
		const strength = Math.hypot(input.nx, input.nz);
		if (strength > 0.05 && this.meter > 0) {
			const scale = Math.min(1, strength) / strength;
			const push = CONFIG.aftertouch.accel * this.player.mass * dt;
			body.applyImpulse({ x: input.nx * scale * push, y: 0, z: input.nz * scale * push }, true);
			body.applyTorqueImpulse({ x: 0, y: input.nx * scale * CONFIG.aftertouch.spin * dt * this.player.mass, z: 0 }, true);
			this.meter = Math.max(0, this.meter - dt / CONFIG.aftertouch.timeScale);
			this.aftertouchActive = true;
		}
		if (input.breaker && !this.breakerUsed) {
			this.breakerUsed = true;
			const p = body.translation();
			const v = body.linvel();
			body.setLinvel({ x: v.x * 0.4, y: Math.max(v.y, 0) + CONFIG.breaker.selfJump, z: v.z * 0.4 }, true);
			body.applyTorqueImpulse({ x: (this.rng() - 0.5) * 40, y: (this.rng() - 0.5) * 40, z: (this.rng() - 0.5) * 40 }, true);
			this.blast(p.x, p.y, p.z, CONFIG.breaker, 'breaker', this.player);
		}
	}

	private driveTraffic(dt: number): void {
		const tuning = CONFIG.traffic;
		const crashed = this.phase === 'crash' || this.phase === 'done';
		for (const e of this.entities) {
			if (e.state !== 'driving') continue;
			const lane = this.lanes[e.lane];
			const def = lane.def;
			let allowed = def.speed;

			if (def.phase !== undefined && def.stopAt !== undefined && this.lightColor(def.phase) !== 'green') {
				const d = def.stopAt - (e.s + e.size[2] / 2);
				const canStop = (e.speed * e.speed) / (2 * tuning.brake) <= d + 1;
				if (d > -0.5 && canStop) allowed = Math.min(allowed, Math.sqrt(2 * tuning.brake * Math.max(0, d - 0.3)));
			}

			for (const other of this.entities) {
				if (other === e || other.lane !== e.lane || other.state !== 'driving') continue;
				let ahead = other.s - e.s;
				if (def.loop && ahead < 0) ahead += lane.length;
				if (ahead <= 0) continue;
				const gap = ahead - (other.size[2] + e.size[2]) / 2;
				allowed = Math.min(allowed, Math.sqrt(2 * tuning.brake * Math.max(0, gap - tuning.minGap)) + other.speed * 0.5);
			}

			e.speed = e.speed > allowed ? allowed : Math.min(allowed, e.speed + tuning.accel * dt);
			e.s += e.speed * dt;

			let jumped = false;
			if (e.s >= lane.length) {
				if (def.loop) {
					e.s -= lane.length;
				} else if (!crashed) {
					e.s -= lane.length;
					jumped = true;
				} else {
					this.remove(e);
					continue;
				}
			}

			lanePlace(lane, e.s, this.place);
			const target = Math.atan2(this.place.dx, this.place.dz);
			let turn = target - e.yaw;
			while (turn > Math.PI) turn -= Math.PI * 2;
			while (turn < -Math.PI) turn += Math.PI * 2;
			e.yaw += Math.max(-3 * dt, Math.min(3 * dt, turn));

			const body = e.body;
			if (jumped) {
				e.yaw = target;
				body.setTranslation({ x: this.place.x, y: e.size[1] / 2 + 0.05, z: this.place.z }, true);
				e.prevPos[0] = Number.NaN;
			}
			const p = body.translation();
			const v = body.linvel();
			body.setLinvel(
				{
					x: this.place.dx * e.speed + (this.place.x - p.x) * tuning.laneHold,
					y: v.y,
					z: this.place.dz * e.speed + (this.place.z - p.z) * tuning.laneHold,
				},
				true,
			);
			body.setRotation(yawQuat(e.yaw), true);
		}
	}

	private readContacts(): void {
		this.contacts.length = 0;
		this.queue.drainContactForceEvents((event) => {
			const h1 = event.collider1();
			const h2 = event.collider2();
			this.contacts.push({
				a: this.byCollider.get(h1),
				b: this.byCollider.get(h2),
				ground: h1 === this.groundHandle || h2 === this.groundHandle,
				force: event.totalForceMagnitude(),
			});
		});
		if (this.phase === 'aim' || this.phase === 'done') return;

		for (const c of this.contacts) {
			if (c.ground) continue;
			const a = c.a ?? c.b;
			const b = c.a ? c.b : undefined;
			if (!a || a.state === 'gone' || b?.state === 'gone') continue;

			if (this.phase === 'approach' && (a === this.player || b === this.player) && c.force > CONFIG.damage.playerHitForce) {
				this.startCrash(true);
			}

			const speed = Math.max(a.speedBefore, b ? b.speedBefore : 0);
			const wasWreckedA = a.state === 'wrecked';
			const wasWreckedB = b?.state === 'wrecked';
			const paid = this.hit(a, b, c.force, speed) + (b ? this.hit(b, a, c.force, speed) : 0);

			const first = !wasWreckedA || (b !== undefined && !wasWreckedB);
			const hard = c.force > CONFIG.damage.wreckForce && speed > 3;
			if ((first || hard) && this.time - a.lastFx > 0.1) {
				a.lastFx = this.time;
				if (b) b.lastFx = this.time;
				const x = b ? (a.pos[0] + b.pos[0]) / 2 : a.pos[0];
				const y = b ? (a.pos[1] + b.pos[1]) / 2 : a.pos[1];
				const z = b ? (a.pos[2] + b.pos[2]) / 2 : a.pos[2];
				this.events.push({ type: 'impact', x, y, z, force: c.force, big: c.force > CONFIG.damage.bigForce, money: paid });
			}
		}
	}

	/** Works out what one contact does to the entity `e`. Returns extra money that it paid. */
	private hit(e: Entity, other: Entity | undefined, force: number, speed: number): number {
		const damage = CONFIG.damage;
		if (e.kind === 'barrel') {
			if (!e.exploded && e.fuse < 0 && force > damage.barrelForce && speed > 2) e.fuse = 0;
			return 0;
		}
		if (e.kind === 'player') return 0;

		if (e.state === 'driving') {
			if (other) this.wreck(e);
			return 0;
		}
		if (e.state === 'parked') {
			if (force > damage.wreckForce && speed > 1.5) this.wreck(e);
			return 0;
		}
		if (force > damage.wreckForce * 2 && speed > 4 && this.time - e.lastPaid > damage.impactCooldown) {
			e.lastPaid = this.time;
			this.lastHitTime = this.time;
			const money = roundMoney(Math.min(damage.impactMoneyMax, force * damage.impactMoneyPerForce) * this.multiplier());
			this.money += money;
			return money;
		}
		return 0;
	}

	multiplier(): number {
		return Math.max(1, Math.min(CONFIG.score.maxMultiplier, this.chain));
	}

	private addToChain(): void {
		this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
		this.chainTimer = CONFIG.score.chainWindow;
		this.bestChain = Math.max(this.bestChain, this.chain);
		this.lastHitTime = this.time;
	}

	private wreck(e: Entity): void {
		if (e.state !== 'driving' && e.state !== 'parked') return;
		if (e.kind === 'player' || e.kind === 'barrel') return;
		e.state = 'wrecked';
		e.lastPaid = this.time;
		e.collider.setCollisionGroups(GROUPS_FREE);
		e.body.setEnabledRotations(true, true, true, true);
		e.body.setLinearDamping(CONFIG.physics.wreckLinearDamping);
		e.body.setAngularDamping(CONFIG.physics.wreckAngularDamping);

		const spec = CONFIG.vehicles[e.kind];
		this.addToChain();
		const mult = this.multiplier();
		const money = roundMoney(spec.value * mult);
		this.money += money;
		this.wrecks++;
		if (e.kind === 'bus') this.bonus.bus++;
		if (e.kind === 'tanker') this.bonus.tanker++;
		if (spec.explodes && e.fuse < 0) e.fuse = CONFIG.tanker.fuse;
		this.events.push({ type: 'wreck', id: e.id, x: e.pos[0], y: e.pos[1], z: e.pos[2], money, mult, bonus: spec.bonus, label: spec.label });
	}

	private burnFuses(dt: number): void {
		for (const e of this.entities) {
			if (e.fuse < 0 || e.exploded || e.state === 'gone') continue;
			e.fuse -= dt;
			if (e.fuse > 0) continue;
			e.exploded = true;
			const p = e.body.translation();
			if (e.kind === 'barrel') {
				this.remove(e);
				this.blast(p.x, p.y, p.z, CONFIG.barrel, 'barrel', e);
			} else {
				e.body.applyImpulse({ x: 0, y: e.mass * 9, z: 0 }, true);
				e.body.applyTorqueImpulse({ x: (this.rng() - 0.5) * 120, y: (this.rng() - 0.5) * 60, z: (this.rng() - 0.5) * 120 }, true);
				this.blast(p.x, p.y, p.z, CONFIG.tanker, 'tanker', e);
			}
		}
	}

	private blast(x: number, y: number, z: number, spec: { radius: number; impulse: number; lift: number }, source: BlastSource, origin: Entity): void {
		let thrown = 0;
		for (const e of this.entities) {
			if (e === origin || e.state === 'gone') continue;
			const p = e.body.translation();
			let dx = p.x - x;
			let dz = p.z - z;
			const flat = Math.hypot(dx, dz);
			const d = Math.hypot(flat, p.y - y);
			if (d > spec.radius + e.size[2] / 2) continue;

			if (e.kind === 'barrel') {
				if (!e.exploded && e.fuse < 0) e.fuse = CONFIG.barrel.fuseBase + d * CONFIG.barrel.fusePerMetre;
			} else if (e.kind !== 'player') {
				if (e.state !== 'wrecked') this.wreck(e);
				if (CONFIG.vehicles[e.kind].explodes && !e.exploded) e.fuse = e.fuse < 0 ? CONFIG.tanker.fuse * 0.6 : Math.min(e.fuse, CONFIG.tanker.fuse * 0.6);
				thrown++;
			}

			if (flat > 0.01) {
				dx /= flat;
				dz /= flat;
			} else {
				const angle = this.rng() * Math.PI * 2;
				dx = Math.cos(angle);
				dz = Math.sin(angle);
			}
			const falloff = 0.3 + 0.7 * Math.max(0, 1 - d / spec.radius);
			const j = spec.impulse * falloff * Math.sqrt(e.mass);
			e.body.applyImpulse({ x: dx * j, y: spec.lift * j, z: dz * j }, true);
			const spin = j * 1.2;
			e.body.applyTorqueImpulse({ x: (this.rng() - 0.5) * spin, y: (this.rng() - 0.5) * spin, z: (this.rng() - 0.5) * spin }, true);
		}

		let money = 0;
		let label = 'Crashbreaker';
		if (source === 'barrel') {
			this.addToChain();
			this.bonus.barrel++;
			money = roundMoney(CONFIG.score.barrelValue * this.multiplier());
			label = 'Barrel';
		} else if (source === 'breaker') {
			money = roundMoney(CONFIG.score.breakerBonus * thrown * this.multiplier());
		} else {
			label = 'Tanker blast';
			money = roundMoney(CONFIG.score.breakerBonus * thrown * this.multiplier());
		}
		this.money += money;
		this.lastHitTime = this.time;
		this.events.push({ type: 'blast', x, y, z, radius: spec.radius, source, money, label });
	}

	private remove(e: Entity): void {
		e.state = 'gone';
		e.body.setEnabled(false);
	}

	private readBodies(): void {
		for (const e of this.entities) {
			if (e.state === 'gone') continue;
			const jumped = Number.isNaN(e.prevPos[0]);
			if (!jumped) {
				e.prevPos.set(e.pos);
				e.prevQuat.set(e.quat);
			}
			const t = e.body.translation();
			const r = e.body.rotation();
			e.pos[0] = t.x;
			e.pos[1] = t.y;
			e.pos[2] = t.z;
			e.quat[0] = r.x;
			e.quat[1] = r.y;
			e.quat[2] = r.z;
			e.quat[3] = r.w;
			if (jumped) {
				e.prevPos.set(e.pos);
				e.prevQuat.set(e.quat);
			}
			if (t.y < CONFIG.run.killY && e !== this.player) this.remove(e);
		}
	}

	private runClock(dt: number): void {
		if (this.phase !== 'approach' && this.phase !== 'crash') return;

		if (this.chainTimer > 0) {
			this.chainTimer -= dt;
			if (this.chainTimer <= 0) {
				this.chainTimer = 0;
				if (this.chain > 1) this.events.push({ type: 'chainBreak', chain: this.chain });
				this.chain = 0;
			}
		}

		this.settleLeft = -1;
		let over = this.time >= this.level.timeLimit;
		if (this.phase === 'crash') {
			const quiet = this.time - this.lastHitTime;
			const run = CONFIG.run;
			if (quiet > run.settleTime - run.settleWarn && !this.trafficIncoming() && !this.fuseBurning()) {
				this.settleLeft = Math.max(0, run.settleTime - quiet);
				if (quiet >= run.settleTime) over = true;
			}
		}
		if (over) {
			this.phase = 'done';
			this.settleLeft = -1;
			this.events.push({ type: 'end' });
		}
	}

	private fuseBurning(): boolean {
		return this.entities.some((e) => e.fuse >= 0 && !e.exploded && e.state !== 'gone');
	}

	/** True when a vehicle that still drives has a wreck on its lane, close ahead. */
	private trafficIncoming(): boolean {
		const wrecks = this.entities.filter((e) => e.state === 'wrecked' || e === this.player);
		for (const e of this.entities) {
			if (e.state !== 'driving') continue;
			const lane = this.lanes[e.lane];
			for (let ahead = 3; ahead <= 48; ahead += 3) {
				const s = e.s + ahead;
				if (!lane.def.loop && s > lane.length) break;
				lanePlace(lane, s, this.place);
				for (const w of wrecks) {
					if (Math.abs(w.pos[0] - this.place.x) < 3.2 && Math.abs(w.pos[2] - this.place.z) < 3.2 && w.pos[1] < 5) return true;
				}
			}
		}
		return false;
	}
}

function yawQuat(yaw: number): { x: number; y: number; z: number; w: number } {
	return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

function roundMoney(value: number): number {
	return Math.round(value / 10) * 10;
}
