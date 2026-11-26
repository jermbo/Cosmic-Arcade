// A panel with guess rows and the keyboard. Crack and Secret use it.
import { sfx } from '../audio.ts';
import type { Mark } from '../core/types.ts';
import { isWord } from '../core/words.ts';
import { h, icon } from './dom.ts';
import { calm, pulse, toast } from './fx.ts';
import { Keyboard } from './keyboard.ts';
import { closeLayer, pushLayer } from './nav.ts';
import type { WordRows } from './wordrows.ts';

export interface PanelOpts {
	title: string;
	sub: string;
	rows: WordRows;
	length: number;
	keyMarks: Map<string, Mark>;
	/** False: no close button, back does not close it. */
	closable: boolean;
	/** False: any letters count as a guess. */
	checkWords: boolean;
	parent: HTMLElement;
	onGuess: (guess: string) => Promise<void>;
	onClose: () => void;
}

export class GuessPanel {
	el: HTMLElement;
	kb: Keyboard;
	private subEl: HTMLElement;
	private depth = 0;
	private open = true;

	private opts: PanelOpts;

	constructor(opts: PanelOpts) {
		this.opts = opts;
		this.kb = new Keyboard((k) => void this.key(k));
		this.kb.setMarks(opts.keyMarks);
		this.subEl = h('span', { class: 'panel__sub' }, opts.sub);
		const head = h(
			'div',
			{ class: 'panel__head' },
			h('div', {}, h('strong', { class: 'panel__title' }, opts.title), this.subEl),
			opts.closable && h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Back to the board', on: { click: () => this.close() } }, icon('close')),
		);
		this.el = h('section', { class: 'panel' }, head, opts.rows.el, this.kb.el);
		opts.parent.append(this.el);
		if (!calm()) pulse(this.el, 'panel--in');
		this.kb.attach();
		if (opts.closable) this.depth = pushLayer(() => this.remove());
		opts.rows.scrollToNow();
	}

	setSub(text: string): void {
		this.subEl.textContent = text;
	}

	private async key(k: string) {
		const rows = this.opts.rows;
		if (rows.busy) return;
		if (k === 'BACK') rows.erase();
		else if (k !== 'ENTER') rows.type(k);
		else if (rows.guess.length < this.opts.length) {
			rows.shake();
			sfx.invalid();
			toast('Not enough letters');
		} else if (this.opts.checkWords && !isWord(rows.guess)) {
			rows.shake();
			sfx.invalid();
			toast('Not in the word list');
		} else {
			await this.opts.onGuess(rows.guess);
		}
	}

	/** Closes by the back stack when it is a layer. */
	close(): void {
		if (!this.open) return;
		if (this.depth) closeLayer(this.depth);
		else this.remove();
	}

	private remove() {
		if (!this.open) return;
		this.open = false;
		this.kb.detach();
		this.el.classList.add('panel--out');
		setTimeout(() => this.el.remove(), calm() ? 0 : 200);
		this.opts.onClose();
	}
}
