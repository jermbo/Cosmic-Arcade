// A bot archer for the headless sim. It aims like a person: picks a target, misjudges a bit, pulls, lets go.

import { PHYSICS, WORLD } from './data/balance.ts';
import { type Battle, type Enemy, hitShapes } from './combat.ts';
import { solveAim } from './geom.ts';
import type { Rng } from './rng.ts';

export interface BotSkill {
	name: string;
	/** Aim error in radians (one spread). */
	angleNoise: number;
	/** Pull error as a share of the pull. */
	powerNoise: number;
	/** Chance to aim at the head instead of the body. */
	headAim: number;
	/** Seconds of thinking between shots. */
	reaction: number;
	/** How well it leads moving targets, 0 to 1. */
	lead: number;
	/** Chance to shoot a projectile down when one is coming. */
	shootDown: number;
}

export const SKILLS: Record<string, BotSkill> = {
	novice: { name: 'novice', angleNoise: 0.085, powerNoise: 0.11, headAim: 0.2, reaction: 1.0, lead: 0.35, shootDown: 0.3 },
	average: { name: 'average', angleNoise: 0.055, powerNoise: 0.075, headAim: 0.45, reaction: 0.7, lead: 0.65, shootDown: 0.55 },
	skilled: { name: 'skilled', angleNoise: 0.032, powerNoise: 0.045, headAim: 0.7, reaction: 0.45, lead: 0.9, shootDown: 0.85 },
};

interface Plan {
	angle: number;
	power: number;
}

export class Bot {
	skill: BotSkill;
	rng: Rng;
	wait = 0.6;
	plan: Plan | null = null;

	constructor(skill: BotSkill, rng: Rng) {
		this.skill = skill;
		this.rng = rng;
	}

	step(b: Battle, dt: number) {
		if (b.outcome) return;
		if (this.plan) {
			if (b.held >= b.drawTime * this.plan.power || b.held > b.drawTime * 1.5) {
				b.release();
				this.plan = null;
				this.wait = this.skill.reaction * this.rng.range(0.7, 1.3);
			}
			return;
		}
		this.wait -= dt;
		if (this.wait > 0 || !b.ready) return;
		const plan = this.choose(b);
		if (!plan) {
			this.wait = 0.2;
			return;
		}
		this.plan = plan;
		b.beginDraw();
		b.setAim(plan.angle, plan.power);
		// A held tutorial wave needs a first shot to start.
	}

	private choose(b: Battle): Plan | null {
		const s = this.skill;
		// Shoot down the most urgent projectile.
		const incoming = b.projectiles.filter((p) => p.x < WORLD.width && p.x > WORLD.bowX + 140).sort((p, q) => p.x - q.x)[0];
		if (incoming && this.rng.chance(s.shootDown)) {
			const lead = 0.18 * s.lead;
			return this.aimAt(b, incoming.x + incoming.vx * lead, incoming.y + incoming.vy * lead, false, 0);
		}
		const boss = b.boss;
		if (boss && boss.bs && boss.bs.phase !== 'enter' && boss.x < WORLD.width) {
			const near = b.enemies.filter((e) => !e.boss && e.x < 330);
			if (!near.length) {
				const w = hitShapes(boss).weak!;
				const aimWeak = boss.bs.phase !== 'guard' && this.rng.chance(0.4 + s.headAim * 0.6);
				const target = aimWeak ? w : { x: boss.x, y: hitShapes(boss).body.y + 40 };
				return this.aimAt(b, target.x, target.y, false, b.velocityX(boss));
			}
		}
		const foes = b.enemies.filter((e) => !e.boss && e.x < WORLD.width + 10);
		if (!foes.length) {
			// Nothing on screen: the tutorial waits for a shot, so loose one.
			if (b.holding) return { angle: -0.5, power: 0.6 };
			return null;
		}
		const threat = (e: Enemy) => e.x - (e.def.flying ? 60 : 0) - (e.state === 'attack' ? 80 : 0) - (e.def.thrower && e.state === 'throw' ? 40 : 0);
		const target = foes.sort((p, q) => threat(p) - threat(q))[0];
		const sh = hitShapes(target);
		const head = target.helmet === 0 && this.rng.chance(s.headAim);
		const point = head ? { x: sh.head.x, y: sh.head.y } : { x: sh.body.x + sh.body.w / 2, y: sh.body.y + sh.body.h * 0.4 };
		return this.aimAt(b, point.x, point.y, target.shield > 0, b.velocityX(target));
	}

	private aimAt(b: Battle, tx: number, ty: number, lob: boolean, vx: number): Plan | null {
		const s = this.skill;
		const g = PHYSICS.gravity;
		const powers = lob ? [0.75, 0.85, 1] : [1, 0.9];
		for (const power of powers) {
			const v = b.speedFor(power);
			let angle = solveAim(WORLD.bowX, WORLD.bowY, tx, ty, v, g, lob);
			if (angle === null) continue;
			const time = (tx - WORLD.bowX) / Math.max(1, v * Math.cos(angle)) + b.drawTime * power;
			const lx = tx + vx * time * s.lead;
			angle = solveAim(WORLD.bowX, WORLD.bowY, lx, ty, v, g, lob) ?? angle;
			const noisyAngle = angle + this.rng.gauss() * s.angleNoise;
			const noisyPower = Math.max(0.1, Math.min(1, power * (1 + this.rng.gauss() * s.powerNoise)));
			return { angle: noisyAngle, power: noisyPower };
		}
		return null;
	}
}
