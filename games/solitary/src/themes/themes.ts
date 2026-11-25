import type { CardDef } from '../core/cards.ts';
import plebesSheet from '../assets/plebes-1x.png';

/**
 * A deck is how card faces and backs are drawn.
 * 'sprite' cuts each card from one sheet image. 'vector' draws the plain placeholder faces.
 * See ASSETS.md for how to add a new deck.
 */
export type Deck =
	| {
			kind: 'sprite';
			sheet: string;
			/** Size of the sheet, and of one card, in art pixels. */
			sheetW: number;
			sheetH: number;
			cardW: number;
			cardH: number;
			/** Top-left of a card in the sheet, in art pixels. */
			at: (card: CardDef) => [number, number];
			back: [number, number];
			/** Part of the card height that shows when cards overlap face up. */
			fanUp: number;
	  }
	| { kind: 'vector'; fanUp: number };

export interface Theme {
	id: string;
	name: string;
	/** Two colors for the picker swatch: felt, back. */
	swatch: [string, string];
	deck: Deck;
}

// Pixel Plebes (Classic) by Devlyn JD. Rows: hearts, diamonds, spades, clubs.
// Columns: A, K, Q, J, 2 to 10, then the back. Cards sit on a 90 x 126 grid. A card is the
// cream edge, the frame and the rank that pokes out of it: 88 x 126 from x + 1. The clear
// pixels at the grid corners round its corners.
const SUIT_ROW = { H: 0, D: 1, S: 2, C: 3 } as const;
const plebes: Deck = {
	kind: 'sprite',
	sheet: plebesSheet,
	sheetW: 1260,
	sheetH: 504,
	cardW: 88,
	cardH: 126,
	at: (card) => {
		const col = card.rank === 1 ? 0 : card.rank >= 11 ? 14 - card.rank : card.rank + 2;
		return [1 + col * 90, SUIT_ROW[card.suit] * 126];
	},
	back: [1 + 13 * 90, 0],
	fanUp: 0.2,
};

export const THEMES: Theme[] = [
	{ id: 'teal', name: 'Plebes · Teal', swatch: ['#0f5a69', '#3b324a'], deck: plebes },
	{ id: 'night', name: 'Plebes · Night', swatch: ['#2a2338', '#3b324a'], deck: plebes },
	{ id: 'parlour', name: 'Plain · Green', swatch: ['#1d6644', '#8e1f2d'], deck: { kind: 'vector', fanUp: 0.27 } },
];

export function getTheme(id: string): Theme {
	return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Card height over width. */
export function deckRatio(deck: Deck): number {
	return deck.kind === 'sprite' ? deck.cardH / deck.cardW : 1.4;
}
