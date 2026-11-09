// The space map: home station, planets, cargo routes and ships.

import { PLANETS } from '../core/data.ts';
import { fmt } from '../core/format.ts';
import { SHIP_WAIT } from '../core/sim.ts';
import type { Game } from '../core/state.ts';
import { drawPlanet, drawShip, glow, roundRect, withAlpha } from './draw.ts';
import { burst, popup, ring } from './fx.ts';

interface Star {
	x: number;
	y: number;
	z: number;
	s: number;
	p: number;
}

const ANGLES = [-140, -68, -8, 52, 118, 178].map((d) => (d * Math.PI) / 180);
const DIST = [0.8, 0.95, 1, 0.92, 1, 0.88];

export class SpaceView {
	w = 0;
	h = 0;
	home = { x: 0, y: 0, r: 30 };
	pos: { x: number; y: number; r: number }[] = [];
	private stars: Star[] = [];
	private nebula: HTMLCanvasElement | null = null;
	private bump = new Float32Array(6);
	private homeBump = 0;
	selected = -1;
	/** income per planet, smoothed, for labels */
	rate = new Float64Array(6);
	/** For the tutorial: a planet to point at. */
	pointAt = -1;
	showLabels = true;

	constructor() {
		for (let i = 0; i < 220; i++) this.stars.push({ x: Math.random(), y: Math.random(), z: Math.random(), s: Math.random(), p: Math.random() * 6.28 });
	}

	layout(w: number, h: number, top: number, bottom: number) {
		this.w = w;
		this.h = h;
		const availH = h - top - bottom;
		const cyy = top + availH / 2;
		const base = Math.min(w, availH);
		const r = Math.max(18, Math.min(46, base * 0.068));
		this.home = { x: w / 2, y: cyy, r: r * 0.95 };
		const rx = Math.min(w * 0.37, availH * 0.62);
		const ry = Math.min(availH * 0.37, w * 0.7);
		this.pos = PLANETS.map((_, i) => ({ x: w / 2 + Math.cos(ANGLES[i]) * rx * DIST[i], y: cyy + Math.sin(ANGLES[i]) * ry * DIST[i], r: r * (1 + i * 0.04) }));
		this.nebula = this.renderNebula(w, h);
	}

	/** Which planet (0..5), -2 for home, or -1. */
	hit(g: Game, sx: number, sy: number): number {
		for (let i = 0; i < this.pos.length; i++) {
			if (!this.visible(g, i)) continue;
			const p = this.pos[i];
			if (Math.hypot(sx - p.x, sy - p.y) < Math.max(p.r * 1.35, 30)) return i;
		}
		if (Math.hypot(sx - this.home.x, sy - this.home.y) < this.home.r * 1.4) return -2;
		return -1;
	}

	visible(g: Game, i: number) {
		return i === 0 || g.planets[i].unlocked || g.planets[i - 1].unlocked;
	}

	tapPlanet(i: number, value: number, color: string) {
		const p = this.pos[i];
		this.bump[i] = 1;
		burst(p.x, p.y, color, 7, 180, { size: 3, life: 0.5 });
		popup(p.x, p.y - p.r - 8, '+' + fmt(value), '#ffe58a', 18);
	}

	onSold(pi: number, amount: number) {
		const h = this.home;
		this.homeBump = 1;
		const col = PLANETS[pi].color;
		ring(h.x, h.y, col, h.r * 0.8, h.r * 3, 0.7);
		burst(h.x, h.y, col, 16, 200, { size: 3, life: 0.7 });
		burst(h.x, h.y, '#ffffff', 6, 120, { size: 2, life: 0.4 });
		popup(h.x, h.y - h.r - 14, '+' + fmt(amount), '#ffe58a', 18);
		this.rate[pi] += amount;
	}

	onDepart(pi: number) {
		const p = this.pos[pi];
		burst(p.x, p.y, PLANETS[pi].light, 6, 80, { size: 2, life: 0.5 });
	}

	/** Where ships sit at a planet: on its edge, facing home. */
	dock(pi: number) {
		const a = this.pos[pi];
		const b = this.home;
		const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		const k = (a.r * 1.18) / d;
		return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: Math.atan2(b.y - a.y, b.x - a.x) };
	}

	/** Point on a route. dir 1 goes home, 2 goes back. */
	private route(pi: number, t: number, dir: 1 | 2) {
		const a0 = this.pos[pi];
		const b0 = this.home;
		const d = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
		const ux = (b0.x - a0.x) / d;
		const uy = (b0.y - a0.y) / d;
		const a = { x: a0.x + ux * a0.r * 1.18, y: a0.y + uy * a0.r * 1.18 };
		const b = { x: b0.x - ux * b0.r * 1.2, y: b0.y - uy * b0.r * 1.2 };
		const from = dir === 1 ? a : b;
		const to = dir === 1 ? b : a;
		const mx = (a.x + b.x) / 2;
		const my = (a.y + b.y) / 2;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const side = dir === 1 ? 0.22 : -0.22;
		const qx = mx - dy * side;
		const qy = my + dx * side;
		const e = t * t * (3 - 2 * t);
		const k1 = (1 - e) * (1 - e);
		const k2 = 2 * (1 - e) * e;
		const k3 = e * e;
		const x = from.x * k1 + qx * k2 + to.x * k3;
		const y = from.y * k1 + qy * k2 + to.y * k3;
		const tx = 2 * (1 - e) * (qx - from.x) + 2 * e * (to.x - qx);
		const ty = 2 * (1 - e) * (qy - from.y) + 2 * e * (to.y - qy);
		return { x, y, a: Math.atan2(ty, tx), speed: 6 * t * (1 - t) };
	}

	draw(ctx: CanvasRenderingContext2D, g: Game, time: number, dt: number) {
		this.drawSky(ctx, time);
		for (let i = 0; i < 6; i++) {
			this.bump[i] = Math.max(0, this.bump[i] - dt * 5);
			this.rate[i] *= Math.exp(-dt / 12);
		}
		this.homeBump = Math.max(0, this.homeBump - dt * 3);

		// routes
		for (let i = 0; i < 6; i++) {
			if (!g.planets[i].unlocked) continue;
			for (const dir of [1, 2] as const) {
				ctx.beginPath();
				for (let k = 0; k <= 24; k++) {
					const p = this.route(i, k / 24, dir);
					if (k) ctx.lineTo(p.x, p.y);
					else ctx.moveTo(p.x, p.y);
				}
				ctx.setLineDash([3, 7]);
				ctx.lineDashOffset = -time * 14;
				ctx.strokeStyle = withAlpha(PLANETS[i].color, dir === 1 ? 0.35 : 0.15);
				ctx.lineWidth = 1.5;
				ctx.stroke();
				ctx.setLineDash([]);
			}
		}

		this.drawHome(ctx, g, time);

		// planets
		for (let i = 0; i < 6; i++) this.drawPlanetSpot(ctx, g, i, time);

		// ships
		for (let i = 0; i < 6; i++) {
			const p = g.planets[i];
			if (!p.unlocked) continue;
			const pos = this.pos[i];
			const sz = Math.max(5, pos.r * 0.22);
			let queue = 0;
			let first = true;
			for (const s of p.ships) {
				if (s.ph === 0) {
					// waiting ships circle the planet; the loading one sits on top
					if (first) {
						first = false;
						const load = Math.min(1, s.wait / SHIP_WAIT);
						const dk = this.dock(i);
						if (s.cargo.length) glow(ctx, dk.x, dk.y, sz * 2.4, PLANETS[i].color, 0.3 + 0.4 * load);
						drawShip(ctx, dk.x, dk.y, dk.a, sz, PLANETS[i].color, 0, time);
					} else {
						const a = time * 0.8 + queue * 1.3;
						queue++;
						drawShip(ctx, pos.x + Math.cos(a) * pos.r * 1.6, pos.y + Math.sin(a) * pos.r * 1.6, a + Math.PI / 2, sz * 0.8, PLANETS[i].color, 0.3, time);
					}
					continue;
				}
				const r = this.route(i, s.t, s.ph);
				if (s.ph === 1) glow(ctx, r.x, r.y, sz * 2.2, PLANETS[i].color, 0.35);
				drawShip(ctx, r.x, r.y, r.a, sz, PLANETS[i].color, 0.4 + r.speed * 0.6, time);
			}
		}

		if (this.showLabels) this.drawLabels(ctx, g);
	}

	private drawSky(ctx: CanvasRenderingContext2D, time: number) {
		if (this.nebula) ctx.drawImage(this.nebula, 0, 0, this.w, this.h);
		for (const s of this.stars) {
			const x = ((s.x * this.w + time * (2 + s.z * 6)) % (this.w + 4)) - 2;
			const y = s.y * this.h;
			const tw = 0.5 + 0.5 * Math.sin(time * (0.8 + s.s * 2) + s.p);
			const a = (0.25 + s.z * 0.6) * (0.5 + tw * 0.5);
			ctx.fillStyle = `rgba(220,235,255,${a})`;
			const size = 0.6 + s.z * 1.4;
			ctx.fillRect(x, y, size, size);
		}
	}

	private renderNebula(w: number, h: number) {
		const c = document.createElement('canvas');
		c.width = Math.max(1, Math.ceil(w / 3));
		c.height = Math.max(1, Math.ceil(h / 3));
		const g = c.getContext('2d')!;
		const bg = g.createLinearGradient(0, 0, 0, c.height);
		bg.addColorStop(0, '#070a17');
		bg.addColorStop(1, '#0a0716');
		g.fillStyle = bg;
		g.fillRect(0, 0, c.width, c.height);
		const blobs: [number, number, number, string][] = [
			[0.2, 0.25, 0.5, 'rgba(94,60,200,0.22)'],
			[0.85, 0.7, 0.55, 'rgba(30,140,190,0.18)'],
			[0.6, 0.15, 0.35, 'rgba(255,95,174,0.10)'],
			[0.15, 0.85, 0.4, 'rgba(60,200,160,0.08)'],
		];
		for (const [bx, by, br, col] of blobs) {
			const r = br * Math.max(c.width, c.height);
			const grd = g.createRadialGradient(bx * c.width, by * c.height, 0, bx * c.width, by * c.height, r);
			grd.addColorStop(0, col);
			grd.addColorStop(1, 'rgba(0,0,0,0)');
			g.fillStyle = grd;
			g.fillRect(0, 0, c.width, c.height);
		}
		return c;
	}

	private drawHome(ctx: CanvasRenderingContext2D, g: Game, time: number) {
		const { x, y, r } = this.home;
		const b = 1 + this.homeBump * 0.12;
		if (g.beaconLit) {
			const pulse = 0.6 + 0.4 * Math.sin(time * 2);
			for (let k = 0; k < 6; k++) {
				const a = time * 0.15 + (k / 6) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + Math.cos(a - 0.04) * r * 9, y + Math.sin(a - 0.04) * r * 9);
				ctx.lineTo(x + Math.cos(a + 0.04) * r * 9, y + Math.sin(a + 0.04) * r * 9);
				ctx.closePath();
				ctx.fillStyle = withAlpha('#fff2b0', 0.05 * pulse);
				ctx.fill();
			}
			glow(ctx, x, y, r * 6, '#ffe58a', 0.35 * pulse);
		}
		glow(ctx, x, y, r * 3 * b, '#5ef2ff', 0.35 + this.homeBump * 0.4);
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(b, b);
		// outer ring
		ctx.save();
		ctx.rotate(time * 0.25);
		ctx.beginPath();
		ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
		ctx.strokeStyle = withAlpha('#5ef2ff', 0.55);
		ctx.lineWidth = r * 0.08;
		ctx.setLineDash([r * 0.5, r * 0.18]);
		ctx.stroke();
		ctx.setLineDash([]);
		for (let k = 0; k < 4; k++) {
			ctx.rotate(Math.PI / 2);
			roundRect(ctx, r * 0.95, -r * 0.1, r * 0.4, r * 0.2, r * 0.06);
			ctx.fillStyle = '#9fb4ff';
			ctx.fill();
		}
		ctx.restore();
		// inner ring
		ctx.save();
		ctx.rotate(-time * 0.6);
		ctx.beginPath();
		ctx.ellipse(0, 0, r * 0.8, r * 0.8, 0, 0, Math.PI * 2);
		ctx.strokeStyle = '#2a3a6a';
		ctx.lineWidth = r * 0.22;
		ctx.stroke();
		for (let k = 0; k < 8; k++) {
			const a = (k / 8) * Math.PI * 2;
			ctx.fillStyle = k % 2 ? '#5ef2ff' : '#ff5fae';
			ctx.beginPath();
			ctx.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.06, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
		// core
		const grd = ctx.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r * 0.55);
		grd.addColorStop(0, '#ffffff');
		grd.addColorStop(0.4, '#8ff7ff');
		grd.addColorStop(1, '#1d6a8a');
		ctx.beginPath();
		ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
		ctx.fillStyle = grd;
		ctx.fill();
		ctx.restore();
	}

	private drawPlanetSpot(ctx: CanvasRenderingContext2D, g: Game, i: number, time: number) {
		const p = this.pos[i];
		const st = g.planets[i];
		if (!this.visible(g, i)) {
			// far planets: a faint outline only
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
			ctx.setLineDash([3, 5]);
			ctx.strokeStyle = 'rgba(140,155,200,0.18)';
			ctx.lineWidth = 1.2;
			ctx.stroke();
			ctx.setLineDash([]);
			return;
		}
		const locked = !st.unlocked;
		const b = this.bump[i];
		const scale = 1 + Math.sin(b * Math.PI) * 0.1;
		if (this.selected === i) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r * 1.35, 0, Math.PI * 2);
			ctx.strokeStyle = withAlpha(PLANETS[i].color, 0.6);
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);
			ctx.lineDashOffset = time * 10;
			ctx.stroke();
			ctx.setLineDash([]);
		}
		if (this.pointAt === i) {
			const a = 0.5 + 0.5 * Math.sin(time * 5);
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r * (1.45 + a * 0.2), 0, Math.PI * 2);
			ctx.strokeStyle = withAlpha('#ffffff', 0.4 + a * 0.5);
			ctx.lineWidth = 3;
			ctx.stroke();
		}
		drawPlanet(ctx, i, p.x, p.y, p.r * scale, time, locked, 1 - Math.sin(b * Math.PI) * 0.06);
	}

	private drawLabels(ctx: CanvasRenderingContext2D, g: Game) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		for (let i = 0; i < 6; i++) {
			if (!this.visible(g, i)) continue;
			const p = this.pos[i];
			const st = g.planets[i];
			const def = PLANETS[i];
			const y = p.y + p.r * (def.rings ? 1.05 : 1) + 8;
			ctx.font = '700 13px "Chakra Petch", system-ui, sans-serif';
			ctx.fillStyle = st.unlocked ? def.light : 'rgba(200,210,240,0.6)';
			ctx.fillText(def.name.toUpperCase(), p.x, y);
			ctx.font = '600 11px "Chakra Petch", system-ui, sans-serif';
			if (st.unlocked) {
				const rate = this.rate[i] / 12;
				const ships = st.ships.length;
				ctx.fillStyle = 'rgba(220,230,255,0.7)';
				ctx.fillText(rate > 0.05 ? `${fmt(rate)}/s · ${ships} ship${ships > 1 ? 's' : ''}` : def.ore, p.x, y + 15);
			} else {
				const can = g.credits >= def.unlock;
				ctx.fillStyle = can ? '#9dffb0' : 'rgba(255,200,120,0.85)';
				ctx.fillText(`UNLOCK ${fmt(def.unlock)}`, p.x, y + 15);
			}
		}
		ctx.font = '700 11px "Chakra Petch", system-ui, sans-serif';
		ctx.fillStyle = 'rgba(160,240,255,0.75)';
		ctx.fillText('HOME', this.home.x, this.home.y + this.home.r * 1.45 + 4);
	}
}
