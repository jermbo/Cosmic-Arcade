// The title screen: the logo, Kip, and a card per mode.
import { sfx } from '../audio.ts';
import { todayKey } from '../core/rng.ts';
import type { ModeId } from '../core/types.ts';
import { MODES } from '../modes/meta.ts';
import { dailyResult, save } from '../save.ts';
import { h, icon } from './dom.ts';
import { calm, pulse, toast } from './fx.ts';
import { Kip } from './kip.ts';
import { openSettings, openStats } from './menus.ts';

const LOGO_COLORS = ['l1', 'l2', 'l3', 'l4', 'l3', 'l2', 'l1'];

function mini(mode: ModeId): HTMLElement {
	const t = (text: string, cls = '') => h('span', { class: `mini__t ${cls}` }, text);
	if (mode === 'crack') return h('div', { class: 'mini mini--crack', 'aria-hidden': 'true' }, t('OAK'), t('', 'mini__t--lock'), t('ELM'), t('ASH'));
	if (mode === 'secret') return h('div', { class: 'mini mini--secret', 'aria-hidden': 'true' }, t('?'), t('A', 'mini__t--on'), t('?'), t('E', 'mini__t--on'), t('?'));
	return h('div', { class: 'mini mini--link', 'aria-hidden': 'true' }, t('B'), t('M'), t('S'), t('D'));
}

export function titleScreen(onPlay: (mode: ModeId, daily: boolean) => void): { el: HTMLElement; destroy: () => void } {
	const kip = new Kip('big');
	const today = todayKey();
	let note = 0;

	const letters = [...'WORDKIN'].map((ch, i) => {
		const tile = h('button', { class: `logo__tile logo__tile--${LOGO_COLORS[i]}`, type: 'button', tabindex: '-1', 'aria-hidden': 'true', '--i': i }, ch);
		tile.addEventListener('click', () => {
			pulse(tile, 'logo__tile--hop');
			sfx.select((note++ % 6) + 1);
			if (i === 6) kip.react('happy');
		});
		return tile;
	});
	const logo = h(
		'h1',
		{ class: 'logo', 'aria-label': 'Wordkin' },
		h('span', { class: 'logo__row' }, ...letters.slice(0, 4)),
		h('span', { class: 'logo__row' }, ...letters.slice(4), kip.el),
	);

	const cards = MODES.map((m) => {
		const done = dailyResult(m.id, today);
		const streak = save.stats[m.id].streak;
		const daily = h(
			'button',
			{
				class: `btn ${done ? 'btn--done' : 'btn--go'}`,
				type: 'button',
				on: {
					click: () => {
						if (done) {
							sfx.ui();
							toast('Done for today. A new one comes tomorrow!', 2000);
							return;
						}
						onPlay(m.id, true);
					},
				},
			},
			done ? h('span', { class: 'btn__stars' }, done.won ? '★'.repeat(done.stars) + '☆'.repeat(3 - done.stars) : '✖') : 'Daily',
			done && h('span', { class: 'btn__small' }, 'Done'),
		);
		const practice = h('button', { class: 'btn btn--ghost', type: 'button', on: { click: () => onPlay(m.id, false) } }, 'Practice');
		return h(
			'article',
			{ class: `mode mode--${m.id}` },
			h('div', { class: 'mode__head' }, h('h2', { class: 'mode__name' }, m.name), streak > 0 && h('span', { class: 'chip chip--streak' }, `🔥 ${streak}`)),
			mini(m.id),
			h('p', { class: 'mode__blurb' }, m.blurb),
			h('div', { class: 'mode__actions' }, daily, practice),
		);
	});

	const el = h(
		'div',
		{ class: 'screen title' },
		h(
			'div',
			{ class: 'title__bar' },
			h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Stats', on: { click: () => { sfx.ui(); openStats(); } } }, icon('chart')),
			h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Settings', on: { click: () => { sfx.ui(); openSettings(); } } }, icon('gear')),
		),
		logo,
		h('p', { class: 'title__tag' }, 'Find the kin. Crack the words.'),
		h('div', { class: 'modes' }, ...cards),
		h('p', { class: 'title__foot' }, `New daily puzzles every day · ${today}`),
	);

	const onMove = (e: PointerEvent) => kip.look(e.clientX, e.clientY);
	addEventListener('pointermove', onMove);
	if (!calm()) setTimeout(() => kip.react('happy', 900), 700);

	return {
		el,
		destroy: () => {
			removeEventListener('pointermove', onMove);
			kip.destroy();
		},
	};
}
