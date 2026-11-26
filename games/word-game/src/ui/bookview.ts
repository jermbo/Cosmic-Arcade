// The Kin Book screen: hats on top, then each sticker set.
import { sfx } from '../audio.ts';
import { SETS, setDone, setProgress, stickerCount, TOTAL_STICKERS, type StickerSet } from '../book.ts';
import { GROUP_BY_ID } from '../core/bank.ts';
import { persist, save } from '../save.ts';
import { h } from './dom.ts';
import { pulse, toast } from './fx.ts';
import { hatSvg } from './hats.ts';
import { openModal } from './modal.ts';

/** `onHat` runs when the worn hat changes, so open screens can redraw Kip. */
export function openBook(onHat?: () => void): void {
	const hatButtons = SETS.map((set) => hatButton(set));

	function hatButton(set: StickerSet): HTMLButtonElement {
		const done = setDone(set);
		const b = h(
			'button',
			{
				class: `hatpick${done ? '' : ' hatpick--locked'}${save.hat === set.id && done ? ' hatpick--on' : ''}`,
				type: 'button',
				'aria-pressed': String(save.hat === set.id && done),
				'aria-label': done ? `${set.hatName}. Tap to wear.` : `${set.hatName}: finish ${set.name} to unlock`,
				html: hatSvg(set.hat),
			},
			h('small', {}, done ? set.hatName : `${setProgress(set)}/${set.groups.length}`),
		);
		b.addEventListener('click', () => {
			if (!done) {
				sfx.invalid();
				pulse(b, 'tile--nope');
				toast(`Finish “${set.name}” for the ${set.hatName.toLowerCase()}`, 1800);
				return;
			}
			save.hat = save.hat === set.id ? null : set.id;
			persist();
			sfx.select(3);
			hatButtons.forEach((x, i) => {
				const on = save.hat === SETS[i].id;
				x.classList.toggle('hatpick--on', on);
				x.setAttribute('aria-pressed', String(on));
			});
			pulse(b, 'diff__btn--pop');
			onHat?.();
		});
		return b;
	}

	const sections = SETS.map((set) => {
		const got = setProgress(set);
		const stickers = set.groups.map((id) => {
			const g = GROUP_BY_ID.get(id)!;
			const entry = save.book[id];
			if (!entry) return h('div', { class: `sticker sticker--empty sticker--l${g.level}`, 'aria-label': 'Not found yet' }, '?');
			return h(
				'div',
				{ class: `sticker sticker--l${g.level}`, title: g.words.join(', ') },
				h('strong', {}, g.theme),
				entry.n > 1 ? h('small', {}, `×${entry.n}`) : null,
			);
		});
		return h(
			'section',
			{ class: `bookset${got === set.groups.length ? ' bookset--done' : ''}` },
			h('div', { class: 'bookset__head' }, h('h3', {}, set.name), h('span', {}, `${got}/${set.groups.length}`)),
			h('div', { class: 'bookset__bar', '--p': got / set.groups.length }),
			h('div', { class: 'bookset__grid' }, ...stickers),
		);
	});

	openModal({
		title: 'Kin Book',
		cls: 'modal__card--book',
		body: [
			h('p', { class: 'book__count' }, h('strong', {}, `${stickerCount()} / ${TOTAL_STICKERS}`), ' stickers. Solve a group yourself to add it. Fill a set to win Kip a hat.'),
			h('div', { class: 'hats' }, ...hatButtons),
			...sections,
		],
	});
}
