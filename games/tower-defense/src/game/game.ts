import * as THREE from 'three';
import { model, ownMaterials } from '../assets';
import { sound } from '../audio';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { BALANCE, mapById, waveHpScale, type MapDef, type MapId } from '../data/maps';
import { TOWERS, type Branch, type TowerId } from '../data/towers';
import type { Stage } from '../stage';
import { Board, TOP, type Cell } from './board';
import { Effects } from './effects';
import { Enemy } from './enemy';
import { buildTowerLook, THROW_TIME, Tower } from './tower';

export type GameEvent =
	| { type: 'change' }
	| { type: 'select'; cell: Cell | null; tower: Tower | null }
	| { type: 'built'; tower: Tower }
	| { type: 'upgraded'; tower: Tower }
	| { type: 'sold' }
	| { type: 'waveStart'; wave: number }
	| { type: 'waveClear'; wave: number; bonus: number }
	| { type: 'leak'; lives: number }
	| { type: 'swarm' }
	| { type: 'end'; result: Result };

export interface Result {
	won: boolean;
	map: MapId;
	stars: number;
	score: number;
	lives: number;
	waves: number;
	kills: number;
}

interface Spawn {
	time: number;
	type: EnemyId;
	elite: boolean;
	path: number;
	wave: number;
}

interface Shot {
	kind: 'arrow' | 'shell' | 'boulder';
	object: THREE.Object3D;
	tower: Tower;
	from: THREE.Vector3;
	to: THREE.Vector3;
	vel: THREE.Vector3;
	t: number;
	dur: number;
	arc: number;
	damage: number;
	splash: number;
	pierce: number;
	hit: Set<number>;
	hitsFlying: boolean;
}

export interface WavePreview {
	type: EnemyId;
	count: number;
	elite: boolean;
}

const MAX_LIVES = 20;
// A thin glowing streak behind each flying bolt.
const trailGeometry = new THREE.CylinderGeometry(0.012, 0.03, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
const trailMaterials = {
	plain: new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
	rail: new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const SWARM_COUNT = 8;
const SWARM_WINDOW = 1.6;

export class Game {
	readonly map: MapDef;
	readonly board: Board;
	readonly fx: Effects;
	readonly root = new THREE.Group();
	readonly enemies: Enemy[] = [];
	readonly towers: Tower[] = [];
	gold: number;
	lives = MAX_LIVES;
	wave = 0;
	speed = 1;
	paused = false;
	over = false;
	selected: Cell | null = null;
	kills = 0;
	time = 0;
	private killScore = 0;
	private readonly stage: Stage;
	private readonly emit: (event: GameEvent) => void;
	private readonly demo: boolean;
	private shots: Shot[] = [];
	private queue: Spawn[] = [];
	private pathTurn = 0;
	private waveLeft = new Map<number, number>();
	private killTimes: { t: number; at: THREE.Vector3 }[] = [];
	private swarmCooldown = 0;
	private endTimer = -1;
	private crystalFlash = 0;
	private readonly crystalMaterials: { material: THREE.MeshStandardMaterial; base: THREE.Color }[];

	// Previews.
	private readonly cursor: THREE.Object3D;
	private readonly cursorBad: THREE.Object3D;
	private readonly selectMark: THREE.Object3D;
	private readonly rangeRing: THREE.Mesh;
	private readonly rangeDisc: THREE.Mesh;
	private ghost: THREE.Object3D | null = null;
	private ghostKey = '';
	private hoverCell: Cell | null = null;
	private rangePreview: number | null = null;
	/** The size the range ring shows, which eases toward the real range. */
	private ringSize = 0;
	private ringAt = new THREE.Vector3();
	private keyCursor: Cell | null = null;
	private readonly arrows: THREE.InstancedMesh;
	private readonly flyArrows: THREE.InstancedMesh;
	private readonly arrowSlots: { route: number; d: number; fly: boolean }[] = [];

	constructor(stage: Stage, mapId: MapId, emit: (event: GameEvent) => void, demo = false) {
		this.stage = stage;
		this.emit = emit;
		this.demo = demo;
		this.map = mapById(mapId);
		this.gold = this.map.startGold;
		this.board = new Board(this.map);
		this.fx = new Effects(stage, document.getElementById('world-ui')!);
		this.root.add(this.board.group, this.fx.group);
		this.crystalMaterials = [];
		this.board.crystal.traverse((node) => {
			const mesh = node as THREE.Mesh;
			if (!mesh.isMesh) return;
			const material = mesh.material as THREE.MeshStandardMaterial;
			this.crystalMaterials.push({ material, base: material.emissive.clone() });
		});

		this.cursor = model('selection-a');
		this.cursorBad = model('selection-a');
		for (const material of ownMaterials(this.cursorBad)) {
			material.color.setRGB(1, 0.2, 0.2);
			material.emissive = new THREE.Color(0xff2030);
			material.emissiveIntensity = 0.6;
		}
		this.selectMark = model('selection-b');
		for (const material of ownMaterials(this.selectMark)) {
			material.emissive = new THREE.Color(0xffd36b);
			material.emissiveIntensity = 0.4;
		}
		for (const mark of [this.cursor, this.cursorBad, this.selectMark]) {
			mark.visible = false;
			mark.traverse((node) => (node.castShadow = false));
			this.root.add(mark);
		}

		this.rangeDisc = new THREE.Mesh(
			new THREE.CircleGeometry(1, 64),
			new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false }),
		);
		this.rangeRing = new THREE.Mesh(
			new THREE.RingGeometry(0.97, 1, 64),
			new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
		);
		for (const mesh of [this.rangeDisc, this.rangeRing]) {
			mesh.rotation.x = -Math.PI / 2;
			mesh.visible = false;
			mesh.renderOrder = 5;
			this.root.add(mesh);
		}

		const arrowShape = new THREE.Shape();
		arrowShape.moveTo(-0.16, -0.1);
		arrowShape.lineTo(0, 0.1);
		arrowShape.lineTo(0.16, -0.1);
		arrowShape.lineTo(0, -0.03);
		arrowShape.lineTo(-0.16, -0.1);
		const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
		arrowGeometry.rotateX(-Math.PI / 2);
		arrowGeometry.rotateY(Math.PI);
		const slots: { route: number; d: number; fly: boolean }[] = [];
		this.board.routes.forEach((route, i) => {
			for (let d = 0.4; d < route.total - 0.4; d += 0.6) slots.push({ route: i, d, fly: false });
		});
		const flySlots: { route: number; d: number; fly: boolean }[] = [];
		this.board.flyRoutes.forEach((route, i) => {
			for (let d = 0.6; d < route.total - 0.6; d += 0.7) flySlots.push({ route: i, d, fly: true });
		});
		this.arrowSlots = [...slots, ...flySlots];
		this.arrows = new THREE.InstancedMesh(
			arrowGeometry,
			new THREE.MeshBasicMaterial({ color: this.map.theme === 'snow' ? 0x6a5cff : 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }),
			Math.max(1, slots.length),
		);
		this.flyArrows = new THREE.InstancedMesh(
			arrowGeometry,
			new THREE.MeshBasicMaterial({ color: 0xc8a4ff, transparent: true, opacity: 0.6, depthWrite: false }),
			Math.max(1, flySlots.length),
		);
		this.arrows.renderOrder = 4;
		this.flyArrows.renderOrder = 4;
		this.root.add(this.arrows, this.flyArrows);

		stage.scene.add(this.root);
		stage.setBoard(this.board.width, this.board.depth);
	}

	get totalWaves(): number {
		return this.map.waves.length;
	}

	get waveRunning(): boolean {
		return this.queue.length > 0 || this.enemies.length > 0;
	}

	get canCallWave(): boolean {
		return !this.over && this.wave < this.totalWaves && !this.queue.some((spawn) => spawn.wave === this.wave);
	}

	get score(): number {
		return this.killScore + this.lives * 100 + this.gold;
	}

	get stars(): number {
		if (this.lives >= MAX_LIVES) return 3;
		if (this.lives >= 10) return 2;
		return 1;
	}

	nextWavePreview(): WavePreview[] {
		const groups = this.map.waves[this.wave];
		if (!groups) return [];
		const out: WavePreview[] = [];
		for (const group of groups) {
			const found = out.find((p) => p.type === group.type && p.elite === !!group.elite);
			if (found) found.count += group.count;
			else out.push({ type: group.type, count: group.count, elite: !!group.elite });
		}
		return out;
	}

	// ---------- Player actions ----------

	callWave(): boolean {
		if (!this.canCallWave) return false;
		const early = this.enemies.length > 0;
		const groups = this.map.waves[this.wave];
		this.wave += 1;
		let count = 0;
		for (const group of groups) {
			for (let i = 0; i < group.count; i++) {
				const path = group.path ?? this.pathTurn++ % this.board.routes.length;
				this.queue.push({ time: this.time + group.delay + i * group.gap, type: group.type, elite: !!group.elite, path, wave: this.wave });
				count += ENEMIES[group.type].splits ? 1 + (ENEMIES[group.type].splits ?? 0) : 1;
			}
		}
		this.queue.sort((a, b) => a.time - b.time);
		this.waveLeft.set(this.wave, count);
		if (early && !this.demo) {
			const bonus = 10 + this.wave * 2;
			this.gold += bonus;
			this.fx.text(this.board.crystal.position.clone().add(new THREE.Vector3(0, 1.4, 0)), `Early +${bonus}`, 'gold');
		}
		if (!this.demo) {
			sound.play('wave');
			this.emit({ type: 'waveStart', wave: this.wave });
			this.emit({ type: 'change' });
		}
		return true;
	}

	canBuild(id: TowerId, cell: Cell | null): boolean {
		return !this.over && this.board.buildable(cell) && this.gold >= TOWERS[id].levels[0].cost;
	}

	build(id: TowerId, cell: Cell): Tower | null {
		if (!this.canBuild(id, cell)) {
			sound.play('deny');
			return null;
		}
		const def = TOWERS[id];
		this.gold -= def.levels[0].cost;
		const tower = new Tower(id, cell, this.board.world(cell.c, cell.r));
		cell.tower = tower;
		this.towers.push(tower);
		this.root.add(tower.group);
		this.clearGhost();
		sound.play('place');
		this.emit({ type: 'built', tower });
		// Show the reach once, then get out of the way.
		if (!this.demo) this.fx.ring(tower.pos.clone().setY(TOP), 0xffe08a, tower.stats.range, 0.7, 0.45);
		this.select(null);
		this.emit({ type: 'change' });
		return tower;
	}

	upgrade(tower: Tower, branch?: Branch): boolean {
		const cost = tower.upgradeCost(branch);
		if (cost === null || this.gold < cost || this.over) {
			sound.play('deny');
			return false;
		}
		this.gold -= cost;
		tower.spent += cost;
		tower.level += 1;
		if (tower.level === 3 && branch) tower.branch = branch;
		tower.rebuild(true);
		tower.setSelected(true);
		this.fx.burst(tower.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffe08a, 22, { speed: 3, up: 3, size: 0.07 });
		this.fx.ring(tower.pos, 0xffe08a, 1.1, 0.5);
		sound.play('upgrade');
		this.emit({ type: 'upgraded', tower });
		this.emit({ type: 'select', cell: tower.cell, tower });
		this.emit({ type: 'change' });
		return true;
	}

	sell(tower: Tower): void {
		this.gold += tower.sellValue;
		this.fx.text(tower.pos.clone().add(new THREE.Vector3(0, 1, 0)), `+${tower.sellValue}`, 'gold');
		this.fx.smoke(tower.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 10);
		this.fx.burst(tower.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x9a9ab4, 14);
		this.root.remove(tower.group);
		this.towers.splice(this.towers.indexOf(tower), 1);
		tower.cell.tower = null;
		sound.play('sell');
		this.select(null);
		this.emit({ type: 'sold' });
		this.emit({ type: 'change' });
	}

	towerAt(cell: Cell | null): Tower | null {
		return (cell?.tower as Tower | null) ?? null;
	}

	select(cell: Cell | null): void {
		this.rangePreview = null;
		for (const tower of this.towers) tower.setSelected(false);
		this.selected = cell;
		const tower = this.towerAt(cell);
		if (tower) tower.setSelected(true);
		this.clearGhost();
		this.emit({ type: 'select', cell, tower });
	}

	/** Shows the range an upgrade would give the selected tower. Null shows the real range. */
	previewRange(range: number | null): void {
		this.rangePreview = range;
	}

	setHover(cell: Cell | null): void {
		this.hoverCell = cell;
	}

	/** The cell that the keyboard or gamepad points at. Null hides it. */
	setKeyCursor(cell: Cell | null): void {
		this.keyCursor = cell;
	}

	get keyCell(): Cell | null {
		return this.keyCursor;
	}

	/** Shows a see-through tower and its range on the selected cell. */
	showGhost(id: TowerId | null): void {
		const cell = this.selected;
		const key = id && cell ? `${id}:${cell.c},${cell.r}` : '';
		if (key === this.ghostKey) return;
		this.clearGhost();
		if (!id || !cell) return;
		this.ghostKey = key;
		const look = buildTowerLook(TOWERS[id], TOWERS[id].levels[0]);
		look.root.traverse((node) => {
			const mesh = node as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.castShadow = false;
			for (const material of ownMaterials(mesh)) {
				material.transparent = true;
				material.opacity = 0.55;
				material.emissive = new THREE.Color(0x6fbfff);
				material.emissiveIntensity = 0.3;
			}
		});
		this.board.world(cell.c, cell.r, look.root.position);
		look.root.position.y = 0;
		this.ghost = look.root;
		this.ghost.userData.range = TOWERS[id].levels[0].stats.range;
		this.root.add(this.ghost);
	}

	private clearGhost(): void {
		if (this.ghost) this.root.remove(this.ghost);
		this.ghost = null;
		this.ghostKey = '';
	}

	// ---------- Simulation ----------

	update(realDt: number): void {
		const dt = Math.min(realDt, 0.1);
		this.board.update(performance.now() / 1000);
		if (!this.paused) {
			let left = dt * this.speed;
			while (left > 0) {
				const step = Math.min(left, 1 / 60);
				this.step(step);
				left -= step;
			}
		}
		this.updateVisuals(dt);
		this.fx.update(this.paused ? 0 : dt * Math.min(this.speed, 2));
	}

	private step(dt: number): void {
		this.time += dt;
		while (this.queue.length && this.queue[0].time <= this.time) this.spawn(this.queue.shift()!);

		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const enemy = this.enemies[i];
			if (!enemy.alive) continue;
			if (enemy.update(dt, this.stage.camera)) this.leak(enemy);
		}
		for (const tower of this.towers) this.towerStep(tower, dt);
		this.shotsStep(dt);
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			if (!this.enemies[i].alive) this.removeEnemy(this.enemies[i]);
		}
		if (this.swarmCooldown > 0) this.swarmCooldown -= dt;
		if (this.demo && this.queue.length === 0 && this.enemies.length < 6) this.demoSpawn();
		this.checkEnd(dt);
	}

	private spawn(spawn: Spawn): void {
		const def = ENEMIES[spawn.type];
		const route = def.flying ? this.board.flyRouteFor(spawn.path) : this.board.routes[spawn.path];
		const hp = def.boss ? this.map.hpScale : waveHpScale(this.map, spawn.wave);
		const enemy = new Enemy(def, spawn.elite, route, hp, spawn.wave);
		this.enemies.push(enemy);
		this.root.add(enemy.object);
		this.fx.burst(enemy.pos, 0xb06cff, 6, { speed: 1.5, up: 1.5, size: 0.06, gravity: -2 });
		if (def.boss && !this.demo) {
			this.stage.addShake(0.15);
			sound.play('bigPop');
		}
	}

	private demoSpawn(): void {
		const types: EnemyId[] = ['scout', 'scout', 'scout', 'tank', 'splitter', 'skimmer'];
		for (let i = 0; i < 4; i++) {
			this.queue.push({
				time: this.time + i * 0.9,
				type: types[Math.floor(Math.random() * types.length)],
				elite: Math.random() < 0.15,
				path: this.pathTurn++ % this.board.routes.length,
				wave: 3,
			});
		}
	}

	private leak(enemy: Enemy): void {
		enemy.alive = false;
		if (this.demo) return;
		this.lives = Math.max(0, this.lives - enemy.lives);
		this.crystalFlash = 1;
		this.stage.addShake(0.12 + enemy.lives * 0.03);
		this.fx.burst(this.board.crystal.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xff6f9a, 16, { speed: 3, up: 3 });
		this.fx.text(this.board.crystal.position.clone().add(new THREE.Vector3(0, 1.2, 0)), `-${enemy.lives}`, 'hurt');
		sound.play('leak');
		this.resolve(enemy);
		this.emit({ type: 'leak', lives: this.lives });
		this.emit({ type: 'change' });
	}

	private kill(enemy: Enemy, tower: Tower | null): void {
		const at = enemy.pos.clone();
		const def = enemy.def;
		this.fx.burst(at, def.color, 10 + Math.round(enemy.size * 14), { speed: 3.2, up: 2.5, size: 0.07 + enemy.size * 0.06 });
		this.fx.burst(at, 0x3a3a52, 5, { speed: 2.5, up: 2, size: 0.06 });
		this.fx.flash(at, 0xfff0c0, 0.25 + enemy.size * 0.5);
		if (def.boss) {
			this.fx.ring(at, 0xff9a6a, 3, 0.7);
			this.fx.burst(at, 0xffd166, 50, { speed: 6, up: 5, size: 0.1 });
			this.stage.addShake(0.4);
			sound.play('bigPop');
		} else {
			sound.play('pop');
		}
		if (this.demo) return;
		if (tower) tower.kills += 1;
		this.kills += 1;
		this.gold += enemy.reward;
		this.killScore += enemy.reward * 10;
		this.fx.text(at.clone().add(new THREE.Vector3(0, 0.3, 0)), `+${enemy.reward}`, 'gold');

		if (def.splits) {
			for (let i = 0; i < def.splits; i++) {
				const shard = new Enemy(ENEMIES.shard, false, enemy.route, waveHpScale(this.map, enemy.wave), enemy.wave, Math.max(0, enemy.dist + (i - 1) * 0.25));
				this.enemies.push(shard);
				this.root.add(shard.object);
			}
		}

		this.killTimes.push({ t: this.time, at });
		this.killTimes = this.killTimes.filter((k) => this.time - k.t < SWARM_WINDOW);
		if (this.killTimes.length >= SWARM_COUNT && this.swarmCooldown <= 0) this.swarm();
		this.resolve(enemy);
		this.emit({ type: 'change' });
	}

	/** A swarm cleared: many kills in a short time. */
	private swarm(): void {
		const center = new THREE.Vector3();
		for (const k of this.killTimes) center.add(k.at);
		center.divideScalar(this.killTimes.length);
		center.y = TOP;
		const bonus = 5 + this.killTimes.length;
		this.gold += bonus;
		this.swarmCooldown = 4;
		this.killTimes = [];
		this.fx.ring(center, 0xffe27a, 3.2, 0.8, 0.9);
		this.fx.ring(center, 0xff8ad8, 2.2, 0.6, 0.7);
		this.fx.burst(center.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffe27a, 40, { speed: 5, up: 5, size: 0.08 });
		this.fx.burst(center.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x8fe3ff, 30, { speed: 4, up: 6, size: 0.06 });
		this.fx.text(center.clone().add(new THREE.Vector3(0, 1.2, 0)), `Swarm cleared! +${bonus}`, 'swarm');
		this.stage.addShake(0.2);
		sound.play('swarm');
		this.emit({ type: 'swarm' });
	}

	private resolve(enemy: Enemy): void {
		if (this.demo) return;
		const left = (this.waveLeft.get(enemy.wave) ?? 1) - 1;
		this.waveLeft.set(enemy.wave, left);
		const spawning = this.queue.some((spawn) => spawn.wave === enemy.wave);
		if (left <= 0 && !spawning) {
			this.waveLeft.delete(enemy.wave);
			if (this.lives <= 0) return;
			const bonus = BALANCE.clearBonus + enemy.wave * BALANCE.clearPerWave;
			this.gold += bonus;
			sound.play('waveClear');
			this.emit({ type: 'waveClear', wave: enemy.wave, bonus });
		}
	}

	private removeEnemy(enemy: Enemy): void {
		this.root.remove(enemy.object);
		enemy.dispose();
		this.enemies.splice(this.enemies.indexOf(enemy), 1);
	}

	private findTarget(tower: Tower, range: number): Enemy | null {
		let best: Enemy | null = null;
		let bestScore = Infinity;
		for (const enemy of this.enemies) {
			if (!enemy.alive) continue;
			if (enemy.flying && !tower.def.hitsFlying) continue;
			const dx = enemy.pos.x - tower.pos.x;
			const dz = enemy.pos.z - tower.pos.z;
			const d2 = dx * dx + dz * dz;
			if (d2 > range * range) continue;
			let score: number;
			if (tower.targeting === 'strong') score = -enemy.hp;
			else if (tower.targeting === 'close') score = d2;
			else score = enemy.remaining;
			if (score < bestScore) {
				bestScore = score;
				best = enemy;
			}
		}
		return best;
	}

	private towerStep(tower: Tower, dt: number): void {
		const landed = tower.update(dt);
		if (landed) {
			this.fx.smoke(tower.pos.clone().setY(TOP + 0.1), 4 * landed, 0xe8dcc8);
			if (!this.demo) sound.play('thud');
		}
		if (tower.building) return;
		tower.cooldown -= dt;
		const stats = tower.stats;

		if (tower.def.id === 'crystal') {
			if (tower.cooldown > 0) return;
			const inRange = this.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - tower.pos.x, e.pos.z - tower.pos.z) <= stats.range);
			if (inRange.length === 0) return;
			tower.cooldown = stats.rate;
			const color = tower.levelDef.tint ?? 0x8fe3ff;
			this.fx.ring(tower.pos.clone().setY(TOP), color, stats.range, 0.5, 0.55);
			this.fx.burst(tower.muzzle, color, 6, { speed: 2, up: 1, size: 0.05, gravity: -1 });
			if (!this.demo) sound.play('crystal');
			for (const enemy of inRange) {
				enemy.applySlow(stats.slow ?? 0, stats.slowTime ?? 1, stats.stun, stats.shatter);
				if (enemy.damage(stats.damage)) this.kill(enemy, tower);
			}
			return;
		}

		const target = this.findTarget(tower, stats.range);
		if (!target) return;
		const muzzle = tower.muzzle;
		const flight = target.pos.distanceTo(muzzle) / (stats.speed ?? 10);
		const aimPoint = target.predict(tower.def.id === 'ballista' ? flight * 0.9 : flight, new THREE.Vector3());
		const off = tower.aim(aimPoint, dt);
		if (tower.cooldown > 0 || off > 0.5) return;
		tower.cooldown = stats.rate;
		tower.fired();
		this.fire(tower, aimPoint, target);
	}

	private fire(tower: Tower, aimPoint: THREE.Vector3, target: Enemy): void {
		const stats = tower.stats;
		const muzzle = tower.launchPoint;
		const shots = stats.shots ?? 1;
		const id = tower.def.id;
		if (!this.demo) sound.play(id === 'ballista' ? 'ballista' : id === 'cannon' ? 'cannon' : 'catapult');

		for (let s = 0; s < shots; s++) {
			if (id === 'ballista') {
				const dir = new THREE.Vector3().subVectors(aimPoint, muzzle);
				dir.y = (target.pos.y - muzzle.y) * 0.9;
				dir.normalize();
				if (shots > 1) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (s - (shots - 1) / 2) * (stats.spread ?? 0.2));
				const rail = !!stats.pierce && stats.pierce > 10;
				const object = model('ballista-bolt');
				const trail = new THREE.Mesh(trailGeometry, rail ? trailMaterials.rail : trailMaterials.plain);
				trail.name = 'trail';
				trail.position.z = -0.3;
				trail.scale.set(1, 1, 0.01);
				object.add(trail);
				object.userData.size = rail ? 1.25 : 1;
				object.scale.setScalar(object.userData.size);
				object.position.copy(muzzle);
				object.lookAt(muzzle.clone().add(dir));
				this.root.add(object);
				this.shots.push({
					kind: 'arrow',
					object,
					tower,
					from: muzzle.clone(),
					to: muzzle.clone(),
					vel: dir.multiplyScalar(stats.speed ?? 16),
					t: 0,
					dur: ((stats.range + 1.5) / (stats.speed ?? 16)) * 1.2,
					arc: 0,
					damage: stats.damage,
					splash: 0,
					pierce: stats.pierce ?? 1,
					hit: new Set(),
					hitsFlying: true,
				});
			} else {
				const boulder = id === 'catapult';
				const to = aimPoint.clone();
				if (boulder) {
					to.y = TOP + 0.15;
					if (shots > 1 && s > 0) to.add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4));
				}
				const object = model(boulder ? 'weapon-ammo-boulder' : 'weapon-ammo-cannonball');
				object.position.copy(muzzle);
				object.scale.setScalar(boulder && stats.damage > 150 ? 1.6 : 1);
				this.root.add(object);
				const dist = to.distanceTo(muzzle);
				this.shots.push({
					kind: boulder ? 'boulder' : 'shell',
					object,
					tower,
					from: muzzle.clone(),
					to,
					vel: new THREE.Vector3(),
					// Rocks leave when the arm reaches the top of its throw.
					t: boulder ? -THROW_TIME - s * 0.08 : -s * 0.08,
					dur: Math.max(0.25, dist / (stats.speed ?? 8)),
					arc: boulder ? 1.4 + dist * 0.25 : 0.25 + dist * 0.06,
					damage: stats.damage,
					splash: stats.splash ?? 0.8,
					pierce: 0,
					hit: new Set(),
					hitsFlying: !boulder,
				});
				if (!boulder) {
					this.fx.smoke(muzzle, 4);
					this.fx.flash(muzzle, 0xffd27a, 0.22, 0.1);
				}
			}
		}
	}

	private shotsStep(dt: number): void {
		for (let i = this.shots.length - 1; i >= 0; i--) {
			const shot = this.shots[i];
			shot.t += dt;
			if (shot.t < 0) {
				shot.object.visible = false;
				continue;
			}
			shot.object.visible = true;
			if (shot.kind === 'arrow') {
				shot.object.position.addScaledVector(shot.vel, dt);
				// The trail grows out of the bow, and the bolt shrinks away at the end of its flight.
				const trail = shot.object.getObjectByName('trail');
				const size = shot.object.userData.size as number;
				if (trail) trail.scale.z = Math.min(1, shot.t / 0.08) * (size > 1 ? 1.6 : 0.9);
				const left = shot.dur - shot.t;
				if (left < 0.1) shot.object.scale.setScalar(Math.max(0.01, left / 0.1) * size);
				const p = shot.object.position;
				for (const enemy of this.enemies) {
					if (!enemy.alive || shot.hit.has(enemy.id)) continue;
					const r = 0.22 + enemy.size * 0.4;
					if ((enemy.pos.x - p.x) ** 2 + (enemy.pos.z - p.z) ** 2 > r * r) continue;
					shot.hit.add(enemy.id);
					shot.pierce -= 1;
					this.fx.burst(p.clone(), 0xfff1c4, 3, { speed: 1.5, size: 0.04 });
					if (!this.demo) sound.play('hit');
					if (enemy.damage(shot.damage)) this.kill(enemy, shot.tower);
					if (shot.pierce <= 0) break;
				}
				if (shot.pierce <= 0 || shot.t >= shot.dur) this.removeShot(i);
				continue;
			}
			const k = Math.min(1, shot.t / shot.dur);
			const p = shot.object.position;
			p.lerpVectors(shot.from, shot.to, k);
			p.y += shot.arc * 4 * k * (1 - k);
			shot.object.rotation.x += dt * 8;
			shot.object.rotation.z += dt * 5;
			if (k >= 1) {
				this.explode(shot);
				this.removeShot(i);
			}
		}
	}

	private explode(shot: Shot): void {
		const at = shot.to;
		const boulder = shot.kind === 'boulder';
		const ground = at.clone().setY(TOP);
		this.fx.flash(at, boulder ? 0xffe1b0 : 0xffc06a, shot.splash * 0.9, 0.16);
		this.fx.ring(ground, boulder ? 0xe8c9a0 : 0xffb36b, shot.splash, 0.35, 0.6);
		this.fx.smoke(at, boulder ? 7 : 5, boulder ? 0xd9c4a6 : 0xd8d4e8);
		this.fx.burst(at, boulder ? 0x9c8a7a : 0xff9a4d, boulder ? 12 : 8, { speed: 3, up: 2.5, size: 0.06 });
		if (!this.demo) {
			sound.play(boulder ? 'thud' : 'boom');
			this.stage.addShake(boulder ? 0.06 + shot.damage / 2500 : 0.03);
		}
		for (const enemy of this.enemies) {
			if (!enemy.alive) continue;
			if (enemy.flying && !shot.hitsFlying) continue;
			const reach = shot.splash + enemy.size * 0.3;
			const d2 = (enemy.pos.x - at.x) ** 2 + (enemy.pos.z - at.z) ** 2;
			if (d2 > reach * reach) continue;
			// Full damage near the middle, less at the edge.
			const falloff = 1 - 0.4 * (Math.sqrt(d2) / reach);
			if (enemy.damage(shot.damage * falloff)) this.kill(enemy, shot.tower);
		}
	}

	private removeShot(index: number): void {
		this.root.remove(this.shots[index].object);
		this.shots.splice(index, 1);
	}

	private checkEnd(dt: number): void {
		if (this.demo) return;
		if (this.endTimer >= 0) {
			this.endTimer -= dt;
			if (this.endTimer < 0) this.finish();
			return;
		}
		if (this.over) return;
		if (this.lives <= 0) {
			this.over = true;
			this.endTimer = 1.6;
			const at = this.board.crystal.position.clone().add(new THREE.Vector3(0, 0.5, 0));
			this.fx.burst(at, 0xff7ad9, 60, { speed: 6, up: 6, size: 0.12, life: 1.4 });
			this.fx.flash(at, 0xffffff, 2.5, 0.4);
			this.board.crystal.visible = false;
			this.stage.addShake(0.5);
			sound.play('bigPop');
			sound.music(null);
			this.select(null);
			return;
		}
		if (this.wave >= this.totalWaves && !this.waveRunning) {
			this.over = true;
			this.endTimer = 1.4;
			this.select(null);
			sound.music(null);
			for (let i = 0; i < 5; i++) {
				const at = this.board.crystal.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random(), (Math.random() - 0.5) * 3));
				this.fx.burst(at, [0xffe27a, 0x8fe3ff, 0xff8ad8, 0x9cf29c][i % 4], 30, { speed: 5, up: 5, size: 0.07, life: 1.3 });
			}
		}
	}

	private finish(): void {
		const won = this.lives > 0;
		this.emit({
			type: 'end',
			result: { won, map: this.map.id, stars: won ? this.stars : 0, score: won ? this.score : this.killScore, lives: this.lives, waves: this.wave, kills: this.kills },
		});
	}

	// ---------- Visuals that are not part of the simulation ----------

	private updateVisuals(dt: number): void {
		const time = performance.now() / 1000;
		// Cursor and selection marks.
		const hover = this.keyCursor ?? this.hoverCell;
		const ok = this.board.buildable(hover) || !!this.towerAt(hover);
		this.cursor.visible = !!hover && ok && hover !== this.selected && !this.demo && !this.over;
		this.cursorBad.visible = !!hover && !ok && !this.demo && !this.over;
		for (const mark of [this.cursor, this.cursorBad]) {
			if (hover) {
				this.board.world(hover.c, hover.r, mark.position);
				mark.position.y = TOP + 0.01 + Math.sin(time * 6) * 0.015;
			}
		}
		this.selectMark.visible = !!this.selected;
		if (this.selected) {
			this.board.world(this.selected.c, this.selected.r, this.selectMark.position);
			this.selectMark.position.y = TOP - 0.15;
			const pulse = 1 + Math.sin(time * 5) * 0.03;
			this.selectMark.scale.set(pulse, 1, pulse);
		}

		// Range: the ghost first, then the selected tower, then the tower under the cursor.
		let rangeAt: THREE.Vector3 | null = null;
		let range = 0;
		let color = 0xffffff;
		const selectedTower = this.towerAt(this.selected);
		const hoverTower = this.towerAt(hover);
		if (this.ghost) {
			rangeAt = this.ghost.position;
			range = this.ghost.userData.range;
			color = 0x8fd3ff;
		} else if (selectedTower) {
			rangeAt = selectedTower.pos;
			range = this.rangePreview ?? selectedTower.stats.range;
			color = this.rangePreview ? 0x9cf29c : 0xffe08a;
		} else if (hoverTower && !this.demo) {
			rangeAt = hoverTower.pos;
			range = hoverTower.stats.range;
		}
		if (rangeAt) {
			// A new spot starts small and grows; the same spot eases to a new size.
			if (!this.rangeRing.visible || rangeAt.x !== this.ringAt.x || rangeAt.z !== this.ringAt.z) this.ringSize = range * 0.6;
			this.ringAt.copy(rangeAt);
			this.ringSize += (range - this.ringSize) * Math.min(1, dt * 16);
		}
		for (const mesh of [this.rangeDisc, this.rangeRing]) {
			mesh.visible = !!rangeAt && !this.over;
			if (rangeAt) {
				mesh.position.set(rangeAt.x, TOP + 0.04, rangeAt.z);
				mesh.scale.setScalar(this.ringSize);
				(mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
			}
		}

		// Path arrows glow between waves, so the player sees where the UFOs go.
		const between = !this.waveRunning && !this.over && !this.demo && this.wave < this.totalWaves;
		const nextHasFlyers = this.nextWavePreview().some((p) => ENEMIES[p.type].flying);
		const arrowsOpacity = between ? 0.7 + Math.sin(time * 3) * 0.25 : 0;
		(this.arrows.material as THREE.MeshBasicMaterial).opacity = arrowsOpacity;
		(this.flyArrows.material as THREE.MeshBasicMaterial).opacity = between && nextHasFlyers ? 0.5 + Math.sin(time * 3) * 0.2 : 0;
		this.arrows.visible = arrowsOpacity > 0;
		this.flyArrows.visible = between && nextHasFlyers;
		if (this.arrows.visible || this.flyArrows.visible) {
			const dummy = new THREE.Object3D();
			const tangent = new THREE.Vector3();
			let groundIndex = 0;
			let flyIndex = 0;
			const scroll = (time * 1.2) % 0.6;
			for (const slot of this.arrowSlots) {
				const route = slot.fly ? this.board.flyRoutes[slot.route] : this.board.routes[slot.route];
				const d = slot.d + (slot.fly ? (time * 1.2) % 0.7 : scroll);
				route.at(d, dummy.position, tangent);
				dummy.position.y = TOP + (slot.fly ? 0.06 : 0.05);
				dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
				const fade = Math.min(1, d / 1, (route.total - d) / 1);
				dummy.scale.setScalar(Math.max(0.01, fade));
				dummy.updateMatrix();
				if (slot.fly) this.flyArrows.setMatrixAt(flyIndex++, dummy.matrix);
				else this.arrows.setMatrixAt(groundIndex++, dummy.matrix);
			}
			this.arrows.instanceMatrix.needsUpdate = true;
			this.flyArrows.instanceMatrix.needsUpdate = true;
		}

		// The crystal flashes red when hit.
		if (this.crystalFlash > 0) {
			this.crystalFlash = Math.max(0, this.crystalFlash - dt * 2.5);
			const red = new THREE.Color(1, 0.15, 0.2);
			for (const { material, base } of this.crystalMaterials) material.emissive.lerpColors(base, red, this.crystalFlash);
		}
		if (this.ghost) this.ghost.position.y = Math.sin(time * 4) * 0.03;
	}

	dispose(): void {
		this.stage.scene.remove(this.root);
		this.fx.clear();
		for (const enemy of this.enemies) enemy.dispose();
	}

	// ---------- Debug ----------

	debugKillAll(): void {
		for (const enemy of [...this.enemies]) if (enemy.alive && enemy.damage(1e9)) this.kill(enemy, null);
	}
}
