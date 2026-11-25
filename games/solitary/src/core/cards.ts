export type Suit = 'S' | 'H' | 'D' | 'C';

export const SUIT_NAMES: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
export const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
export const RANK_SHORT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** A card's fixed identity. The deck never changes during a game. */
export interface CardDef {
	id: number;
	suit: Suit;
	rank: number; // 1 (Ace) to 13 (King)
}

/** A card as it lies in a pile. */
export interface Slot {
	id: number;
	up: boolean;
}

export const isRed = (suit: Suit) => suit === 'H' || suit === 'D';

export function cardName(card: CardDef): string {
	return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

/** One deck per suit list entry, 13 cards each. */
export function makeDeck(suits: Suit[]): CardDef[] {
	const deck: CardDef[] = [];
	for (const suit of suits) {
		for (let rank = 1; rank <= 13; rank++) deck.push({ id: deck.length, suit, rank });
	}
	return deck;
}
