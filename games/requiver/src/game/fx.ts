// Game feel for a fight: particles, hit stop, slow motion, shake, pop-up text,
// corpses that fall, and arrows that stay stuck in the ground.

import { art } from '../art/index.ts';
import type { CorpseView } from '../art/types.ts';
import { WORLD } from '../rules/data/balance.ts';
import { k } from './k.ts';
import { game } from './state.ts';

interface Pop {
	text: string;
	x: number;
	y: number;
	age: number;
	life: number;
	size: number;
	color: string;
	rise: number;
}

interface Corpse extends CorpseView {
	vx: number;
	vy: number;
	spin: number;
	age: number;
	grounded: boolean;
	target: number;
}

interface FlyingPart {
	kind: 'head' | 'helmet' | 'plate' | 'shield' | 'arrow';
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number;
	spin: number;
	r: number;
	age: number;
}

export interface Stuck {
	x: number;
	y: number;
	angle: number;
	age: number;
	owner: string;
}

export class Fx {
	act: number;
	hitStop = 0;
	slowT = 0;
	slowScale = 1;
	pops: Pop[] = [];
	corpses: Corpse[] = [];
	parts: FlyingPart[] = [];
	ground: Stuck[] = [];
	/** Arrows stuck in a foe: offsets from its anchor. */
	inFoe = new Map<number, { dx: number; dy: number; angle: number }[]>();
	kicks = new Map<number, number>();
	dim = 0;
	dimTarget = 0;

	constructor(act: number) {
		this.act = act;
	}

	get timeScale() {
		return this.slowT > 0 ? this.slowScale : 1;
	}

	stop(seconds: number) {
		if (!game.save.settings.hitStop) return;
		this.hitStop = Math.max(this.hitStop, seconds);
	}

	slowmo(scale: number, seconds: number) {
		this.slowScale = scale;
		this.slowT = Math.max(this.slowT, seconds);
	}

	shake(amount: number) {
		const s = game.save.settings.shake;
		if (s > 0) k.shake(amount * s);
	}

	/** A particle burst. `dir` in radians; null sprays all around. */
	burst(kind: string, x: number, y: number, dir: number | null = null, scale = 1) {
		const style = art.particle(kind, this.act);
		const sheet = k.getSprite('fx')?.data;
		if (!style || !sheet) return;
		const count = Math.max(1, Math.round(style.count * scale));
		const life = style.life[1] + 0.05;
		const obj = k.add([
			k.pos(x, y),
			k.z(30),
			k.particles(
				{
					max: count,
					texture: sheet.tex,
					quads: [sheet.frames[style.frame] ?? sheet.frames[0]],
					colors: style.colors.map((c) => k.rgb(c)),
					opacities: style.opacities,
					scales: style.scales,
					speed: style.speed,
					lifeTime: style.life,
					acceleration: [k.vec2(0, style.gravity), k.vec2(0, style.gravity)],
					damping: [style.damping, style.damping],
					angularVelocity: [-style.spin, style.spin],
					angle: [0, 360],
				},
				{ direction: dir === null ? 0 : (dir * 180) / Math.PI, spread: dir === null ? 180 : style.spread, lifetime: life },
			),
		]);
		obj.emit(count);
		obj.onEnd(() => obj.destroy());
	}

	pop(text: string, x: number, y: number, size = 22, color = '#fff3dc', life = 0.9, rise = 50) {
		this.pops.push({ text, x, y, age: 0, life, size, color, rise });
	}

	kick(uid: number, amount: number) {
		this.kicks.set(uid, (this.kicks.get(uid) ?? 0) + amount);
	}

	corpse(c: CorpseView, vx: number, vy: number) {
		const flyer = c.shape === 'flyer';
		this.corpses.push({
			...c,
			vx: Math.max(-60, Math.min(220, vx * 0.16)),
			vy: flyer ? -40 : Math.min(-40, vy * 0.1) - 40 - Math.random() * 60,
			spin: (flyer ? 4 : 2.4) * (0.8 + Math.random() * 0.4),
			age: 0,
			grounded: false,
			target: flyer ? Math.PI * (0.8 + Math.random() * 0.4) : Math.PI / 2 - 0.08,
		});
	}

	part(kind: FlyingPart['kind'], x: number, y: number, vx: number, vy: number, r = 8) {
		this.parts.push({ kind, x, y, vx, vy, angle: 0, spin: (Math.random() - 0.5) * 18, r, age: 0 });
	}

	stick(x: number, y: number, angle: number, owner: string) {
		this.ground.push({ x, y, angle, age: 0, owner });
		if (this.ground.length > 70) this.ground.shift();
	}

	stickInFoe(uid: number, dx: number, dy: number, angle: number) {
		const list = this.inFoe.get(uid) ?? [];
		list.push({ dx, dy, angle });
		if (list.length > 6) list.shift();
		this.inFoe.set(uid, list);
	}

	/** Real time, not game time: effects keep moving during hit stop. */
	update(dt: number) {
		if (this.slowT > 0) this.slowT -= dt;
		this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 4);
		for (const p of this.pops) p.age += dt;
		this.pops = this.pops.filter((p) => p.age < p.life);
		for (const [uid, v] of this.kicks) {
			const n = v * Math.max(0, 1 - dt * 14);
			if (Math.abs(n) < 0.1) this.kicks.delete(uid);
			else this.kicks.set(uid, n);
		}
		const g = 900;
		for (const c of this.corpses) {
			c.age += dt;
			if (!c.grounded) {
				c.vy += g * dt;
				c.x += c.vx * dt;
				c.y = Math.min(WORLD.groundY, c.y + c.vy * dt);
				c.angle += (c.target - c.angle) * Math.min(1, dt * c.spin);
				if (c.y >= WORLD.groundY && (c.shape !== 'flyer' || c.vy > 0)) {
					if (c.shape === 'flyer') c.y = WORLD.groundY - 6;
					c.grounded = true;
					this.burst('dust', c.x, WORLD.groundY, -Math.PI / 2, 0.6);
				}
			} else {
				c.vx *= Math.max(0, 1 - dt * 8);
				c.x += c.vx * dt;
				c.angle += (c.target - c.angle) * Math.min(1, dt * 10);
			}
			if (c.age > 1.3) {
				const before = c.fade;
				c.fade = Math.min(1, (c.age - 1.3) / 0.6);
				if (before === 0) this.burst('dissolve', c.x + 20 * c.size, c.y - 10, null, 0.8);
			}
		}
		this.corpses = this.corpses.filter((c) => c.fade < 1);
		for (const p of this.parts) {
			p.age += dt;
			p.vy += g * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.angle += p.spin * dt;
			if (p.y > WORLD.groundY - p.r * 0.5) {
				p.y = WORLD.groundY - p.r * 0.5;
				p.vy *= -0.35;
				p.vx *= 0.6;
				p.spin *= 0.5;
			}
		}
		this.parts = this.parts.filter((p) => p.age < 2.2);
		for (const s of this.ground) s.age += dt;
	}

	drawGround() {
		for (const s of this.ground) {
			art.arrow({ x: s.x, y: s.y, angle: s.angle, kind: 'stuck', trail: [], fire: false, ice: false, explosive: false, opacity: 1, act: this.act, length: 0.72 });
		}
	}

	drawCorpses() {
		for (const c of this.corpses) art.corpse(c);
		for (const p of this.parts) {
			const o = Math.min(1, (2.2 - p.age) * 2);
			if (p.kind === 'arrow') {
				art.arrow({ x: p.x, y: p.y, angle: p.angle, kind: 'stuck', trail: [], fire: false, ice: false, explosive: false, opacity: o, act: this.act, length: 1 });
			} else {
				art.piece({ kind: p.kind, x: p.x, y: p.y, angle: p.angle, r: p.r, opacity: o, act: this.act });
			}
		}
	}

	drawPops() {
		for (const p of this.pops) {
			const t = p.age / p.life;
			const grow = t < 0.15 ? 0.6 + (t / 0.15) * 0.55 : 1.15 - Math.min(0.15, (t - 0.15) * 0.5);
			const o = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
			art.text(p.text, p.x, p.y - p.rise * Math.sqrt(t), p.size * grow, p.color, o);
		}
	}
}
