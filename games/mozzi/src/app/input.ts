/** Keyboard and gamepad input, turned into simple commands. */
import { useEffect, useRef } from 'react';

export type Pad = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'select' | 'start';

const BUTTONS: [number, Pad][] = [
	[0, 'a'],
	[1, 'b'],
	[2, 'x'],
	[3, 'y'],
	[4, 'lb'],
	[5, 'rb'],
	[8, 'select'],
	[9, 'start'],
	[12, 'up'],
	[13, 'down'],
	[14, 'left'],
	[15, 'right'],
];
const DIRS: Pad[] = ['up', 'down', 'left', 'right'];

/** Calls `onPad` for each gamepad press. Arrows repeat while held. */
export function useGamepad(onPad: (cmd: Pad) => void, onConnect?: () => void) {
	const handler = useRef(onPad);
	handler.current = onPad;
	const connect = useRef(onConnect);
	connect.current = onConnect;
	useEffect(() => {
		let raf = 0;
		const held = new Map<Pad, number>(); // when it repeats next
		const poll = () => {
			raf = requestAnimationFrame(poll);
			const pads = navigator.getGamepads?.() ?? [];
			const down = new Set<Pad>();
			for (const gp of pads) {
				if (!gp) continue;
				for (const [i, cmd] of BUTTONS) if (gp.buttons[i]?.pressed) down.add(cmd);
				const [ax = 0, ay = 0] = gp.axes;
				if (ax < -0.5) down.add('left');
				if (ax > 0.5) down.add('right');
				if (ay < -0.5) down.add('up');
				if (ay > 0.5) down.add('down');
			}
			const now = performance.now();
			for (const cmd of down) {
				const next = held.get(cmd);
				if (next === undefined) {
					held.set(cmd, now + 320);
					handler.current(cmd);
				} else if (DIRS.includes(cmd) && now >= next) {
					held.set(cmd, now + 110);
					handler.current(cmd);
				}
			}
			for (const cmd of [...held.keys()]) if (!down.has(cmd)) held.delete(cmd);
		};
		const start = () => {
			connect.current?.();
			if (!raf) poll();
		};
		window.addEventListener('gamepadconnected', start);
		if ((navigator.getGamepads?.() ?? []).some(Boolean)) start();
		return () => {
			window.removeEventListener('gamepadconnected', start);
			cancelAnimationFrame(raf);
		};
	}, []);
}

export function useKeys(onKey: (e: KeyboardEvent) => void) {
	const handler = useRef(onKey);
	handler.current = onKey;
	useEffect(() => {
		const fn = (e: KeyboardEvent) => handler.current(e);
		window.addEventListener('keydown', fn);
		return () => window.removeEventListener('keydown', fn);
	}, []);
}

/**
 * Moves focus to the nearest button in a direction, inside the top layer
 * (the open dialog, or else the screen). Used by the gamepad and arrow keys in menus.
 */
export function moveFocus(dir: 'up' | 'down' | 'left' | 'right') {
	const layers = document.querySelectorAll<HTMLElement>('[data-layer]');
	const root = layers[layers.length - 1] ?? document.body;
	const items = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, [tabindex="0"]')].filter((el) => el.offsetParent !== null);
	if (!items.length) return;
	const current = document.activeElement as HTMLElement | null;
	if (!current || !root.contains(current)) {
		items[0].focus();
		return;
	}
	const a = current.getBoundingClientRect();
	const ax = a.left + a.width / 2;
	const ay = a.top + a.height / 2;
	let best: HTMLElement | null = null;
	let bestScore = Infinity;
	for (const el of items) {
		if (el === current) continue;
		const b = el.getBoundingClientRect();
		const dx = b.left + b.width / 2 - ax;
		const dy = b.top + b.height / 2 - ay;
		const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
		const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
		if (along <= 4) continue;
		const score = along + across * 2.5;
		if (score < bestScore) {
			bestScore = score;
			best = el;
		}
	}
	best?.focus();
}
