// The on-screen keyboard. Physical keys are routed to the same handler.
import { sfx } from '../audio.ts';
import type { Mark } from '../core/types.ts';
import { h, icon } from './dom.ts';
import { pulse } from './fx.ts';
import { pushKeys } from './nav.ts';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '+ZXCVBNM-'];

export type KeyName = string | 'ENTER' | 'BACK';

export class Keyboard {
	el: HTMLElement;
	private keys = new Map<string, HTMLButtonElement>();
	private release: (() => void) | null = null;

	private onKey: (key: KeyName) => void;

	constructor(onKey: (key: KeyName) => void) {
		this.onKey = onKey;
		this.el = h('div', { class: 'kb', role: 'group', 'aria-label': 'Keyboard' });
		for (const row of ROWS) {
			const r = this.el.appendChild(h('div', { class: 'kb__row' }));
			for (const ch of row) {
				const name = ch === '+' ? 'ENTER' : ch === '-' ? 'BACK' : ch;
				const btn = h(
					'button',
					{
						class: `kb__key${name.length > 1 ? ' kb__key--wide' : ''}`,
						type: 'button',
						'aria-label': name === 'BACK' ? 'Delete' : name === 'ENTER' ? 'Enter' : name,
						'data-key': name,
					},
					name === 'BACK' ? icon('erase') : name === 'ENTER' ? 'ENTER' : name,
				);
				btn.addEventListener('pointerdown', (e) => {
					e.preventDefault();
					this.press(name);
				});
				// Keyboard users (Tab + Enter/Space) still get a click.
				btn.addEventListener('click', (e) => {
					if ((e as PointerEvent).pointerType === '' || e.detail === 0) this.press(name);
				});
				this.keys.set(name, btn);
				r.append(btn);
			}
		}
	}

	private press(name: KeyName) {
		const btn = this.keys.get(name);
		if (btn) pulse(btn, 'kb__key--press');
		if (name === 'BACK') sfx.erase();
		else if (name !== 'ENTER') sfx.key();
		this.onKey(name);
	}

	/** Starts listening to the physical keyboard. */
	attach(): void {
		this.release ??= pushKeys((key, e) => {
			if (key === 'Enter') this.press('ENTER');
			else if (key === 'Backspace') this.press('BACK');
			else if (/^[a-z]$/i.test(key)) this.press(key.toUpperCase());
			else return;
			e.preventDefault();
		});
	}

	detach(): void {
		this.release?.();
		this.release = null;
	}

	setMarks(marks: Map<string, Mark>): void {
		for (const [ch, btn] of this.keys) {
			if (ch.length > 1) continue;
			const m = marks.get(ch);
			const old = btn.dataset.mark;
			if (m) btn.dataset.mark = m;
			else delete btn.dataset.mark;
			if (m && m !== old) pulse(btn, 'kb__key--pop');
		}
	}
}
