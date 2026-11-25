import { makeDeck } from '../core/cards.ts';
import { shuffle } from '../core/rng.ts';
import type { DealOptions, Hint, Move, State } from '../core/types.ts';
import { altDown, Rules, type StockResult } from './base.ts';

const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];
const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];

export class Klondike extends Rules {
	readonly mode = 'klondike' as const;
	readonly pileIds = ['stock', 'waste', ...FOUNDATIONS, ...TABLEAU];

	constructor(opts: DealOptions, seed: number) {
		super(makeDeck(['S', 'H', 'D', 'C']), opts, seed);
	}

	initial(): State {
		const order = shuffle(this.deck.map((c) => c.id), this.seed);
		const piles: State['piles'] = {};
		for (const id of this.pileIds) piles[id] = [];
		let next = 0;
		for (let row = 0; row < 7; row++) {
			for (let col = row; col < 7; col++) piles[TABLEAU[col]].push({ id: order[next++], up: col === row });
		}
		while (next < order.length) piles.stock.push({ id: order[next++], up: false });
		return { piles, noAuto: [], redeals: 0 };
	}

	canPick(state: State, pile: string, index: number): boolean {
		const cards = state.piles[pile];
		const kind = this.kind(pile);
		if (kind === 'stock') return false;
		if (kind === 'waste' || kind === 'foundation') return index === cards.length - 1 && index >= 0;
		return this.isRun(state, pile, index, altDown);
	}

	protected canPlace(state: State, move: Move): boolean {
		const run = state.piles[move.from].length - move.index;
		const lead = this.card(state.piles[move.from][move.index].id);
		const kind = this.kind(move.to);
		if (kind === 'foundation') {
			if (run !== 1) return false;
			const top = this.top(state, move.to);
			if (!top) return lead.rank === 1;
			const under = this.card(top.id);
			return under.suit === lead.suit && under.rank === lead.rank - 1;
		}
		if (kind !== 'tableau') return false;
		const top = this.top(state, move.to);
		if (!top) return lead.rank === 13;
		return top.up && altDown(this.card(top.id), lead);
	}

	stock(state: State): StockResult | null {
		const stock = state.piles.stock;
		const waste = state.piles.waste;
		if (stock.length === 0 && waste.length === 0) return null;
		const next: State = {
			piles: { ...state.piles, stock: stock.map((c) => ({ ...c })), waste: waste.map((c) => ({ ...c })) },
			noAuto: state.noAuto.slice(),
			redeals: state.redeals,
		};
		if (stock.length === 0) {
			next.piles.stock = next.piles.waste.reverse().map((c) => ({ id: c.id, up: false }));
			next.piles.waste = [];
			next.redeals++;
			return { state: next, kind: 'redeal' };
		}
		const count = Math.min(this.opts.draw, stock.length);
		for (let i = 0; i < count; i++) {
			const card = next.piles.stock.pop()!;
			next.piles.waste.push({ id: card.id, up: true });
		}
		return { state: next, kind: 'draw' };
	}

	autoMove(state: State): Move | null {
		return this.safeHome(state, ['waste', ...TABLEAU]);
	}

	isWon(state: State): boolean {
		return FOUNDATIONS.every((f) => state.piles[f].length === 13);
	}

	canFinish(state: State): boolean {
		if (state.piles.stock.length || state.piles.waste.length) return false;
		return TABLEAU.every((t) => state.piles[t].every((c) => c.up));
	}

	protected scoreMove(state: State, move: Move): number {
		const fromKind = this.kind(move.from);
		const toKind = this.kind(move.to);
		if (fromKind === 'foundation') return 0; // legal, but never the best advice
		if (toKind === 'foundation') return 100 + (this.revealsCard(state, move) ? 20 : 0);
		if (fromKind === 'waste') {
			const lead = this.card(state.piles.waste[move.index].id);
			return lead.rank === 13 ? 45 : 50;
		}
		// Tableau to tableau.
		if (this.revealsCard(state, move)) return 80 + this.hiddenUnder(state, move);
		if (move.index === 0) {
			// Emptying a column only helps when a King is waiting for it.
			const lead = this.card(state.piles[move.from][0].id);
			if (lead.rank === 13) return 0;
			return this.kingWaiting(state) ? 30 : 0;
		}
		// The run already sits on a fine parent. Only worth it if that frees a card for home.
		const below = state.piles[move.from][move.index - 1];
		return this.foundationFor(state, below.id) ? 60 : 0;
	}

	private kingWaiting(state: State): boolean {
		const waste = this.top(state, 'waste');
		if (waste && this.card(waste.id).rank === 13) return true;
		return TABLEAU.some((t) => {
			const cards = state.piles[t];
			const i = cards.findIndex((c) => c.up);
			return i > 0 && this.card(cards[i].id).rank === 13;
		});
	}

	protected stockHint(state: State): Hint | null {
		if (state.piles.stock.length) return { kind: 'stock', score: 5, text: 'Draw from the stock' };
		if (state.piles.waste.length > 0) return { kind: 'stock', score: 4, text: 'Turn the waste back over' };
		return null;
	}
}
