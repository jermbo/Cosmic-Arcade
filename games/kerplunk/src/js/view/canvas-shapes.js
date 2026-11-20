// Small drawing helpers for the canvas, in the neo-brutalist look: hard shadows and thick outlines.

/** Starts a path of a rectangle with round corners. Call fill() or stroke() after it. */
export function roundRect(ctx, x, y, w, h, radius) {
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/**
 * A card: a hard shadow, a fill and an outline. pressed puts the card down into its shadow.
 * outline, shadow and radius are in pixels, and start from the theme.
 */
export function drawCard(ctx, theme, x, y, w, h, { fill, outline = theme.outlineWidth, shadow = theme.shadowOffset, radius = theme.cornerRadius, pressed = false }) {
	if (pressed) {
		x += shadow;
		y += shadow;
	} else if (shadow) {
		ctx.fillStyle = theme.shadow;
		roundRect(ctx, x + shadow, y + shadow, w, h, radius);
		ctx.fill();
	}
	ctx.fillStyle = fill;
	roundRect(ctx, x, y, w, h, radius);
	ctx.fill();
	ctx.lineWidth = outline;
	ctx.strokeStyle = theme.ink;
	roundRect(ctx, x + outline / 2, y + outline / 2, w - outline, h - outline, radius);
	ctx.stroke();
}

/** A dashed outline: an empty slot or an empty card. */
export function drawDashedOutline(ctx, theme, x, y, w, h, { dash, gap, alpha }) {
	ctx.globalAlpha = alpha;
	ctx.setLineDash([dash, gap]);
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = 2;
	roundRect(ctx, x, y, w, h, theme.cornerRadius);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
}

/** An X made of two lines, centered at (x, y), `size` from the middle to each end. */
export function drawCross(ctx, x, y, size) {
	ctx.beginPath();
	ctx.moveTo(x - size, y - size);
	ctx.lineTo(x + size, y + size);
	ctx.moveTo(x + size, y - size);
	ctx.lineTo(x - size, y + size);
	ctx.stroke();
}

/** A value that goes up and down between 0 and 1, `speed` times faster than once every 2π seconds. */
export function pulse(time, speed, offset = 0) {
	return 0.5 + 0.5 * Math.sin(time * speed + offset);
}

export const MONO_FONT = "'DM Mono', 'Space Grotesk', system-ui, sans-serif";
export const DANGER_RED = '#FF6B6B';
