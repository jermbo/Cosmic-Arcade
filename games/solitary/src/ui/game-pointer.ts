import { sfx, unlockAudio } from '../audio/sfx.ts';
import type { CardRef } from './card-ref.ts';
import type { GamePlaySurface } from './game-play.ts';
import { rectOverlap } from './rect.ts';

interface PointerPress {
	pointerId: number;
	startX: number;
	startY: number;
	cardRef: CardRef | null;
	cardIds: number[];
	dragging: boolean;
	pile: string | null;
	lastTime: number;
}

/** Drag and tap-to-place on the card table. */
export class GamePointer {
	private press: PointerPress | null = null;
	private play: GamePlaySurface;

	constructor(play: GamePlaySurface) {
		this.play = play;
	}

	bind(boardRoot: HTMLElement) {
		boardRoot.addEventListener('pointerdown', (e) => this.onDown(e));
		boardRoot.addEventListener('pointermove', (e) => this.onMove(e));
		boardRoot.addEventListener('pointerup', (e) => this.end(e, false));
		boardRoot.addEventListener('pointercancel', (e) => this.end(e, true));
		boardRoot.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	private onDown(e: PointerEvent) {
		const { session, board } = this.play;
		if (!session || session.won || e.button > 0) return;
		unlockAudio();
		board.showRing = false;
		board.updateHighlights();
		const cardId = board.cardAt(e.target as Element);
		const cardRef = cardId === null ? null : board.locate(cardId);
		const tablePoint = board.toTable(e.clientX, e.clientY);
		const pile = cardRef?.pile ?? board.pileAt(tablePoint.x, tablePoint.y);
		let cardIds: number[] = [];
		if (cardRef && session.rules.canPick(session.state, cardRef.pile, cardRef.index)) {
			cardIds = session.state.piles[cardRef.pile].slice(cardRef.index).map((c) => c.id);
		}
		this.press = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			cardRef,
			cardIds,
			dragging: false,
			pile,
			lastTime: performance.now(),
		};
		if (cardIds.length) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	private onMove(e: PointerEvent) {
		const press = this.press;
		const { session, board } = this.play;
		if (!press || press.pointerId !== e.pointerId || !press.cardIds.length) return;
		const dx = e.clientX - press.startX;
		const dy = e.clientY - press.startY;
		if (!press.dragging) {
			if (Math.hypot(dx, dy) < 7) return;
			press.dragging = true;
			this.play.flushAutoMoves();
			this.play.clearHint();
			if (!press.cardRef || !session.rules.canPick(session.state, press.cardRef.pile, press.cardRef.index)) {
				this.press = null;
				return;
			}
			board.held = press.cardRef;
			board.targets = new Set(session.rules.targets(session.state, press.cardRef.pile, press.cardRef.index));
			board.setDragging(press.cardIds, true);
			board.updateHighlights();
			sfx.pick();
		}
		const now = performance.now();
		board.dragTo(press.cardIds, dx, dy, (now - press.lastTime) / 1000);
		press.lastTime = now;
		const hover = this.dropTarget(press, dx, dy).bestPile;
		if (hover !== board.over) {
			board.over = hover;
			board.updateHighlights();
		}
	}

	private end(e: PointerEvent, cancelled: boolean) {
		const press = this.press;
		if (!press || press.pointerId !== e.pointerId) return;
		this.press = null;
		if (press.dragging) {
			this.finishDrag(press, e, cancelled);
			return;
		}
		if (!cancelled) this.tap(press);
	}

	private dropTarget(press: PointerPress, dx: number, dy: number): { bestPile: string | null; missed: boolean } {
		const lead = this.play.board.placedRect(press.cardIds[0]);
		const rect = { ...lead, x: lead.x + dx, y: lead.y + dy };
		let bestPile: string | null = null;
		let bestArea = 0;
		let missed = false;
		for (const pile of this.play.session.rules.pileIds) {
			if (pile === press.cardRef!.pile) continue;
			const area = rectOverlap(rect, this.play.board.catchRect(pile));
			if (area <= 0) continue;
			if (this.play.board.targets.has(pile)) {
				if (area > bestArea) {
					bestArea = area;
					bestPile = pile;
				}
			} else missed = true;
		}
		return { bestPile, missed };
	}

	private finishDrag(press: PointerPress, e: PointerEvent, cancelled: boolean) {
		const { board } = this.play;
		const { bestPile, missed } = this.dropTarget(press, e.clientX - press.startX, e.clientY - press.startY);
		board.setDragging(press.cardIds, false);
		const from = press.cardRef!;
		board.held = null;
		board.over = null;
		board.targets.clear();
		if (!cancelled && bestPile && this.play.tryMove({ from: from.pile, index: from.index, to: bestPile })) return;
		if (!cancelled && missed) sfx.nope();
		board.animateLayout();
	}

	private tap(press: PointerPress) {
		const { session, board } = this.play;
		this.play.flushAutoMoves();
		const state = session.state;
		const rules = session.rules;
		const cardRef = press.cardRef && press.cardIds.length ? board.locate(press.cardIds[0]) : press.cardRef;
		const pile = cardRef?.pile ?? press.pile;
		const held = board.held;
		if (!pile) {
			this.play.cancelHold();
			return;
		}
		const pickable = cardRef ? rules.canPick(state, cardRef.pile, cardRef.index) : false;
		if (held) {
			if (pile === held.pile) {
				if (cardRef && cardRef.index === held.index) {
					if (!this.play.sendHome(held)) this.play.cancelHold();
				} else if (cardRef && pickable) this.play.hold(cardRef);
				else this.play.cancelHold();
				return;
			}
			const move = { from: held.pile, index: held.index, to: pile };
			if (session.canMove(move)) {
				this.play.tryMove(move);
				return;
			}
			if (cardRef && pickable && rules.kind(pile) !== 'foundation') {
				this.play.hold(cardRef);
				return;
			}
			sfx.nope();
			board.shake(pile);
			this.play.cancelHold();
			return;
		}
		if (rules.kind(pile) === 'stock') {
			this.play.drawFromStock();
			return;
		}
		if (cardRef && pickable) this.play.hold(cardRef);
	}
}