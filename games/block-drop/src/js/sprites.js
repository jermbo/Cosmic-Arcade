// Draws the stained-glass blocks once per size, so each frame only copies images.

export const PALETTE = [
	{ name: 'Ember', base: '#ff5d73', light: '#ffc0c8', dark: '#9e1f3c', glyph: 'tri' },
	{ name: 'Amber', base: '#ffbe45', light: '#ffeab0', dark: '#b06a12', glyph: 'sun' },
	{ name: 'Moss', base: '#47cf86', light: '#c0f7d7', dark: '#16774a', glyph: 'leaf' },
	{ name: 'Tide', base: '#45b0ff', light: '#bfe6ff', dark: '#18589e', glyph: 'drop' },
	{ name: 'Dusk', base: '#b285ff', light: '#e6d6ff', dark: '#5a2ab0', glyph: 'moon' },
];

export const LEAD = '#130f26';
export const GOLD = '#f2c879';

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function starPath(ctx, cx, cy, points, outer, inner, turn = -Math.PI / 2) {
	ctx.beginPath();
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 ? inner : outer;
		const a = turn + (i * Math.PI) / points;
		ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
	}
	ctx.closePath();
}

function glyphPath(ctx, glyph, cx, cy, r) {
	ctx.beginPath();
	switch (glyph) {
		case 'tri':
			ctx.moveTo(cx, cy - r);
			ctx.lineTo(cx + r * 0.92, cy + r * 0.66);
			ctx.lineTo(cx - r * 0.92, cy + r * 0.66);
			ctx.closePath();
			break;
		case 'sun':
			ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
			break;
		case 'leaf':
			ctx.moveTo(cx, cy - r);
			ctx.lineTo(cx + r * 0.75, cy);
			ctx.lineTo(cx, cy + r);
			ctx.lineTo(cx - r * 0.75, cy);
			ctx.closePath();
			break;
		case 'drop':
			ctx.moveTo(cx, cy - r);
			ctx.bezierCurveTo(cx + r * 0.25, cy - r * 0.5, cx + r * 0.8, cy, cx + r * 0.8, cy + r * 0.25);
			ctx.arc(cx, cy + r * 0.25, r * 0.8, 0, Math.PI, false);
			ctx.bezierCurveTo(cx - r * 0.8, cy, cx - r * 0.25, cy - r * 0.5, cx, cy - r);
			ctx.closePath();
			break;
		case 'moon':
			ctx.arc(cx, cy, r * 0.85, Math.PI * 0.3, Math.PI * 1.7, false);
			ctx.arc(cx + r * 0.42, cy - r * 0.08, r * 0.62, Math.PI * 1.45, Math.PI * 0.55, true);
			ctx.closePath();
			break;
	}
}

/** The glass body that every block shares. */
function drawGlass(ctx, s, color) {
	const gap = s * 0.04;
	ctx.fillStyle = LEAD;
	roundRect(ctx, gap, gap, s - gap * 2, s - gap * 2, s * 0.2);
	ctx.fill();

	const inset = s * 0.11;
	const w = s - inset * 2;
	const grad = ctx.createLinearGradient(inset, inset, s - inset, s - inset);
	grad.addColorStop(0, color.light);
	grad.addColorStop(0.38, color.base);
	grad.addColorStop(1, color.dark);
	ctx.fillStyle = grad;
	roundRect(ctx, inset, inset, w, w, s * 0.13);
	ctx.fill();

	// Bevel: light on the top-left edge, shade on the bottom-right edge.
	ctx.save();
	roundRect(ctx, inset, inset, w, w, s * 0.13);
	ctx.clip();
	ctx.lineWidth = s * 0.06;
	ctx.strokeStyle = 'rgba(255,255,255,0.35)';
	ctx.beginPath();
	ctx.moveTo(inset, s - inset);
	ctx.lineTo(inset, inset);
	ctx.lineTo(s - inset, inset);
	ctx.stroke();
	ctx.strokeStyle = 'rgba(0,0,0,0.28)';
	ctx.beginPath();
	ctx.moveTo(s - inset, inset);
	ctx.lineTo(s - inset, s - inset);
	ctx.lineTo(inset, s - inset);
	ctx.stroke();
	// A thin lead line across one corner, like a pane of leaded glass.
	ctx.strokeStyle = LEAD;
	ctx.lineWidth = Math.max(1, s * 0.035);
	ctx.beginPath();
	ctx.moveTo(s - inset - w * 0.34, s - inset);
	ctx.lineTo(s - inset, s - inset - w * 0.34);
	ctx.stroke();
	ctx.restore();

	// Gloss.
	ctx.fillStyle = 'rgba(255,255,255,0.22)';
	ctx.beginPath();
	ctx.ellipse(s * 0.36, s * 0.3, s * 0.2, s * 0.09, -0.6, 0, Math.PI * 2);
	ctx.fill();
}

function drawPlain(ctx, s, color) {
	drawGlass(ctx, s, color);
	const r = s * 0.2;
	glyphPath(ctx, color.glyph, s / 2, s / 2 + s * 0.02, r);
	ctx.fillStyle = 'rgba(255,255,255,0.82)';
	ctx.fill();
	ctx.lineWidth = Math.max(1, s * 0.035);
	ctx.strokeStyle = LEAD;
	ctx.stroke();
}

function drawFlare(ctx, s, color) {
	drawGlass(ctx, s, color);
	const c = s / 2;
	ctx.fillStyle = LEAD;
	ctx.beginPath();
	ctx.arc(c, c, s * 0.29, 0, Math.PI * 2);
	ctx.fill();
	const core = ctx.createRadialGradient(c, c, 0, c, c, s * 0.26);
	core.addColorStop(0, '#fffbe8');
	core.addColorStop(0.45, color.light);
	core.addColorStop(1, color.base);
	ctx.fillStyle = core;
	ctx.beginPath();
	ctx.arc(c, c, s * 0.25, 0, Math.PI * 2);
	ctx.fill();
	starPath(ctx, c, c, 4, s * 0.22, s * 0.06, -Math.PI / 2);
	ctx.fillStyle = '#fffdf2';
	ctx.fill();
	ctx.lineWidth = Math.max(1, s * 0.025);
	ctx.strokeStyle = LEAD;
	ctx.stroke();
	// Rivets in the corners mark it as a charged block.
	ctx.fillStyle = GOLD;
	for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
		ctx.beginPath();
		ctx.arc(s * x, s * y, s * 0.045, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawNova(ctx, s, color) {
	drawGlass(ctx, s, color);
	const c = s / 2;
	ctx.fillStyle = LEAD;
	starPath(ctx, c, c, 8, s * 0.36, s * 0.2, 0);
	ctx.fill();
	const rainbow = ctx.createConicGradient
		? ctx.createConicGradient(0, c, c)
		: ctx.createLinearGradient(0, 0, s, s);
	['#ff6b8a', '#ffc65a', '#7ef0a0', '#5ac8ff', '#c08cff', '#ff6b8a'].forEach((col, i) => rainbow.addColorStop(i / 5, col));
	ctx.fillStyle = rainbow;
	starPath(ctx, c, c, 8, s * 0.31, s * 0.16, 0);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.arc(c, c, s * 0.1, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = Math.max(1, s * 0.03);
	ctx.strokeStyle = color.dark;
	ctx.stroke();
}

function makeCanvas(px) {
	const c = document.createElement('canvas');
	c.width = c.height = Math.max(1, Math.round(px));
	return c;
}

/** Builds every block image for one cell size in device pixels. */
export function buildSprites(px) {
	const out = { px, plain: [], flare: [], nova: [], glow: [], slot: null, sparkle: null };
	PALETTE.forEach((color, i) => {
		for (const kind of ['plain', 'flare', 'nova']) {
			const c = makeCanvas(px);
			const ctx = c.getContext('2d');
			if (kind === 'plain') drawPlain(ctx, px, color);
			if (kind === 'flare') drawFlare(ctx, px, color);
			if (kind === 'nova') drawNova(ctx, px, color);
			out[kind][i] = c;
		}
		out.glow[i] = makeGlow(64, color.base);
	});
	out.glowWhite = makeGlow(64, '#fff6dc');
	out.glowGold = makeGlow(64, GOLD);

	const slot = makeCanvas(px);
	const sctx = slot.getContext('2d');
	sctx.fillStyle = 'rgba(160,140,255,0.06)';
	roundRect(sctx, px * 0.08, px * 0.08, px * 0.84, px * 0.84, px * 0.18);
	sctx.fill();
	sctx.fillStyle = 'rgba(200,190,255,0.12)';
	sctx.beginPath();
	sctx.arc(px / 2, px / 2, px * 0.04, 0, Math.PI * 2);
	sctx.fill();
	out.slot = slot;
	return out;
}

function makeGlow(px, color) {
	const c = makeCanvas(px);
	const ctx = c.getContext('2d');
	const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
	g.addColorStop(0, '#ffffff');
	g.addColorStop(0.2, color);
	g.addColorStop(1, color + '00');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, px, px);
	return c;
}

export { roundRect, starPath, glyphPath };
