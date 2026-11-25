import { RANK_SHORT, type CardDef } from '../core/cards.ts';
import { settings } from '../store/settings.ts';
import { getTheme, type Deck } from '../themes/themes.ts';
import { pixelSuit, suitIcon } from './icons.ts';

// Pip positions on number cards: [x, y] in a 3-column box.
const PIPS: Record<number, [number, number][]> = {
	2: [[1, 0], [1, 1]],
	3: [[1, 0], [1, 0.5], [1, 1]],
	4: [[0, 0], [2, 0], [0, 1], [2, 1]],
	5: [[0, 0], [2, 0], [1, 0.5], [0, 1], [2, 1]],
	6: [[0, 0], [2, 0], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
	7: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
	8: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [1, 0.75], [0, 1], [2, 1]],
	9: [[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, 0.5], [0, 2 / 3], [2, 2 / 3], [0, 1], [2, 1]],
	10: [[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3], [2, 2 / 3], [1, 5 / 6], [0, 1], [2, 1]],
};

export function vectorFace(card: CardDef): string {
	const rank = RANK_SHORT[card.rank];
	const corner = `<span class="card__rank">${rank}</span>${suitIcon(card.suit, 'card__cpip')}`;
	let center: string;
	if (card.rank === 1) {
		center = `<div class="card__ace">${suitIcon(card.suit, 'card__bigpip')}</div>`;
	} else if (card.rank > 10) {
		center = `<div class="card__court"><span class="card__court-letter">${rank}</span>${suitIcon(card.suit, 'card__court-pip')}</div>`;
	} else {
		const pips = PIPS[card.rank]
			.map(([x, y]) => `<i style="--px:${x / 2};--py:${y}" class="${y > 0.5 ? 'flip' : ''}">${suitIcon(card.suit, 'card__pip')}</i>`)
			.join('');
		center = `<div class="card__pips">${pips}</div><div class="card__solo">${suitIcon(card.suit, 'card__bigpip')}</div>`;
	}
	return `<div class="card__corner">${corner}</div>${center}`;
}

/** Background for one cell of a sprite sheet, sized to the card. */
export function spriteStyle(deck: Extract<Deck, { kind: 'sprite' }>, [x, y]: [number, number]): string {
	const sheetCols = deck.sheetW / deck.cardW;
	const sheetRows = deck.sheetH / deck.cardH;
	return `background-image:url(${deck.sheet});background-size:calc(var(--cw)*${sheetCols}) calc(var(--ch)*${sheetRows});background-position:calc(var(--cw)*${-x / deck.cardW}) calc(var(--ch)*${-y / deck.cardH})`;
}

export function faceHTML(card: CardDef): string {
	const deck = getTheme(settings.theme).deck;
	if (deck.kind === 'vector') return vectorFace(card);
	return `<div class="card__art" style="${spriteStyle(deck, deck.at(card))}"></div><span class="card__tag">${pixelSuit(card.suit)}</span>`;
}

export function backHTML(): string {
	const deck = getTheme(settings.theme).deck;
	if (deck.kind === 'vector') return '';
	return `<div class="card__art" style="${spriteStyle(deck, deck.back)}"></div>`;
}