import type { CardDef, Suit } from '../core/cards.ts';
import type { DealOptions, Hint, Move, State } from '../core/types.ts';
import { altDown, Rules } from './base.ts';

const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
const CELLS = ['c0', 'c1', 'c2', 'c3'];
const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];

/** Deck in the order of the classic numbered deals: clubs, diamonds, hearts, spades per rank. */
function numberedDeck(): CardDef[] {
	const suits: Suit[] = ['C', 'D', 'H', 'S'];
	const deck: CardDef[] = [];
	for (let i = 0; i < 52; i++) deck.push({ id: i, suit: suits[i % 4], rank: Math.floor(i / 4) + 1 });
	return deck;
}

/** Deals 1 to 32000 of the well-known numbered FreeCell deals. Only 11982 cannot be won. */
export function randomDealNumber(): number {
	let n = 11982;
	while (n === 11982) n = 1 + Math.floor(Math.random() * 32000);
	return n;
}

export class FreeCell extends Rules {
	readonly mode = 'freecell' as const;
	readonly pileIds = [...CELLS, ...FOUNDATIONS, ...TABLEAU];

	constructor(opts: DealOptions, dealNumber: number) {
		super(numberedDeck(), opts, dealNumber);
	}

	initial(): State {
		const piles: State['piles'] = {};
		for (const id of this.pileIds) piles[id] = [];
		let seed = this.seed;
		const rand = () => {
			seed = (seed * 214013 + 2531011) % 2147483648;
			return Math.floor(seed / 65536);
		};
		const cards = Array.from({ length: 52 }, (_, i) => i);
		for (let i = 0; i < 52; i++) {
			const left = 52 - i;
			const j = rand() % left;
			piles[TABLEAU[i % 8]].push({ id: cards[j], up: true });
			cards[j] = cards[left - 1];
		}
		return { piles, noAuto: [], redeals: 0 };
	}

	/** How many cards fit through the free cells and empty columns at once. */
	maxRun(state: State, toEmpty: boolean): number {
		const cells = CELLS.filter((c) => state.piles[c].length === 0).length;
		let empty = TABLEAU.filter((t) => state.piles[t].length === 0).length;
		if (toEmpty) empty--;
		return (cells + 1) * 2 ** Math.max(0, empty);
	}

	canPick(state: State, pile: string, index: number): boolean {
		const kind = this.kind(pile);
		if (kind === 'foundation') return false;
		if (kind === 'cell') return index === 0 && state.piles[pile].length === 1;
		return this.isRun(state, pile, index, altDown);
	}

	protected canPlace(state: State, move: Move): boolean {
		const run = state.piles[move.from].length - move.index;
		const lead = this.card(state.piles[move.from][move.index].id);
		const kind = this.kind(move.to);
		const top = this.top(state, move.to);
		if (kind === 'cell') return run === 1 && !top;
		if (kind === 'foundation') {
			if (run !== 1) return false;
			if (!top) return lead.rank === 1;
			const under = this.card(top.id);
			return under.suit === lead.suit && under.rank === lead.rank - 1;
		}
		if (!top) return run <= this.maxRun(state, true);
		return run <= this.maxRun(state, false) && altDown(this.card(top.id), lead);
	}

	stock(): null {
		return null;
	}

	autoMove(state: State): Move | null {
		return this.safeHome(state, [...CELLS, ...TABLEAU]);
	}

	isWon(state: State): boolean {
		return FOUNDATIONS.every((f) => state.piles[f].length === 13);
	}

	/** Every column runs high to low: the lowest card left is always free. */
	canFinish(state: State): boolean {
		return TABLEAU.every((t) => {
			const cards = state.piles[t];
			for (let i = 1; i < cards.length; i++) {
				if (this.card(cards[i - 1].id).rank < this.card(cards[i].id).rank) return false;
			}
			return true;
		});
	}

	protected scoreMove(state: State, move: Move): number {
		const fromKind = this.kind(move.from);
		const toKind = this.kind(move.to);
		const toEmpty = state.piles[move.to].length === 0;
		if (toKind === 'foundation') return 100;
		const freesHome = () => {
			if (move.index === 0) return false;
			const below = state.piles[move.from][move.index - 1];
			return Boolean(this.foundationFor(state, below.id));
		};
		if (fromKind === 'cell') return toEmpty ? 15 : 60;
		if (toKind === 'cell') return 10 + (freesHome() ? 40 : 0);
		if (this.sitsOnParent(state, move, false)) return freesHome() ? 45 : 0;
		if (toEmpty) return move.index === 0 ? 0 : 20 + (freesHome() ? 30 : 0);
		return 50 + (move.index === 0 ? 15 : 0) + (freesHome() ? 30 : 0);
	}

	protected stockHint(): Hint | null {
		return null;
	}
}
