/** Keys for the menus: arrows move focus between buttons. */
import { useEffect, useRef } from 'react';

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
