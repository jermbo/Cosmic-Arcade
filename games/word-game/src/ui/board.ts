// The sorting board: 16 tiles, pick 4 that share a link, submit.
import { buzz, sfx } from '../audio.ts';
import type { Board, BoardGroup, Level } from '../core/types.ts';
import { h, icon, lengthClass, wait } from './dom.ts';
import { calm, confetti, glide, measure, pulse, toast } from './fx.ts';

export interface BoardEvents {
	onSolve: (group: BoardGroup, bar: HTMLElement, given: boolean) => void;
	onMistake: (oneAway: boolean) => void;
	onLockedTap?: (word: string) => void;
	/** False while play is paused (a panel is open, or the game is over). */
	canPlay: () => boolean;
}

export class SortBoard {
	el: HTMLElement;
	private solvedEl: HTMLElement;
	private gridEl: HTMLElement;
	private submitBtn: HTMLButtonElement;
	private clearBtn: HTMLButtonElement;
	private shuffleBtn: HTMLButtonElement;
	private tiles = new Map<string, HTMLButtonElement>();
	private groupOf = new Map<string, BoardGroup>();
	private order: string[];
	private selected = new Set<string>();
	private locked: Set<string>;
	private tried = new Set<string>();
	private busy = false;
	solved: BoardGroup[] = [];
	/** Each submit, as the levels of its 4 tiles. For the share text. */
	history: Level[][] = [];

	private board: Board;
	private events: BoardEvents;

	private hints: Map<string, (string | null)[]>;

	constructor(board: Board, events: BoardEvents, locked: string[] = [], hints = new Map<string, (string | null)[]>()) {
		this.hints = hints;
		this.board = board;
		this.events = events;
		this.locked = new Set(locked);
		this.order = board.tiles.slice();
		for (const g of board.groups) for (const w of g.words) this.groupOf.set(w, g);

		this.solvedEl = h('div', { class: 'board__solved' });
		this.gridEl = h('div', { class: 'board__grid', role: 'group', 'aria-label': 'Word tiles' });
		for (const word of this.order) this.gridEl.append(this.makeTile(word));

		this.shuffleBtn = h('button', { class: 'btn btn--ghost', type: 'button', on: { click: () => this.shuffle() } }, icon('shuffle'), 'Shuffle');
		this.clearBtn = h('button', { class: 'btn btn--ghost', type: 'button', disabled: true, on: { click: () => this.clear() } }, 'Clear');
		this.submitBtn = h('button', { class: 'btn btn--go', type: 'button', disabled: true, on: { click: () => void this.submit() } }, 'Submit');
		this.el = h('div', { class: 'board' }, this.solvedEl, this.gridEl, h('div', { class: 'board__controls' }, this.shuffleBtn, this.clearBtn, this.submitBtn));
	}

	get done(): boolean {
		return this.solved.length === this.board.groups.length;
	}

	private makeTile(word: string): HTMLButtonElement {
		const isLocked = this.locked.has(word);
		const tile = h(
			'button',
			{
				class: `tile ${lengthClass(word)}${isLocked ? ' tile--locked' : ''}`,
				type: 'button',
				'aria-pressed': 'false',
				'aria-label': isLocked ? `Locked word, ${word.length} letters` : word,
				on: { click: () => this.tap(word) },
			},
			isLocked ? this.lockFace(word) : h('span', { class: 'tile__word' }, word),
		);
		this.tiles.set(word, tile);
		return tile;
	}

	/** The lock, plus a dot per letter. Letters given by the difficulty show in place of their dot. */
	private lockFace(word: string): HTMLElement {
		const hint = this.hints.get(word) ?? [];
		const marks = [...word].map((_, i) => (hint[i] ? h('b', {}, hint[i]!) : h('i')));
		return h('span', { class: 'tile__lock' }, icon('lock', 'tile__lockicon'), h('span', { class: 'tile__dots' }, ...marks));
	}

	private tap(word: string) {
		if (this.busy || !this.events.canPlay()) return;
		const tile = this.tiles.get(word)!;
		if (this.locked.has(word)) {
			sfx.ui();
			pulse(tile, 'tile--nudge');
			this.events.onLockedTap?.(word);
			return;
		}
		if (this.selected.has(word)) {
			this.selected.delete(word);
			sfx.deselect();
		} else if (this.selected.size >= 4) {
			sfx.invalid();
			pulse(tile, 'tile--nope');
			return;
		} else {
			this.selected.add(word);
			sfx.select(this.selected.size);
		}
		const on = this.selected.has(word);
		tile.classList.toggle('tile--on', on);
		tile.setAttribute('aria-pressed', String(on));
		pulse(tile, on ? 'tile--squish' : 'tile--unsquish');
		this.syncButtons();
	}

	private syncButtons() {
		this.submitBtn.disabled = this.selected.size !== 4;
		this.clearBtn.disabled = this.selected.size === 0;
		this.submitBtn.classList.toggle('btn--ready', this.selected.size === 4);
	}

	clear(): void {
		if (this.busy) return;
		for (const w of this.selected) {
			const t = this.tiles.get(w)!;
			t.classList.remove('tile--on');
			t.setAttribute('aria-pressed', 'false');
		}
		if (this.selected.size) sfx.deselect();
		this.selected.clear();
		this.syncButtons();
	}

	shuffle(): void {
		if (this.busy) return;
		const before = measure(this.order.map((w) => this.tiles.get(w)!));
		for (let i = this.order.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.order[i], this.order[j]] = [this.order[j], this.order[i]];
		}
		for (const w of this.order) this.gridEl.append(this.tiles.get(w)!);
		glide(before, 420, 14);
		sfx.shuffle();
	}

	async submit(): Promise<void> {
		if (this.busy || this.selected.size !== 4 || !this.events.canPlay()) return;
		const picked = this.order.filter((w) => this.selected.has(w));
		const key = picked.slice().sort().join('|');
		if (this.tried.has(key)) {
			toast('Already tried that one');
			picked.forEach((w) => pulse(this.tiles.get(w)!, 'tile--nope'));
			return;
		}
		this.tried.add(key);
		this.busy = true;
		this.submitBtn.classList.remove('btn--ready');

		const step = calm() ? 30 : 90;
		picked.forEach((w, i) => {
			const t = this.tiles.get(w)!;
			t.style.setProperty('--d', `${i * step}ms`);
			pulse(t, 'tile--hop');
			setTimeout(() => sfx.hop(i), i * step);
		});
		await wait(picked.length * step + (calm() ? 120 : 360));

		this.history.push(picked.map((w) => this.groupOf.get(w)!.level));
		const counts = new Map<BoardGroup, number>();
		for (const w of picked) counts.set(this.groupOf.get(w)!, (counts.get(this.groupOf.get(w)!) ?? 0) + 1);
		const best = Math.max(...counts.values());

		if (best === 4) {
			await this.solve(this.groupOf.get(picked[0])!, false);
		} else {
			picked.forEach((w) => pulse(this.tiles.get(w)!, 'tile--shake'));
			buzz([30, 40, 30]);
			if (best === 3) {
				sfx.oneAway();
				toast('One away!');
			} else {
				sfx.wrong();
			}
			await wait(calm() ? 100 : 380);
			this.events.onMistake(best === 3);
		}
		this.busy = false;
		this.syncButtons();
	}

	private async solve(group: BoardGroup, given: boolean) {
		const words = group.words;
		const rest = this.order.filter((w) => !words.includes(w));
		const before = measure(rest.map((w) => this.tiles.get(w)!));
		for (const w of words) {
			this.tiles.get(w)!.remove();
			this.selected.delete(w);
		}
		this.order = rest;

		const bar = h(
			'div',
			{ class: `bar bar--l${group.level}${given ? ' bar--given' : ''}`, role: 'status' },
			h('strong', { class: 'bar__theme' }, group.theme),
			h('span', { class: 'bar__words' }, words.join(' · ')),
		);
		this.solvedEl.append(bar);
		this.solved.push(group);
		glide(before, 380);
		pulse(bar, 'bar--stamp');
		if (!given) {
			const r = bar.getBoundingClientRect();
			confetti(r.left + r.width / 2, r.top + r.height / 2, 18);
		}
		await wait(calm() ? 80 : 260);
		this.events.onSolve(group, bar, given);
	}

	private kin = new Map<string, number>();
	private kinCount = 0;

	private markKin(word: string, n: number) {
		const t = this.tiles.get(word);
		if (!t) return;
		this.kin.set(word, n);
		t.dataset.kin = String(n);
		t.classList.add('tile--kin');
		pulse(t, 'tile--nudge');
	}

	/**
	 * Kip's board hint: marks 2 words of one group with the same number,
	 * or adds one more word to a group Kip already marked.
	 */
	hintKin(): boolean {
		const open = this.board.groups.filter((g) => !this.solved.includes(g));
		const free = (g: BoardGroup) => g.words.filter((w) => !this.kin.has(w) && !this.locked.has(w));
		for (const g of open) {
			const marked = g.words.filter((w) => this.kin.has(w));
			const more = free(g);
			if (marked.length >= 2 && more.length) {
				this.markKin(more[0], this.kin.get(marked[0])!);
				return true;
			}
		}
		for (const g of open) {
			const more = free(g);
			if (more.length >= 2 && !g.words.some((w) => this.kin.has(w))) {
				const n = ++this.kinCount;
				this.markKin(more[0], n);
				this.markKin(more[1], n);
				return true;
			}
		}
		return false;
	}

	/** Redraws a locked tile, after Kip shows one more of its letters. */
	refreshLock(word: string): void {
		const tile = this.tiles.get(word);
		if (tile && this.locked.has(word)) tile.replaceChildren(this.lockFace(word));
	}

	/** Opens a locked tile: the lock pops off, the word flips in. */
	async unlock(word: string, given = false): Promise<void> {
		const tile = this.tiles.get(word);
		if (!tile || !this.locked.has(word)) return;
		this.locked.delete(word);
		tile.classList.add('tile--unlocking');
		await wait(calm() ? 60 : 220);
		tile.classList.remove('tile--locked');
		tile.classList.add(given ? 'tile--given' : 'tile--cracked');
		tile.setAttribute('aria-label', word);
		tile.replaceChildren(h('span', { class: 'tile__word' }, word));
		await wait(calm() ? 60 : 260);
		tile.classList.remove('tile--unlocking');
	}

	/** Solves every group left, one by one, after a loss or an early win. */
	async revealRest(): Promise<void> {
		this.clear();
		this.busy = true;
		for (const w of [...this.locked]) await this.unlock(w, true);
		const left = this.board.groups.filter((g) => !this.solved.includes(g));
		for (const g of left) {
			g.words.forEach((w) => this.tiles.get(w)?.classList.add('tile--on'));
			await wait(calm() ? 100 : 320);
			await this.solve(g, true);
			await wait(calm() ? 100 : 250);
		}
		this.setEnabled(false);
	}

	setEnabled(on: boolean): void {
		this.el.classList.toggle('board--off', !on);
		[this.submitBtn, this.clearBtn, this.shuffleBtn].forEach((b) => (b.hidden = !on));
	}

	setCompact(on: boolean): void {
		this.el.classList.toggle('board--compact', on);
	}

	/** Submit with Enter, when no keyboard panel has the keys. */
	submitKey(): void {
		void this.submit();
	}
}
