import { sfx, unlockAudio } from '../audio/sfx.ts';
import { neighbourPile } from './pile-navigation.ts';
import type { GamePlaySurface } from './game-play.ts';

/** Focus ring and arrow-key play on the table. */
export class GameKeyboard {
	private keyboardMode = false;
	private play: GamePlaySurface;

	constructor(play: GamePlaySurface) {
		this.play = play;
	}

	bind(boardRoot: HTMLElement) {
		boardRoot.addEventListener('focusin', (e) => {
			const pile = (e.target as HTMLElement).dataset.pile;
			if (!pile) return;
			const { board } = this.play;
			if (board.focus?.pile !== pile) board.focus = { pile, index: this.play.topCardIndex(pile) };
			board.showRing = this.keyboardMode;
			board.updateHighlights();
		});
		boardRoot.addEventListener('focusout', () => {
			window.setTimeout(() => {
				if (!boardRoot.contains(document.activeElement)) {
					this.play.board.showRing = false;
					this.play.board.updateHighlights();
				}
			});
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
				this.keyboardMode = true;
				if (boardRoot.contains(document.activeElement)) {
					this.play.board.showRing = true;
					this.play.board.updateHighlights();
				}
			}
		});
		boardRoot.addEventListener('keydown', (e) => {
			const { session, board } = this.play;
			if (!session || session.won) return;
			const focus = board.focus;
			if (!focus) return;
			unlockAudio();
			this.keyboardMode = true;
			board.showRing = true;
			const key = e.key;
			if (key === 'Enter' || key === ' ') {
				e.preventDefault();
				this.activate();
			} else if (key.startsWith('Arrow')) {
				e.preventDefault();
				this.moveFocus(key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down');
			}
		});
	}

	private activate() {
		this.play.flushAutoMoves();
		const focus = this.play.board.focus!;
		const rules = this.play.session.rules;
		const state = this.play.session.state;
		const held = this.play.board.held;
		focus.index = Math.min(focus.index, this.play.topCardIndex(focus.pile));
		if (held) {
			if (focus.pile === held.pile) {
				if (focus.index === held.index && this.play.sendHome(held)) return;
				if (focus.index !== held.index && rules.canPick(state, focus.pile, focus.index)) this.play.hold({ ...focus });
				else this.play.cancelHold();
				return;
			}
			this.play.dropOn(focus.pile);
			return;
		}
		if (rules.kind(focus.pile) === 'stock') {
			this.play.drawFromStock();
			return;
		}
		if (state.piles[focus.pile].length && rules.canPick(state, focus.pile, focus.index)) this.play.hold({ ...focus });
		else {
			sfx.nope();
			this.play.say('Nothing to pick up here.');
		}
	}

	private moveFocus(dir: 'left' | 'right' | 'up' | 'down') {
		const focus = this.play.board.focus!;
		const rules = this.play.session.rules;
		const state = this.play.session.state;
		const cards = state.piles[focus.pile];
		if (rules.kind(focus.pile) === 'tableau' && cards.length && (dir === 'up' || dir === 'down')) {
			const step = dir === 'up' ? -1 : 1;
			for (let index = focus.index + step; index >= 0 && index < cards.length; index += step) {
				if (rules.canPick(state, focus.pile, index)) {
					focus.index = index;
					this.play.board.updateHighlights();
					this.play.say(
						`${rules.cardLabel(cards[index].id)}, ${cards.length - index} card${cards.length - index > 1 ? 's' : ''}.`,
					);
					return;
				}
			}
			if (dir === 'down') return;
		}
		const next = neighbourPile(
			this.play.board.layout,
			this.play.session.rules.pileIds,
			focus.pile,
			dir,
		);
		if (next) this.play.board.slot(next).focus({ preventScroll: true });
	}
}