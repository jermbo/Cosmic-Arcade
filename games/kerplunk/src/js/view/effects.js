// The effects on top of the game: stickers, rings, the screen flash and the screen shake.
// Positions are in CSS pixels.

import { LIGHT } from '../looks/themes.js';
import { tuning } from '../feel/tuning.js';
import { drawStickers } from './stickers.js';

const motion = tuning.motion;
const BIG_STICKER_STAYS = 1.36; // a big sticker stays this many times longer
const FLASH_FADE = 2.5; // how fast the screen flash fades, per second
const SHAKE_STOP = 0.3; // a shake smaller than this many pixels stops

export class Effects {
	constructor() {
		this.stickers = [];
		this.rings = [];
		this.flash = 0;
		this.flashColor = '#ffffff';
		this.shakeSize = 0;
		this.shakeX = 0;
		this.shakeY = 0;
		this.shakeOn = true; // the Shake setting
		this.theme = LIGHT;
	}

	clear() {
		this.stickers.length = 0;
		this.rings.length = 0;
		this.flash = 0;
		this.shakeSize = 0;
	}

	/** Shakes the screen by up to `amount` pixels. It fades by itself. */
	shake(amount) {
		if (this.shakeOn) this.shakeSize = Math.max(this.shakeSize, amount);
	}

	/** A ring that grows from (x, y) and fades: the wave of a Blast. */
	ring({ x, y, radius, width = 6, time = 0.5 }) {
		this.rings.push({ x, y, radius, width, age: 0, lifetime: time });
	}

	screenFlash(amount, color = '#ffffff') {
		this.flash = Math.max(this.flash, amount);
		this.flashColor = color;
	}

	/** A sticker that rises and fades: the points of a clear, or a word. fill is the score-card color unless given. */
	sticker({ x, y, text, sub = '', big = false, fill = null }) {
		const lifetime = motion.stickerTime * (big ? BIG_STICKER_STAYS : 1);
		this.stickers.push({ x, y, text, sub, big, fill, age: 0, lifetime });
	}

	update(dt) {
		this.rings = growOlder(this.rings, dt);
		this.stickers = growOlder(this.stickers, dt);
		this.flash = Math.max(0, this.flash - dt * FLASH_FADE);
		this.shakeSize *= Math.pow(0.5, dt / Math.max(0.01, motion.shakeTime));
		if (this.shakeSize < SHAKE_STOP) this.shakeSize = 0;
		this.shakeX = (Math.random() * 2 - 1) * this.shakeSize;
		this.shakeY = (Math.random() * 2 - 1) * this.shakeSize;
	}

	/** Draws the rings. The view draws them inside the shaking part of the screen. */
	drawRings(ctx) {
		ctx.strokeStyle = this.theme.ink;
		for (const ring of this.rings) {
			const progress = ring.age / ring.lifetime;
			const easeOut = 1 - Math.pow(1 - progress, 3);
			ctx.globalAlpha = 1 - progress;
			ctx.lineWidth = ring.width * (1 - progress) + 1;
			ctx.beginPath();
			ctx.arc(ring.x, ring.y, ring.radius * easeOut, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	/** Draws the stickers. unit is the size of a cell. */
	drawStickers(ctx, unit) {
		drawStickers(ctx, this.stickers, unit, this.theme);
	}

	/** A flash of color over the whole screen. */
	drawFlash(ctx, width, height) {
		if (this.flash <= 0) return;
		ctx.globalAlpha = Math.min(0.85, this.flash);
		ctx.fillStyle = this.flashColor;
		ctx.fillRect(0, 0, width, height);
		ctx.globalAlpha = 1;
	}
}

/** Adds dt to the age of each item, and keeps the ones that are still alive. */
function growOlder(items, dt) {
	for (const item of items) item.age += dt;
	return items.filter((item) => item.age < item.lifetime);
}
