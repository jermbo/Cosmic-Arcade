// Small DOM helpers and the icon set.

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined || value === null || value === false) continue;
		if (key === 'on') {
			for (const [ev, fn] of Object.entries(value as Record<string, EventListener>)) el.addEventListener(ev, fn);
		} else if (key === 'class') {
			el.className = String(value);
		} else if (key === 'html') {
			el.innerHTML = String(value);
		} else if (key === 'style' && typeof value === 'object') {
			Object.assign(el.style, value);
		} else if (key.startsWith('--')) {
			el.style.setProperty(key, String(value));
		} else if (value === true) {
			el.setAttribute(key, '');
		} else {
			el.setAttribute(key, String(value));
		}
	}
	for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
	return el;
}

export function icon(name: keyof typeof ICONS, cls = 'icon'): HTMLSpanElement {
	return h('span', { class: cls, 'aria-hidden': 'true', html: ICONS[name] });
}

const svg = (body: string) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
	back: svg('<path d="M15 5l-7 7 7 7"/>'),
	help: svg('<path d="M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.3"/><circle cx="12" cy="18" r=".6" fill="currentColor"/>'),
	gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
	coin: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#ffd23f" stroke="#141414" stroke-width="2.4"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#141414" stroke-width="1.8" stroke-dasharray="2.2 2"/><path d="M10.4 9.6h3.2M12 9.6v4.8" stroke="#141414" stroke-width="2" stroke-linecap="round"/></svg>`,
	shop: svg('<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 1.9A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1.1A3 3 0 0 1 4 11z"/><path d="M5.5 13.5V20h13v-6.5"/>'),
	play: svg('<path d="M8 5.5v13l10-6.5z"/>'),
	book: svg('<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>'),
	chart: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
	shuffle: svg('<path d="M3 7h4c5 0 5 10 10 10h4M3 17h4c2 0 3-1.5 4-3M17 7h4M13 10c1-1.7 2-3 4-3"/><path d="M19 4l2 3-2 3M19 14l2 3-2 3"/>'),
	lock: `<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.8"/></svg>`,
	heart: `<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.7-8 10.6-8 10.6z" fill="currentColor" stroke="#141414" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
	star: `<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="#141414" stroke-width="2" stroke-linejoin="round"/></svg>`,
	erase: svg('<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>'),
	close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
	share: svg('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>'),
	bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
};

export function wait(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/** Font size step for a word on a tile, so long words fit. */
export function lengthClass(word: string): string {
	return word.length >= 8 ? 'len-xl' : word.length >= 7 ? 'len-l' : word.length >= 6 ? 'len-m' : '';
}
