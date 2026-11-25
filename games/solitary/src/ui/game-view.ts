import { sfx, unlockAudio } from '../audio/sfx.ts';
import type { Move } from '../core/types.ts';
import type { Change, Session } from '../game/session.ts';
import { variantName } from '../rules/index.ts';
import { formatTime } from '../store/bests.ts';
import { settings } from '../store/settings.ts';
import { Board, type Rect, type Spot } from './board.ts';
import { icon } from './icons.ts';

export interface GameViewHooks {
	pause(): void;
	newDeal(): void;
	win(): void;
}

interface Press {
	pointerId: number;
	startX: number;
	startY: number;
	spot: Spot | null;
	ids: number[];
	dragging: boolean;
	pile: string | null;
	lastT: number;
}

const overlap = (a: Rect, b: Rect) =>
	Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
	Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** The play screen: HUD on top, the table below. Mouse, touch and keyboard all end in session moves. */
export class GameView {
	readonly el: HTMLElement;
	readonly board: Board;
	session!: Session;
	private hooks: GameViewHooks;
	private press: Press | null = null;
	private keyboardMode = false;
	private hintTimer = 0;
	private toastTimer = 0;
	private clock = 0;
	private els: {
		title: HTMLElement;
		sub: HTMLElement;
		time: HTMLElement;
		moves: HTMLElement;
		stats: HTMLElement;
		undo: HTMLButtonElement;
		hint: HTMLButtonElement;
		finish: HTMLButtonElement;
		toast: HTMLElement;
		live: HTMLElement;
	};

	constructor(hooks: GameViewHooks) {
		this.hooks = hooks;
		this.el = document.createElement('section');
		this.el.className = 'game';
		this.el.hidden = true;
		this.el.innerHTML = `
			<main class="board" aria-label="Card table"></main>
			<header class="hud">
				<button class="hud-btn hud-btn--pause" data-act="pause" aria-label="Pause (P)">${icon('pause')}<span>Menu</span></button>
				<div class="hud__title"><strong></strong><small></small></div>
				<div class="hud__stats" aria-label="Game stats">
					<span class="hud__stat"><small>Time</small><b data-time>0:00</b></span>
					<span class="hud__stat"><small>Moves</small><b data-moves>0</b></span>
				</div>
				<div class="hud__actions">
					<button class="hud-btn hud-btn--finish" data-act="finish" aria-label="Finish the game (F)" hidden>${icon('redo')}<span>Finish</span></button>
					<button class="hud-btn" data-act="hint" aria-label="Hint (H)">${icon('hint')}<span>Hint</span></button>
					<button class="hud-btn" data-act="undo" aria-label="Undo (U)">${icon('undo')}<span>Undo</span></button>
					<button class="hud-btn" data-act="new" aria-label="New deal (N)">${icon('new')}<span>New</span></button>
				</div>
			</header>
			<div class="toast" role="status" aria-live="polite"></div>
			<div class="sr-only" aria-live="assertive" data-live></div>`;
		const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
		this.els = {
			title: q('.hud__title strong'),
			sub: q('.hud__title small'),
			time: q('[data-time]'),
			moves: q('[data-moves]'),
			stats: q('.hud__stats'),
			undo: q('[data-act="undo"]'),
			hint: q('[data-act="hint"]'),
			finish: q('[data-act="finish"]'),
			toast: q('.toast'),
			live: q('[data-live]'),
		};
		this.board = new Board(q('.board'));
		this.el.querySelector('.hud')!.addEventListener('click', (e) => {
			const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
			unlockAudio();
			if (act === 'pause') this.hooks.pause();
			if (act === 'hint') this.showHint();
			if (act === 'undo') this.undo();
			if (act === 'new') this.hooks.newDeal();
			if (act === 'finish') this.finish();
		});
		this.bindPointer();
		this.bindKeys();
		new ResizeObserver(() => {
			if (!this.session) return;
			this.board.measure();
			this.board.render('instant');
		}).observe(this.board.el);
	}

	start(session: Session, how: 'deal' | 'instant') {
		this.session?.dispose();
		this.session = session;
		this.press = null;
		session.onChange = (c) => this.changed(c);
		session.onWin = () => this.hooks.win();
		this.board.clearCelebration();
		this.board.attach(session);
		this.board.render(how);
		if (how === 'deal') sfx.newDeal();
		// With auto-move on, Aces dealt face up go home once the deal has landed.
		session.settingsChanged(how === 'deal' ? 1000 : 200);
		this.els.title.textContent = variantName(session.mode, session.opts).split(' · ')[0];
		const sub = variantName(session.mode, session.opts).split(' · ')[1] ?? `Deal #${session.seed}`;
		this.els.sub.textContent = sub;
		this.refreshHud();
		clearInterval(this.clock);
		this.clock = window.setInterval(() => this.tick(), 250);
		this.say(`${variantName(session.mode, session.opts)}. New deal.`);
	}

	stop() {
		clearInterval(this.clock);
		this.session?.dispose();
	}

	focusBoard() {
		const first = this.session.rules.pileIds.find((p) => this.session.rules.kind(p) === 'tableau')!;
		this.board.slot(first).focus({ preventScroll: true });
	}

	refreshHud() {
		const s = this.session;
		this.els.stats.hidden = !settings.showStats;
		this.els.hint.hidden = !settings.hints;
		this.els.undo.disabled = !s.canUndo();
		this.els.finish.hidden = !s.canFinish();
		this.els.moves.textContent = String(s.moves);
		this.tick();
	}

	private tick() {
		if (this.session) this.els.time.textContent = formatTime(this.session.time());
	}

	private changed(c: Change) {
		this.clearHint();
		this.board.held = null;
		this.board.targets.clear();
		// Keep the keyboard focus on the top card of its pile.
		if (this.board.focus) this.board.focus.index = this.topIndex(this.board.focus.pile);
		this.board.render('animate');
		this.refreshHud();
		const rules = this.session.rules;
		if (c.kind === 'stock') {
			if (c.stock === 'deal') sfx.dealRow();
			else if (c.stock === 'redeal') sfx.redeal();
			else sfx.draw();
		} else if (c.kind === 'undo') sfx.undo();
		else if (c.home) {
			let rank = 1;
			for (const id of c.moved) rank = Math.max(rank, rules.card(id).rank);
			sfx.home(rank);
		} else if (c.moved.length) sfx.place();
		if (c.flipped) sfx.flip();
	}

	finish() {
		if (!this.session.canFinish()) return;
		this.cancel();
		this.session.finish();
		this.refreshHud();
		this.say('Finishing the game.');
	}

	// ---------- actions ----------

	undo() {
		if (this.session.won) return;
		if (this.board.held) this.cancel();
		if (!this.session.undo()) {
			this.toast('Nothing to undo.');
			return;
		}
		this.say('Undone.');
	}

	private tryMove(move: Move): boolean {
		const text = this.session.rules.describe(this.session.state, move);
		if (this.session.move(move)) {
			this.say(`Moved ${text}.`);
			return true;
		}
		return false;
	}

	private doStock() {
		const r = this.session.stock();
		if (typeof r === 'string') {
			sfx.nope();
			this.toast(r);
			this.board.shake('stock');
		} else if (r === null) {
			this.board.shake('stock');
			sfx.nope();
		} else {
			this.say(this.session.mode === 'spider' ? 'Dealt a new row.' : 'Drew from the stock.');
		}
	}

	private hold(spot: Spot) {
		this.board.held = spot;
		this.board.targets = new Set(this.session.rules.targets(this.session.state, spot.pile, spot.index));
		this.board.decorate();
		sfx.pick();
		const card = this.session.rules.short(this.session.state.piles[spot.pile][spot.index].id);
		const n = this.board.targets.size;
		this.say(`Picked up ${card}. ${n ? `${n} place${n > 1 ? 's' : ''} it can go.` : 'No place it can go.'}`);
	}

	cancel() {
		if (!this.board.held) return;
		this.board.held = null;
		this.board.targets.clear();
		this.board.decorate();
		this.say('Put back.');
	}

	/** Send the run home, if a foundation takes it. */
	private sendHome(spot: Spot): boolean {
		const rules = this.session.rules;
		const to = rules.targets(this.session.state, spot.pile, spot.index).find((p) => rules.kind(p) === 'foundation');
		return to ? this.tryMove({ from: spot.pile, index: spot.index, to }) : false;
	}

	/** Drop the held run on a pile. */
	private dropOn(pile: string): boolean {
		const held = this.board.held!;
		const ok = this.tryMove({ from: held.pile, index: held.index, to: pile });
		if (!ok) {
			sfx.nope();
			this.board.shake(pile);
			this.say(`Can't go on ${this.session.rules.pileName(pile)}.`);
		}
		return ok;
	}

	showHint() {
		if (!settings.hints || this.session.won) return;
		this.cancel();
		const hint = this.session.hint();
		this.clearHint();
		if (!hint) {
			this.toast('No moves left. Try Undo or a new deal.');
			return;
		}
		this.board.hint = hint;
		this.board.decorate();
		sfx.hint();
		const text = hint.kind === 'move' ? this.session.rules.describe(this.session.state, hint.move) : hint.text;
		this.toast(`Hint: ${text}`);
		this.say(`Hint: ${text}`);
		this.hintTimer = window.setTimeout(() => this.clearHint(), 2600);
	}

	private clearHint() {
		clearTimeout(this.hintTimer);
		if (this.board.hint) {
			this.board.hint = null;
			this.board.decorate();
		}
	}

	toast(text: string) {
		const t = this.els.toast;
		t.textContent = text;
		t.classList.add('is-on');
		clearTimeout(this.toastTimer);
		this.toastTimer = window.setTimeout(() => t.classList.remove('is-on'), 2400);
	}

	private say(text: string) {
		this.els.live.textContent = '';
		window.setTimeout(() => (this.els.live.textContent = text), 30);
	}

	// ---------- pointer: drag, or tap to select then tap to place ----------

	private bindPointer() {
		const el = this.board.el;
		el.addEventListener('pointerdown', (e) => {
			if (!this.session || this.session.won || e.button > 0) return;
			unlockAudio();
			this.keyboardMode = false;
			this.board.showRing = false;
			this.board.decorate();
			const id = this.board.cardAt(e.target as Element);
			const spot = id === null ? null : this.board.locate(id);
			const p = this.board.toTable(e.clientX, e.clientY);
			const pile = spot?.pile ?? this.board.pileAt(p.x, p.y);
			let ids: number[] = [];
			if (spot && this.session.rules.canPick(this.session.state, spot.pile, spot.index)) {
				ids = this.session.state.piles[spot.pile].slice(spot.index).map((c) => c.id);
			}
			this.press = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, spot, ids, dragging: false, pile, lastT: performance.now() };
			if (ids.length) el.setPointerCapture(e.pointerId);
			e.preventDefault();
		});
		el.addEventListener('pointermove', (e) => {
			const press = this.press;
			if (!press || press.pointerId !== e.pointerId || !press.ids.length) return;
			const dx = e.clientX - press.startX;
			const dy = e.clientY - press.startY;
			if (!press.dragging) {
				if (Math.hypot(dx, dy) < 7) return;
				press.dragging = true;
				this.session.flush();
				this.clearHint();
				// The board may have changed under an auto-move: check the run again.
				if (!press.spot || !this.session.rules.canPick(this.session.state, press.spot.pile, press.spot.index)) {
					this.press = null;
					return;
				}
				this.board.held = press.spot;
				this.board.targets = new Set(this.session.rules.targets(this.session.state, press.spot.pile, press.spot.index));
				this.board.setDragging(press.ids, true);
				this.board.decorate();
				sfx.pick();
			}
			const now = performance.now();
			this.board.dragTo(press.ids, dx, dy, (now - press.lastT) / 1000);
			press.lastT = now;
			// Light up the target the card would land on.
			const over = this.dropTarget(press, dx, dy).best;
			if (over !== this.board.over) {
				this.board.over = over;
				this.board.decorate();
			}
		});
		const end = (e: PointerEvent, cancelled: boolean) => {
			const press = this.press;
			if (!press || press.pointerId !== e.pointerId) return;
			this.press = null;
			if (press.dragging) {
				this.finishDrag(press, e, cancelled);
				return;
			}
			if (!cancelled) this.tap(press);
		};
		el.addEventListener('pointerup', (e) => end(e, false));
		el.addEventListener('pointercancel', (e) => end(e, true));
		el.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	/** The legal pile the dragged card overlaps most. */
	private dropTarget(press: Press, dx: number, dy: number): { best: string | null; missed: boolean } {
		const lead = this.board.placedRect(press.ids[0]);
		const rect = { ...lead, x: lead.x + dx, y: lead.y + dy };
		let best: string | null = null;
		let bestArea = 0;
		let missed = false;
		for (const pile of this.session.rules.pileIds) {
			if (pile === press.spot!.pile) continue;
			const area = overlap(rect, this.board.catchRect(pile));
			if (area <= 0) continue;
			if (this.board.targets.has(pile)) {
				if (area > bestArea) {
					bestArea = area;
					best = pile;
				}
			} else missed = true;
		}
		return { best, missed };
	}

	private finishDrag(press: Press, e: PointerEvent, cancelled: boolean) {
		const { best, missed } = this.dropTarget(press, e.clientX - press.startX, e.clientY - press.startY);
		this.board.setDragging(press.ids, false);
		const from = press.spot!;
		this.board.held = null;
		this.board.over = null;
		this.board.targets.clear();
		if (!cancelled && best && this.tryMove({ from: from.pile, index: from.index, to: best })) return;
		if (!cancelled && missed) sfx.nope();
		this.board.render('animate');
	}

	private tap(press: Press) {
		const rules = this.session.rules;
		this.session.flush();
		const state = this.session.state;
		const spot = press.spot && press.ids.length ? this.board.locate(press.ids[0]) : press.spot;
		const pile = spot?.pile ?? press.pile;
		const held = this.board.held;
		if (!pile) {
			this.cancel();
			return;
		}
		const pickable = spot ? rules.canPick(state, spot.pile, spot.index) : false;
		if (held) {
			if (pile === held.pile) {
				if (spot && spot.index === held.index) {
					// Tap the held card again: send it home, or put it back.
					if (!this.sendHome(held)) this.cancel();
				} else if (spot && pickable) this.hold(spot);
				else this.cancel();
				return;
			}
			const move = { from: held.pile, index: held.index, to: pile };
			if (this.session.canMove(move)) {
				this.tryMove(move);
				return;
			}
			if (spot && pickable && rules.kind(pile) !== 'foundation') {
				this.hold(spot);
				return;
			}
			sfx.nope();
			this.board.shake(pile);
			this.cancel();
			return;
		}
		if (rules.kind(pile) === 'stock') {
			this.doStock();
			return;
		}
		if (spot && pickable) this.hold(spot);
	}

	// ---------- keyboard ----------

	private topIndex(pile: string): number {
		return Math.max(0, this.session.state.piles[pile].length - 1);
	}

	private bindKeys() {
		const el = this.board.el;
		el.addEventListener('focusin', (e) => {
			const pile = (e.target as HTMLElement).dataset.pile;
			if (!pile) return;
			if (this.board.focus?.pile !== pile) this.board.focus = { pile, index: this.topIndex(pile) };
			this.board.showRing = this.keyboardMode;
			this.board.decorate();
		});
		el.addEventListener('focusout', () => {
			window.setTimeout(() => {
				if (!el.contains(document.activeElement)) {
					this.board.showRing = false;
					this.board.decorate();
				}
			});
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
				this.keyboardMode = true;
				if (el.contains(document.activeElement)) {
					this.board.showRing = true;
					this.board.decorate();
				}
			}
		});
		el.addEventListener('keydown', (e) => {
			if (!this.session || this.session.won) return;
			const f = this.board.focus;
			if (!f) return;
			unlockAudio();
			this.keyboardMode = true;
			this.board.showRing = true;
			const key = e.key;
			if (key === 'Enter' || key === ' ') {
				e.preventDefault();
				this.activate();
			} else if (key.startsWith('Arrow')) {
				e.preventDefault();
				this.arrow(key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down');
			}
		});
	}

	private activate() {
		this.session.flush();
		const f = this.board.focus!;
		const rules = this.session.rules;
		const state = this.session.state;
		const held = this.board.held;
		f.index = Math.min(f.index, this.topIndex(f.pile));
		if (held) {
			if (f.pile === held.pile) {
				if (f.index === held.index && this.sendHome(held)) return;
				if (f.index !== held.index && rules.canPick(state, f.pile, f.index)) this.hold({ ...f });
				else this.cancel();
				return;
			}
			this.dropOn(f.pile);
			return;
		}
		if (rules.kind(f.pile) === 'stock') {
			this.doStock();
			return;
		}
		if (state.piles[f.pile].length && rules.canPick(state, f.pile, f.index)) this.hold({ ...f });
		else {
			sfx.nope();
			this.say('Nothing to pick up here.');
		}
	}

	private arrow(dir: 'left' | 'right' | 'up' | 'down') {
		const f = this.board.focus!;
		const rules = this.session.rules;
		const state = this.session.state;
		const cards = state.piles[f.pile];
		if (rules.kind(f.pile) === 'tableau' && cards.length && (dir === 'up' || dir === 'down')) {
			// Up and down walk through the face-up run.
			const step = dir === 'up' ? -1 : 1;
			for (let i = f.index + step; i >= 0 && i < cards.length; i += step) {
				if (rules.canPick(state, f.pile, i)) {
					f.index = i;
					this.board.decorate();
					this.say(`${rules.short(cards[i].id)}, ${cards.length - i} card${cards.length - i > 1 ? 's' : ''}.`);
					return;
				}
			}
			if (dir === 'down') return;
		}
		const next = this.neighbour(f.pile, dir);
		if (next) this.board.slot(next).focus({ preventScroll: true });
	}

	/** The nearest pile in a direction, by where the piles sit on the table. */
	private neighbour(from: string, dir: 'left' | 'right' | 'up' | 'down'): string | null {
		const L = this.board.layout;
		const a = L.piles[from];
		let best: string | null = null;
		let bestScore = Infinity;
		for (const pile of this.session.rules.pileIds) {
			if (pile === from) continue;
			const b = L.piles[pile];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
			const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
			if (along <= 1) continue;
			const score = along + across * 3;
			if (score < bestScore) {
				bestScore = score;
				best = pile;
			}
		}
		return best;
	}
}
