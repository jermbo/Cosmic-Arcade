// The title screen: the logo, Kip, and a card per mode.
import { sfx } from '../audio.ts';
import { todayKey } from '../core/rng.ts';
import type { ModeId } from '../core/types.ts';
import { MODES } from '../modes/meta.ts';
import { DIFFICULTIES, DIFFICULTY } from '../core/tuning.ts';
import { dailyResult, persist, save } from '../save.ts';
import { h, icon } from './dom.ts';
import { calm, pulse, toast } from './fx.ts';
import { Kip } from './kip.ts';
import { openBook } from './bookview.ts';
import { chainCard } from './chainview.ts';
import { openSettings, openStats } from './menus.ts';
import { wornHat } from '../book.ts';
import { canInstall, isStandalone, promptInstall } from './pwa.ts';

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

	const makeCards = () => MODES.map((m) => {
		const done = dailyResult(m.id, save.settings.difficulty, today);
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
							toast(`${DIFFICULTY[save.settings.difficulty].name} daily done. Try another level!`, 2200);
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

	const modes = h('div', { class: 'modes' }, ...makeCards());
	let chainEl = chainCard(save.settings.difficulty, today, () => redrawChain());
	const redrawChain = () => {
		const next = chainCard(save.settings.difficulty, today, () => redrawChain());
		chainEl.replaceWith(next);
		chainEl = next;
	};
	const installBtn = h('button', { class: 'btn btn--small btn--ghost', type: 'button', hidden: true, on: { click: () => void promptInstall() } }, 'Install');
	const syncInstall = () => (installBtn.hidden = isStandalone() || !canInstall());
	syncInstall();
	addEventListener('pwa-change', syncInstall);
	const blurb = h('p', { class: 'diff__blurb' }, DIFFICULTY[save.settings.difficulty].blurb);

	function diffPicker(): HTMLElement {
		const buttons = DIFFICULTIES.map((d) => {
			const b = h('button', { class: `diff__btn diff__btn--${d}`, type: 'button', role: 'radio', 'aria-checked': String(d === save.settings.difficulty) }, DIFFICULTY[d].name);
			b.addEventListener('click', () => {
				if (save.settings.difficulty === d) return;
				save.settings.difficulty = d;
				persist();
				sfx.select(DIFFICULTIES.indexOf(d) + 2);
				buttons.forEach((x, i) => x.setAttribute('aria-checked', String(DIFFICULTIES[i] === d)));
				pulse(b, 'diff__btn--pop');
				blurb.textContent = DIFFICULTY[d].blurb;
				modes.replaceChildren(...makeCards());
				redrawChain();
				kip.react(d === 'hard' ? 'think' : 'happy', 800);
			});
			return b;
		});
		return h('div', { class: 'diff' }, h('div', { class: 'diff__group', role: 'radiogroup', 'aria-label': 'Difficulty' }, ...buttons), blurb);
	}

	const el = h(
		'div',
		{ class: 'screen title' },
		h(
			'div',
			{ class: 'title__bar' },
			installBtn,
			h('span', { class: 'title__spacer' }),
			h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Kin Book', on: { click: () => { sfx.ui(); openBook(() => kip.setHat(wornHat()?.hat ?? null)); } } }, icon('book')),
			h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Stats', on: { click: () => { sfx.ui(); openStats(); } } }, icon('chart')),
			h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Settings', on: { click: () => { sfx.ui(); openSettings(); } } }, icon('gear')),
		),
		logo,
		h('p', { class: 'title__tag' }, 'Find the kin. Crack the words.'),
		diffPicker(),
		modes,
		chainEl,
		h('p', { class: 'title__foot' }, `New daily puzzles every day · ${today}`),
	);

	const onMove = (e: PointerEvent) => kip.look(e.clientX, e.clientY);
	addEventListener('pointermove', onMove);
	if (!calm()) setTimeout(() => kip.react('happy', 900), 700);

	return {
		el,
		destroy: () => {
			removeEventListener('pointermove', onMove);
			removeEventListener('pwa-change', syncInstall);
			kip.destroy();
		},
	};
}
