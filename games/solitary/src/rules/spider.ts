import { makeDeck, type Suit } from '../core/cards.ts';
import { shuffle } from '../core/rng.ts';
import type { DealOptions, Hint, Move, State } from '../core/types.ts';
import { Rules, suitDown, type StockResult } from './base.ts';

const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];
const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'];

function spiderSuits(count: 1 | 2 | 4): Suit[] {
	const base: Suit[] = count === 1 ? ['S'] : count === 2 ? ['S', 'H'] : ['S', 'H', 'D', 'C'];
	const out: Suit[] = [];
	for (let i = 0; i < 8; i++) out.push(base[i % base.length]);
	return out;
}

export class Spider extends Rules {
	readonly mode = 'spider' as const;
	readonly pileIds = ['stock', ...FOUNDATIONS, ...TABLEAU];

	constructor(opts: DealOptions, seed: number) {
		super(makeDeck(spiderSuits(opts.suits)), opts, seed);
	}

	initial(): State {
		const order = shuffle(this.deck.map((c) => c.id), this.seed);
		const piles: State['piles'] = {};
		for (const id of this.pileIds) piles[id] = [];
		let next = 0;
		for (let col = 0; col < 10; col++) {
			const count = col < 4 ? 6 : 5;
			for (let i = 0; i < count; i++) piles[TABLEAU[col]].push({ id: order[next++], up: i === count - 1 });
		}
		while (next < order.length) piles.stock.push({ id: order[next++], up: false });
		return { piles, noAuto: [], redeals: 0 };
	}

	canPick(state: State, pile: string, index: number): boolean {
		if (this.kind(pile) !== 'tableau') return false;
		return this.isRun(state, pile, index, suitDown);
	}

	/** A full King-to-Ace run of one suit, which may go to a foundation. */
	isFullRun(state: State, pile: string, index: number): boolean {
		const cards = state.piles[pile];
		return (
			cards.length - index === 13 &&
			this.card(cards[index].id).rank === 13 &&
			this.isRun(state, pile, index, suitDown)
		);
	}

	protected canPlace(state: State, move: Move): boolean {
		const lead = this.card(state.piles[move.from][move.index].id);
		const kind = this.kind(move.to);
		const top = this.top(state, move.to);
		if (kind === 'foundation') return !top && this.isFullRun(state, move.from, move.index);
		if (kind !== 'tableau') return false;
		if (!top) return true;
		return top.up && this.card(top.id).rank === lead.rank + 1;
	}

	stock(state: State): StockResult | string | null {
		if (state.piles.stock.length === 0) return null;
		if (TABLEAU.some((t) => state.piles[t].length === 0)) return 'Fill every column before you deal.';
		const piles = { ...state.piles };
		const stock = state.piles.stock.map((c) => ({ ...c }));
		for (const t of TABLEAU) {
			const card = stock.pop()!;
			piles[t] = [...state.piles[t].map((c) => ({ ...c })), { id: card.id, up: true }];
		}
		piles.stock = stock;
		return { state: { piles, noAuto: state.noAuto.slice(), redeals: state.redeals }, kind: 'deal' };
	}

	/** A finished run that can go home. */
	fullRunMove(state: State): Move | null {
		const to = FOUNDATIONS.find((f) => state.piles[f].length === 0);
		if (!to) return null;
		for (const t of TABLEAU) {
			const index = state.piles[t].length - 13;
			if (index >= 0 && this.isFullRun(state, t, index)) return { from: t, index, to };
		}
		return null;
	}

	autoMove(state: State): Move | null {
		return this.fullRunMove(state);
	}

	finishMove(state: State): Move | null {
		return this.fullRunMove(state);
	}

	isWon(state: State): boolean {
		return FOUNDATIONS.every((f) => state.piles[f].length === 13);
	}

	canFinish(): boolean {
		return false;
	}

	protected scoreMove(state: State, move: Move): number {
		if (this.kind(move.to) === 'foundation') return 200;
		const cards = state.piles[move.from];
		const lead = this.card(cards[move.index].id);
		const top = this.top(state, move.to);
		const reveal = this.revealsCard(state, move) ? 50 : 0;
		if (!top) {
			if (move.index === 0) return 0;
			if (this.sitsOnParent(state, move, false)) return 0;
			return reveal ? 35 : 12;
		}
		const sameSuit = this.card(top.id).suit === lead.suit;
		if (this.sitsOnParent(state, move, true)) return 0; // never break a clean run
		if (this.sitsOnParent(state, move, false)) return sameSuit ? 90 : 0;
		return (sameSuit ? 100 : 40) + reveal + (move.index === 0 ? 30 : 0);
	}

	protected stockHint(state: State): Hint | null {
		if (!state.piles.stock.length) return null;
		if (TABLEAU.some((t) => state.piles[t].length === 0))
			return { kind: 'stock', score: 1, text: 'Fill the empty column, then deal' };
		return { kind: 'stock', score: 5, text: 'Deal a new row' };
	}
}
