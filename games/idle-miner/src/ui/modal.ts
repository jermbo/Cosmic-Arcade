// One modal sheet, reused by every panel. A panel gives a title and a render function.
// While open, the body re-renders a few times a second, but only when its HTML changes.

const modal = document.getElementById('modal')!;
const title = document.getElementById('modal-title')!;
const body = document.getElementById('modal-body')!;
const closeBtn = document.getElementById('modal-close')!;

export interface Panel {
	id: string;
	title: string;
	render: () => string;
	/** Clicks on elements with data-act="name" call this. */
	act?: (name: string, el: HTMLElement) => void;
	onClose?: () => void;
	/** Some panels must be answered, not closed with the X. */
	locked?: boolean;
	/** Some panels hold inputs and must not re-render while open. */
	still?: boolean;
}

let current: Panel | null = null;
let lastHtml = '';
let returnFocus: HTMLElement | null = null;

export function openPanel(p: Panel) {
	if (!current) returnFocus = document.activeElement as HTMLElement | null;
	current = p;
	title.textContent = p.title;
	lastHtml = p.render();
	body.innerHTML = lastHtml;
	closeBtn.hidden = !!p.locked;
	modal.hidden = false;
	body.scrollTop = 0;
	const first = body.querySelector<HTMLElement>('button:not(:disabled), input, textarea');
	(first || closeBtn).focus({ preventScroll: true });
}

export function closePanel() {
	if (!current) return;
	const p = current;
	current = null;
	modal.hidden = true;
	body.innerHTML = '';
	p.onClose?.();
	returnFocus?.focus?.({ preventScroll: true });
}

export function panelOpen(id?: string) {
	return current !== null && (id === undefined || current.id === id);
}

export function refreshPanel() {
	if (!current || current.still) return;
	const html = current.render();
	if (html === lastHtml) return;
	lastHtml = html;
	const scroll = body.scrollTop;
	const focusAct = (document.activeElement as HTMLElement | null)?.dataset?.act;
	const focusArg = (document.activeElement as HTMLElement | null)?.dataset?.arg;
	body.innerHTML = html;
	body.scrollTop = scroll;
	if (focusAct) body.querySelector<HTMLElement>(`[data-act="${focusAct}"]${focusArg ? `[data-arg="${focusArg}"]` : ''}`)?.focus({ preventScroll: true });
}

closeBtn.addEventListener('click', closePanel);
modal.addEventListener('pointerdown', (e) => {
	if (e.target === modal && current && !current.locked) closePanel();
});
body.addEventListener('click', (e) => {
	const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
	if (!el || !current || (el as HTMLButtonElement).disabled) return;
	current.act?.(el.dataset.act!, el);
});
body.addEventListener('input', (e) => {
	const el = e.target as HTMLElement;
	if (el.dataset.act && current) current.act?.(el.dataset.act, el);
});

export function isLocked() {
	return !!current?.locked;
}
