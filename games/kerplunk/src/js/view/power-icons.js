// The small pictures of the power-ups, drawn on a canvas. Each is centered at (0, 0) with radius r.

import { PALETTE } from './sprites/block-sprites.js';
import { DANGER_RED } from './canvas-shapes.js';

export const POWER_NAMES = { prism: 'Prism', blast: 'Blast', remix: 'Remix' };

/** Draws the icon of a power-up, centered at (x, y) and about `size` wide. */
export function drawPowerIcon(ctx, kind, x, y, size, ink) {
	const radius = size / 2;
	ctx.save();
	ctx.translate(x, y);
	if (kind === 'prism') drawPrismIcon(ctx, radius, ink);
	else if (kind === 'blast') drawBlastIcon(ctx, radius, ink);
	else drawRemixIcon(ctx, radius, ink);
	ctx.restore();
}

/** A gem cut into four colored facets. */
function drawPrismIcon(ctx, r, ink) {
	const corners = [
		[0, -r],
		[r, 0],
		[0, r],
		[-r, 0],
	];
	corners.forEach((corner, i) => {
		const next = corners[(i + 1) % corners.length];
		ctx.fillStyle = PALETTE[i].base;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(...corner);
		ctx.lineTo(...next);
		ctx.closePath();
		ctx.fill();
	});
	ctx.strokeStyle = ink;
	ctx.lineWidth = 2;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(...corners[0]);
	for (const corner of corners.slice(1)) ctx.lineTo(...corner);
	ctx.closePath();
	ctx.stroke();
}

/** A burst: a red core with eight rays. */
function drawBlastIcon(ctx, r, ink) {
	const RAYS = 8;
	ctx.strokeStyle = ink;
	ctx.lineWidth = Math.max(2, r * 0.26);
	ctx.beginPath();
	for (let i = 0; i < RAYS; i++) {
		const angle = (i / RAYS) * Math.PI * 2;
		ctx.moveTo(Math.cos(angle) * r * 0.55, Math.sin(angle) * r * 0.55);
		ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
	}
	ctx.stroke();
	ctx.fillStyle = DANGER_RED;
	ctx.beginPath();
	ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.stroke();
}

/** Two arrows chasing each other in a circle. */
function drawRemixIcon(ctx, r, ink) {
	ctx.strokeStyle = ink;
	ctx.fillStyle = ink;
	ctx.lineWidth = Math.max(2, r * 0.24);
	const arcRadius = r * 0.72;
	const arrowAngle = -Math.PI * 0.1;
	for (let i = 0; i < 2; i++) {
		ctx.save();
		ctx.rotate(i * Math.PI);
		ctx.beginPath();
		ctx.arc(0, 0, arcRadius, -Math.PI * 0.85, arrowAngle);
		ctx.stroke();
		// The arrow head at the end of the arc.
		const tipX = Math.cos(arrowAngle) * arcRadius;
		const tipY = Math.sin(arrowAngle) * arcRadius;
		ctx.beginPath();
		ctx.moveTo(tipX + r * 0.38, tipY - r * 0.05);
		ctx.lineTo(tipX - r * 0.12, tipY - r * 0.3);
		ctx.lineTo(tipX - r * 0.12, tipY + r * 0.3);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
}
