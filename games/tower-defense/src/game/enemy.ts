import * as THREE from 'three';
import { model, ownMaterials } from '../assets';
import { ELITE, type EnemyDef } from '../data/enemies';
import { TOP, type Route } from './board';

const barGeometry = new THREE.PlaneGeometry(1, 1);
const barBack = new THREE.MeshBasicMaterial({ color: 0x1d1a33, depthTest: false, transparent: true, opacity: 0.85 });
const barColors = {
	high: new THREE.MeshBasicMaterial({ color: 0x7ee081, depthTest: false, transparent: true }),
	mid: new THREE.MeshBasicMaterial({ color: 0xffd04d, depthTest: false, transparent: true }),
	low: new THREE.MeshBasicMaterial({ color: 0xff5d5d, depthTest: false, transparent: true }),
};

let nextId = 1;

export class Enemy {
	readonly id = nextId++;
	readonly def: EnemyDef;
	readonly elite: boolean;
	readonly wave: number;
	readonly route: Route;
	readonly object = new THREE.Group();
	readonly pos = new THREE.Vector3();
	readonly maxHp: number;
	readonly reward: number;
	readonly lives: number;
	hp: number;
	dist: number;
	alive = true;
	slow = 0;
	slowTime = 0;
	stunTime = 0;
	shatter = 0;
	shatterTime = 0;
	private flash = 0;
	private age = Math.random() * 10;
	private readonly offset: number;
	private readonly body: THREE.Object3D;
	private readonly lean = new THREE.Group();
	private readonly materials: THREE.MeshStandardMaterial[];
	private readonly bar = new THREE.Group();
	private readonly fill: THREE.Mesh;
	private readonly tangent = new THREE.Vector3(1, 0, 0);
	private readonly frost: THREE.Mesh;
	readonly size: number;

	constructor(def: EnemyDef, elite: boolean, route: Route, hpScale: number, wave: number, startDist = 0) {
		this.def = def;
		this.elite = elite;
		this.wave = wave;
		this.route = route;
		this.dist = startDist;
		this.maxHp = Math.round(def.hp * hpScale * (elite ? ELITE.hp : 1));
		this.hp = this.maxHp;
		this.reward = Math.round(def.reward * (elite ? ELITE.reward : 1));
		this.lives = def.lives + (elite ? ELITE.lives : 0);
		this.offset = def.flying || def.boss ? 0 : (Math.random() - 0.5) * 0.3;

		this.body = model(elite ? def.eliteModel : def.model);
		this.materials = ownMaterials(this.body);
		this.size = def.scale * (elite ? ELITE.scale : 1);
		this.body.scale.setScalar(this.size);
		this.lean.add(this.body);
		this.object.add(this.lean);

		if (def.boss) {
			const beam = model('enemy-ufo-beam');
			for (const material of ownMaterials(beam)) {
				material.transparent = true;
				material.opacity = 0.55;
				material.emissive = new THREE.Color(0xff6fd8);
				material.emissiveIntensity = 0.5;
				material.depthWrite = false;
			}
			beam.scale.set(0.5, def.hover + 0.05, 0.5);
			beam.position.y = -def.hover - 0.02;
			beam.name = 'beam';
			beam.traverse((node) => (node.castShadow = false));
			this.object.add(beam);
		}

		this.frost = new THREE.Mesh(
			new THREE.IcosahedronGeometry(0.5, 0),
			new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0, emissive: 0x6fd6ff, emissiveIntensity: 0.4, flatShading: true, depthWrite: false }),
		);
		this.frost.scale.set(this.size * 1.3, this.size * 0.8, this.size * 1.3);
		this.frost.position.y = this.size * 0.3;
		this.object.add(this.frost);

		const back = new THREE.Mesh(barGeometry, barBack);
		back.scale.set(0.56, 0.1, 1);
		this.fill = new THREE.Mesh(barGeometry, barColors.high);
		this.fill.scale.set(0.5, 0.06, 1);
		this.fill.position.z = 0.001;
		back.renderOrder = 10;
		this.fill.renderOrder = 11;
		this.bar.add(back, this.fill);
		this.bar.position.y = this.size * 0.8 + 0.25;
		this.bar.visible = false;
		this.object.add(this.bar);
		if (def.boss) this.bar.scale.setScalar(2);

		this.place(0);
	}

	get flying(): boolean {
		return !!this.def.flying;
	}

	get remaining(): number {
		return this.route.total - this.dist;
	}

	get speedNow(): number {
		if (this.stunTime > 0) return 0;
		return this.def.speed * (1 - this.slow);
	}

	/** Where the enemy will be in t seconds, if nothing slows it more. */
	predict(t: number, out: THREE.Vector3): THREE.Vector3 {
		this.route.at(this.dist + this.speedNow * t, out);
		out.y = this.pos.y;
		return out;
	}

	update(dt: number, camera: THREE.Camera): boolean {
		this.age += dt;
		if (this.stunTime > 0) this.stunTime -= dt;
		if (this.slowTime > 0) {
			this.slowTime -= dt;
			if (this.slowTime <= 0) this.slow = 0;
		}
		if (this.shatterTime > 0) {
			this.shatterTime -= dt;
			if (this.shatterTime <= 0) this.shatter = 0;
		}
		this.dist += this.speedNow * dt;
		this.place(dt);

		if (this.flash > 0) {
			this.flash -= dt;
			const k = Math.max(0, this.flash / 0.1);
			for (const material of this.materials) {
				material.emissive.setRGB(k, k, k);
				material.emissiveIntensity = 1;
			}
		}
		const frosty = this.stunTime > 0 ? 0.75 : this.slow > 0 ? 0.3 : 0;
		const material = this.frost.material as THREE.MeshStandardMaterial;
		material.opacity += (frosty - material.opacity) * Math.min(1, dt * 12);
		this.frost.visible = material.opacity > 0.02;

		if (this.bar.visible) this.bar.quaternion.copy(camera.quaternion);
		return this.dist >= this.route.total;
	}

	private place(dt: number): void {
		this.route.at(this.dist, this.pos, this.tangent);
		if (this.offset) {
			this.pos.x += -this.tangent.z * this.offset;
			this.pos.z += this.tangent.x * this.offset;
		}
		const bob = Math.sin(this.age * 4) * 0.04;
		let hover = this.def.hover;
		if (this.flying) hover = Math.min(this.def.hover, 0.3 + this.dist * 1.4);
		this.pos.y = TOP + hover + bob;
		this.object.position.copy(this.pos);
		const spin = this.def.boss ? 0.8 : 2.5;
		this.body.rotation.y += dt * spin * (this.stunTime > 0 ? 0 : 1);
		// Lean into the direction of travel.
		const lean = 0.18 * Math.min(1, this.speedNow);
		this.lean.rotation.x = this.tangent.z * lean;
		this.lean.rotation.z = -this.tangent.x * lean;
		const beam = this.object.getObjectByName('beam');
		if (beam) beam.rotation.y -= dt * 2;
	}

	/** Returns true when this hit destroys the enemy. */
	damage(amount: number): boolean {
		if (!this.alive) return false;
		const dealt = amount * (1 + this.shatter);
		this.hp -= dealt;
		this.flash = 0.1;
		this.bar.visible = true;
		const ratio = Math.max(0, this.hp / this.maxHp);
		this.fill.scale.x = 0.5 * ratio;
		this.fill.position.x = -0.25 * (1 - ratio);
		this.fill.material = ratio > 0.6 ? barColors.high : ratio > 0.3 ? barColors.mid : barColors.low;
		if (this.hp <= 0) {
			this.alive = false;
			return true;
		}
		return false;
	}

	applySlow(amount: number, time: number, stun = 0, shatter = 0): void {
		const resist = this.def.boss ? 0.5 : 1;
		if (amount * resist >= this.slow) {
			this.slow = amount * resist;
			this.slowTime = time;
		} else {
			this.slowTime = Math.max(this.slowTime, time);
		}
		if (stun && !this.def.boss) this.stunTime = Math.max(this.stunTime, stun);
		if (shatter) {
			this.shatter = Math.max(this.shatter, shatter);
			this.shatterTime = Math.max(this.shatterTime, time);
		}
	}

	dispose(): void {
		for (const material of this.materials) material.dispose();
		(this.frost.material as THREE.Material).dispose();
		this.frost.geometry.dispose();
	}
}
