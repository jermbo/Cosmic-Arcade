// The end card: stars stamp in, the score counts up, then share and next.
import { sfx } from '../audio.ts';
import type { ModeId } from '../core/types.ts';
import { MODE_BY_ID } from '../modes/meta.ts';
import { h, icon, wait } from './dom.ts';
import { calm, confetti, countUp, pulse, toast } from './fx.ts';
import { openModal } from './modal.ts';

export interface Outcome {
	won: boolean;
	score: number;
	stars: number;
	/** Short lines about the game, like "Cracked 3 of 4". */
	lines: string[];
	/** Emoji rows for the share text. */
	grid: string;
}

export interface ResultsOpts {
	mode: ModeId;
	date: string | null;
	outcome: Outcome;
	newBest: boolean;
	streak: number;
	parent: HTMLElement;
	onNext: () => void;
	onHome: () => void;
}

export function shareText(mode: ModeId, date: string | null, o: Outcome): string {
	const stars = '★'.repeat(o.stars) + '☆'.repeat(3 - o.stars);
	return [`Wordkin · ${MODE_BY_ID[mode].name}${date ? ` · ${date}` : ''}`, `${stars} ${o.score}`, o.grid].filter(Boolean).join('\n');
}

export function showResults(opts: ResultsOpts): void {
	const { outcome: o } = opts;
	const stars = [0, 1, 2].map(() => h('span', { class: 'rstar' }, icon('star', 'rstar__icon')));
	const score = h('strong', { class: 'results__score' }, '0');
	const share = shareText(opts.mode, opts.date, o);

	const shareBtn = h('button', { class: 'btn btn--ghost', type: 'button' }, icon('share'), 'Share');
	shareBtn.addEventListener('click', async () => {
		try {
			if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text: share });
			else {
				await navigator.clipboard.writeText(share);
				toast('Copied to clipboard');
			}
		} catch {
			// Closed the share sheet: nothing to do.
		}
	});

	const body = [
		h('div', { class: 'results__stars' }, ...stars),
		h('div', { class: 'results__scorebox' }, h('small', {}, 'Score'), score, opts.newBest && h('span', { class: 'badge badge--best' }, 'New best!')),
		h('ul', { class: 'results__lines' }, ...o.lines.map((l) => h('li', {}, l))),
		opts.date && opts.streak > 0 ? h('p', { class: 'results__streak' }, `Daily streak: ${opts.streak}`) : null,
		h('pre', { class: 'results__grid', 'aria-hidden': 'true' }, o.grid),
		h(
			'div',
			{ class: 'results__actions' },
			shareBtn,
			h('button', { class: 'btn btn--ghost', type: 'button', on: { click: opts.onHome } }, 'Menu'),
			h('button', { class: 'btn btn--go', type: 'button', on: { click: opts.onNext } }, opts.date ? 'Practice' : 'Next puzzle'),
		),
	].filter(Boolean) as Node[];

	const modal = openModal({ title: o.won ? pickWin(o.stars) : 'So close!', body, closable: false, parent: opts.parent, cls: `modal__card--results${o.won ? '' : ' modal__card--lost'}` });

	void (async () => {
		await wait(calm() ? 100 : 380);
		for (let i = 0; i < 3; i++) {
			if (i < o.stars) {
				stars[i].classList.add('rstar--on');
				pulse(stars[i], 'rstar--stamp');
				sfx.star(i);
				await wait(calm() ? 80 : 260);
			}
		}
		countUp(score, 0, o.score, 900, (t) => sfx.tick(t));
		if (o.won) {
			if (o.stars === 3) confetti();
			sfx.win();
		} else {
			sfx.lose();
		}
		pulse(modal.card, 'modal__card--settle');
	})();
}

function pickWin(stars: number): string {
	return stars === 3 ? 'Flawless!' : stars === 2 ? 'Nice one!' : 'Phew, solved!';
}
