// One fight, as a plain simulation. No drawing, no sound: the game reads `events` each frame.
// The headless sim drives the same class with a bot.

import { ACTS } from './data/acts.ts';
import { BONUS, BOW, COMBO, DAMAGE, ELITE, HITBOX, PHYSICS, WAVES, WORLD } from './data/balance.ts';
import { BOSSES, type BossDef, type BossPattern } from './data/bosses.ts';
import { ENEMIES, type EnemyDef, type ProjectileDef } from './data/enemies.ts';
import { type Box, type Circle, lobVelocity, segBox, segCircle, solveAim } from './geom.ts';
import { Rng } from './rng.ts';
import type { Stats } from './stats.ts';
import { buildWaves, type FightKind, type SpawnSpec } from './waves.ts';

export type Zone = 'head' | 'body' | 'helmet' | 'plate' | 'shield' | 'weak' | 'guard';
export type BonusKind = 'volley' | 'crown';
export type Owner = 'player' | 'helper' | 'rain' | 'crown';
export type KillCause = 'arrow' | 'head' | 'fire' | 'spikes' | 'thorns' | 'blast' | 'boss';

export interface BossState {
	phase: 'enter' | 'idle' | 'windup' | 'volley' | 'charge' | 'return' | 'stagger' | 'guard';
	pattern: BossPattern | null;
	t: number;
	weakHits: number;
	left: number;
	enraged: boolean;
	baseY: number;
}

export interface Enemy {
	uid: number;
	def: EnemyDef;
	boss: BossDef | null;
	bs: BossState | null;
	x: number;
	/** Feet for walkers, body center for flyers and flying bosses. */
	y: number;
	size: number;
	hp: number;
	maxHp: number;
	helmet: number;
	plate: number;
	shield: number;
	elite: boolean;
	state: 'walk' | 'attack' | 'throw' | 'hover' | 'dive';
	t: number;
	stopX: number;
	attackT: number;
	windT: number;
	burnT: number;
	burnDps: number;
	slowT: number;
	slowF: number;
	flash: number;
	alt: number;
	diveT: number;
	damageMult: number;
	speedMult: number;
	/** Set by an owner shot for fire credit. */
	burnShot: number;
	hopT: number;
}

export interface Arrow {
	uid: number;
	shot: number;
	owner: Owner;
	x: number;
	y: number;
	vx: number;
	vy: number;
	damage: number;
	pierce: number;
	bounces: number;
	bounceDamage: number;
	split: number;
	homing: number;
	fire: number;
	fireTime: number;
	ice: number;
	iceTime: number;
	explosive: number;
	blast: number;
	gravity: number;
	age: number;
	dead: boolean;
	hit: number[];
	/** Volley bonus: rain falls where this arrow ends. */
	rain: boolean;
}

export interface Projectile {
	uid: number;
	def: ProjectileDef;
	x: number;
	y: number;
	vx: number;
	vy: number;
	hp: number;
	age: number;
	dead: boolean;
}

interface Shot {
	id: number;
	arrows: number;
	hits: number;
	kills: number;
	counts: boolean;
	bonus: BonusKind | null;
}

export interface EnemySnapshot {
	uid: number;
	art: string;
	shape: string;
	size: number;
	elite: boolean;
	boss: boolean;
	x: number;
	y: number;
}

export type BattleEvent =
	| { type: 'shoot'; x: number; y: number; angle: number; power: number; arrows: number; bonus: BonusKind | null }
	| { type: 'hit'; uid: number; x: number; y: number; zone: Zone; damage: number; vx: number; vy: number; owner: Owner; stuck: boolean }
	| { type: 'armorOff'; uid: number; piece: 'helmet' | 'plate' | 'shield'; x: number; y: number; vx: number; vy: number }
	| { type: 'kill'; enemy: EnemySnapshot; head: boolean; cause: KillCause; vx: number; vy: number; multi: number }
	| { type: 'stick'; x: number; y: number; angle: number; owner: Owner }
	| { type: 'bounce'; x: number; y: number }
	| { type: 'explode'; x: number; y: number; r: number }
	| { type: 'miss' }
	| { type: 'combo'; gain: number; meter: number; streak: number; multi: number }
	| { type: 'comboFull'; bonus: BonusKind }
	| { type: 'rain'; x: number }
	| { type: 'projectileDown'; x: number; y: number; kind: string }
	| { type: 'projectileLand'; x: number; y: number; kind: string }
	| { type: 'throw'; uid: number; x: number; y: number; kind: string }
	| { type: 'hurt'; damage: number; x: number; y: number }
	| { type: 'block'; x: number; y: number }
	| { type: 'wallHit'; damage: number; broken: boolean }
	| { type: 'spawn'; uid: number }
	| { type: 'split'; x: number; y: number }
	| { type: 'wave'; index: number; total: number }
	| { type: 'helperShot'; angle: number }
	| { type: 'bossWindup'; kind: BossPattern['kind'] }
	| { type: 'bossStagger' }
	| { type: 'bossAct'; kind: BossPattern['kind'] }
	| { type: 'bossEnrage' }
	| { type: 'bossDown'; x: number; y: number }
	| { type: 'won' }
	| { type: 'lost' };

export interface BattleSetup {
	seed: number;
	act: number;
	row: number;
	kind: FightKind;
	stats: Stats;
	hp: number;
	tutorial: boolean;
	/** Bosses use this id instead of the act boss (for tests). */
	bossId?: string;
}

export interface BattleTally {
	shots: number;
	hits: number;
	kills: number;
	headshots: number;
	damageTaken: number;
	maxStreak: number;
	bonusShots: number;
	projectilesDown: number;
	time: number;
}

export interface HitShapes {
	head: Circle;
	body: Box;
	shield: Box | null;
	weak: Circle | null;
}

/** The hit shapes of a foe. The art uses the same numbers to draw it. */
export function hitShapes(e: Enemy): HitShapes {
	const s = e.size;
	if (e.boss) {
		const b = e.boss;
		return {
			head: { x: e.x + b.head.x, y: e.y + b.head.y, r: b.head.r },
			body: { x: e.x + b.body.x, y: e.y + b.body.y, w: b.body.w, h: b.body.h },
			shield: null,
			weak: { x: e.x + b.weak.x, y: e.y + b.weak.y, r: b.weak.r },
		};
	}
	if (e.def.shape === 'flyer') {
		return {
			head: { x: e.x - 14 * s, y: e.y - 4 * s, r: 7 * s },
			body: { x: e.x - 10 * s, y: e.y - 7 * s, w: 24 * s, h: 14 * s },
			shield: null,
			weak: null,
		};
	}
	return {
		head: { x: e.x + s, y: e.y - 63 * s, r: 9 * s },
		body: { x: e.x - 8 * s, y: e.y - 54 * s, w: 16 * s, h: 54 * s },
		shield: e.shield > 0 ? { x: e.x - 24 * s, y: e.y - 82 * s, w: 9 * s, h: 82 * s } : null,
		weak: null,
	};
}

export class Battle {
	readonly setup: BattleSetup;
	readonly stats: Stats;
	readonly rng: Rng;
	readonly kind: FightKind;
	t = 0;
	hp: number;
	maxHp: number;
	blocks: number;
	enemies: Enemy[] = [];
	arrows: Arrow[] = [];
	projectiles: Projectile[] = [];
	events: BattleEvent[] = [];
	waves: SpawnSpec[][];
	waveIndex = -1;
	queue: SpawnSpec[] = [];
	spawnT = 0;
	gapT = 0;
	/** Seconds since the last wave started, for the wave timeout. */
	waveAge = 0;
	held = 0;
	cool = 0;
	drawing = false;
	angle = -0.35;
	pull = 0;
	meter = 0;
	headGain = 0;
	streak = 0;
	bonus: BonusKind | null = null;
	wall: { hp: number; max: number } | null;
	helperT = 1.2;
	outcome: 'won' | 'lost' | null = null;
	tally: BattleTally = { shots: 0, hits: 0, kills: 0, headshots: 0, damageTaken: 0, maxStreak: 0, bonusShots: 0, projectilesDown: 0, time: 0 };
	/** The tutorial holds the first wave until the first shot. */
	holding: boolean;
	private uid = 1;
	private shotId = 1;
	private shots = new Map<number, Shot>();
	private acc = 0;
	private bossUid = 0;

	constructor(setup: BattleSetup) {
		this.setup = setup;
		this.stats = setup.stats;
		this.kind = setup.kind;
		this.rng = new Rng(setup.seed);
		this.hp = setup.hp;
		this.maxHp = setup.stats.maxHp;
		this.blocks = Math.round(setup.stats.block);
		this.wall = setup.stats.wall > 0 ? { hp: setup.stats.wall, max: setup.stats.wall } : null;
		this.waves = buildWaves(this.rng, setup.act, setup.row, setup.kind, setup.tutorial);
		this.holding = setup.tutorial && WAVES.tutorialHold;
		if (setup.kind === 'boss') this.spawnBoss(setup.bossId ?? ACTS[setup.act].boss);
		this.gapT = setup.kind === 'boss' ? 0 : 1.2;
	}

	// ---------- Aim and shoot ----------

	get drawTime() {
		return this.stats.drawTime;
	}

	/** The current pull: the smaller of the drag and the draw time. 0 to 1. */
	get power() {
		if (!this.drawing) return 0;
		return Math.min(this.pull, this.held / this.drawTime);
	}

	get ready() {
		return this.cool <= 0;
	}

	beginDraw() {
		if (this.outcome) return;
		this.drawing = true;
		this.held = 0;
	}

	/** Angle in radians, screen space: negative is up. Pull from 0 to 1. */
	setAim(angle: number, pull: number) {
		this.angle = Math.max(-1.45, Math.min(0.5, angle));
		this.pull = Math.max(0, Math.min(1, pull));
	}

	cancelDraw() {
		this.drawing = false;
		this.held = 0;
	}

	/** Shoots if the pull is strong enough. Returns true when a shot left. */
	release(): boolean {
		const power = this.power;
		this.drawing = false;
		this.held = 0;
		if (this.outcome || power < 0.08 || this.cool > 0) return false;
		this.fire(this.angle, power);
		return true;
	}

	/** Arrow speed for a pull. */
	speedFor(power: number) {
		return (PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * power) * this.stats.speedMult;
	}

	/** Points of the aim arc for the current aim. */
	arcPoints(angle = this.angle, power = this.power): { x: number; y: number }[] {
		const crown = this.bonus === 'crown';
		const v = crown ? BONUS.crown.speed : this.speedFor(power);
		const g = crown ? 0 : PHYSICS.gravity;
		const pts: { x: number; y: number }[] = [];
		const vx = Math.cos(angle) * v;
		const vy = Math.sin(angle) * v;
		const span = this.stats.aimArc * (crown ? 0.6 : 1);
		for (let t = BOW.aimArcDot; t <= span + 1e-6; t += BOW.aimArcDot) {
			const x = WORLD.bowX + vx * t;
			const y = WORLD.bowY + vy * t + 0.5 * g * t * t;
			if (y > WORLD.groundY) break;
			pts.push({ x, y });
		}
		return pts;
	}

	private fire(angle: number, power: number) {
		const s = this.stats;
		this.cool = s.cooldown;
		this.tally.shots++;
		this.holding = false;
		const bonus = this.bonus;
		const shot: Shot = { id: this.shotId++, arrows: 0, hits: 0, kills: 0, counts: true, bonus };
		this.shots.set(shot.id, shot);
		if (bonus) {
			this.bonus = null;
			this.meter = 0;
			this.headGain = 0;
			this.tally.bonusShots++;
		}
		if (bonus === 'crown') {
			const a = this.newArrow(shot, 'crown', angle, BONUS.crown.speed);
			a.gravity = 0;
			a.pierce = 999;
			this.events.push({ type: 'shoot', x: WORLD.bowX, y: WORLD.bowY, angle, power, arrows: 1, bonus });
			return;
		}
		const n = Math.max(1, Math.round(s.arrows));
		const spread = (BOW.multiSpread * Math.PI) / 180;
		for (let i = 0; i < n; i++) {
			const off = (i - (n - 1) / 2) * spread;
			const a = this.newArrow(shot, 'player', angle + off, this.speedFor(power));
			this.applyArrowBoosts(a);
			if (bonus === 'volley' && i === 0) a.rain = true;
		}
		this.events.push({ type: 'shoot', x: WORLD.bowX, y: WORLD.bowY, angle, power, arrows: n, bonus });
	}

	private applyArrowBoosts(a: Arrow) {
		const s = this.stats;
		a.damage = s.damage;
		a.pierce = Math.round(s.pierce);
		a.bounces = Math.round(s.bounce);
		a.bounceDamage = s.bounceDamage;
		a.split = Math.round(s.split);
		a.homing = s.homing;
		a.fire = s.fire;
		a.fireTime = s.fireTime;
		a.ice = s.ice;
		a.iceTime = s.iceTime;
		a.explosive = s.explosive;
		a.blast = s.blast;
	}

	private newArrow(shot: Shot, owner: Owner, angle: number, speed: number, x = WORLD.bowX, y = WORLD.bowY): Arrow {
		const a: Arrow = {
			uid: this.uid++,
			shot: shot.id,
			owner,
			x,
			y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			damage: DAMAGE.body,
			pierce: 0,
			bounces: 0,
			bounceDamage: 0,
			split: 0,
			homing: 0,
			fire: 0,
			fireTime: 0,
			ice: 0,
			iceTime: 0,
			explosive: 0,
			blast: 0,
			gravity: 1,
			age: 0,
			dead: false,
			hit: [],
			rain: false,
		};
		shot.arrows++;
		this.arrows.push(a);
		return a;
	}

	// ---------- Time ----------

	/** Advances by `dt` seconds in fixed steps. */
	update(dt: number) {
		this.acc += Math.min(dt, 0.1);
		while (this.acc >= PHYSICS.step) {
			this.acc -= PHYSICS.step;
			this.tick(PHYSICS.step);
		}
	}

	tick(dt: number) {
		this.t += dt;
		if (!this.outcome) this.tally.time += dt;
		if (this.cool > 0) this.cool -= dt;
		else if (this.drawing) this.held += dt;
		this.updateWaves(dt);
		this.updateHelper(dt);
		for (const e of this.enemies) this.updateEnemy(e, dt);
		this.enemies = this.enemies.filter((e) => e.hp > 0);
		for (const p of this.projectiles) this.updateProjectile(p, dt);
		this.projectiles = this.projectiles.filter((p) => !p.dead);
		for (let i = 0; i < this.arrows.length; i++) this.updateArrow(this.arrows[i], dt);
		this.arrows = this.arrows.filter((a) => !a.dead);
		this.checkEnd();
	}

	private checkEnd() {
		if (this.outcome) return;
		if (this.hp <= 0) {
			this.hp = 0;
			this.outcome = 'lost';
			this.drawing = false;
			this.events.push({ type: 'lost' });
			return;
		}
		const wavesDone = this.waveIndex >= this.waves.length - 1 && this.queue.length === 0;
		if (this.kind === 'boss') {
			if (!this.enemies.some((e) => e.boss)) this.win();
		} else if (wavesDone && this.enemies.length === 0 && this.waveIndex >= 0) {
			this.win();
		}
	}

	private win() {
		this.outcome = 'won';
		this.drawing = false;
		this.projectiles.forEach((p) => (p.dead = true));
		this.events.push({ type: 'won' });
	}

	// ---------- Waves ----------

	private updateWaves(dt: number) {
		if (this.outcome || this.holding) return;
		this.waveAge += dt;
		if (this.queue.length > 0) {
			this.spawnT -= dt;
			if (this.spawnT <= 0) {
				const next = this.queue.shift()!;
				this.spawn(next.foe, next.elite);
				if (this.queue.length) this.spawnT = this.queue[0].delay;
			}
			return;
		}
		if (this.waveIndex >= this.waves.length - 1) return;
		const left = this.enemies.filter((e) => !e.boss).length;
		if (this.waveIndex >= 0 && left > WAVES.nextWhenLeft && this.waveAge < WAVES.maxGap) return;
		this.gapT -= dt;
		if (this.gapT > 0) return;
		this.waveIndex++;
		this.waveAge = 0;
		this.gapT = WAVES.gapAfterClear;
		this.queue = [...this.waves[this.waveIndex]];
		this.spawnT = this.queue.length ? this.queue[0].delay : 0;
		if (this.kind !== 'boss') this.events.push({ type: 'wave', index: this.waveIndex, total: this.waves.length });
	}

	spawn(foe: string, elite: boolean, x = WORLD.spawnX + this.rng.range(0, 40), y?: number): Enemy {
		const def = ENEMIES[foe];
		const act = ACTS[this.setup.act];
		const hp = Math.ceil(def.hp * act.hpMult * (elite ? ELITE.hpMult : 1));
		const size = def.size * (elite ? ELITE.sizeMult : 1);
		const flying = def.flying;
		const alt = flying ? this.rng.range(flying.altitude[0], flying.altitude[1]) : 0;
		let stopX = WORLD.meleeX + this.rng.range(0, 34);
		if (def.thrower) stopX = this.rng.range(def.thrower.range[0], def.thrower.range[1]);
		if (flying) stopX = WORLD.archerX + this.rng.range(90, 150);
		const e: Enemy = {
			uid: this.uid++,
			def,
			boss: null,
			bs: null,
			x,
			y: y ?? (flying ? WORLD.groundY - alt : WORLD.groundY),
			size,
			hp,
			maxHp: hp,
			helmet: def.helmet + (elite ? ELITE.extraHelmet : 0),
			plate: def.plate,
			shield: def.shield,
			elite,
			state: flying ? 'hover' : 'walk',
			t: this.rng.range(0, 10),
			stopX,
			attackT: 0,
			windT: 0,
			burnT: 0,
			burnDps: 0,
			slowT: 0,
			slowF: 0,
			flash: 0,
			alt,
			diveT: 0,
			damageMult: elite ? ELITE.damageMult : 1,
			speedMult: (elite ? ELITE.speedMult : 1) * this.rng.range(0.92, 1.08),
			burnShot: 0,
			hopT: 0,
		};
		this.enemies.push(e);
		this.events.push({ type: 'spawn', uid: e.uid });
		return e;
	}

	private spawnBoss(id: string) {
		const b = BOSSES[id];
		const e = this.spawn('walker', false, WORLD.spawnX + 60);
		e.boss = b;
		e.hp = b.hp;
		e.maxHp = b.hp;
		e.size = 1;
		e.helmet = 0;
		e.plate = 0;
		e.y = WORLD.groundY - b.altitude;
		e.stopX = b.holdX;
		e.bs = { phase: 'enter', pattern: null, t: 0, weakHits: 0, left: 0, enraged: false, baseY: e.y };
		this.bossUid = e.uid;
		for (const [foe, n] of b.escort) for (let i = 0; i < n; i++) this.queue.push({ foe, elite: false, delay: 1.2 + i * 0.8 });
		this.spawnT = 1.5;
		this.waveIndex = 0;
	}

	get boss(): Enemy | undefined {
		return this.enemies.find((e) => e.uid === this.bossUid);
	}

	// ---------- Helper archer ----------

	private updateHelper(dt: number) {
		const s = this.stats;
		if (!s.helper || this.outcome) return;
		this.helperT -= dt;
		if (this.helperT > 0) return;
		const target = this.enemies.filter((e) => e.x < WORLD.width - 20).sort((a, b) => a.x - b.x)[0];
		if (!target) {
			this.helperT = 0.3;
			return;
		}
		this.helperT = s.helper;
		const shapes = hitShapes(target);
		const sx = WORLD.helperX + 10;
		const sy = WORLD.helperY - 14;
		const speed = 880;
		let tx = shapes.body.x + shapes.body.w / 2;
		let ty = shapes.body.y + shapes.body.h * 0.35;
		let angle = solveAim(sx, sy, tx, ty, speed, PHYSICS.gravity);
		if (angle === null) return;
		// Lead the target once.
		const time = (tx - sx) / (speed * Math.cos(angle));
		tx += this.velocityX(target) * time;
		angle = solveAim(sx, sy, tx, ty, speed, PHYSICS.gravity) ?? angle;
		angle += this.rng.gauss() * 0.02;
		const shot: Shot = { id: this.shotId++, arrows: 0, hits: 0, kills: 0, counts: false, bonus: null };
		this.shots.set(shot.id, shot);
		const a = this.newArrow(shot, 'helper', angle, speed, sx, sy);
		a.damage = 1;
		if (s.helperInherit) {
			this.applyArrowBoosts(a);
			a.split = 0;
		}
		this.events.push({ type: 'helperShot', angle });
	}

	/** How fast a foe moves left right now (negative is left). */
	velocityX(e: Enemy) {
		if (e.boss) return e.bs?.phase === 'charge' ? -400 : e.bs?.phase === 'enter' ? -e.boss.speed : 0;
		if (e.state === 'walk' || (e.state === 'hover' && e.x > e.stopX)) return -e.def.speed * this.speedFactor(e);
		return 0;
	}

	// ---------- Foes ----------

	private speedFactor(e: Enemy) {
		let f = e.speedMult;
		if (e.slowT > 0) f *= 1 - e.slowF;
		if (this.onSpikes(e)) f *= 1 - this.stats.spikesSlow;
		return f;
	}

	private onSpikes(e: Enemy) {
		return this.stats.spikes > 0 && !e.def.flying && !e.boss && e.x >= WORLD.spikesFrom && e.x <= WORLD.spikesTo;
	}

	private updateEnemy(e: Enemy, dt: number) {
		if (e.hp <= 0) return;
		e.t += dt;
		if (e.flash > 0) e.flash -= dt;
		if (e.slowT > 0) e.slowT -= dt;
		if (e.hopT > 0) {
			e.hopT -= dt;
			e.x += 60 * dt;
		}
		if (e.burnT > 0) {
			e.burnT -= dt;
			this.hurtEnemy(e, e.burnDps * dt, 'fire', e.burnShot, 0, 0);
			if (e.hp <= 0) return;
		}
		if (this.onSpikes(e)) {
			this.hurtEnemy(e, this.stats.spikes * dt, 'spikes', 0, 0, 0);
			if (e.hp <= 0) return;
		}
		if (this.outcome) return;
		if (e.boss) {
			this.updateBoss(e, dt);
			return;
		}
		const speed = e.def.speed * this.speedFactor(e);
		const fly = e.def.flying;
		if (fly) {
			const baseY = WORLD.groundY - e.alt + Math.sin(e.t * 2.2) * fly.bob;
			if (e.state === 'hover') {
				if (e.x > e.stopX) e.x -= speed * dt;
				e.y = baseY;
				if (e.x <= e.stopX + 4) {
					e.attackT -= dt;
					if (e.attackT <= 0) {
						e.state = 'dive';
						e.diveT = 0;
					}
				}
			} else {
				e.diveT += dt;
				const d = fly.dive;
				const k = e.diveT < d ? e.diveT / d : Math.max(0, 2 - e.diveT / d);
				const ease = k * k * (3 - 2 * k);
				e.y = baseY + (WORLD.targetY - 26 - baseY) * ease;
				e.x = e.stopX - ease * (e.stopX - WORLD.archerX - 26);
				if (e.diveT >= d && e.diveT - dt < d) this.hitPlayer(e.def.melee.damage * e.damageMult, e);
				if (e.diveT >= d * 2) {
					e.state = 'hover';
					e.attackT = e.def.melee.interval;
				}
			}
			return;
		}
		const wallStop = this.wall && this.wall.hp > 0 ? WORLD.wallX + 16 * e.size + this.rng.range(0, 3) : -Infinity;
		const stop = Math.max(e.stopX, e.x > WORLD.wallX ? wallStop : -Infinity);
		if (e.state === 'walk') {
			e.x -= speed * dt;
			if (e.x <= stop) {
				e.x = stop;
				e.state = e.def.thrower && e.stopX > WORLD.wallX + 40 ? 'throw' : 'attack';
				e.attackT = e.def.thrower && e.state === 'throw' ? 0.6 : e.def.melee.interval * 0.4;
			}
		} else if (e.state === 'attack') {
			// The wall fell: walk on.
			if (e.x > stop + 2) {
				e.state = 'walk';
				return;
			}
			e.attackT -= dt * (e.slowT > 0 ? 1 - e.slowF * 0.5 : 1);
			if (e.attackT <= 0) {
				e.attackT = e.def.melee.interval;
				const dmg = e.def.melee.damage * e.damageMult;
				if (this.wall && this.wall.hp > 0 && e.x > WORLD.wallX) this.hitWall(dmg, e);
				else this.hitPlayer(dmg, e);
			}
		} else if (e.state === 'throw') {
			const th = e.def.thrower!;
			if (e.windT > 0) {
				e.windT -= dt;
				if (e.windT <= 0) {
					this.throwAt(e.x - 6, e.y - 64 * e.size, th.projectile);
					this.events.push({ type: 'throw', uid: e.uid, x: e.x, y: e.y - 64 * e.size, kind: th.projectile.kind });
					e.attackT = th.interval;
				}
			} else {
				e.attackT -= dt * (e.slowT > 0 ? 1 - e.slowF : 1);
				if (e.attackT <= 0) e.windT = th.windup;
			}
		}
	}

	private throwAt(x: number, y: number, def: ProjectileDef) {
		const g = PHYSICS.gravity * def.gravity;
		const flight = def.flight * this.rng.range(0.92, 1.08);
		// Not every throw is true: a miss falls short or sails over the archer's head.
		let tx = WORLD.archerX + 4;
		let ty = WORLD.targetY + this.rng.range(-10, 10);
		if (!this.rng.chance(def.hitChance)) {
			if (this.rng.chance(0.5)) {
				tx = WORLD.archerX + this.rng.range(WORLD.missShort[0], WORLD.missShort[1]);
				ty = WORLD.groundY;
			} else {
				tx = WORLD.archerX - 30;
				ty = WORLD.targetY - 46 - this.rng.range(WORLD.missOver[0], WORLD.missOver[1]);
			}
		}
		const v = lobVelocity(x, y, tx, ty, flight, g);
		this.projectiles.push({ uid: this.uid++, def, x, y, vx: v.vx, vy: v.vy, hp: def.hp, age: 0, dead: false });
	}

	private updateBoss(e: Enemy, dt: number) {
		const b = e.boss!;
		const bs = e.bs!;
		const mult = bs.enraged ? b.enrage : 1;
		if (!bs.enraged && e.hp / e.maxHp < b.enrageAt) {
			bs.enraged = true;
			this.events.push({ type: 'bossEnrage' });
		}
		const hover = b.altitude > 0 ? Math.sin(e.t * 1.6) * 12 : 0;
		bs.t -= dt;
		switch (bs.phase) {
			case 'enter':
				e.x -= b.speed * dt;
				e.y = bs.baseY + hover;
				if (e.x <= b.holdX) {
					bs.phase = 'idle';
					bs.t = 1.2;
				}
				break;
			case 'idle':
			case 'guard':
				e.y = bs.baseY + hover;
				if (bs.t <= 0) {
					if (bs.phase === 'guard') this.events.push({ type: 'bossAct', kind: 'guard' });
					const pattern = this.rng.weighted(b.patterns, (p) => (p === bs.pattern || (p.kind === 'guard' && bs.phase === 'guard') ? p.weight * 0.2 : p.weight))!;
					bs.pattern = pattern;
					bs.weakHits = 0;
					if (pattern.kind === 'guard') {
						// It hides its weak spot, then picks again.
						bs.phase = 'guard';
						bs.t = pattern.duration;
						this.events.push({ type: 'bossWindup', kind: 'guard' });
						return;
					}
					bs.phase = 'windup';
					bs.t = pattern.windup * mult;
					this.events.push({ type: 'bossWindup', kind: pattern.kind });
				}
				break;
			case 'windup': {
				e.y = bs.baseY + hover;
				const p = bs.pattern!;
				if (bs.t > 0) break;
				this.events.push({ type: 'bossAct', kind: p.kind });
				if (p.kind === 'summon') {
					for (const [foe, n] of p.foes)
						for (let i = 0; i < n; i++) {
							this.spawn(foe, false, e.x + 30 + i * 36 + this.rng.range(0, 20));
						}
					this.restBoss(e, p.cooldown * mult);
				} else if (p.kind === 'hurl') {
					bs.phase = 'volley';
					bs.left = p.count;
					bs.t = 0;
				} else if (p.kind === 'charge') {
					bs.phase = 'charge';
				}
				break;
			}
			case 'volley': {
				const p = bs.pattern as Extract<BossPattern, { kind: 'hurl' }>;
				if (bs.t <= 0 && bs.left > 0) {
					const from = hitShapes(e).head;
					this.throwAt(from.x - 10, from.y, p.projectile);
					this.events.push({ type: 'throw', uid: e.uid, x: from.x, y: from.y, kind: p.projectile.kind });
					bs.left--;
					bs.t = p.gap;
				}
				if (bs.left <= 0 && bs.t <= 0) this.restBoss(e, p.cooldown * mult);
				break;
			}
			case 'charge': {
				const p = bs.pattern as Extract<BossPattern, { kind: 'charge' }>;
				const wallUp = this.wall && this.wall.hp > 0;
				const targetX = (wallUp && b.altitude === 0 ? WORLD.wallX + 30 : WORLD.meleeX + 26) - b.body.x;
				e.x -= 430 * dt;
				if (b.altitude > 0) {
					const k = Math.min(1, (b.holdX - e.x) / (b.holdX - targetX));
					e.y = bs.baseY + (WORLD.targetY - 30 - bs.baseY) * Math.sin((k * Math.PI) / 2);
				}
				if (e.x <= targetX) {
					e.x = targetX;
					if (wallUp && b.altitude === 0) this.hitWall(p.damage * 1.5, e);
					else this.hitPlayer(p.damage, e);
					bs.phase = 'return';
				}
				break;
			}
			case 'return':
				e.x += 200 * dt;
				e.y += (bs.baseY - e.y) * Math.min(1, dt * 3);
				if (e.x >= b.holdX) {
					e.x = b.holdX;
					this.restBoss(e, (bs.pattern?.kind === 'charge' ? bs.pattern.cooldown : 2) * mult);
				}
				break;
			case 'stagger':
				e.y += (bs.baseY - e.y) * Math.min(1, dt * 3);
				if (bs.t <= 0) this.restBoss(e, 1.2);
				break;
		}
	}

	private restBoss(e: Enemy, cooldown: number) {
		const bs = e.bs!;
		bs.phase = 'idle';
		bs.t = cooldown;
	}

	private hitPlayer(damage: number, from: Enemy | null) {
		if (this.outcome) return;
		const x = WORLD.archerX;
		const y = WORLD.targetY;
		if (this.blocks > 0) {
			this.blocks--;
			this.events.push({ type: 'block', x, y });
		} else {
			const dmg = Math.round(damage);
			this.hp -= dmg;
			this.tally.damageTaken += dmg;
			this.events.push({ type: 'hurt', damage: dmg, x, y });
		}
		if (from && this.stats.thorns > 0 && !from.boss) this.hurtEnemy(from, this.stats.thorns, 'thorns', 0, 0, 0);
	}

	private hitWall(damage: number, from: Enemy | null) {
		if (!this.wall) return;
		const dmg = Math.round(damage);
		this.wall.hp = Math.max(0, this.wall.hp - dmg);
		this.events.push({ type: 'wallHit', damage: dmg, broken: this.wall.hp <= 0 });
		if (from && this.stats.thorns > 0 && !from.boss) this.hurtEnemy(from, this.stats.thorns, 'thorns', 0, 0, 0);
	}

	// ---------- Projectiles ----------

	private updateProjectile(p: Projectile, dt: number) {
		p.age += dt;
		const px = p.x;
		const py = p.y;
		p.vy += PHYSICS.gravity * p.def.gravity * dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		if (this.wall && this.wall.hp > 0 && px > WORLD.wallX && p.x <= WORLD.wallX && p.y > WORLD.groundY - WORLD.wallHeight) {
			p.dead = true;
			this.hitWall(p.def.damage, null);
			this.events.push({ type: 'projectileLand', x: p.x, y: p.y, kind: p.def.kind });
			return;
		}
		// The archer's body: it hits only if it crosses this box.
		const box = { x: WORLD.archerX - 16, y: WORLD.targetY - 46, w: 34, h: WORLD.groundY - WORLD.targetY + 46 };
		if (segBox(px, py, p.x, p.y, { x: box.x - p.def.radius, y: box.y - p.def.radius, w: box.w + p.def.radius * 2, h: box.h + p.def.radius }) !== null) {
			p.dead = true;
			this.hitPlayer(p.def.damage, null);
			return;
		}
		if (p.y >= WORLD.groundY || p.x < -40) {
			p.dead = true;
			this.events.push({ type: 'projectileLand', x: p.x, y: WORLD.groundY, kind: p.def.kind });
		}
	}

	// ---------- Arrows ----------

	private updateArrow(a: Arrow, dt: number) {
		if (a.dead) return;
		a.age += dt;
		if (a.homing > 0) this.steer(a, dt);
		const wasRising = a.vy < 0;
		a.vy += PHYSICS.gravity * a.gravity * dt;
		if (a.split > 1 && wasRising && a.vy >= 0) this.splitArrow(a);
		const nx = a.x + a.vx * dt;
		const ny = a.y + a.vy * dt;
		if (this.collide(a, nx, ny)) return;
		a.x = nx;
		a.y = ny;
		if (a.y >= WORLD.groundY) {
			a.y = WORLD.groundY;
			if (a.bounces > 0) {
				a.bounces--;
				a.vy = -Math.abs(a.vy) * 0.5;
				a.vx *= 0.8;
				a.damage += a.bounceDamage;
				a.hit = [];
				this.events.push({ type: 'bounce', x: a.x, y: a.y });
				if (a.explosive) this.explode(a, a.x, a.y);
				return;
			}
			if (a.explosive) this.explode(a, a.x, a.y);
			this.events.push({ type: 'stick', x: a.x, y: a.y, angle: Math.atan2(a.vy, a.vx), owner: a.owner });
			this.endArrow(a);
			return;
		}
		if (a.x > WORLD.width + 260 || a.x < -120 || a.y < -900 || a.age > PHYSICS.arrowLife) this.endArrow(a);
	}

	private steer(a: Arrow, dt: number) {
		let best: Circle | null = null;
		let bestD = 300;
		for (const e of this.enemies) {
			const sh = hitShapes(e);
			const target = sh.weak ?? sh.head;
			if (target.x < a.x + 10) continue;
			const d = Math.hypot(target.x - a.x, target.y - a.y);
			if (d < bestD) {
				bestD = d;
				best = target;
			}
		}
		if (!best) return;
		const speed = Math.hypot(a.vx, a.vy);
		const cur = Math.atan2(a.vy, a.vx);
		const want = Math.atan2(best.y - a.y, best.x - a.x);
		let diff = want - cur;
		while (diff > Math.PI) diff -= Math.PI * 2;
		while (diff < -Math.PI) diff += Math.PI * 2;
		const max = ((a.homing * Math.PI) / 180) * dt;
		const turn = Math.max(-max, Math.min(max, diff));
		a.vx = Math.cos(cur + turn) * speed;
		a.vy = Math.sin(cur + turn) * speed;
	}

	private splitArrow(a: Arrow) {
		const shot = this.shots.get(a.shot)!;
		const speed = Math.hypot(a.vx, a.vy);
		const base = Math.atan2(a.vy, a.vx);
		const extra = a.split - 1;
		a.split = 0;
		for (let i = 0; i < extra; i++) {
			const side = i % 2 === 0 ? 1 : -1;
			const step = Math.floor(i / 2) + 1;
			const child = this.newArrow(shot, a.owner, base + side * step * 0.13, speed * (1 - step * 0.04), a.x, a.y);
			Object.assign(child, { ...a, uid: child.uid, vx: child.vx, vy: child.vy, hit: [], split: 0, rain: false });
		}
		this.events.push({ type: 'split', x: a.x, y: a.y });
	}

	private endArrow(a: Arrow) {
		if (a.dead) return;
		a.dead = true;
		if (a.rain) this.rain(a.x);
		const shot = this.shots.get(a.shot);
		if (!shot) return;
		shot.arrows--;
		if (shot.arrows <= 0) {
			this.shots.delete(shot.id);
			if (shot.counts && shot.hits === 0 && !shot.bonus) {
				this.streak = 0;
				this.events.push({ type: 'miss' });
			}
		}
	}

	private rain(x: number) {
		const b = BONUS.volley;
		const shot: Shot = { id: this.shotId++, arrows: 0, hits: 0, kills: 0, counts: false, bonus: 'volley' };
		this.shots.set(shot.id, shot);
		for (let i = 0; i < b.arrows; i++) {
			const ax = Math.max(160, x) + this.rng.range(-b.spread, b.spread);
			const ay = WORLD.groundY - b.height - this.rng.range(0, 260);
			const arrow = this.newArrow(shot, 'rain', Math.PI / 2 - 0.12 + this.rng.range(-0.05, 0.05), b.speed, ax, ay);
			arrow.damage = b.damage + (this.stats.damage - DAMAGE.body);
			arrow.fire = this.stats.fire;
			arrow.fireTime = this.stats.fireTime;
			arrow.ice = this.stats.ice;
			arrow.iceTime = this.stats.iceTime;
		}
		this.events.push({ type: 'rain', x });
	}

	/** Finds the first thing the arrow touches on its way to (nx, ny). Returns true if the arrow stopped. */
	private collide(a: Arrow, nx: number, ny: number): boolean {
		let bestT = 2;
		let bestE: Enemy | null = null;
		let bestP: Projectile | null = null;
		let bestZ: Zone = 'body';
		for (const p of this.projectiles) {
			const t = segCircle(a.x, a.y, nx, ny, { x: p.x, y: p.y, r: p.def.radius + HITBOX.projectilePad });
			if (t !== null && t < bestT) {
				bestT = t;
				bestP = p;
				bestE = null;
			}
		}
		for (const e of this.enemies) {
			if (e.hp <= 0 || a.hit.includes(e.uid)) continue;
			const sh = hitShapes(e);
			const pad = HITBOX.bodyPad;
			const test = (z: Zone, t: number | null) => {
				if (t !== null && t < bestT) {
					bestT = t;
					bestE = e;
					bestP = null;
					bestZ = z;
				}
			};
			if (sh.shield) test('shield', segBox(a.x, a.y, nx, ny, sh.shield));
			if (sh.weak) test('weak', segCircle(a.x, a.y, nx, ny, { ...sh.weak, r: sh.weak.r + HITBOX.headPad }));
			test('head', segCircle(a.x, a.y, nx, ny, { ...sh.head, r: sh.head.r + HITBOX.headPad }));
			test('body', segBox(a.x, a.y, nx, ny, { x: sh.body.x - pad, y: sh.body.y - pad, w: sh.body.w + pad * 2, h: sh.body.h + pad * 2 }));
		}
		if (bestT > 1) return false;
		const hx = a.x + (nx - a.x) * bestT;
		const hy = a.y + (ny - a.y) * bestT;
		const shot = this.shots.get(a.shot);
		if (bestP) {
			const p = bestP as Projectile;
			p.hp--;
			if (shot) shot.hits++;
			if (p.hp <= 0) {
				p.dead = true;
				this.tally.projectilesDown++;
				this.events.push({ type: 'projectileDown', x: p.x, y: p.y, kind: p.def.kind });
				if (a.owner === 'player') this.gainCombo(COMBO.killGain * 0.5, false, 1);
			} else {
				this.events.push({ type: 'hit', uid: 0, x: hx, y: hy, zone: 'plate', damage: 0, vx: a.vx, vy: a.vy, owner: a.owner, stuck: false });
			}
			if (a.pierce > 0) {
				a.pierce--;
				return false;
			}
			a.x = hx;
			a.y = hy;
			if (a.explosive) this.explode(a, hx, hy);
			this.endArrow(a);
			return true;
		}
		const e = bestE as Enemy | null;
		if (!e) return false;
		a.x = hx;
		a.y = hy;
		a.hit.push(e.uid);
		const passed = this.arrowHits(a, e, bestZ, hx, hy);
		if (passed) return false;
		if (a.explosive) this.explode(a, hx, hy);
		this.endArrow(a);
		return true;
	}

	/** Applies one arrow hit. Returns true when the arrow flies on. */
	private arrowHits(a: Arrow, e: Enemy, zone: Zone, x: number, y: number): boolean {
		const shot = this.shots.get(a.shot);
		const crown = a.owner === 'crown';
		const push = (z: Zone, damage: number, stuck: boolean) =>
			this.events.push({ type: 'hit', uid: e.uid, x, y, zone: z, damage, vx: a.vx, vy: a.vy, owner: a.owner, stuck });
		e.flash = 0.12;

		if (crown) {
			if (shot) shot.hits++;
			if (e.boss) {
				const dmg = BONUS.crown.bossDamage;
				push('weak', dmg, false);
				this.hurtEnemy(e, dmg, 'head', a.shot, a.vx, a.vy);
			} else {
				if (e.shield > 0) this.knock(e, 'shield', a);
				this.tally.headshots++;
				push('head', e.hp, false);
				this.killEnemy(e, true, 'head', a.shot, a.vx, a.vy);
			}
			return true;
		}

		if (zone === 'shield') {
			push('shield', 0, true);
			return false;
		}
		if (shot) shot.hits++;
		this.tally.hits++;
		const bs = e.bs;
		if (e.boss && bs) {
			if (bs.phase === 'guard') {
				push('guard', 0, false);
				return false;
			}
			let dmg = a.damage * (zone === 'weak' ? e.boss.weak.mult : zone === 'head' ? DAMAGE.bossHeadMult : e.boss.bodyArmor);
			if (bs.phase === 'stagger') dmg *= 1.5;
			if (zone === 'weak' && bs.phase === 'windup' && bs.pattern?.kind === 'charge') {
				bs.weakHits++;
				if (bs.weakHits >= bs.pattern.staggerHits) {
					bs.phase = 'stagger';
					bs.t = 1.8;
					this.events.push({ type: 'bossStagger' });
				}
			}
			push(zone, dmg, zone !== 'weak');
			this.applyStatus(e, a);
			this.hurtEnemy(e, dmg, zone === 'weak' ? 'head' : 'arrow', a.shot, a.vx, a.vy);
			return false;
		}
		if (zone === 'head') {
			if (e.helmet > 0) {
				this.knock(e, 'helmet', a);
				push('helmet', 0, false);
				return false;
			}
			this.applyStatus(e, a);
			push('head', e.hp, false);
			if (a.owner !== 'helper') this.tally.headshots++;
			this.killEnemy(e, true, 'head', a.shot, a.vx, a.vy);
		} else {
			if (e.plate > 0) {
				this.knock(e, 'plate', a);
				push('plate', 0, false);
				return false;
			}
			let dmg = a.damage;
			if (this.stats.brittle && e.slowT > 0) dmg += this.stats.brittle;
			this.applyStatus(e, a);
			push('body', dmg, e.hp > dmg);
			this.hurtEnemy(e, dmg, 'arrow', a.shot, a.vx, a.vy);
		}
		if (a.pierce > 0) {
			a.pierce--;
			return true;
		}
		return false;
	}

	private knock(e: Enemy, piece: 'helmet' | 'plate' | 'shield', a: { vx: number; vy: number }) {
		e[piece] = Math.max(0, e[piece] - 1);
		if (e[piece] === 0) {
			const sh = hitShapes(e);
			const at = piece === 'helmet' ? sh.head : piece === 'shield' && sh.shield ? { x: sh.shield.x, y: sh.shield.y + 20 } : { x: e.x, y: sh.body.y + 16 };
			this.events.push({ type: 'armorOff', uid: e.uid, piece, x: at.x, y: at.y, vx: a.vx, vy: a.vy });
		}
	}

	private applyStatus(e: Enemy, a: Arrow) {
		if (a.fire > 0) {
			e.burnT = Math.max(e.burnT, a.fireTime);
			e.burnDps = Math.max(e.burnDps, a.fire);
			e.burnShot = a.shot;
		}
		if (a.ice > 0) {
			e.slowT = Math.max(e.slowT, a.iceTime);
			e.slowF = Math.max(e.slowF, a.ice);
		}
	}

	private explode(a: Arrow, x: number, y: number) {
		const r = a.explosive;
		this.events.push({ type: 'explode', x, y, r });
		for (const p of this.projectiles) {
			if (Math.hypot(p.x - x, p.y - y) < r + p.def.radius) {
				p.dead = true;
				this.tally.projectilesDown++;
				this.events.push({ type: 'projectileDown', x: p.x, y: p.y, kind: p.def.kind });
			}
		}
		for (const e of [...this.enemies]) {
			if (e.hp <= 0) continue;
			const sh = hitShapes(e);
			const cx = sh.body.x + sh.body.w / 2;
			const cy = sh.body.y + sh.body.h / 2;
			const reach = r + Math.max(sh.body.w, sh.body.h) / 2;
			if (Math.hypot(cx - x, cy - y) > reach) continue;
			const shot = this.shots.get(a.shot);
			if (shot) shot.hits++;
			if (e.boss) {
				if (e.bs?.phase !== 'guard') this.hurtEnemy(e, a.blast * e.boss.bodyArmor, 'blast', a.shot, 0, -200);
				continue;
			}
			let armored = false;
			for (const piece of ['shield', 'helmet', 'plate'] as const)
				if (e[piece] > 0) {
					this.knock(e, piece, { vx: (cx - x) * 6, vy: -300 });
					armored = true;
				}
			if (!armored || e.plate === 0) this.hurtEnemy(e, a.blast, 'blast', a.shot, (cx - x) * 5, -260);
			if (a.fire > 0) this.applyStatus(e, a);
		}
	}

	private hurtEnemy(e: Enemy, dmg: number, cause: KillCause, shotId: number, vx: number, vy: number) {
		if (e.hp <= 0) return;
		e.hp -= dmg;
		if (e.hp <= 0.001) this.killEnemy(e, false, cause, shotId, vx, vy);
	}

	private killEnemy(e: Enemy, head: boolean, cause: KillCause, shotId: number, vx: number, vy: number) {
		if (e.hp <= -1000) return;
		e.hp = -1000;
		this.tally.kills++;
		const shot = shotId ? this.shots.get(shotId) : undefined;
		let multi = 1;
		if (shot) {
			shot.kills++;
			multi = shot.kills;
		}
		this.events.push({
			type: 'kill',
			enemy: { uid: e.uid, art: e.boss ? e.boss.art : e.def.art, shape: e.boss ? 'boss' : e.def.shape, size: e.size, elite: e.elite, boss: !!e.boss, x: e.x, y: e.y },
			head,
			cause,
			vx,
			vy,
			multi,
		});
		if (e.def.splits && !e.boss) {
			const n = e.def.splits.count + (e.elite ? 1 : 0);
			for (let i = 0; i < n; i++) {
				const s = this.spawn(e.def.splits.into, false, e.x + (i - (n - 1) / 2) * 18);
				s.hopT = 0.25 + i * 0.05;
			}
			this.events.push({ type: 'split', x: e.x, y: e.y - 30 });
		}
		if (this.stats.fireSpread && e.burnT > 0) {
			for (const o of this.enemies) {
				if (o.hp > 0 && o !== e && Math.abs(o.x - e.x) < 80 && Math.abs(o.y - e.y) < 120) {
					o.burnT = Math.max(o.burnT, this.stats.fireTime);
					o.burnDps = Math.max(o.burnDps, this.stats.fire);
					o.burnShot = e.burnShot;
				}
			}
		}
		if (e.boss) {
			this.events.push({ type: 'bossDown', x: e.x, y: e.y });
			for (const o of this.enemies) if (o !== e && o.hp > 0) this.killEnemy(o, false, 'boss', 0, 0, -200);
			return;
		}
		if (cause === 'boss') return;
		// Bonus shots never fill the meter again.
		if (shot?.bonus) return;
		this.streak++;
		this.tally.maxStreak = Math.max(this.tally.maxStreak, this.streak);
		const base = COMBO.killGain + Math.min(this.streak - 1, COMBO.streakCap) * COMBO.streakGain;
		const gain = (head ? base * COMBO.headshotMult : base) + (multi > 1 ? COMBO.multiKillBonus : 0);
		this.gainCombo(gain, head, multi);
	}

	private gainCombo(gain: number, head: boolean, multi: number) {
		if (this.bonus) return;
		this.meter = Math.min(COMBO.max, this.meter + gain);
		if (head) this.headGain += gain;
		this.events.push({ type: 'combo', gain, meter: this.meter, streak: this.streak, multi });
		if (this.meter >= COMBO.max) {
			this.bonus = this.headGain / COMBO.max >= COMBO.crownShare ? 'crown' : 'volley';
			this.events.push({ type: 'comboFull', bonus: this.bonus });
		}
	}

	/** Takes the events since the last call. */
	drain(): BattleEvent[] {
		const out = this.events;
		this.events = [];
		return out;
	}
}
