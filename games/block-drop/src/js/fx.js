// Particles, score pops and screen shake. Positions are in CSS pixels.

import { PALETTE, GOLD } from './sprites.js';

const MAX_PARTS = 500;

export class Fx {
	constructor() {
		this.parts = [];
		this.pops = [];
		this.rings = [];
		this.flash = 0;
		this.flashColor = '#ffffff';
		this.shakeAmp = 0;
		this.shakeX = 0;
		this.shakeY = 0;
		this.shakeOn = true;
		this.lite = false;
	}

	clear() {
		this.parts.length = 0;
		this.pops.length = 0;
		this.rings.length = 0;
		this.flash = 0;
		this.shakeAmp = 0;
	}

	shake(amount) {
		if (this.shakeOn) this.shakeAmp = Math.max(this.shakeAmp, amount);
	}

	add(p) {
		if (this.parts.length < MAX_PARTS) this.parts.push(p);
	}

	/** Glass shards and sparks for one cleared block. */
	shatter({ x, y, size, colorIndex, power = 1 }) {
		const color = PALETTE[colorIndex] || PALETTE[0];
		const shards = Math.round((this.lite ? 4 : 7) * power);
		for (let i = 0; i < shards; i++) {
			const a = Math.random() * Math.PI * 2;
			const sp = (60 + Math.random() * 220) * power;
			this.add({
				kind: 'shard',
				x: x + (Math.random() - 0.5) * size * 0.5,
				y: y + (Math.random() - 0.5) * size * 0.5,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp + 120,
				g: -900,
				life: 0,
				max: 0.5 + Math.random() * 0.45,
				size: size * (0.12 + Math.random() * 0.16),
				rot: Math.random() * 6,
				vr: (Math.random() - 0.5) * 18,
				color: Math.random() < 0.3 ? color.light : color.base,
			});
		}
		const sparks = Math.round((this.lite ? 2 : 5) * power);
		for (let i = 0; i < sparks; i++) {
			const a = Math.random() * Math.PI * 2;
			const sp = 30 + Math.random() * 150 * power;
			this.add({
				kind: 'spark',
				x,
				y,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp - 40,
				g: -30,
				life: 0,
				max: 0.4 + Math.random() * 0.6,
				size: size * (0.3 + Math.random() * 0.4),
				glow: colorIndex,
			});
		}
	}

	ring({ x, y, radius, color, width = 6, time = 0.5 }) {
		this.rings.push({ x, y, radius, color, width, life: 0, max: time });
	}

	burst({ x, y, count, speed, glow, size }) {
		for (let i = 0; i < count; i++) {
			const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
			const sp = speed * (0.6 + Math.random() * 0.6);
			this.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, life: 0, max: 0.5 + Math.random() * 0.5, size, glow });
		}
	}

	screenFlash(amount, color = '#ffffff') {
		this.flash = Math.max(this.flash, amount);
		this.flashColor = color;
	}

	pop({ x, y, text, sub, color = GOLD, big = false }) {
		this.pops.push({ x, y, text, sub, color, big, life: 0, max: big ? 1.5 : 1.1 });
	}

	update(dt) {
		for (const p of this.parts) {
			p.life += dt;
			p.vy += p.g * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.rot !== undefined) p.rot += p.vr * dt;
		}
		this.parts = this.parts.filter((p) => p.life < p.max);
		for (const r of this.rings) r.life += dt;
		this.rings = this.rings.filter((r) => r.life < r.max);
		for (const t of this.pops) t.life += dt;
		this.pops = this.pops.filter((t) => t.life < t.max);
		this.flash = Math.max(0, this.flash - dt * 2.5);
		this.shakeAmp *= Math.pow(0.0015, dt);
		if (this.shakeAmp < 0.3) this.shakeAmp = 0;
		this.shakeX = (Math.random() * 2 - 1) * this.shakeAmp;
		this.shakeY = (Math.random() * 2 - 1) * this.shakeAmp;
	}

	draw(ctx, sprites) {
		for (const r of this.rings) {
			const t = r.life / r.max;
			const ease = 1 - Math.pow(1 - t, 3);
			ctx.globalAlpha = 1 - t;
			ctx.strokeStyle = r.color;
			ctx.lineWidth = r.width * (1 - t) + 1;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius * ease, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
		for (const p of this.parts) {
			if (p.kind !== 'shard') continue;
			const t = p.life / p.max;
			ctx.globalAlpha = 1 - t * t;
			ctx.fillStyle = p.color;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rot);
			ctx.beginPath();
			ctx.moveTo(0, -p.size);
			ctx.lineTo(p.size * 0.8, p.size * 0.6);
			ctx.lineTo(-p.size * 0.7, p.size * 0.4);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
		ctx.globalCompositeOperation = 'lighter';
		for (const p of this.parts) {
			if (p.kind !== 'spark') continue;
			const t = p.life / p.max;
			const img = p.glow === 'gold' ? sprites.glowGold : p.glow === 'white' ? sprites.glowWhite : sprites.glow[p.glow] || sprites.glowWhite;
			const s = p.size * (1 - t * 0.6);
			ctx.globalAlpha = 1 - t;
			ctx.drawImage(img, p.x - s / 2, p.y - s / 2, s, s);
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
	}

	drawPops(ctx, unit) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (const t of this.pops) {
			const k = t.life / t.max;
			const rise = (1 - Math.pow(1 - Math.min(1, k * 1.6), 3)) * unit * 0.9;
			const grow = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.22 ? 1.15 - ((k - 0.12) / 0.1) * 0.15 : 1;
			ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
			const size = unit * (t.big ? 0.62 : 0.44) * grow;
			ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
			ctx.lineWidth = Math.max(3, size * 0.18);
			ctx.strokeStyle = '#130f26';
			ctx.lineJoin = 'round';
			ctx.strokeText(t.text, t.x, t.y - rise);
			ctx.fillStyle = t.color;
			ctx.fillText(t.text, t.x, t.y - rise);
			if (t.sub) {
				const subSize = size * 0.55;
				ctx.font = `800 ${subSize}px ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
				ctx.lineWidth = Math.max(3, subSize * 0.2);
				ctx.strokeText(t.sub, t.x, t.y - rise + size * 0.78);
				ctx.fillStyle = '#ffffff';
				ctx.fillText(t.sub, t.x, t.y - rise + size * 0.78);
			}
		}
		ctx.globalAlpha = 1;
	}
}
