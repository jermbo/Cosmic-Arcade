// Draws the stickers: a card in the score-card color, tilted, with an outline and a hard shadow.
// A sticker pops in a bit too big, settles, rises, and fades at the end.

import { tuning } from '../feel/tuning.js';
import { roundRect, MONO_FONT } from './canvas-shapes.js';

const motion = tuning.motion;
const POP_END = 0.12; // the part of its life a sticker spends growing in
const SETTLE_END = 0.22; // ... and settling back to its size
const RISE_SPEED = 1.6; // the sticker reaches its top at 1 / RISE_SPEED of its life
const FADE_START = 0.7; // it fades over the last 30% of its life

export function drawStickers(ctx, stickers, unit, theme) {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const sticker of stickers) drawSticker(ctx, sticker, unit, theme);
	ctx.globalAlpha = 1;
}

function drawSticker(ctx, sticker, unit, theme) {
	const life = sticker.age / sticker.lifetime; // 0 when it shows, 1 when it is gone
	const rise = (1 - Math.pow(1 - Math.min(1, life * RISE_SPEED), 3)) * unit * motion.stickerRise;
	const textSize = unit * (sticker.big ? 0.56 : 0.42);
	const subSize = Math.max(9, textSize * 0.42);
	const subText = sticker.sub.toUpperCase();
	const { w, h } = stickerSize(ctx, sticker, { textSize, subSize, subText, theme });

	ctx.save();
	ctx.globalAlpha = life > FADE_START ? 1 - (life - FADE_START) / (1 - FADE_START) : 1;
	ctx.translate(sticker.x, sticker.y - rise);
	ctx.rotate((motion.stickerTilt * Math.PI) / 180);
	const scale = popScale(life);
	ctx.scale(scale, scale);
	drawStickerCard(ctx, { w, h, fill: sticker.fill || theme.accent, theme });

	ctx.fillStyle = sticker.fill ? '#111111' : theme.onAccent;
	ctx.font = displayFont(textSize, theme);
	const mainY = sticker.sub ? -h / 2 + textSize * 0.68 : 0;
	ctx.fillText(sticker.text, 0, mainY + textSize * 0.04);
	if (sticker.sub) {
		ctx.font = `500 ${subSize}px ${MONO_FONT}`;
		ctx.fillText(subText, 0, h / 2 - subSize * 0.85);
	}
	ctx.restore();
}

/** The card fits the longest line of text, with some room on each side. */
function stickerSize(ctx, sticker, { textSize, subSize, subText, theme }) {
	ctx.font = displayFont(textSize, theme);
	const textWidth = ctx.measureText(sticker.text).width;
	ctx.font = `500 ${subSize}px ${MONO_FONT}`;
	const subWidth = sticker.sub ? ctx.measureText(subText).width : 0;
	const padding = textSize * 0.4;
	const w = Math.max(textWidth, subWidth) + padding * 2;
	const h = textSize * 1.25 + (sticker.sub ? subSize * 1.3 : 0);
	return { w, h };
}

/** It grows in past its size, then settles back. */
function popScale(life) {
	const overshoot = motion.stickerPop;
	if (life < POP_END) return 0.6 + (life / POP_END) * (0.4 + overshoot);
	if (life < SETTLE_END) return 1 + overshoot - ((life - POP_END) / (SETTLE_END - POP_END)) * overshoot;
	return 1;
}

function drawStickerCard(ctx, { w, h, fill, theme }) {
	const outline = Math.min(theme.outlineWidth, 3);
	const shadow = Math.min(theme.shadowOffset, 4);
	ctx.fillStyle = theme.shadow;
	roundRect(ctx, -w / 2 + shadow, -h / 2 + shadow, w, h, 3);
	ctx.fill();
	ctx.fillStyle = fill;
	roundRect(ctx, -w / 2, -h / 2, w, h, 3);
	ctx.fill();
	ctx.lineWidth = outline;
	ctx.strokeStyle = theme.ink;
	ctx.stroke();
}

function displayFont(size, theme) {
	return `${size}px '${theme.displayFont}', 'Arial Black', sans-serif`;
}
