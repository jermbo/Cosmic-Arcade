// Small DOM helpers for the overlay: elements, panels, banners, and the phone back button.

import { art } from '../art/index.ts';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

/** Makes an element. Attributes starting with "on" become listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	for (const [key, val] of Object.entries(attrs)) {
		if (val === undefined || val === false) continue;
		if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2), val as EventListener);
		else if (key === 'class') el.className = String(val);
		else if (key === 'html') el.innerHTML = String(val);
		else el.setAttribute(key, val === true ? '' : String(val));
	}
	for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
	return el;
}

export function icon(name: string, size = 22): HTMLElement {
	const span = h('span', { class: 'ico', 'aria-hidden': 'true' });
	span.innerHTML = art.iconSvg(name).replace('width="24" height="24"', `width="${size}" height="${size}"`);
	span.style.display = 'inline-flex';
	return span;
}

export const root = document.querySelector<HTMLElement>('#ui')!;

/** One layer of the overlay. */
export interface Layer {
	el: HTMLElement;
	/** Called by the back button. Return false to keep the layer open. */
	back?: () => boolean | void;
}

const layers: Layer[] = [];

export function push(el: HTMLElement, back?: () => boolean | void): Layer {
	const layer = { el, back };
	layers.push(layer);
	root.append(el);
	const focus = el.querySelector<HTMLElement>('[autofocus], .btn--accent, button');
	focus?.focus({ preventScroll: true });
	return layer;
}

export function pop(layer?: Layer) {
	const l = layer ?? layers[layers.length - 1];
	if (!l) return;
	const i = layers.indexOf(l);
	if (i >= 0) layers.splice(i, 1);
	l.el.remove();
}

export function clearLayers() {
	while (layers.length) pop();
}

export const topLayer = () => layers[layers.length - 1];
export const hasPanel = () => layers.some((l) => l.el.classList.contains('scrim'));

/** A modal panel. `onBack` runs on the back button or the close button; omit it for panels that must be answered. */
export function panel(opts: { title: string; sub?: string; body: Child | Child[]; foot?: Child | Child[]; narrow?: boolean; onBack?: () => void; clear?: boolean }): Layer {
	const close = opts.onBack
		? h('button', { class: 'btn btn--icon panel__close', 'aria-label': 'Close', onclick: () => opts.onBack!() }, icon('close'))
		: null;
	const box = h(
		'section',
		{ class: `panel${opts.narrow ? ' panel--narrow' : ''}`, role: 'dialog', 'aria-label': opts.title },
		h('header', { class: 'panel__head' }, h('div', {}, h('h2', { class: 'panel__title' }, opts.title), opts.sub ? h('p', { class: 'panel__sub' }, opts.sub) : null), close),
		opts.body,
		opts.foot ? h('footer', { class: 'panel__foot' }, opts.foot) : null,
	);
	const scrim = h('div', { class: `scrim${opts.clear ? ' scrim--clear' : ''}` }, box);
	return push(scrim, opts.onBack ? () => opts.onBack!() : () => false);
}

export function button(label: string | Node, onclick: () => void, cls = '', attrs: Attrs = {}): HTMLButtonElement {
	return h('button', { class: `btn ${cls}`, type: 'button', onclick: () => onclick(), ...attrs }, label);
}

/** A big call-out that fades by itself. */
export function banner(text: string, sub = '', ink = false, ms = 1600) {
	const el = h('div', { class: `banner${ink ? ' banner--ink' : ''}`, role: 'status' }, text, sub ? h('small', {}, sub) : null);
	el.style.animationDuration = `${ms}ms`;
	root.append(el);
	setTimeout(() => el.remove(), ms + 50);
}

let flashEl: HTMLElement | null = null;
export function hurtFlash() {
	if (!flashEl) {
		flashEl = h('div', { class: 'flash pass' });
		root.append(flashEl);
	}
	flashEl.classList.remove('flash--hurt');
	void flashEl.offsetWidth;
	flashEl.classList.add('flash--hurt');
}

// ---------- Back button stays in the game ----------

let backHandler: () => void = () => {};

/** What the back button does when no panel is open (pause, leave a menu...). */
export function onBack(fn: () => void) {
	backHandler = fn;
}

export function setupBack() {
	history.pushState({ requiver: true }, '');
	window.addEventListener('popstate', () => {
		history.pushState({ requiver: true }, '');
		const top = topLayer();
		if (top?.back) {
			top.back();
			return;
		}
		backHandler();
	});
}

/** The rotate prompt for phones held upright. */
export function setupRotate() {
	root.append(h('div', { class: 'rotate', role: 'alert' }, h('div', {}, h('div', { class: 'rotate__phone' }), 'Turn your phone sideways')));
}
