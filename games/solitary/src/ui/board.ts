import { cardName } from '../core/cards.ts';
import type { Hint, State } from '../core/types.ts';
import type { Session } from '../game/session.ts';
import { settings } from '../store/settings.ts';
import { deckRatio, getTheme, type Deck } from '../themes/themes.ts';
import { backHTML, faceHTML } from './card-face.ts';
import type { CardRef } from './card-ref.ts';
import { computeLayout, type Layout, type Point } from './layout.ts';
import { Motion } from './motion.ts';
import type { RenderMode } from './render-mode.ts';
import type { Rect } from './rect.ts';

export type { CardRef } from './card-ref.ts';
export type { Rect } from './rect.ts';
export { spriteStyle, vectorFace } from './card-face.ts';

interface PlacedCard {
	x: number;
	y: number;
	z: number;
	pile: string;
	index: number;
	up: boolean;
}

const FLIP_MS = 280;

/** Draws the table. Each card is one element that keeps its place in the DOM and springs to its spot. */
export class Board {
	readonly el: HTMLElement;
	readonly table: HTMLElement;
	readonly motion = new Motion();
	session!: Session;
	layout!: Layout;

	held: CardRef | null = null;
	targets = new Set<string>();
	/** The legal target under a dragged card. */
	over: string | null = null;
	hint: Hint | null = null;
	focus: CardRef | null = null;
	showRing = false;
	/** Cards being dragged: render leaves them to the pointer. */
	dragging = new Set<number>();

	private cards = new Map<number, HTMLElement>();
	private slots = new Map<string, HTMLElement>();
	private marks = new Map<string, HTMLElement>();
	private ring: HTMLElement;
	private badge: HTMLElement;
	private placed = new Map<number, PlacedCard>();
	private offsets = new Map<string, { down: number; up: number }>();

	constructor(host: HTMLElement) {
		this.el = host;
		this.table = document.createElement('div');
		this.table.className = 'table';
		this.el.append(this.table);
		this.ring = document.createElement('div');
		this.ring.className = 'focus-ring';
		this.badge = document.createElement('div');
		this.badge.className = 'stock-badge';
		this.badge.setAttribute('aria-hidden', 'true');
	}

	private get deck(): Deck {
		return getTheme(settings.theme).deck;
	}

	attach(session: Session) {
		this.session = session;
		this.motion.clear();
		this.table.replaceChildren();
		this.cards.clear();
		this.slots.clear();
		this.marks.clear();
		this.placed.clear();
		this.held = null;
		this.over = null;
		this.targets.clear();
		this.hint = null;
		this.focus = null;
		this.dragging.clear();
		this.table.dataset.mode = session.mode;
		const rules = session.rules;
		for (const pile of rules.pileIds) {
			const slot = document.createElement('div');
			slot.className = `slot slot--${rules.kind(pile)}`;
			slot.dataset.pile = pile;
			slot.tabIndex = 0;
			slot.setAttribute('role', 'button');
			const kind = rules.kind(pile);
			if (kind === 'foundation') slot.innerHTML = `<span class="slot__mark">${session.mode === 'spider' ? 'K' : 'A'}</span>`;
			if (kind === 'cell') slot.innerHTML = `<span class="slot__mark slot__mark--small">FREE</span>`;
			if (kind === 'stock') slot.innerHTML = `<span class="slot__mark slot__mark--redeal"></span>`;
			this.table.append(slot);
			this.slots.set(pile, slot);
			const mark = document.createElement('div');
			mark.className = 'mark';
			this.table.append(mark);
			this.marks.set(pile, mark);
		}
		for (const card of rules.deck) {
			const el = document.createElement('div');
			el.className = `card suit-${card.suit}`;
			el.dataset.id = String(card.id);
			el.setAttribute('role', 'img');
			el.innerHTML = `<div class="card__lift"><div class="card__inner"><div class="card__face card__front"></div><div class="card__face card__back"></div></div></div>`;
			this.table.append(el);
			this.cards.set(card.id, el);
		}
		this.refreshFaces();
		this.table.append(this.badge, this.ring);
		this.measure();
	}

	/** Draw faces and backs for the current deck. */
	refreshFaces() {
		if (!this.session) return;
		this.table.dataset.deck = this.deck.kind;
		const back = backHTML();
		for (const card of this.session.rules.deck) {
			const el = this.cards.get(card.id)!;
			el.querySelector('.card__front')!.innerHTML = faceHTML(card);
			el.querySelector('.card__back')!.innerHTML = back;
		}
	}

	/** Size the layout to the board box. */
	measure() {
		const style = getComputedStyle(this.el);
		const innerWidth =
			this.el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		const innerHeight =
			this.el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
		const deck = this.deck;
		const dpr = window.devicePixelRatio || 1;
		const snapCardWidth = (cw: number) => {
			if (deck.kind !== 'sprite') return cw;
			const scale = Math.floor((cw * dpr) / deck.cardW);
			const crisp = (scale * deck.cardW) / dpr;
			return scale >= 1 && crisp >= cw * 0.84 ? crisp : cw;
		};
		this.layout = computeLayout(
			this.session.mode,
			this.session.opts,
			Math.max(200, innerWidth),
			Math.max(160, innerHeight),
			deckRatio(deck),
			snapCardWidth,
		);
		const { cw, ch } = this.layout;
		this.table.style.setProperty('--cw', `${cw}px`);
		this.table.style.setProperty('--ch', `${ch}px`);
		this.table.style.setProperty('--ap', `${deck.kind === 'sprite' ? cw / deck.cardW : cw / 80}px`);
		this.table.dataset.size = cw < 66 ? 'small' : 'large';
		this.table.dataset.pixel =
			deck.kind === 'sprite' && (cw / deck.cardW) * dpr < 1 ? 'smooth' : 'crisp';
		this.table.dataset.layout = this.layout.kind;
		for (const [pile, slot] of this.slots) {
			const base = this.layout.piles[pile];
			slot.style.transform = `translate(${base.x}px, ${base.y}px)`;
		}
	}

	snapToLayout() {
		this.render('instant');
	}

	animateLayout() {
		this.render('animate');
	}

	dealIn() {
		this.render('deal');
	}

	card(id: number): HTMLElement {
		return this.cards.get(id)!;
	}

	cardAt(el: Element | null): number | null {
		const card = el?.closest<HTMLElement>('.card');
		return card ? Number(card.dataset.id) : null;
	}

	/** Which pile and index hold this card in the current state. */
	locate(id: number): CardRef | null {
		const piles = this.session.state.piles;
		for (const pile in piles) {
			const index = piles[pile].findIndex((c) => c.id === id);
			if (index >= 0) return { pile, index };
		}
		return null;
	}

	private tableauOffsets(pile: string, state: State) {
		const { ch, height } = this.layout;
		const cards = state.piles[pile];
		const base = this.layout.piles[pile];
		let down = ch * 0.085;
		let up = ch * this.deck.fanUp;
		let need = 0;
		for (let i = 0; i < cards.length - 1; i++) need += cards[i].up ? up : down;
		const room = height - base.y - ch;
		if (need > room && need > 0) {
			const scale = Math.max(0.2, room / need);
			down *= scale;
			up *= scale;
		}
		this.offsets.set(pile, { down, up });
		return { down, up };
	}

	/** Screen position of a card in a pile for the given state. */
	cardPosition(state: State, pile: string, index: number): Point {
		const base = this.layout.piles[pile];
		const kind = this.session.rules.kind(pile);
		const cards = state.piles[pile];
		if (kind === 'tableau') {
			const off = this.offsets.get(pile) ?? this.tableauOffsets(pile, state);
			let y = base.y;
			for (let i = 0; i < index; i++) y += cards[i].up ? off.up : off.down;
			return { x: base.x, y };
		}
		const fan = this.layout.fan[pile];
		if (kind === 'waste' && fan) {
			const fanIndex = Math.max(0, index - (cards.length - 3));
			return { x: base.x + fan.x * fanIndex, y: base.y + fan.y * fanIndex };
		}
		if (kind === 'stock' && fan) {
			const fanIndex = Math.floor(index / 10);
			return { x: base.x + fan.x * fanIndex, y: base.y + fan.y * fanIndex };
		}
		if (kind === 'stock') {
			const fanIndex = Math.floor(index / 8);
			return { x: base.x - fanIndex * 0.6, y: base.y - fanIndex * 0.8 };
		}
		return base;
	}

	private zFor(pile: string, index: number): number {
		const kind = this.session.rules.kind(pile);
		if (kind === 'tableau') return 100 + index;
		if (kind === 'foundation' && this.session.mode === 'spider') {
			const foundation = Number(pile.slice(1));
			return 10 + foundation * 14 + (13 - index);
		}
		return 10 + index;
	}

	/** Rect of the top card, or the empty slot. */
	topRect(pile: string): Rect {
		const state = this.session.state;
		const count = state.piles[pile].length;
		const point = count ? this.cardPosition(state, pile, count - 1) : this.layout.piles[pile];
		return { x: point.x, y: point.y, w: this.layout.cw, h: this.layout.ch };
	}

	/** Where a dropped card is caught for this pile. Columns catch along their full height. */
	catchRect(pile: string): Rect {
		const { cw, ch, gap, height } = this.layout;
		if (this.session.rules.kind(pile) === 'tableau') {
			const base = this.layout.piles[pile];
			return { x: base.x - gap / 2, y: base.y - gap, w: cw + gap, h: height - base.y + gap };
		}
		const top = this.topRect(pile);
		const pad = Math.min(gap, 8);
		const base = this.layout.piles[pile];
		const x = Math.min(top.x, base.x) - pad;
		const y = Math.min(top.y, base.y) - pad;
		return {
			x,
			y,
			w: Math.max(top.x, base.x) - x + cw + pad,
			h: Math.max(top.y, base.y) - y + ch + pad,
		};
	}

	/** The pile under a point in table space. */
	pileAt(x: number, y: number): string | null {
		for (const pile of this.session.rules.pileIds) {
			const rect = this.catchRect(pile);
			if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return pile;
		}
		return null;
	}

	toTable(clientX: number, clientY: number): Point {
		const bounds = this.table.getBoundingClientRect();
		return { x: clientX - bounds.left, y: clientY - bounds.top };
	}

	render(how: RenderMode = 'animate') {
		const state = this.session.state;
		const rules = this.session.rules;
		this.motion.reduced = settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.offsets.clear();
		for (const pile of rules.pileIds)
			if (rules.kind(pile) === 'tableau') this.tableauOffsets(pile, state);
		const origin =
			this.session.mode === 'freecell'
				? { x: this.layout.width / 2 - this.layout.cw / 2, y: this.layout.height + this.layout.ch * 0.3 }
				: this.layout.piles.stock;
		let dealOrder = 0;
		for (const pile of rules.pileIds) {
			const cards = state.piles[pile];
			const isStock = rules.kind(pile) === 'stock';
			let runStep = 0;
			cards.forEach((slot, index) => {
				const el = this.cards.get(slot.id)!;
				const point = this.cardPosition(state, pile, index);
				const z = this.zFor(pile, index);
				const prev = this.placed.get(slot.id);
				this.placed.set(slot.id, { x: point.x, y: point.y, z, pile, index, up: slot.up });
				el.setAttribute('aria-label', slot.up ? cardName(rules.card(slot.id)) : 'Face-down card');
				if (this.dragging.has(slot.id)) return;

				if (how === 'instant' || (!prev && how !== 'deal')) {
					el.classList.toggle('is-up', slot.up);
					this.motion.snap(slot.id, el, point.x, point.y);
					el.style.zIndex = String(z);
					return;
				}
				if (how === 'deal') {
					el.classList.remove('is-up');
					if (isStock) {
						this.motion.snap(slot.id, el, point.x, point.y);
						el.style.zIndex = String(z);
						return;
					}
					this.motion.snap(slot.id, el, origin.x, origin.y);
					el.style.zIndex = String(10 + dealOrder);
					const wait = this.dealDelay(pile, index, dealOrder++);
					this.motion.to(slot.id, el, point.x, point.y, {
						wait,
						kickY: -this.layout.ch * (2.5 + Math.random()),
						kickX: (Math.random() - 0.5) * 120,
						spin: (Math.random() - 0.5) * 500,
						k: 300,
						zeta: 0.7,
						onStart: () => {
							el.style.zIndex = String(3000 + index);
							if (slot.up) window.setTimeout(() => this.flip(el, true), 90);
						},
						onSettle: () => (el.style.zIndex = String(this.placed.get(slot.id)?.z ?? z)),
					});
					return;
				}
				const changedPile = prev!.pile !== pile;
				if (prev!.up !== slot.up) this.flip(el, slot.up);
				if (changedPile) {
					const home = rules.kind(pile) === 'foundation';
					const fromStock = rules.kind(prev!.pile) === 'stock' || rules.kind(prev!.pile) === 'waste';
					this.motion.to(slot.id, el, point.x, point.y, {
						wait: runStep++ * 22,
						kickY: home ? -this.layout.ch * 2.2 : 0,
						spin: fromStock ? -60 : 0,
						onStart: () => (el.style.zIndex = String(3000 + index)),
						onSettle: () => {
							el.style.zIndex = String(this.placed.get(slot.id)?.z ?? z);
							if (home && this.placed.get(slot.id)?.pile === pile) this.puff(point.x, point.y);
						},
					});
				} else {
					this.motion.to(slot.id, el, point.x, point.y, { land: false });
					if (!this.motion.isMoving(slot.id)) el.style.zIndex = String(z);
				}
			});
		}
		this.updateHighlights();
	}

	private flip(el: HTMLElement, up: boolean) {
		el.classList.toggle('is-up', up);
		if (this.motion.reduced) return;
		el.classList.remove('is-flipping');
		void el.offsetWidth;
		el.classList.add('is-flipping');
		window.setTimeout(() => el.classList.remove('is-flipping'), FLIP_MS);
	}

	private dealDelay(pile: string, index: number, order: number): number {
		const mode = this.session.mode;
		if (mode === 'klondike') {
			const col = Number(pile.slice(1));
			const nth = index * 7 - (index * (index - 1)) / 2 + (col - index);
			return 80 + nth * 30;
		}
		const cols = mode === 'spider' ? 10 : 8;
		const col = Number(pile.slice(1));
		if (pile[0] !== 't') return 80 + order * 14;
		return 80 + (index * cols + col) * (mode === 'spider' ? 14 : 15);
	}

	puff(x: number, y: number) {
		if (this.motion.reduced) return;
		const { cw, ch } = this.layout;
		const colors = ['var(--accent)', 'var(--paper)', 'var(--red)', 'var(--teal)'];
		for (let i = 0; i < 10; i++) {
			const dust = document.createElement('i');
			dust.className = 'dust';
			const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
			const radius = cw * (0.45 + Math.random() * 0.35);
			dust.style.left = `${x + cw / 2}px`;
			dust.style.top = `${y + ch / 2}px`;
			dust.style.setProperty('--dx', `${Math.cos(angle) * radius}px`);
			dust.style.setProperty('--dy', `${Math.sin(angle) * radius * 1.2}px`);
			dust.style.background = colors[i % colors.length];
			this.table.append(dust);
			window.setTimeout(() => dust.remove(), 600);
		}
	}

	/** Selection, targets, hint, focus ring, badges and labels. */
	updateHighlights() {
		const state = this.session.state;
		const rules = this.session.rules;
		const heldIds = new Set<number>();
		if (this.held)
			for (const c of state.piles[this.held.pile].slice(this.held.index)) heldIds.add(c.id);
		const hintIds = new Set<number>();
		let hintTo: string | null = null;
		if (this.hint?.kind === 'move') {
			const move = this.hint.move;
			for (const c of state.piles[move.from].slice(move.index)) hintIds.add(c.id);
			hintTo = move.to;
		} else if (this.hint?.kind === 'stock') hintTo = 'stock';
		const pickable = new Set<number>();
		for (const pile of rules.pileIds) {
			const cards = state.piles[pile];
			for (let i = cards.length - 1; i >= 0; i--) {
				if (!rules.canPick(state, pile, i)) break;
				pickable.add(cards[i].id);
			}
		}
		for (const [id, el] of this.cards) {
			el.classList.toggle('is-held', heldIds.has(id));
			el.classList.toggle('is-hint', hintIds.has(id));
			el.classList.toggle('can-pick', pickable.has(id) && !this.session.won);
		}
		for (const pile of rules.pileIds) {
			const cards = state.piles[pile];
			cards.forEach((c, i) => this.cards.get(c.id)!.classList.toggle('is-top', i === cards.length - 1));
		}
		for (const pile of rules.pileIds) {
			const mark = this.marks.get(pile)!;
			const rect = this.topRect(pile);
			mark.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
			mark.classList.toggle('mark--drop', this.targets.has(pile));
			mark.classList.toggle('mark--over', this.over === pile);
			mark.classList.toggle('mark--hint', hintTo === pile);
			const slot = this.slots.get(pile)!;
			slot.setAttribute('aria-label', this.describePile(pile));
			slot.classList.toggle('is-empty', state.piles[pile].length === 0);
		}
		const stock = state.piles.stock;
		if (stock) {
			const base = this.layout.piles.stock;
			const count = this.session.mode === 'spider' ? Math.ceil(stock.length / 10) : stock.length;
			this.badge.textContent = String(count);
			this.badge.hidden = count === 0;
			const top = stock.length ? this.cardPosition(state, 'stock', stock.length - 1) : base;
			this.badge.style.transform = `translate(${top.x + this.layout.cw}px, ${top.y}px)`;
			this.slots.get('stock')!.classList.toggle('can-redeal', !stock.length && state.piles.waste?.length > 0);
		} else this.badge.hidden = true;
		this.placeFocusRing();
	}

	private placeFocusRing() {
		const focus = this.focus;
		if (!focus || !this.showRing) {
			this.ring.hidden = true;
			return;
		}
		const state = this.session.state;
		const cards = state.piles[focus.pile];
		const { cw, ch } = this.layout;
		let rect: Rect;
		if (!cards.length) rect = { ...this.layout.piles[focus.pile], w: cw, h: ch };
		else {
			const index = Math.min(focus.index, cards.length - 1);
			const first = this.cardPosition(state, focus.pile, index);
			const last = this.cardPosition(state, focus.pile, cards.length - 1);
			rect = { x: Math.min(first.x, last.x), y: first.y, w: Math.abs(last.x - first.x) + cw, h: last.y - first.y + ch };
		}
		this.ring.hidden = false;
		this.ring.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
		this.ring.style.width = `${rect.w}px`;
		this.ring.style.height = `${rect.h}px`;
		this.ring.classList.toggle('is-holding', Boolean(this.held));
	}

	describePile(pile: string): string {
		const rules = this.session.rules;
		const cards = this.session.state.piles[pile];
		const name = rules.pileName(pile);
		const kind = rules.kind(pile);
		const cap = name[0].toUpperCase() + name.slice(1);
		if (kind === 'stock') {
			if (!cards.length) return this.session.mode === 'klondike' ? 'Stock, empty. Press Enter to turn the waste over.' : 'Stock, empty.';
			return this.session.mode === 'spider'
				? `Stock, ${Math.ceil(cards.length / 10)} deals left. Press Enter to deal.`
				: `Stock, ${cards.length} cards. Press Enter to draw.`;
		}
		if (!cards.length) return `${cap}, empty.`;
		const top = rules.card(cards[cards.length - 1].id);
		if (kind === 'tableau') {
			const hidden = cards.filter((c) => !c.up).length;
			const first = cards.findIndex((c) => c.up);
			const from = first >= 0 && first < cards.length - 1 ? `${cardName(rules.card(cards[first].id))} down to ` : '';
			const pick =
				this.focus?.pile === pile && this.focus.index < cards.length - 1
					? ` Picking up from ${cardName(rules.card(cards[this.focus.index].id))}.`
					: '';
			return `${cap}, ${hidden ? `${hidden} face down, ` : ''}${from}${cardName(top)}.${pick}`;
		}
		if (kind === 'foundation') return `${cap}, up to ${cardName(top)}.`;
		return `${cap}, ${cardName(top)}${kind === 'waste' ? ` on top, ${cards.length} cards` : ''}.`;
	}

	slot(pile: string): HTMLElement {
		return this.slots.get(pile)!;
	}

	shake(pile: string) {
		const state = this.session.state;
		const cards = state.piles[pile];
		const targets = cards.length ? cards.slice(-1).map((c) => this.cards.get(c.id)!) : [this.slots.get(pile)!];
		for (const el of targets) {
			el.classList.remove('is-shaking');
			void el.offsetWidth;
			el.classList.add('is-shaking');
			window.setTimeout(() => el.classList.remove('is-shaking'), 320);
		}
	}

	dragTo(ids: number[], dx: number, dy: number, dt: number) {
		const lead = this.placed.get(ids[0])!;
		ids.forEach((id, i) => {
			const placed = this.placed.get(id)!;
			const el = this.cards.get(id)!;
			this.motion.hold(id, el, lead.x + dx + (placed.x - lead.x), lead.y + dy + (placed.y - lead.y), dt, i > 0);
			el.style.zIndex = String(5000 + i);
		});
	}

	placedRect(id: number): Rect {
		const placed = this.placed.get(id)!;
		return { x: placed.x, y: placed.y, w: this.layout.cw, h: this.layout.ch };
	}

	setDragging(ids: number[], on: boolean) {
		for (const id of ids) {
			this.cards.get(id)!.classList.toggle('is-dragging', on);
			if (on) this.dragging.add(id);
			else this.dragging.delete(id);
		}
		if (!on) ids.forEach((id, i) => (this.cards.get(id)!.style.zIndex = String(4000 + i)));
	}

	celebrate(): Promise<void> {
		const reduce = this.motion.reduced;
		this.table.classList.add('is-won');
		const state = this.session.state;
		const rules = this.session.rules;
		let n = 0;
		for (const pile of rules.pileIds) {
			if (rules.kind(pile) !== 'foundation') continue;
			state.piles[pile].forEach((c, i) => {
				this.cards.get(c.id)!.style.setProperty('--hop-delay', `${(n * 90 + i * 22) % 900}ms`);
			});
			if (!reduce && state.piles[pile].length) {
				const base = this.layout.piles[pile];
				window.setTimeout(() => this.puff(base.x, base.y), n * 120);
			}
			n++;
		}
		const stamp = document.createElement('div');
		stamp.className = 'win-stamp';
		stamp.innerHTML = `<span>Solved!</span>`;
		this.el.append(stamp);
		return new Promise((resolve) => window.setTimeout(resolve, reduce ? 300 : 1500));
	}

	clearCelebration() {
		this.table.classList.remove('is-won');
		this.el.querySelectorAll('.win-stamp').forEach((s) => s.remove());
	}
}