/**
 * Text that the logic produces (hint explanations) is a list of tokens, so the UI
 * can draw a tile name, a number or a glass color as a little chip, and tests can
 * turn the same tokens into plain text.
 */
import { cellName } from './grid.ts';

export const COLOR_NAMES = ['ruby', 'cobalt', 'amber', 'jade'] as const;
/** The symbol each color shows with the Color shapes setting. */
export const SHAPE_NAMES = ['circle', 'triangle', 'square', 'diamond'] as const;

export type Token =
	| string
	| { t: 'cell'; cell: number }
	| { t: 'num'; v: number }
	| { t: 'color'; v: number }
	| { t: 'pair'; n: number; c: number };

export type Sentence = Token[];

export const numWord = (v: number) => String(v + 1);
export const colorWord = (v: number) => COLOR_NAMES[v];
export const pairWord = (n: number, c: number) => `${COLOR_NAMES[c]} ${n + 1}`;

export function tokenText(token: Token): string {
	if (typeof token === 'string') return token;
	switch (token.t) {
		case 'cell':
			return cellName(token.cell);
		case 'num':
			return numWord(token.v);
		case 'color':
			return colorWord(token.v);
		case 'pair':
			return pairWord(token.n, token.c);
	}
}

export const sentenceText = (s: Sentence) => s.map(tokenText).join('');
