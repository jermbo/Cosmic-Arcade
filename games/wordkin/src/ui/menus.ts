// Help, settings and stats cards.
import { sfx } from '../audio.ts';
import { DIFFICULTY, LEVEL_NAMES } from '../core/tuning.ts';
import type { ModeId } from '../core/types.ts';
import { MODE_BY_ID, MODES } from '../modes/meta.ts';
import { applyLooks } from '../shop/wallet.ts';
import { persist, resetAll, save, type Settings } from '../save.ts';
import { h } from './dom.ts';
import { openModal, type ModalHandle } from './modal.ts';

/** Turns **bold** into <strong>. */
function rich(text: string): HTMLElement {
	const p = h('p');
	text.split(/\*\*(.+?)\*\*/).forEach((part, i) => p.append(i % 2 ? h('strong', {}, part) : part));
	return p;
}

function legend(): HTMLElement {
	const item = (mark: string, letter: string, text: string) =>
		h('div', { class: 'legend__item' }, h('span', { class: 'cell cell--filled cell--mini', 'data-mark': mark }, letter), h('span', {}, text));
	return h('div', { class: 'legend' }, item('hit', 'A', 'Right spot'), item('near', 'B', 'In the word'), item('miss', 'C', 'Not in it'));
}

export function openHelp(mode: ModeId, parent?: HTMLElement, onClose?: () => void, diff = save.settings.difficulty): ModalHandle {
	const meta = MODE_BY_ID[mode];
	let handle: ModalHandle;
	const body = [
		h('ol', { class: 'steps' }, ...meta.steps(DIFFICULTY[diff]).map((s) => h('li', {}, rich(s)))),
		mode === 'blitz' ? null : mode !== 'secret' ? legend() : h('div', { class: 'legend legend--groups' }, ...[1, 2, 3, 4].map((l) => h('span', { class: `chip chip--l${l}` }, LEVEL_NAMES[l as 1 | 2 | 3 | 4]))),
		h('button', { class: 'btn btn--go btn--wide', type: 'button', on: { click: () => handle.close() } }, "Let's go"),
	];
	handle = openModal({ title: mode === 'blitz' ? meta.name : `${meta.name} · ${DIFFICULTY[diff].name}`, body: body.filter((b): b is HTMLElement => !!b), parent, cls: 'modal__card--help', onClose });
	save.seenHelp[mode] = true;
	persist();
	return handle;
}

export function openSettings(): void {
	const toggle = (key: Exclude<keyof Settings, 'difficulty' | 'style'>, label: string, note: string) => {
		const input = h('input', { type: 'checkbox', class: 'switch__input', checked: save.settings[key] });
		input.addEventListener('change', () => {
			save.settings[key] = input.checked;
			persist();
			document.documentElement.classList.toggle('calm', save.settings.lessMotion);
			sfx.ui();
		});
		return h('label', { class: 'switch' }, h('span', { class: 'switch__text' }, h('strong', {}, label), h('small', {}, note)), input, h('span', { class: 'switch__knob', 'aria-hidden': 'true' }));
	};
	// The cozy kit style: Soft (the default) or Bold. Free, and it changes the whole game at once.
	const bold = h('input', { type: 'checkbox', class: 'switch__input', checked: save.settings.style === 'bold' });
	bold.addEventListener('change', () => {
		save.settings.style = bold.checked ? 'bold' : 'soft';
		persist();
		applyLooks();
		sfx.ui();
	});
	const styleSwitch = h('label', { class: 'switch' }, h('span', { class: 'switch__text' }, h('strong', {}, 'Bold style'), h('small', {}, 'Ink outlines and hard shadows. Off: soft clay.')), bold, h('span', { class: 'switch__knob', 'aria-hidden': 'true' }));
	const reset = h(
		'button',
		{
			class: 'btn btn--ghost btn--wide',
			type: 'button',
			on: {
				click: () => {
					if (reset.dataset.sure) {
						resetAll();
						reset.textContent = 'Stats cleared';
						reset.setAttribute('disabled', '');
					} else {
						reset.dataset.sure = '1';
						reset.textContent = 'Tap again to clear all stats';
					}
				},
			},
		},
		'Clear stats',
	);
	openModal({
		title: 'Settings',
		body: [toggle('sound', 'Sound', 'Soft taps and chimes'), toggle('haptics', 'Buzz', 'Phone buzz on mistakes'), toggle('lessMotion', 'Less motion', 'Shorter, calmer animations'), styleSwitch, reset],
	});
}

export function openStats(): void {
	const rows = MODES.map((m) => {
		const s = save.stats[m.id];
		const cell = (n: number | string, label: string) => h('div', { class: 'stat' }, h('strong', {}, String(n)), h('small', {}, label));
		return h(
			'div',
			{ class: `statrow statrow--${m.id}` },
			h('h3', {}, m.name),
			h('div', { class: 'statrow__cells' }, cell(s.played, 'Played'), cell(s.played ? `${Math.round((s.won / s.played) * 100)}%` : '–', 'Won'), cell(s.bestScore, 'Best'), cell(s.streak, 'Streak'), cell(s.bestStreak, 'Top streak')),
		);
	});
	openModal({ title: 'Stats', body: [...rows, h('p', { class: 'muted' }, 'Streaks count daily wins in a row.')] });
}
