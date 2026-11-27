/**
 * Particles on a canvas over the window: glue squeezing out, glints on finished
 * lines, and glass confetti when the window is mended. Runs only while particles live.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
/** Particles use board units: the board is 400 × 400, a tile is 100. */
export const FX_SIZE = 400;
export const tileCenter = (cell: number) => ({ cx: (cell % 4) * 100 + 50, cy: Math.floor(cell / 4) * 100 + 50 });

/** Theme colors, read from CSS, so particles match the current theme. */
function themeColor(name: string, fallback: string) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

type Kind = 'glue' | 'glint' | 'shard' | 'mote';

interface P {
	kind: Kind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	color: string;
	spin: number;
	angle: number;
}

export interface FxApi {
	/** x, y in window (SVG) units. */
	burst(kind: Kind, x: number, y: number, count: number, color?: string): void;
}

export const Fx = forwardRef<FxApi, { calm: boolean }>(function Fx({ calm }, ref) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const parts = useRef<P[]>([]);
	const frame = useRef(0);

	useImperativeHandle(ref, () => ({
		burst(kind, x, y, count, color) {
			const n = calm ? Math.ceil(count / 3) : count;
			for (let i = 0; i < n; i++) {
				const a = Math.random() * Math.PI * 2;
				const sp = kind === 'glue' ? 0.6 + Math.random() * 1.6 : kind === 'shard' ? 1.5 + Math.random() * 3.5 : 0.3 + Math.random() * 0.9;
				const max = kind === 'glue' ? 34 + Math.random() * 18 : kind === 'shard' ? 90 + Math.random() * 60 : 40 + Math.random() * 30;
				parts.current.push({
					kind,
					x: x + (kind === 'glue' ? Math.cos(a) * 36 : 0),
					y: y + (kind === 'glue' ? Math.sin(a) * 36 : 0),
					vx: Math.cos(a) * sp,
					vy: Math.sin(a) * sp - (kind === 'shard' ? 2.5 : 0),
					life: 0,
					max,
					size: kind === 'glue' ? 2.5 + Math.random() * 3.5 : kind === 'shard' ? 5 + Math.random() * 6 : 2 + Math.random() * 3,
					color: color ?? themeColor(`--k${Math.floor(Math.random() * 4)}`, '#ffb3b3'),
					spin: (Math.random() - 0.5) * 0.3,
					angle: Math.random() * 6,
				});
			}
			if (!frame.current) frame.current = requestAnimationFrame(loop);
		},
	}));

	const loop = () => {
		const cv = canvas.current;
		if (!cv) return;
		const ctx = cv.getContext('2d')!;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const w = cv.clientWidth;
		const h = cv.clientHeight;
		if (cv.width !== Math.round(w * dpr)) {
			cv.width = Math.round(w * dpr);
			cv.height = Math.round(h * dpr);
		}
		const k = (w / FX_SIZE) * dpr;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, cv.width, cv.height);
		ctx.setTransform(k, 0, 0, k, 0, 0);
		const glue = themeColor('--glue', '#fffdf6');
		const edge = themeColor('--edge-line', 'rgba(0,0,0,0.25)');
		const alive: P[] = [];
		for (const p of parts.current) {
			p.life++;
			if (p.life > p.max) continue;
			alive.push(p);
			const t = p.life / p.max;
			p.x += p.vx;
			p.y += p.vy;
			p.angle += p.spin;
			if (p.kind === 'glue') {
				p.vx *= 0.88;
				p.vy = p.vy * 0.88 + 0.12;
			} else if (p.kind === 'shard') {
				p.vy += 0.09;
				p.vx *= 0.99;
			} else p.vy -= 0.01;
			ctx.globalAlpha = p.kind === 'glue' ? 1 - t * t : 1 - t;
			if (p.kind === 'glue') {
				ctx.fillStyle = glue;
				ctx.strokeStyle = edge;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, p.size * (1 - t * 0.4), p.size * (1 + t * 0.3), 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			} else if (p.kind === 'shard') {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.angle);
				ctx.fillStyle = p.color;
				ctx.strokeStyle = edge;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(-p.size, -p.size * 0.6);
				ctx.lineTo(p.size, -p.size * 0.2);
				ctx.lineTo(-p.size * 0.2, p.size);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
				ctx.restore();
			} else {
				// A four-point glint.
				const s = p.size * (p.kind === 'glint' ? 1.6 - t : 1);
				ctx.fillStyle = p.kind === 'glint' ? '#fffdf2' : p.color;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y - s * 2);
				ctx.quadraticCurveTo(p.x, p.y, p.x + s * 2, p.y);
				ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s * 2);
				ctx.quadraticCurveTo(p.x, p.y, p.x - s * 2, p.y);
				ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
		parts.current = alive;
		frame.current = alive.length ? requestAnimationFrame(loop) : 0;
		if (!alive.length) ctx.clearRect(0, 0, cv.width, cv.height);
	};

	useEffect(() => () => cancelAnimationFrame(frame.current), []);

	return <canvas ref={canvas} className="fx" aria-hidden="true" />;
});
