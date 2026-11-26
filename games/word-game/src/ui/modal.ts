// A card over the screen. Closable ones are history layers, so back closes them.
import { sfx } from '../audio.ts';
import { h, icon } from './dom.ts';
import { closeLayer, pushLayer } from './nav.ts';

export interface ModalOpts {
	title: string;
	body: (Node | string)[];
	/** False for a modal only its own buttons can leave. */
	closable?: boolean;
	cls?: string;
	parent?: HTMLElement;
	onClose?: () => void;
}

export interface ModalHandle {
	el: HTMLElement;
	card: HTMLElement;
	close: () => void;
}

export function openModal(opts: ModalOpts): ModalHandle {
	const closable = opts.closable ?? true;
	// Focus goes back to whatever opened the card.
	const opener = document.activeElement as HTMLElement | null;
	let depth = 0;
	let open = true;
	const remove = () => {
		if (!open) return;
		open = false;
		el.classList.add('modal--out');
		setTimeout(() => el.remove(), 180);
		if (opener?.isConnected) opener.focus({ preventScroll: true });
		opts.onClose?.();
	};
	const close = () => (closable && depth ? closeLayer(depth) : remove());

	const card = h(
		'div',
		{ class: `modal__card ${opts.cls ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
		h(
			'div',
			{ class: 'modal__head' },
			h('h2', { class: 'modal__title' }, opts.title),
			closable && h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', on: { click: () => { sfx.ui(); close(); } } }, icon('close')),
		),
		h('div', { class: 'modal__body' }, ...opts.body),
	);
	const el = h('div', { class: 'modal' }, card);
	if (closable) {
		el.addEventListener('click', (e) => {
			if (e.target === el) close();
		});
	}
	(opts.parent ?? document.body).append(el);
	if (closable) depth = pushLayer(remove);
	// Tab and Shift+Tab stay inside the card while it is open.
	card.addEventListener('keydown', (e) => {
		if (e.key !== 'Tab') return;
		const items = [...card.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	});
	card.tabIndex = -1;
	requestAnimationFrame(() => ((card.querySelector('button.btn') as HTMLElement | null) ?? card).focus({ preventScroll: true }));
	return { el, card, close };
}
