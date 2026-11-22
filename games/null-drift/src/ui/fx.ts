import { gsap } from 'gsap';

/** Calm mode cuts motion. It starts from the OS setting and the settings panel can flip it. */
export const motion = {
	calm: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

export const dur = (s: number) => (motion.calm ? 0 : s);

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, motion.calm ? Math.min(ms, 120) : ms));

export type Tone = 'coral' | 'gold' | 'green' | 'dim' | 'red' | 'cream';

let layer: HTMLElement | null = null;
export function setFxLayer(el: HTMLElement): void {
	layer = el;
}

/** A number or word that rises off an element and fades. */
export function floatText(anchor: Element | null, text: string, tone: Tone = 'cream', dy = -56): void {
	if (!anchor || !layer) return;
	const r = anchor.getBoundingClientRect();
	const el = document.createElement('span');
	el.className = `float float--${tone}`;
	el.textContent = text;
	el.style.left = `${r.left + r.width / 2}px`;
	el.style.top = `${r.top + r.height / 3}px`;
	layer.append(el);
	gsap.fromTo(
		el,
		{ xPercent: -50, yPercent: -50, y: 0, opacity: 0, scale: 0.7 },
		{
			y: dy,
			opacity: 1,
			scale: 1,
			duration: dur(0.35),
			ease: 'back.out(2)',
			onComplete: () => {
				gsap.to(el, { y: dy - 24, opacity: 0, duration: dur(0.7), delay: dur(0.35), onComplete: () => el.remove() });
			},
		},
	);
}

export function shake(el: Element | null, strength = 6, time = 0.35): void {
	if (!el || motion.calm) return;
	gsap.fromTo(
		el,
		{ x: 0 },
		{
			x: 0,
			duration: time,
			ease: 'none',
			keyframes: { x: [0, -strength, strength, -strength * 0.6, strength * 0.6, -strength * 0.3, 0] },
			clearProps: 'transform',
		},
	);
}

/** Adds a class that runs a CSS animation, then takes it off. */
export function pulseClass(el: Element | null, cls: string, ms = 500): void {
	if (!el) return;
	el.classList.remove(cls);
	void (el as HTMLElement).offsetWidth;
	el.classList.add(cls);
	setTimeout(() => el.classList.remove(cls), ms);
}

export function countUp(el: Element | null, from: number, to: number, time = 0.6): void {
	if (!el) return;
	if (motion.calm || from === to) {
		el.textContent = String(Math.round(to));
		return;
	}
	const box = { v: from };
	gsap.to(box, {
		v: to,
		duration: time,
		ease: 'power2.out',
		onUpdate: () => (el.textContent = String(Math.round(box.v))),
	});
}

export { gsap };
