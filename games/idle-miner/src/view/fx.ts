// Particles, rings and number pop-ups, in screen pixels.

import { withAlpha } from './draw.ts';

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	color: string;
	drag: number;
	grav: number;
	spark: boolean;
}

interface Ring {
	x: number;
	y: number;
	r: number;
	grow: number;
	life: number;
	max: number;
	color: string;
}

interface Popup {
	x: number;
	y: number;
	text: string;
	life: number;
	max: number;
	color: string;
	size: number;
}

const parts: Particle[] = [];
const rings: Ring[] = [];
const pops: Popup[] = [];
let reduce = false;

export function setReducedMotion(on: boolean) {
	reduce = on;
}

export function clearFx() {
	parts.length = 0;
	rings.length = 0;
	pops.length = 0;
}

export function burst(x: number, y: number, color: string, n: number, speed = 120, opts: { size?: number; life?: number; grav?: number; spark?: boolean } = {}) {
	if (reduce) n = Math.ceil(n / 3);
	for (let i = 0; i < n && parts.length < 600; i++) {
		const a = Math.random() * Math.PI * 2;
		const v = speed * (0.3 + Math.random() * 0.7);
		const life = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6);
		parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: (opts.size ?? 3) * (0.6 + Math.random() * 0.6), color, drag: 2.5, grav: opts.grav ?? 0, spark: opts.spark ?? true });
	}
}

/** Particles that fly in one direction, like sparks from a drill. */
export function spray(x: number, y: number, color: string, n: number, angle: number, spread: number, speed: number) {
	if (reduce) return;
	for (let i = 0; i < n && parts.length < 600; i++) {
		const a = angle + (Math.random() - 0.5) * spread;
		const v = speed * (0.5 + Math.random() * 0.5);
		const life = 0.35 + Math.random() * 0.3;
		parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: 1.5 + Math.random() * 1.5, color, drag: 3, grav: 120, spark: true });
	}
}

export function ring(x: number, y: number, color: string, r = 10, grow = 120, life = 0.6) {
	if (rings.length < 60) rings.push({ x, y, r, grow, life, max: life, color });
}

export function popup(x: number, y: number, text: string, color = '#ffffff', size = 16) {
	if (pops.length > 40) pops.shift();
	pops.push({ x: x + (Math.random() - 0.5) * 34, y: y + (Math.random() - 0.5) * 12, text, life: 1.1, max: 1.1, color, size });
}

export function stepFx(dt: number) {
	for (let i = parts.length - 1; i >= 0; i--) {
		const p = parts[i];
		p.life -= dt;
		if (p.life <= 0) {
			parts.splice(i, 1);
			continue;
		}
		const k = Math.exp(-p.drag * dt);
		p.vx *= k;
		p.vy = p.vy * k + p.grav * dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
	}
	for (let i = rings.length - 1; i >= 0; i--) {
		const r = rings[i];
		r.life -= dt;
		r.r += r.grow * dt * (r.life / r.max + 0.2);
		if (r.life <= 0) rings.splice(i, 1);
	}
	for (let i = pops.length - 1; i >= 0; i--) {
		const p = pops[i];
		p.life -= dt;
		p.y -= dt * 38 * (p.life / p.max + 0.3);
		if (p.life <= 0) pops.splice(i, 1);
	}
}

export function drawFx(ctx: CanvasRenderingContext2D) {
	for (const r of rings) {
		const a = r.life / r.max;
		ctx.beginPath();
		ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
		ctx.strokeStyle = withAlpha(r.color, a * 0.8);
		ctx.lineWidth = 2 + a * 3;
		ctx.stroke();
	}
	ctx.globalCompositeOperation = 'lighter';
	for (const p of parts) {
		const a = p.life / p.max;
		ctx.fillStyle = withAlpha(p.color, a);
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size * (p.spark ? a : 1), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalCompositeOperation = 'source-over';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const p of pops) {
		const a = Math.min(1, p.life / p.max / 0.3);
		const t = 1 - p.life / p.max;
		const scale = t < 0.12 ? 0.6 + (t / 0.12) * 0.5 : 1.1 - Math.min(0.1, (t - 0.12) * 0.5);
		ctx.font = `800 ${Math.round(p.size * scale)}px "Chakra Petch", system-ui, sans-serif`;
		ctx.globalAlpha = a;
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'rgba(5,7,15,0.85)';
		ctx.strokeText(p.text, p.x, p.y);
		ctx.fillStyle = p.color;
		ctx.fillText(p.text, p.x, p.y);
		ctx.globalAlpha = 1;
	}
}
