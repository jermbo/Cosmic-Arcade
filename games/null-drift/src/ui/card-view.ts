import { CARDS, cardLines } from '../data/cards.ts';
import { effectiveNoise } from '../rules/combat.ts';
import type { Run } from '../rules/run.ts';

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function noiseTag(run: Run | null, raw: number): string {
	const n = run ? effectiveNoise(run, raw) : raw;
	if (n > 0) return `<span class="card__noise card__noise--loud">+${fmt(n)} NOISE</span>`;
	if (n < 0) return `<span class="card__noise card__noise--vent">${fmt(n)} TRACE</span>`;
	return `<span class="card__noise">SILENT</span>`;
}

interface CardOpts {
	index?: number;
	locked?: boolean;
	/** Button cards can be played or picked. */
	button?: boolean;
	hint?: string;
	extraClass?: string;
}

export function cardHtml(run: Run | null, id: string, opts: CardOpts = {}): string {
	const card = CARDS[id];
	const tag = opts.button ? 'button' : 'div';
	const attrs = [
		`class="card card--${card.kind.toLowerCase()}${opts.locked ? ' is-locked' : ''}${opts.extraClass ? ` ${opts.extraClass}` : ''}"`,
		`data-card="${id}"`,
		opts.index !== undefined ? `data-index="${opts.index}"` : '',
		opts.button ? 'type="button"' : '',
		opts.button && opts.locked ? 'aria-disabled="true"' : '',
	].join(' ');
	return `
		<${tag} ${attrs}>
			<span class="card__cost" aria-label="Cost ${card.cost}">${card.cost}</span>
			${opts.hint ? `<span class="card__hint" aria-hidden="true">${opts.hint}</span>` : ''}
			<span class="card__kind">${card.kind}</span>
			<span class="card__name">${card.name}</span>
			<span class="card__lines">${cardLines(card).map((l) => `<span>${l}</span>`).join('')}</span>
			<span class="card__flavor">${card.flavor}</span>
			${noiseTag(run, card.noise)}
		</${tag}>`;
}
