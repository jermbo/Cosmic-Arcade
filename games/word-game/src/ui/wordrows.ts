// Guess rows: type a word, then each tile flips to show its mark.
import { sfx } from '../audio.ts';
import type { Mark } from '../core/types.ts';
import { h, wait } from './dom.ts';
import { calm, pulse } from './fx.ts';

export interface RowsOpts {
	length: number;
	rows: number;
	/** Known letters shown faintly in empty tiles. */
	ghost?: (string | null)[];
}

export class WordRows {
	el: HTMLElement;
	private rowEls: HTMLElement[] = [];
	private row = 0;
	private text = '';
	busy = false;

	private opts: RowsOpts;

	constructor(opts: RowsOpts) {
		this.opts = opts;
		this.el = h('div', { class: 'rows', '--len': opts.length, '--rows': Math.max(1, opts.rows) });
		for (let r = 0; r < opts.rows; r++) {
			const row = this.el.appendChild(h('div', { class: 'rows__row' }));
			for (let i = 0; i < opts.length; i++) row.append(h('div', { class: 'cell' }));
			this.rowEls.push(row);
		}
		this.paintGhost();
		this.markCurrent();
	}

	get guess(): string {
		return this.text;
	}

	get rowsLeft(): number {
		return this.opts.rows - this.row;
	}

	private cells(r = this.row): HTMLElement[] {
		return [...(this.rowEls[r]?.children ?? [])] as HTMLElement[];
	}

	private markCurrent() {
		this.rowEls.forEach((r, i) => r.classList.toggle('rows__row--now', i === this.row));
	}

	private paintGhost() {
		const g = this.opts.ghost;
		if (!g) return;
		this.cells().forEach((c, i) => {
			if (i >= this.text.length && g[i]) c.dataset.ghost = g[i]!;
			else delete c.dataset.ghost;
		});
	}

	setGhost(ghost: (string | null)[]): void {
		this.opts.ghost = ghost;
		this.paintGhost();
	}

	type(ch: string): void {
		if (this.busy || this.row >= this.opts.rows || this.text.length >= this.opts.length) return;
		const cell = this.cells()[this.text.length];
		cell.textContent = ch;
		cell.classList.add('cell--filled');
		pulse(cell, 'cell--pop');
		this.text += ch;
		this.paintGhost();
	}

	erase(): void {
		if (this.busy || !this.text.length) return;
		this.text = this.text.slice(0, -1);
		const cell = this.cells()[this.text.length];
		cell.textContent = '';
		cell.classList.remove('cell--filled');
		this.paintGhost();
	}

	shake(): void {
		pulse(this.rowEls[this.row], 'rows__row--shake');
	}

	/** Flips the current row to show marks, then moves to the next row. */
	async reveal(marks: Mark[]): Promise<void> {
		this.busy = true;
		const cells = this.cells();
		const step = calm() ? 60 : 210;
		cells.forEach((c, i) => {
			c.style.setProperty('--d', `${i * step}ms`);
			setTimeout(() => {
				c.dataset.mark = marks[i];
				sfx.flip(i, marks[i]);
			}, i * step + (calm() ? 0 : 160));
			c.classList.add('cell--flip');
		});
		await wait(cells.length * step + (calm() ? 120 : 380));
		cells.forEach((c) => c.classList.remove('cell--flip'));
		this.row++;
		this.text = '';
		this.markCurrent();
		this.paintGhost();
		this.busy = false;
	}

	/** Fills a past guess at once, with no animation. */
	fill(guess: string, marks: Mark[]): void {
		this.cells().forEach((c, i) => {
			c.textContent = guess[i];
			c.classList.add('cell--filled');
			c.dataset.mark = marks[i];
		});
		this.row++;
		this.text = '';
		this.markCurrent();
		this.paintGhost();
	}

	/** Adds an empty row at the end and scrolls to it. */
	addRow(): void {
		const row = this.el.appendChild(h('div', { class: 'rows__row' }));
		for (let i = 0; i < this.opts.length; i++) row.append(h('div', { class: 'cell' }));
		this.rowEls.push(row);
		this.opts.rows++;
		this.el.style.setProperty('--rows', String(this.opts.rows));
		this.markCurrent();
		this.paintGhost();
		pulse(row, 'rows__row--in');
		this.scrollToNow();
	}

	scrollToNow(): void {
		const row = this.rowEls[Math.min(this.row, this.rowEls.length - 1)];
		if (row) this.el.scrollTo({ top: row.offsetTop - this.el.offsetTop - 4, behavior: calm() ? 'auto' : 'smooth' });
	}

	/** A happy hop along the last revealed row. */
	async bounce(): Promise<void> {
		const cells = this.cells(this.row - 1);
		cells.forEach((c, i) => {
			c.style.setProperty('--d', `${i * 70}ms`);
			pulse(c, 'cell--bounce');
		});
		await wait(cells.length * 70 + 450);
	}

	/** Shows the answer in the next free row (or the last one). */
	showAnswer(word: string): void {
		const r = Math.min(this.row, this.opts.rows - 1);
		this.cells(r).forEach((c, i) => {
			c.textContent = word[i];
			c.classList.add('cell--filled', 'cell--answer');
		});
	}
}
