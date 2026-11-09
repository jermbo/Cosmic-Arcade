// Short messages that show for a moment and go.

import { ui } from './elements.ts';

export function toast(text: string, kind = '') {
	const el = document.createElement('div');
	el.className = `toast ${kind ? 'toast--' + kind : ''}`;
	el.textContent = text;
	pushToast(el, 2.2);
}

export function toastUnlock(title: string, text: string) {
	const el = document.createElement('div');
	el.className = 'toast toast--unlock';
	el.innerHTML = `<strong></strong><span></span>`;
	el.querySelector('strong')!.textContent = title;
	el.querySelector('span')!.textContent = text;
	pushToast(el, 3.6);
}

export function pushToast(el: HTMLElement, life: number) {
	el.style.setProperty('--life', `${life}s`);
	ui.toasts.append(el);
	while (ui.toasts.children.length > 3) ui.toasts.firstElementChild!.remove();
	setTimeout(() => el.remove(), (life + 0.5) * 1000);
}
