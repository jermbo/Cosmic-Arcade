// The heads-up display: health, combo meter, boosts, wave and boss bars, and the pause button.

import { COMBO } from '../rules/data/balance.ts';
import { BOOSTS } from '../rules/data/boosts.ts';
import type { Battle } from '../rules/combat.ts';
import type { RunState } from '../rules/run.ts';
import { button, h, icon, root } from './dom.ts';

function hpBar() {
	const fill = h('div', { class: 'bar__fill' });
	const ghost = h('div', { class: 'bar__ghost' });
	const text = h('div', { class: 'bar__text' });
	const bar = h('div', { class: 'bar hp', role: 'meter', 'aria-label': 'Health' }, ghost, fill, text);
	let last = '';
	return {
		el: bar,
		set(hp: number, max: number) {
			const key = `${hp}/${max}`;
			if (key === last) return;
			last = key;
			const share = Math.max(0, Math.min(1, hp / max));
			fill.style.width = `${share * 100}%`;
			ghost.style.width = `${share * 100}%`;
			text.replaceChildren(icon('hp', 13), `${Math.max(0, Math.ceil(hp))} / ${max}`);
			bar.classList.toggle('hp--low', share < 0.3);
			bar.setAttribute('aria-valuenow', String(Math.ceil(hp)));
		},
	};
}

export function slotsRow(run: RunState, slots: number) {
	const row = h('div', { class: 'slots', 'aria-label': 'Boosts' });
	for (let i = 0; i < slots; i++) {
		const b = run.boosts[i];
		if (b) {
			const def = BOOSTS[b.id];
			row.append(h('div', { class: 'slot', title: `${def.name} ${b.level}` }, icon(def.icon, 18), h('span', { class: 'slot__lvl' }, String(b.level))));
		} else row.append(h('div', { class: 'slot slot--empty' }));
	}
	return row;
}

export class BattleHud {
	el: HTMLElement;
	private hp = hpBar();
	private comboFill = h('div', { class: 'bar__fill' });
	private comboHead = h('div', { class: 'combo__head' });
	private combo: HTMLElement;
	private comboLabel = h('div', { class: 'combo-label' }, 'Combo');
	private wave = h('div', { class: 'chip' }, '');
	private bossWrap = h('div', { class: 'hud__center', hidden: true });
	private bossFill = h('div', { class: 'bar__fill' });
	private bossName = h('div', { class: 'boss-name' });
	private last = { meter: -1, head: -1, bonus: '', streak: -1, wave: '', boss: -1 };

	constructor(run: RunState, slots: number, onPause: () => void) {
		this.combo = h('div', { class: 'bar combo', role: 'meter', 'aria-label': 'Combo' }, this.comboFill, this.comboHead, h('div', { class: 'combo__mark', style: `left:${COMBO.crownShare * 100}%` }));
		const pause = button(icon('pause', 20), onPause, 'btn--icon', { 'aria-label': 'Pause' });
		this.bossWrap.append(this.bossName, h('div', { class: 'bar boss-bar' }, this.bossFill));
		this.el = h(
			'div',
			{ class: 'hud' },
			h('div', { class: 'hud__left' }, this.hp.el, slotsRow(run, slots)),
			h('div', { class: 'hud__center' }, this.bossWrap, this.combo, this.comboLabel),
			h('div', { class: 'hud__right' }, h('div', { class: 'hud__row' }, this.wave, pause)),
		);
		root.append(this.el);
	}

	update(b: Battle) {
		this.hp.set(b.hp, b.maxHp);
		const meter = Math.round(b.meter);
		const head = Math.round(b.headGain);
		if (meter !== this.last.meter || head !== this.last.head) {
			this.comboFill.style.width = `${(meter / COMBO.max) * 100}%`;
			this.comboHead.style.width = `${(Math.min(head, meter) / COMBO.max) * 100}%`;
			this.last.meter = meter;
			this.last.head = head;
		}
		const bonus = b.bonus ?? '';
		if (bonus !== this.last.bonus || b.streak !== this.last.streak) {
			this.last.bonus = bonus;
			this.last.streak = b.streak;
			this.combo.classList.toggle('combo--ready', !!bonus);
			this.comboLabel.classList.toggle('combo-label--ready', !!bonus);
			this.comboLabel.textContent = bonus === 'crown' ? 'Crown Shot ready' : bonus === 'volley' ? 'Arrow Rain ready' : b.streak > 1 ? `Streak x${b.streak}` : 'Combo';
		}
		const boss = b.boss;
		const waveText = b.kind === 'boss' ? 'Boss' : `Wave ${Math.max(1, b.waveIndex + 1)}/${b.waves.length}`;
		if (waveText !== this.last.wave) {
			this.last.wave = waveText;
			this.wave.textContent = waveText;
		}
		if (boss?.boss) {
			this.bossWrap.hidden = false;
			const share = Math.round((Math.max(0, boss.hp) / boss.maxHp) * 200) / 2;
			if (share !== this.last.boss) {
				this.last.boss = share;
				this.bossFill.style.width = `${share}%`;
				this.bossName.textContent = boss.boss.name;
			}
		} else if (b.kind === 'boss') {
			this.bossFill.style.width = '0%';
		}
	}

	remove() {
		this.el.remove();
	}
}

/** A coach card for the first fight. */
export class Coach {
	el: HTMLElement | null = null;

	show(html: string, hand = false) {
		this.hide();
		this.el = h('div', { class: 'coach', role: 'status' }, hand ? h('div', { class: 'coach__hand', 'aria-hidden': 'true' }) : null, h('div', { html }));
		root.append(this.el);
	}

	hide() {
		this.el?.remove();
		this.el = null;
	}
}
