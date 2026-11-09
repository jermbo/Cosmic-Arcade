// Shape drawing shared by the planet view, the space map and the toolbar icons.
// Flat vector shapes with soft glows. Glows use cached sprites, so they are cheap.

import { MACHINES, PLANETS, formOfKind, isCrate, planetOfKind } from '../core/data.ts';
import type { MachineType } from '../core/data.ts';

export const INK = '#0b1020';
export const PANEL = '#151b2e';
export const LINE = '#2a3452';
export const TEXT = '#e8f1ff';
export const CYAN = '#5ef2ff';

type Ctx = CanvasRenderingContext2D;

const glowCache = new Map<string, HTMLCanvasElement>();

function glowSprite(color: string): HTMLCanvasElement {
	let c = glowCache.get(color);
	if (c) return c;
	c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grd.addColorStop(0, color);
	grd.addColorStop(0.35, withAlpha(color, 0.45));
	grd.addColorStop(1, withAlpha(color, 0));
	g.fillStyle = grd;
	g.fillRect(0, 0, 64, 64);
	glowCache.set(color, c);
	return c;
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
	if (alpha <= 0.01 || r <= 0) return;
	const prevA = ctx.globalAlpha;
	const prevOp = ctx.globalCompositeOperation;
	ctx.globalAlpha = prevA * Math.min(1, alpha);
	ctx.globalCompositeOperation = 'lighter';
	ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
	ctx.globalAlpha = prevA;
	ctx.globalCompositeOperation = prevOp;
}

export function withAlpha(hex: string, a: number) {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(a: string, b: string, t: number) {
	const x = parseInt(a.slice(1), 16);
	const y = parseInt(b.slice(1), 16);
	const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
	return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

function poly(ctx: Ctx, pts: number[], cx: number, cy: number, s: number, rot = 0) {
	ctx.beginPath();
	const c = Math.cos(rot);
	const si = Math.sin(rot);
	for (let i = 0; i < pts.length; i += 2) {
		const x = pts[i] * s;
		const y = pts[i + 1] * s;
		const px = cx + x * c - y * si;
		const py = cy + x * si + y * c;
		if (i) ctx.lineTo(px, py);
		else ctx.moveTo(px, py);
	}
	ctx.closePath();
}

// ---------- items ----------

const ORE_SHAPE = [-0.9, -0.3, -0.3, -0.95, 0.6, -0.7, 1, 0.1, 0.5, 0.85, -0.5, 0.8];

/** Draws one item centered at x, y. u is about the item radius. */
export function drawItem(ctx: Ctx, kind: number, x: number, y: number, u: number) {
	const def = PLANETS[planetOfKind(kind)];
	const form = formOfKind(kind) % 5;
	if (isCrate(kind)) {
		roundRect(ctx, x - u * 1.05, y - u * 1.05, u * 2.1, u * 2.1, u * 0.3);
		ctx.fillStyle = '#2a2140';
		ctx.fill();
		ctx.lineWidth = u * 0.25;
		ctx.strokeStyle = def.color;
		ctx.stroke();
		ctx.fillStyle = def.light;
		ctx.fillRect(x - u * 0.7, y - u * 0.12, u * 1.4, u * 0.24);
		return;
	}
	switch (form) {
		case 0:
			poly(ctx, ORE_SHAPE, x, y, u);
			ctx.fillStyle = def.color;
			ctx.fill();
			ctx.fillStyle = withAlpha(def.light, 0.7);
			poly(ctx, [-0.5, -0.3, -0.1, -0.6, 0.2, -0.2], x, y, u);
			ctx.fill();
			break;
		case 1:
			ctx.fillStyle = def.light;
			for (const [dx, dy] of [
				[-0.5, 0.3],
				[0.45, 0.4],
				[0, -0.45],
			]) {
				ctx.beginPath();
				ctx.arc(x + dx * u, y + dy * u, u * 0.42, 0, Math.PI * 2);
				ctx.fill();
			}
			break;
		case 2:
			roundRect(ctx, x - u * 1.1, y - u * 0.6, u * 2.2, u * 1.2, u * 0.3);
			ctx.fillStyle = def.color;
			ctx.fill();
			ctx.fillStyle = withAlpha(def.light, 0.85);
			ctx.fillRect(x - u * 0.8, y - u * 0.45, u * 1.6, u * 0.25);
			break;
		case 3:
			poly(ctx, [0, -1.15, 0.9, 0, 0, 1.15, -0.9, 0], x, y, u);
			ctx.fillStyle = def.color;
			ctx.fill();
			poly(ctx, [0, -1.15, 0.9, 0, 0, 0], x, y, u);
			ctx.fillStyle = withAlpha(def.light, 0.8);
			ctx.fill();
			break;
		case 4:
			glow(ctx, x, y, u * 3, def.color, 0.6);
			ctx.beginPath();
			ctx.arc(x, y, u * 0.75, 0, Math.PI * 2);
			ctx.fillStyle = def.light;
			ctx.fill();
			poly(ctx, [0, -1.4, 0.25, -0.25, 1.4, 0, 0.25, 0.25, 0, 1.4, -0.25, 0.25, -1.4, 0, -0.25, -0.25], x, y, u);
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			break;
	}
}

// ---------- machines ----------

export interface MachineLook {
	t: MachineType;
	d: number;
	lv: number;
	glow: number;
	prog: number;
}

const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/** Draws a machine (not a belt) in a tile at x, y with size s. */
export function drawMachine(ctx: Ctx, m: MachineLook, x: number, y: number, s: number, time: number, tint = '#ffffff') {
	const def = MACHINES[m.t];
	const cx = x + s / 2;
	const cy = y + s / 2;
	const col = def.color;
	const active = m.glow;
	if (m.t === 'pad') {
		glow(ctx, cx, cy, s * 0.9, '#9fb4ff', 0.35);
		ctx.beginPath();
		ctx.arc(cx, cy, s * 0.46, 0, Math.PI * 2);
		ctx.fillStyle = '#1a2240';
		ctx.fill();
		ctx.lineWidth = s * 0.05;
		ctx.strokeStyle = '#9fb4ff';
		ctx.stroke();
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(time * 0.6);
		ctx.setLineDash([s * 0.08, s * 0.08]);
		ctx.beginPath();
		ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
		ctx.strokeStyle = withAlpha('#9fb4ff', 0.6);
		ctx.lineWidth = s * 0.03;
		ctx.stroke();
		ctx.restore();
		// landing lights
		for (let i = 0; i < 4; i++) {
			const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
			const on = (Math.floor(time * 3) + i) % 4 === 0;
			ctx.beginPath();
			ctx.arc(cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4, s * 0.035, 0, Math.PI * 2);
			ctx.fillStyle = on ? '#ffffff' : '#5a6aa8';
			ctx.fill();
		}
		return;
	}
	if (m.t === 'pylon') {
		const pulse = 0.5 + 0.5 * Math.sin(time * 3);
		glow(ctx, cx, cy, s * (1.2 + pulse * 0.3), col, 0.25 + active * 0.25);
		poly(ctx, [-0.8, 0.55, 0, 0.85, 0.8, 0.55, 0, 0.25], cx, cy, s * 0.42);
		ctx.fillStyle = PANEL;
		ctx.fill();
		ctx.strokeStyle = col;
		ctx.lineWidth = s * 0.04;
		ctx.stroke();
		const bob = Math.sin(time * 2) * s * 0.03;
		poly(ctx, [0, -1, 0.42, -0.15, 0, 0.5, -0.42, -0.15], cx, cy + bob - s * 0.05, s * 0.42);
		ctx.fillStyle = col;
		ctx.fill();
		poly(ctx, [0, -1, 0.42, -0.15, 0, -0.1], cx, cy + bob - s * 0.05, s * 0.42);
		ctx.fillStyle = '#fff6c8';
		ctx.fill();
		levelPips(ctx, m.lv, cx, y + s * 0.92, s, col);
		return;
	}
	// glow under active machines
	if (active > 0) glow(ctx, cx, cy, s * 0.95, col, active * 0.55);
	// output notch
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(DIR_ANGLE[m.d]);
	ctx.beginPath();
	ctx.moveTo(s * 0.5, 0);
	ctx.lineTo(s * 0.36, -s * 0.12);
	ctx.lineTo(s * 0.36, s * 0.12);
	ctx.closePath();
	ctx.fillStyle = col;
	ctx.fill();
	ctx.restore();
	// body
	roundRect(ctx, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, s * 0.16);
	ctx.fillStyle = tint === '#ffffff' ? PANEL : tint;
	ctx.fill();
	ctx.lineWidth = s * 0.045;
	ctx.strokeStyle = col;
	ctx.stroke();
	const spin = time * (0.6 + active * 4);
	ctx.save();
	ctx.translate(cx, cy);
	switch (m.t) {
		case 'drill': {
			ctx.rotate(spin);
			for (let i = 0; i < 3; i++) {
				ctx.rotate((Math.PI * 2) / 3);
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(s * 0.27, -s * 0.08);
				ctx.lineTo(s * 0.27, s * 0.08);
				ctx.closePath();
				ctx.fillStyle = i === 0 ? '#ffe2b0' : col;
				ctx.fill();
			}
			ctx.beginPath();
			ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
			break;
		}
		case 'smelter': {
			const flick = 0.6 + 0.4 * Math.sin(time * 17) * Math.sin(time * 7);
			roundRect(ctx, -s * 0.22, -s * 0.05, s * 0.44, s * 0.24, s * 0.08);
			ctx.fillStyle = mix('#3a1a10', '#ffb347', active * flick);
			ctx.fill();
			if (active > 0) glow(ctx, 0, s * 0.07, s * 0.4, '#ff6a3d', active * flick);
			ctx.fillStyle = col;
			ctx.fillRect(-s * 0.2, -s * 0.24, s * 0.4, s * 0.07);
			break;
		}
		case 'crusher': {
			for (const [ox, dir] of [
				[-0.13, 1],
				[0.13, -1],
			]) {
				ctx.save();
				ctx.translate(ox * s, 0);
				ctx.rotate(spin * dir * 1.5);
				ctx.beginPath();
				for (let i = 0; i < 12; i++) {
					const a = (i / 12) * Math.PI * 2;
					const r = i % 2 ? s * 0.11 : s * 0.155;
					ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
				}
				ctx.closePath();
				ctx.fillStyle = dir > 0 ? col : '#b8f1ff';
				ctx.fill();
				ctx.restore();
			}
			break;
		}
		case 'polisher': {
			ctx.save();
			ctx.rotate(spin);
			ctx.beginPath();
			ctx.arc(0, 0, s * 0.24, 0, Math.PI * 1.4);
			ctx.strokeStyle = withAlpha(col, 0.8);
			ctx.lineWidth = s * 0.04;
			ctx.stroke();
			ctx.restore();
			poly(ctx, [0, -1, 0.8, 0, 0, 1, -0.8, 0], 0, 0, s * 0.17);
			ctx.fillStyle = col;
			ctx.fill();
			poly(ctx, [0, -1, 0.8, 0, 0, 0], 0, 0, s * 0.17);
			ctx.fillStyle = '#d6ffe2';
			ctx.fill();
			break;
		}
		case 'compactor': {
			const press = active > 0 ? Math.abs(Math.sin(time * 5)) : 0.3;
			ctx.fillStyle = col;
			ctx.fillRect(-s * 0.22, -s * 0.25 + press * s * 0.1, s * 0.44, s * 0.08);
			ctx.fillRect(-s * 0.22, s * 0.17 - press * s * 0.1, s * 0.44, s * 0.08);
			roundRect(ctx, -s * 0.1, -s * 0.08, s * 0.2, s * 0.16, s * 0.03);
			ctx.fillStyle = '#e2ccff';
			ctx.fill();
			break;
		}
		case 'forge': {
			ctx.beginPath();
			ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2);
			ctx.fillStyle = '#ffe0f0';
			ctx.fill();
			glow(ctx, 0, 0, s * 0.35, col, 0.4 + active * 0.5);
			for (let i = 0; i < 3; i++) {
				const a = spin * 1.3 + (i / 3) * Math.PI * 2;
				ctx.beginPath();
				ctx.arc(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24, s * 0.04, 0, Math.PI * 2);
				ctx.fillStyle = col;
				ctx.fill();
			}
			break;
		}
	}
	ctx.restore();
	// job progress bar
	if (m.prog > 0 && m.t !== 'drill') {
		ctx.fillStyle = withAlpha(col, 0.25);
		ctx.fillRect(x + s * 0.22, y + s * 0.74, s * 0.56, s * 0.05);
		ctx.fillStyle = col;
		ctx.fillRect(x + s * 0.22, y + s * 0.74, s * 0.56 * Math.min(1, m.prog), s * 0.05);
	}
	levelPips(ctx, m.lv, cx, y + s * 0.2, s, col);
}

function levelPips(ctx: Ctx, lv: number, cx: number, y: number, s: number, col: string) {
	if (lv <= 1) return;
	// One pip per level up to 5. Past 5, one wide bar stands for 5 levels.
	const bars = Math.floor((lv - 1) / 5);
	const pips = (lv - 1) % 5;
	const w = s * 0.07;
	const total = bars * 2.6 + pips;
	let px = cx - ((total - 1) * w * 1.25) / 2;
	ctx.fillStyle = col;
	for (let i = 0; i < bars; i++) {
		roundRect(ctx, px - w / 2, y - w / 2, w * 2.6, w, w / 2);
		ctx.fill();
		px += w * 1.25 * 2.6;
	}
	ctx.fillStyle = '#ffffff';
	for (let i = 0; i < pips; i++) {
		ctx.beginPath();
		ctx.arc(px, y, w / 2, 0, Math.PI * 2);
		ctx.fill();
		px += w * 1.25;
	}
}

/** Draws a belt tile. bend is the side items come in from, or -1 for straight. */
export function drawBelt(ctx: Ctx, d: number, bend: number, x: number, y: number, s: number, offset: number, alpha = 1) {
	const cx = x + s / 2;
	const cy = y + s / 2;
	const w = s * 0.58;
	ctx.save();
	ctx.globalAlpha *= alpha;
	ctx.translate(cx, cy);
	ctx.rotate(DIR_ANGLE[d]);
	// bend: the input side, turned into the belt's frame
	const inRel = bend < 0 ? -1 : (((bend - d) % 4) + 4) % 4;
	ctx.fillStyle = '#1a2036';
	ctx.strokeStyle = '#3d4a78';
	ctx.lineWidth = s * 0.035;
	if (inRel === 1 || inRel === 3) {
		// curve: input comes from the side (moving +y is "1" in local frame)
		const sy = inRel === 1 ? -1 : 1; // the side it comes from
		ctx.beginPath();
		ctx.moveTo(-w / 2, sy * s * 0.5);
		ctx.lineTo(w / 2, sy * s * 0.5);
		ctx.quadraticCurveTo(w / 2, sy * (w / 2), s * 0.5, sy * (w / 2));
		ctx.lineTo(s * 0.5, -sy * (w / 2));
		ctx.quadraticCurveTo(-w / 2, -sy * (w / 2), -w / 2, sy * s * 0.5);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
		// chevrons on the out half
		ctx.save();
		ctx.globalAlpha *= alpha;
		ctx.translate(cx, cy);
		ctx.rotate(DIR_ANGLE[d]);
		chevron(ctx, s * (0.05 + 0.4 * offset), 0, s, 0.4 * (1 - Math.abs(offset - 0.5) * 2) + 0.15);
		ctx.restore();
		return;
	}
	ctx.fillRect(-s * 0.5, -w / 2, s, w);
	ctx.beginPath();
	ctx.moveTo(-s * 0.5, -w / 2);
	ctx.lineTo(s * 0.5, -w / 2);
	ctx.moveTo(-s * 0.5, w / 2);
	ctx.lineTo(s * 0.5, w / 2);
	ctx.stroke();
	for (let k = 0; k < 2; k++) {
		const p = (offset + k * 0.5) % 1;
		chevron(ctx, -s * 0.5 + p * s, 0, s, 0.15 + 0.35 * Math.sin(p * Math.PI));
	}
	ctx.restore();
}

function chevron(ctx: Ctx, x: number, y: number, s: number, a: number) {
	ctx.strokeStyle = withAlpha('#7f8cff', a);
	ctx.lineWidth = s * 0.06;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x - s * 0.08, y - s * 0.13);
	ctx.lineTo(x + s * 0.04, y);
	ctx.lineTo(x - s * 0.08, y + s * 0.13);
	ctx.stroke();
	ctx.lineCap = 'butt';
}

// ---------- ships ----------

export function drawShip(ctx: Ctx, x: number, y: number, angle: number, size: number, color: string, thrust: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	if (thrust > 0) {
		const f = 0.7 + 0.3 * Math.sin(time * 40);
		glow(ctx, -size * 0.9, 0, size * 1.2 * thrust, color, 0.8);
		ctx.beginPath();
		ctx.moveTo(-size * 0.55, -size * 0.22);
		ctx.lineTo(-size * (0.9 + 0.7 * thrust * f), 0);
		ctx.lineTo(-size * 0.55, size * 0.22);
		ctx.fillStyle = withAlpha('#ffffff', 0.85);
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(size, 0);
	ctx.lineTo(-size * 0.6, -size * 0.55);
	ctx.lineTo(-size * 0.35, 0);
	ctx.lineTo(-size * 0.6, size * 0.55);
	ctx.closePath();
	ctx.fillStyle = '#e8f1ff';
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(size * 0.45, 0);
	ctx.lineTo(-size * 0.25, -size * 0.2);
	ctx.lineTo(-size * 0.25, size * 0.2);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
}

// ---------- planets ----------

const planetCache = new Map<string, HTMLCanvasElement>();

function rnd(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a * 1664525 + 1013904223) >>> 0;
		return a / 4294967296;
	};
}

/** A planet ball, drawn once per size and cached. */
function planetSprite(index: number, r: number, locked: boolean): HTMLCanvasElement {
	const key = `${index}:${Math.round(r)}:${locked}`;
	let c = planetCache.get(key);
	if (c) return c;
	const def = PLANETS[index];
	const size = Math.ceil(r * 2 + 4);
	c = document.createElement('canvas');
	c.width = c.height = size;
	const g = c.getContext('2d')!;
	const cx = size / 2;
	const color = locked ? mix(def.color, '#20263a', 0.82) : def.color;
	const light = locked ? mix(def.light, '#20263a', 0.8) : def.light;
	const dark = locked ? '#0c0f1a' : def.dark;
	g.save();
	g.beginPath();
	g.arc(cx, cx, r, 0, Math.PI * 2);
	g.clip();
	const grd = g.createRadialGradient(cx - r * 0.35, cx - r * 0.4, r * 0.1, cx, cx, r * 1.05);
	grd.addColorStop(0, light);
	grd.addColorStop(0.45, color);
	grd.addColorStop(1, dark);
	g.fillStyle = grd;
	g.fillRect(0, 0, size, size);
	const rand = rnd(def.seed * 101);
	// bands
	g.globalAlpha = 0.18;
	for (let i = 0; i < 5; i++) {
		const by = cx + (rand() * 2 - 1) * r * 0.8;
		g.fillStyle = rand() < 0.5 ? dark : light;
		g.beginPath();
		g.ellipse(cx, by, r * 1.3, r * (0.05 + rand() * 0.1), (rand() - 0.5) * 0.3, 0, Math.PI * 2);
		g.fill();
	}
	// craters
	g.globalAlpha = 0.25;
	for (let i = 0; i < 7; i++) {
		const a = rand() * Math.PI * 2;
		const d = rand() * r * 0.75;
		const cr = r * (0.06 + rand() * 0.12);
		g.fillStyle = dark;
		g.beginPath();
		g.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, cr, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = light;
		g.globalAlpha = 0.12;
		g.beginPath();
		g.arc(cx + Math.cos(a) * d - cr * 0.2, cx + Math.sin(a) * d - cr * 0.2, cr * 0.6, 0, Math.PI * 2);
		g.fill();
		g.globalAlpha = 0.25;
	}
	// night side
	g.globalAlpha = 1;
	const sh = g.createLinearGradient(cx - r, cx - r, cx + r, cx + r);
	sh.addColorStop(0.45, 'rgba(0,0,0,0)');
	sh.addColorStop(1, 'rgba(3,4,12,0.75)');
	g.fillStyle = sh;
	g.fillRect(0, 0, size, size);
	g.restore();
	// rim light
	g.beginPath();
	g.arc(cx, cx, r - 0.75, 0, Math.PI * 2);
	g.strokeStyle = withAlpha(light, locked ? 0.15 : 0.5);
	g.lineWidth = 1.5;
	g.stroke();
	planetCache.set(key, c);
	return c;
}

export function drawPlanet(ctx: Ctx, index: number, x: number, y: number, r: number, time: number, locked: boolean, squash = 1) {
	const def = PLANETS[index];
	if (!locked) glow(ctx, x, y, r * 2.1, def.color, 0.45);
	if (def.rings) ring(ctx, x, y, r, def, locked, true, time);
	const spr = planetSprite(index, r, locked);
	ctx.drawImage(spr, x - spr.width / 2, y - (spr.height / 2) * squash, spr.width, spr.height * squash);
	if (def.rings) ring(ctx, x, y, r, def, locked, false, time);
}

function ring(ctx: Ctx, x: number, y: number, r: number, def: (typeof PLANETS)[number], locked: boolean, back: boolean, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(-0.35 + Math.sin(time * 0.2) * 0.02);
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 1.7, r * 0.45, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
	ctx.strokeStyle = withAlpha(locked ? '#444c66' : def.light, back ? 0.35 : 0.7);
	ctx.lineWidth = Math.max(1.5, r * 0.09);
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(0, 0, r * 1.5, r * 0.38, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
	ctx.strokeStyle = withAlpha(locked ? '#333a50' : def.color, back ? 0.25 : 0.5);
	ctx.lineWidth = Math.max(1, r * 0.05);
	ctx.stroke();
	ctx.restore();
}

/** Small canvas icon for a toolbar button. */
export function machineIcon(t: MachineType, size: number): HTMLCanvasElement {
	const c = document.createElement('canvas');
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	c.width = c.height = size * dpr;
	c.style.width = c.style.height = size + 'px';
	const g = c.getContext('2d')!;
	g.scale(dpr, dpr);
	if (t === 'belt') drawBelt(g, 0, -1, 0, 0, size, 0.3);
	else drawMachine(g, { t, d: 0, lv: 1, glow: 0.6, prog: 0 }, 0, 0, size, 0.6);
	return c;
}
