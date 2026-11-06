import * as THREE from 'three';
import { model, ownMaterials, tint } from '../assets';
import { SELL_RATE, TOWERS, type Branch, type Targeting, type TowerDef, type TowerId, type TowerLevel, type TowerStats } from '../data/towers';
import { TOP, type Cell } from './board';

const heights = new Map<string, number>();

/** Catapult arm timing, in seconds: the throw, and when the wind back starts. */
export const THROW_TIME = 0.12;
const THROW_HOLD = 0.35;

const smooth = (t: number): number => t * t * (3 - 2 * t);

function heightOf(name: string, object: THREE.Object3D): number {
	let h = heights.get(name);
	if (h === undefined) {
		h = new THREE.Box3().setFromObject(object).max.y;
		heights.set(name, h);
	}
	return h;
}

interface Drop {
	object: THREE.Object3D;
	baseY: number;
	t: number;
	delay: number;
}

const flagGeometry = (() => {
	const shape = new THREE.Shape();
	shape.moveTo(0, 0);
	shape.lineTo(0.32, -0.09);
	shape.lineTo(0, -0.2);
	shape.lineTo(0, 0);
	return new THREE.ShapeGeometry(shape);
})();
const poleGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6);
const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4636 });

/** Builds the look of a tower at a level. Also used for the ghost preview and the icons. */
export function buildTowerLook(def: TowerDef, level: TowerLevel): { root: THREE.Group; weapon: THREE.Object3D; weaponY: number; parts: THREE.Object3D[]; flag: THREE.Object3D | null } {
	const root = new THREE.Group();
	const parts: THREE.Object3D[] = [];
	let y = 0;
	for (const name of level.parts) {
		const part = model(name);
		part.position.y = y;
		root.add(part);
		parts.push(part);
		const h = heightOf(name, part);
		// A top is a ring of battlements: the weapon stands inside it.
		y += name.includes('-top-') ? 0.12 : h;
	}
	const weapon = model(def.weapon);
	let weaponY = y;
	if (def.id === 'crystal') {
		weaponY = y + 0.37;
		if (level.tint) tint(weapon, level.tint, 0.35);
	}
	weapon.position.y = weaponY;
	root.add(weapon);
	parts.push(weapon);

	let flag: THREE.Object3D | null = null;
	if (level.flag) {
		flag = new THREE.Group();
		const pole = new THREE.Mesh(poleGeometry, poleMaterial);
		pole.position.y = 0.27;
		const cloth = new THREE.Mesh(flagGeometry, new THREE.MeshStandardMaterial({ color: level.flag, emissive: level.flag, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
		cloth.position.y = 0.54;
		cloth.name = 'cloth';
		flag.add(pole, cloth);
		flag.position.set(-0.36, y + 0.32, -0.36);
		flag.traverse((node) => (node.castShadow = true));
		root.add(flag);
		parts.push(flag);
	}
	return { root, weapon, weaponY, parts, flag };
}

export class Tower {
	readonly def: TowerDef;
	readonly cell: Cell;
	readonly group = new THREE.Group();
	readonly pos = new THREE.Vector3();
	level = 1;
	branch: Branch | null = null;
	targeting: Targeting = 'first';
	spent: number;
	cooldown = 0.3;
	kills = 0;
	weapon!: THREE.Object3D;
	weaponY = 0;
	private flag: THREE.Object3D | null = null;
	private drops: Drop[] = [];
	private kick = 0;
	private reload = 0;
	private reloadMax = 1;
	/** The moving part of the weapon: the ballista bow, the cannon barrel or the catapult arm. */
	private arm: THREE.Object3D | null = null;
	private armZ = 0;
	/** The loaded ammo: the ballista bolt or the rock in the catapult bucket. */
	private ammo: THREE.Object3D | null = null;
	private yaw = 0;
	private age = 0;
	private highlight: THREE.MeshStandardMaterial[] = [];

	constructor(id: TowerId, cell: Cell, at: THREE.Vector3) {
		this.def = TOWERS[id];
		this.cell = cell;
		this.pos.copy(at);
		this.group.position.copy(at);
		this.group.position.y = TOP - 0.2;
		this.spent = this.def.levels[0].cost;
		this.yaw = Math.PI;
		this.rebuild(true);
	}

	get levelDef(): TowerLevel {
		if (this.level === 3 && this.branch) return this.def.branches[this.branch];
		return this.def.levels[this.level - 1];
	}

	get stats(): TowerStats {
		return this.levelDef.stats;
	}

	get sellValue(): number {
		return Math.floor(this.spent * SELL_RATE);
	}

	/** The cost of the next level, or of a branch at level 2. Null at the top. */
	upgradeCost(branch?: Branch): number | null {
		if (this.level === 1) return this.def.levels[1].cost;
		if (this.level === 2 && branch) return this.def.branches[branch].cost;
		return null;
	}

	get muzzle(): THREE.Vector3 {
		return new THREE.Vector3(this.pos.x, this.group.position.y + this.weaponY + 0.35, this.pos.z);
	}

	/** Where a shot leaves the weapon: the loaded bolt, the end of the barrel or the top of the throw. */
	get launchPoint(): THREE.Vector3 {
		if (this.ammo && this.def.id === 'ballista') {
			this.group.updateMatrixWorld(true);
			return this.ammo.getWorldPosition(new THREE.Vector3());
		}
		const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
		if (this.def.id === 'cannon') return this.muzzle.addScaledVector(forward, 0.3).setY(this.muzzle.y - 0.05);
		if (this.def.id === 'catapult') return this.muzzle.addScaledVector(forward, 0.25).add(new THREE.Vector3(0, 0.27, 0));
		return this.muzzle;
	}

	rebuild(animate: boolean): void {
		this.group.clear();
		const look = buildTowerLook(this.def, this.levelDef);
		this.group.add(look.root);
		this.weapon = look.weapon;
		this.weaponY = look.weaponY;
		this.flag = look.flag;
		this.weapon.rotation.y = this.yaw;
		const armName = { ballista: 'arm', cannon: 'barrel', catapult: 'catapult', crystal: '' }[this.def.id];
		this.arm = armName ? (this.weapon.getObjectByName(armName) ?? null) : null;
		this.armZ = this.arm?.position.z ?? 0;
		this.ammo = this.weapon.getObjectByName('bolt') ?? null;
		if (this.def.id === 'catapult' && this.arm) {
			this.ammo = model('weapon-ammo-boulder');
			this.ammo.scale.setScalar(0.75);
			this.ammo.position.set(0, 0.13, -0.32);
			this.arm.add(this.ammo);
		}
		this.highlight = [];
		this.drops = [];
		if (animate) {
			look.parts.forEach((part, i) => {
				this.drops.push({ object: part, baseY: part.position.y, t: 0, delay: i * 0.09 });
				part.position.y += 2;
				part.visible = false;
			});
		}
	}

	/** Shows the tower as selected with a soft glow. */
	setSelected(on: boolean): void {
		if (on && this.highlight.length === 0) {
			this.group.traverse((node) => {
				const mesh = node as THREE.Mesh;
				if (!mesh.isMesh) return;
				this.highlight.push(...ownMaterials(mesh));
			});
		}
		for (const material of this.highlight) {
			material.emissive = new THREE.Color(on ? 0x55408a : 0x000000);
			material.emissiveIntensity = on ? 0.35 : 0;
		}
	}

	get building(): boolean {
		return this.drops.length > 0;
	}

	/** Returns the parts that just landed, for dust. */
	update(dt: number): number {
		this.age += dt;
		let landed = 0;
		for (let i = this.drops.length - 1; i >= 0; i--) {
			const drop = this.drops[i];
			drop.t += dt;
			const t = drop.t - drop.delay;
			if (t < 0) continue;
			drop.object.visible = true;
			const k = Math.min(1, t / 0.28);
			// Fall, then a small bounce.
			const fall = 1 - k * k;
			drop.object.position.y = drop.baseY + fall * 2;
			if (k >= 1) {
				drop.object.position.y = drop.baseY;
				const squash = drop.object.scale;
				squash.set(1.08, 0.9, 1.08);
				this.drops.splice(i, 1);
				landed += 1;
			}
		}
		this.group.traverse((node) => {
			if (node.scale.y < 1 && node.scale.x > 1) {
				node.scale.x = node.scale.z = Math.max(1, node.scale.x - dt * 0.8);
				node.scale.y = Math.min(1, node.scale.y + dt * 0.8);
			}
		});

		if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 5);
		if (this.reload > 0) this.reload = Math.max(0, this.reload - dt);
		this.weapon.rotation.y = this.yaw;
		// How far into the reload we are: 0 just fired, 1 ready.
		const ready = 1 - this.reload / this.reloadMax;
		if (this.arm && this.def.id === 'ballista') {
			// The bow jumps back, then a new bolt slides in from behind.
			this.arm.position.z = this.armZ - 0.06 * this.kick;
			if (this.ammo) {
				const slide = Math.max(0, (ready - 0.35) / 0.65);
				this.ammo.visible = ready > 0.35;
				this.ammo.position.z = -0.35 * (1 - slide) * (1 - slide);
			}
		} else if (this.arm && this.def.id === 'cannon') {
			this.arm.position.z = this.armZ - 0.12 * this.kick * this.kick;
		} else if (this.arm && this.def.id === 'catapult') {
			// A fast throw over the top, a short hold, then a slow wind back.
			const since = this.reloadMax - this.reload;
			const windBack = Math.max(0.2, this.reloadMax * 0.75 - THROW_HOLD);
			let swing = 0;
			if (since < THROW_TIME) swing = Math.sin((since / THROW_TIME) * (Math.PI / 2));
			else if (since < THROW_HOLD) swing = 1;
			else swing = 1 - smooth(Math.min(1, (since - THROW_HOLD) / windBack));
			this.arm.rotation.x = 1.9 * swing;
			if (this.ammo) this.ammo.visible = since < THROW_TIME * 0.8 || swing <= 0.001;
		}
		if (this.def.id === 'crystal') {
			this.weapon.position.y = this.weaponY + Math.sin(this.age * 2) * 0.05;
			this.weapon.rotation.y = this.age * 0.6;
		}
		const cloth = this.flag?.getObjectByName('cloth');
		if (cloth) cloth.rotation.y = Math.sin(this.age * 3) * 0.35;
		return landed;
	}

	/** Turns toward a point. Returns how far off the aim still is, in radians. */
	aim(target: THREE.Vector3, dt: number): number {
		const wanted = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
		let diff = wanted - this.yaw;
		diff = Math.atan2(Math.sin(diff), Math.cos(diff));
		const step = Math.min(Math.abs(diff), dt * 9);
		this.yaw += Math.sign(diff) * step;
		return Math.abs(diff) - step;
	}

	fired(): void {
		this.kick = 1;
		this.reloadMax = this.reload = Math.max(0.3, this.stats.rate * 0.8);
	}
}
