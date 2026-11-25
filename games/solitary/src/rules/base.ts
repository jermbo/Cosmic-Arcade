import { isRed, type CardDef, type Slot } from '../core/cards.ts';
import { cloneState, type DealOptions, type Hint, type ModeId, type Move, type PileKind, type State } from '../core/types.ts';

export interface StockResult {
	state: State;
	kind: 'draw' | 'redeal' | 'deal';
}

/** What every mode shares: pile lookups, foundation checks, hint search. */
export abstract class Rules {
	abstract readonly mode: ModeId;
	readonly deck: CardDef[];
	readonly opts: DealOptions;
	readonly seed: number;
	/** Every pile, in focus and tab order. */
	abstract readonly pileIds: string[];

	constructor(deck: CardDef[], opts: DealOptions, seed: number) {
		this.deck = deck;
		this.opts = opts;
		this.seed = seed;
	}

	abstract initial(): State;
	/** Can the player pick up the run that starts at this index? */
	abstract canPick(state: State, pile: string, index: number): boolean;
	/** Is this a legal place for the run? canPick is checked first. */
	protected abstract canPlace(state: State, move: Move): boolean;
	abstract stock(state: State): StockResult | string | null;
	abstract autoMove(state: State): Move | null;
	abstract isWon(state: State): boolean;
	/** The board is solved: every card can go home. */
	abstract canFinish(state: State): boolean;
	protected abstract scoreMove(state: State, move: Move): number;
	protected abstract stockHint(state: State): Hint | null;

	kind(pile: string): PileKind {
		if (pile === 'stock') return 'stock';
		if (pile === 'waste') return 'waste';
		if (pile[0] === 'f') return 'foundation';
		if (pile[0] === 'c') return 'cell';
		return 'tableau';
	}

	card(id: number): CardDef {
		return this.deck[id];
	}

	top(state: State, pile: string): Slot | undefined {
		const cards = state.piles[pile];
		return cards[cards.length - 1];
	}

	canMove(state: State, move: Move): boolean {
		if (move.from === move.to) return false;
		if (!state.piles[move.to]) return false;
		if (!this.canPick(state, move.from, move.index)) return false;
		return this.canPlace(state, move);
	}

	/** Move the run and turn up the card under it. Returns a new state. */
	apply(state: State, move: Move, byPlayer = true): State {
		const next = cloneState(state);
		const run = next.piles[move.from].splice(move.index);
		next.piles[move.to].push(...run);
		const under = this.top(next, move.from);
		if (under && !under.up && this.kind(move.from) === 'tableau') under.up = true;
		if (byPlayer) {
			const ids = new Set(run.map((c) => c.id));
			next.noAuto = next.noAuto.filter((id) => !ids.has(id));
			if (this.kind(move.from) === 'foundation') next.noAuto.push(...ids);
		}
		return next;
	}

	/** Piles where the run could go. */
	targets(state: State, from: string, index: number): string[] {
		if (!this.canPick(state, from, index)) return [];
		return this.pileIds.filter((to) => this.canMove(state, { from, index, to }));
	}

	/** Rank on the foundation of this suit (0 when none). */
	homeRank(state: State, suit: CardDef['suit']): number {
		let best = 0;
		for (const id of this.pileIds) {
			if (this.kind(id) !== 'foundation') continue;
			const top = this.top(state, id);
			if (top && this.card(top.id).suit === suit) best = Math.max(best, this.card(top.id).rank);
		}
		return best;
	}

	/** The foundation that takes this single card, if any. */
	foundationFor(state: State, id: number): string | null {
		const card = this.card(id);
		let empty: string | null = null;
		for (const pile of this.pileIds) {
			if (this.kind(pile) !== 'foundation') continue;
			const top = this.top(state, pile);
			if (!top) {
				if (card.rank === 1 && !empty) empty = pile;
				continue;
			}
			const under = this.card(top.id);
			if (under.suit === card.suit && under.rank === card.rank - 1) return pile;
		}
		return empty;
	}

	/** Safe to send home: no tableau card could still want to sit on it. */
	isSafeHome(state: State, id: number): boolean {
		const card = this.card(id);
		if (card.rank <= 2) return true;
		const red = isRed(card.suit);
		const others: CardDef['suit'][] = red ? ['S', 'C'] : ['H', 'D'];
		return others.every((s) => this.homeRank(state, s) >= card.rank - 1);
	}

	/** A safe single-card move to a foundation from these piles. */
	protected safeHome(state: State, sources: string[], safeOnly = true): Move | null {
		const noAuto = new Set(state.noAuto);
		let best: Move | null = null;
		let bestRank = 99;
		for (const from of sources) {
			const top = this.top(state, from);
			if (!top || !top.up) continue;
			if (safeOnly && noAuto.has(top.id)) continue;
			const to = this.foundationFor(state, top.id);
			if (!to) continue;
			if (safeOnly && !this.isSafeHome(state, top.id)) continue;
			const rank = this.card(top.id).rank;
			if (rank < bestRank) {
				bestRank = rank;
				best = { from, index: state.piles[from].length - 1, to };
			}
		}
		return best;
	}

	/** One move that sends a card home, ignoring safety. For finishing a solved board. */
	finishMove(state: State): Move | null {
		const sources = this.pileIds.filter((p) => this.kind(p) !== 'foundation' && this.kind(p) !== 'stock');
		return this.safeHome({ ...state, noAuto: [] }, sources, false);
	}

	/** Every legal move, best first, with pointless ones dropped. */
	hints(state: State): Hint[] {
		const out: Hint[] = [];
		const seen = new Set<string>();
		for (const from of this.pileIds) {
			const cards = state.piles[from];
			for (let index = 0; index < cards.length; index++) {
				if (!this.canPick(state, from, index)) continue;
				for (const to of this.pileIds) {
					const move = { from, index, to };
					if (!this.canMove(state, move)) continue;
					// Two empty cells or columns are the same move: keep one.
					const key = `${from}:${index}:${state.piles[to].length ? to : this.kind(to) + '-empty'}`;
					if (seen.has(key)) continue;
					seen.add(key);
					const score = this.scoreMove(state, move);
					if (score > 0) out.push({ kind: 'move', move, score });
				}
			}
		}
		const stock = this.stockHint(state);
		if (stock) out.push(stock);
		return out.sort((a, b) => b.score - a.score);
	}

	/** True when the card under the run is a natural parent already. */
	protected sitsOnParent(state: State, move: Move, sameSuit: boolean): boolean {
		if (move.index === 0) return false;
		const below = state.piles[move.from][move.index - 1];
		if (!below.up) return false;
		const lead = this.card(state.piles[move.from][move.index].id);
		const parent = this.card(below.id);
		if (parent.rank !== lead.rank + 1) return false;
		return sameSuit ? parent.suit === lead.suit : isRed(parent.suit) !== isRed(lead.suit);
	}

	protected revealsCard(state: State, move: Move): boolean {
		if (move.index === 0) return false;
		return !state.piles[move.from][move.index - 1].up;
	}

	protected hiddenUnder(state: State, move: Move): number {
		let n = 0;
		for (let i = 0; i < move.index; i++) if (!state.piles[move.from][i].up) n++;
		return n;
	}

	/** A short text for the screen reader and the hint toast. */
	describe(state: State, move: Move): string {
		const cards = state.piles[move.from];
		const lead = this.card(cards[move.index].id);
		const count = cards.length - move.index;
		const what = count > 1 ? `${count} cards from ${this.short(lead.id)}` : this.short(lead.id);
		return `${what} to ${this.pileName(move.to)}`;
	}

	short(id: number): string {
		const c = this.card(id);
		const ranks = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
		const suits = { S: '♠', H: '♥', D: '♦', C: '♣' };
		return `${ranks[c.rank]}${suits[c.suit]}`;
	}

	pileName(pile: string): string {
		const kind = this.kind(pile);
		const n = Number(pile.slice(1)) + 1;
		if (kind === 'tableau') return `column ${n}`;
		if (kind === 'foundation') return `foundation ${n}`;
		if (kind === 'cell') return `free cell ${n}`;
		return kind;
	}

	/** Sequence check helper. */
	protected isRun(state: State, pile: string, index: number, fits: (lower: CardDef, upper: CardDef) => boolean): boolean {
		const cards = state.piles[pile];
		if (index < 0 || index >= cards.length) return false;
		for (let i = index; i < cards.length; i++) {
			if (!cards[i].up) return false;
			if (i > index && !fits(this.card(cards[i - 1].id), this.card(cards[i].id))) return false;
		}
		return true;
	}
}

export const altDown = (lower: CardDef, upper: CardDef) =>
	lower.rank === upper.rank + 1 && isRed(lower.suit) !== isRed(upper.suit);

export const suitDown = (lower: CardDef, upper: CardDef) => lower.rank === upper.rank + 1 && lower.suit === upper.suit;
