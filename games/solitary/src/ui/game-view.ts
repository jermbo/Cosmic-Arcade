import { sfx, unlockAudio } from '../audio/sfx.ts';
import type { Move } from '../core/types.ts';
import type { Change, Session } from '../game/session.ts';
import { variantName } from '../rules/index.ts';
import { formatTime } from '../store/bests.ts';
import { settings } from '../store/settings.ts';
import { Board } from './board.ts';
import type { CardRef } from './card-ref.ts';
import { GameKeyboard } from './game-keyboard.ts';
import type { GamePlaySurface } from './game-play.ts';
import { GamePointer } from './game-pointer.ts';
import { icon } from './icons.ts';
export interface GameViewHooks {
	pause(): void;
	newDeal(): void;
	win(): void;
}

/** The play screen: HUD on top, the table below. Mouse, touch and keyboard all end in session moves. */
export class GameView implements GamePlaySurface {
	readonly el: HTMLElement;
	readonly board: Board;
	session!: Session;
	private hooks: GameViewHooks;
	private hintTimer = 0;
	private toastTimer = 0;
	private clock = 0;
	private hud: {
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
		const query = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
		this.hud = {
			title: query('.hud__title strong'),
			sub: query('.hud__title small'),
			time: query('[data-time]'),
			moves: query('[data-moves]'),
			stats: query('.hud__stats'),
			undo: query('[data-act="undo"]'),
			hint: query('[data-act="hint"]'),
			finish: query('[data-act="finish"]'),
			toast: query('.toast'),
			live: query('[data-live]'),
		};
		this.board = new Board(query('.board'));
		this.el.querySelector('.hud')!.addEventListener('click', (e) => {
			const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
			unlockAudio();
			if (act === 'pause') this.hooks.pause();
			if (act === 'hint') this.showHint();
			if (act === 'undo') this.undo();
			if (act === 'new') this.hooks.newDeal();
			if (act === 'finish') this.finish();
		});
		const pointer = new GamePointer(this);
		const keyboard = new GameKeyboard(this);
		pointer.bind(this.board.el);
		keyboard.bind(this.board.el);
		new ResizeObserver(() => {
			if (!this.session) return;
			this.board.measure();
			this.board.snapToLayout();
		}).observe(this.board.el);
	}

	start(session: Session, how: 'deal' | 'instant') {
		this.session?.dispose();
		this.session = session;
		session.onChange = (change) => this.onSessionChange(change);
		session.onWin = () => this.hooks.win();
		this.board.clearCelebration();
		this.board.attach(session);
		if (how === 'deal') this.board.dealIn();
		else this.board.snapToLayout();
		if (how === 'deal') sfx.newDeal();
		session.settingsChanged(how === 'deal' ? 1000 : 200);
		this.hud.title.textContent = variantName(session.mode, session.opts).split(' · ')[0];
		const sub = variantName(session.mode, session.opts).split(' · ')[1] ?? `Deal #${session.seed}`;
		this.hud.sub.textContent = sub;
		this.refreshHud();
		clearInterval(this.clock);
		this.clock = window.setInterval(() => this.tickClock(), 250);
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
		const session = this.session;
		this.hud.stats.hidden = !settings.showStats;
		this.hud.hint.hidden = !settings.hints;
		this.hud.undo.disabled = !session.canUndo();
		this.hud.finish.hidden = !session.canFinish();
		this.hud.moves.textContent = String(session.moves);
		this.tickClock();
	}

	flushAutoMoves() {
		this.session.flush();
	}

	topCardIndex(pile: string): number {
		return Math.max(0, this.session.state.piles[pile].length - 1);
	}

	private tickClock() {
		if (this.session) this.hud.time.textContent = formatTime(this.session.time());
	}

	private onSessionChange(change: Change) {
		this.clearHint();
		this.board.held = null;
		this.board.targets.clear();
		if (this.board.focus) this.board.focus.index = this.topCardIndex(this.board.focus.pile);
		this.board.animateLayout();
		this.refreshHud();
		const rules = this.session.rules;
		if (change.kind === 'stock') {
			if (change.stock === 'deal') sfx.dealRow();
			else if (change.stock === 'redeal') sfx.redeal();
			else sfx.draw();
		} else if (change.kind === 'undo') sfx.undo();
		else if (change.home) {
			let rank = 1;
			for (const id of change.moved) rank = Math.max(rank, rules.card(id).rank);
			sfx.home(rank);
		} else if (change.moved.length) sfx.place();
		if (change.flipped) sfx.flip();
	}

	finish() {
		if (!this.session.canFinish()) return;
		this.cancelHold();
		this.session.finish();
		this.refreshHud();
		this.say('Finishing the game.');
	}

	undo() {
		if (this.session.won) return;
		if (this.board.held) this.cancelHold();
		if (!this.session.undo()) {
			this.toast('Nothing to undo.');
			return;
		}
		this.say('Undone.');
	}

	tryMove(move: Move): boolean {
		const text = this.session.rules.describe(this.session.state, move);
		if (this.session.move(move)) {
			this.say(`Moved ${text}.`);
			return true;
		}
		return false;
	}

	drawFromStock() {
		const result = this.session.stock();
		if (typeof result === 'string') {
			sfx.nope();
			this.toast(result);
			this.board.shake('stock');
		} else if (result === null) {
			this.board.shake('stock');
			sfx.nope();
		} else {
			this.say(this.session.mode === 'spider' ? 'Dealt a new row.' : 'Drew from the stock.');
		}
	}

	hold(card: CardRef) {
		this.board.held = card;
		this.board.targets = new Set(this.session.rules.targets(this.session.state, card.pile, card.index));
		this.board.updateHighlights();
		sfx.pick();
		const label = this.session.rules.cardLabel(this.session.state.piles[card.pile][card.index].id);
		const targetCount = this.board.targets.size;
		this.say(
			`Picked up ${label}. ${targetCount ? `${targetCount} place${targetCount > 1 ? 's' : ''} it can go.` : 'No place it can go.'}`,
		);
	}

	cancel() {
		this.cancelHold();
	}

	cancelHold() {
		if (!this.board.held) return;
		this.board.held = null;
		this.board.targets.clear();
		this.board.updateHighlights();
		this.say('Put back.');
	}

	sendHome(card: CardRef): boolean {
		const rules = this.session.rules;
		const foundation = rules
			.targets(this.session.state, card.pile, card.index)
			.find((pile) => rules.kind(pile) === 'foundation');
		return foundation ? this.tryMove({ from: card.pile, index: card.index, to: foundation }) : false;
	}

	dropOn(pile: string): boolean {
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
		this.cancelHold();
		const hint = this.session.hint();
		this.clearHint();
		if (!hint) {
			this.toast('No moves left. Try Undo or a new deal.');
			return;
		}
		this.board.hint = hint;
		this.board.updateHighlights();
		sfx.hint();
		const text = hint.kind === 'move' ? this.session.rules.describe(this.session.state, hint.move) : hint.text;
		this.toast(`Hint: ${text}`);
		this.say(`Hint: ${text}`);
		this.hintTimer = window.setTimeout(() => this.clearHint(), 2600);
	}

	clearHint() {
		clearTimeout(this.hintTimer);
		if (this.board.hint) {
			this.board.hint = null;
			this.board.updateHighlights();
		}
	}

	toast(text: string) {
		const toast = this.hud.toast;
		toast.textContent = text;
		toast.classList.add('is-on');
		clearTimeout(this.toastTimer);
		this.toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 2400);
	}

	say(text: string) {
		this.hud.live.textContent = '';
		window.setTimeout(() => (this.hud.live.textContent = text), 30);
	}
}