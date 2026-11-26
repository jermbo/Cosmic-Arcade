// Feel layer: toasts, confetti, shakes, glides and count-ups.
import { save } from '../save.ts';
import { h } from './dom.ts';

export const calm = () => save.settings.lessMotion;

/** Plays a CSS animation class once. */
export function pulse(el: Element, cls: string): void {
	el.classList.remove(cls);
	void (el as HTMLElement).offsetWidth;
	el.classList.add(cls);
	const done = (e: Event) => {
		if (e.target !== el) return;
		el.classList.remove(cls);
		el.removeEventListener('animationend', done);
	};
	el.addEventListener('animationend', done);
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

export function toast(text: string, ms = 1500): void {
	toastEl ??= document.body.appendChild(h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }));
	toastEl.textContent = text;
	toastEl.classList.remove('toast--show');
	void toastEl.offsetWidth;
	toastEl.classList.add('toast--show');
	clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toastEl?.classList.remove('toast--show'), ms);
}

const CONFETTI = ['#FFD23F', '#FF9A62', '#5CC8F2', '#B993FF', '#3BD68D', '#FF6B9A'];

/** A burst of bordered paper bits from a point, or from the top of the screen. */
export function confetti(x?: number, y?: number, count = 36): void {
	if (calm()) count = Math.min(count, 10);
	const layer = document.body.appendChild(h('div', { class: 'confetti', 'aria-hidden': 'true' }));
	const fromTop = x === undefined;
	for (let i = 0; i < count; i++) {
		const size = 7 + Math.random() * 8;
		const bit = layer.appendChild(
			h('i', {
				style: {
					width: `${size}px`,
					height: `${size * (Math.random() < 0.5 ? 1 : 0.55)}px`,
					background: CONFETTI[i % CONFETTI.length],
					borderRadius: Math.random() < 0.3 ? '50%' : '2px',
				},
			}),
		);
		const sx = fromTop ? Math.random() * innerWidth : x!;
		const sy = fromTop ? -20 : y!;
		const angle = fromTop ? Math.PI / 2 + (Math.random() - 0.5) : Math.random() * Math.PI * 2;
		const speed = fromTop ? 0 : 120 + Math.random() * 220;
		const dx = Math.cos(angle) * speed + (fromTop ? (Math.random() - 0.5) * 120 : 0);
		const dy = Math.sin(angle) * speed - (fromTop ? 0 : 140);
		const fall = fromTop ? innerHeight + 40 : 260 + Math.random() * 200;
		const spin = (Math.random() - 0.5) * 900;
		const time = fromTop ? 1800 + Math.random() * 1400 : 900 + Math.random() * 600;
		bit.animate(
			[
				{ transform: `translate(${sx}px, ${sy}px) rotate(0deg)`, opacity: 1 },
				{ transform: `translate(${sx + dx * 0.7}px, ${sy + dy * 0.5}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.35 },
				{ transform: `translate(${sx + dx}px, ${sy + dy + fall}px) rotate(${spin}deg)`, opacity: 0 },
			],
			{ duration: time, easing: 'cubic-bezier(.2,.6,.4,1)', delay: fromTop ? Math.random() * 500 : 0, fill: 'forwards' },
		);
	}
	setTimeout(() => layer.remove(), 3600);
}

/** Records where elements are, so `glide` can animate them to their new spots. */
export function measure(els: Iterable<HTMLElement>): Map<HTMLElement, DOMRect> {
	const map = new Map<HTMLElement, DOMRect>();
	for (const el of els) map.set(el, el.getBoundingClientRect());
	return map;
}

/** FLIP: each element slides from its old spot to where it is now. */
export function glide(before: Map<HTMLElement, DOMRect>, ms = 360, tilt = 0): void {
	if (calm()) ms = Math.min(ms, 160);
	let i = 0;
	for (const [el, old] of before) {
		if (!el.isConnected) continue;
		const now = el.getBoundingClientRect();
		const dx = old.left - now.left;
		const dy = old.top - now.top;
		if (!dx && !dy) continue;
		const r = tilt ? (Math.random() - 0.5) * tilt : 0;
		el.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(${r}deg)` }, { transform: 'none' }], {
			duration: ms,
			delay: i++ * 12,
			easing: 'cubic-bezier(.3,1.35,.5,1)',
			fill: 'backwards',
		});
	}
}

/** A copy of `from` flies to `to`, then is removed. */
export async function fly(from: HTMLElement, to: HTMLElement, ms = 520): Promise<void> {
	const a = from.getBoundingClientRect();
	const b = to.getBoundingClientRect();
	const ghost = from.cloneNode(true) as HTMLElement;
	ghost.classList.add('flyer');
	Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
	document.body.append(ghost);
	const dx = b.left + b.width / 2 - (a.left + a.width / 2);
	const dy = b.top + b.height / 2 - (a.top + a.height / 2);
	const s = b.width / a.width;
	await ghost.animate(
		[
			{ transform: 'translate(0,0) scale(1) rotate(0deg)' },
			{ transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(${(1 + s) / 2 + 0.25}) rotate(-12deg)`, offset: 0.5 },
			{ transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)` },
		],
		{ duration: calm() ? 200 : ms, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' },
	).finished;
	ghost.remove();
}

/** Counts a number up inside an element. */
export function countUp(el: HTMLElement, from: number, to: number, ms = 700, onTick?: (i: number) => void): void {
	if (calm() || from === to) {
		el.textContent = String(to);
		return;
	}
	const start = performance.now();
	let ticks = 0;
	const step = (t: number) => {
		const k = Math.min(1, (t - start) / ms);
		const v = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
		el.textContent = String(v);
		if (onTick && Math.floor(k * 8) > ticks) onTick(ticks++);
		if (k < 1) requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}
