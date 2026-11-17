// Stickers, rings, the screen flash and screen shake. Positions are in CSS pixels.

import { LIGHT } from './themes.js';
import { roundRect } from './sprites.js';

const STICKER_TILT = (-4 * Math.PI) / 180;

export class Fx {
	constructor() {
		this.pops = [];
		this.rings = [];
		this.flash = 0;
		this.flashColor = '#ffffff';
		this.shakeAmp = 0;
		this.shakeX = 0;
		this.shakeY = 0;
		this.shakeOn = true;
		this.theme = LIGHT;
	}

	clear() {
		this.pops.length = 0;
		this.rings.length = 0;
		this.flash = 0;
		this.shakeAmp = 0;
	}

	shake(amount) {
		if (this.shakeOn) this.shakeAmp = Math.max(this.shakeAmp, amount);
	}

	ring({ x, y, radius, width = 6, time = 0.5 }) {
		this.rings.push({ x, y, radius, width, life: 0, max: time });
	}

	screenFlash(amount, color = '#ffffff') {
		this.flash = Math.max(this.flash, amount);
		this.flashColor = color;
	}

	/** A sticker that rises and fades. fill is the score-card color unless given. */
	pop({ x, y, text, sub = '', big = false, fill = null }) {
		this.pops.push({ x, y, text, sub, big, fill, life: 0, max: big ? 1.5 : 1.1 });
	}

	update(dt) {
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

	draw(ctx) {
		ctx.strokeStyle = this.theme.ink;
		for (const r of this.rings) {
			const t = r.life / r.max;
			const ease = 1 - Math.pow(1 - t, 3);
			ctx.globalAlpha = 1 - t;
			ctx.lineWidth = r.width * (1 - t) + 1;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.radius * ease, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	/** Each pop is a sticker in the score-card color, tilted -4°, with an outline and a hard shadow. */
	drawPops(ctx, unit) {
		const th = this.theme;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (const t of this.pops) {
			const k = t.life / t.max;
			const rise = (1 - Math.pow(1 - Math.min(1, k * 1.6), 3)) * unit * 0.9;
			const grow = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.22 ? 1.15 - ((k - 0.12) / 0.1) * 0.15 : 1;
			const size = unit * (t.big ? 0.56 : 0.42);
			const subSize = Math.max(9, size * 0.42);
			ctx.font = `${size}px '${th.display}', 'Arial Black', sans-serif`;
			const mainW = ctx.measureText(t.text).width;
			ctx.font = `500 ${subSize}px 'DM Mono', 'Space Grotesk', system-ui, sans-serif`;
			const subText = t.sub.toUpperCase();
			const subW = t.sub ? ctx.measureText(subText).width : 0;
			const padX = size * 0.4;
			const w = Math.max(mainW, subW) + padX * 2;
			const h = size * 1.25 + (t.sub ? subSize * 1.3 : 0);
			ctx.save();
			ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
			ctx.translate(t.x, t.y - rise);
			ctx.rotate(STICKER_TILT);
			ctx.scale(grow, grow);
			const fill = t.fill || th.accent;
			const bw = Math.min(th.bw, 3);
			const sh = Math.min(th.sh, 4);
			ctx.fillStyle = th.shadow;
			roundRect(ctx, -w / 2 + sh, -h / 2 + sh, w, h, 3);
			ctx.fill();
			ctx.fillStyle = fill;
			roundRect(ctx, -w / 2, -h / 2, w, h, 3);
			ctx.fill();
			ctx.lineWidth = bw;
			ctx.strokeStyle = th.ink;
			ctx.stroke();
			const on = t.fill ? '#111111' : th.onAccent;
			ctx.fillStyle = on;
			ctx.font = `${size}px '${th.display}', 'Arial Black', sans-serif`;
			const mainY = t.sub ? -h / 2 + size * 0.68 : 0;
			ctx.fillText(t.text, 0, mainY + size * 0.04);
			if (t.sub) {
				ctx.font = `500 ${subSize}px 'DM Mono', 'Space Grotesk', system-ui, sans-serif`;
				ctx.fillText(subText, 0, h / 2 - subSize * 0.85);
			}
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}
}
