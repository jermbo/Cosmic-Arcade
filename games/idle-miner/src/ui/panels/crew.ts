// The crew panel: hire, train and place crew members.

import { CREW, CREW_MAX, CREW_ORDER } from '../../content/crew.ts';
import type { CrewId } from '../../content/crew.ts';
import { PLANETS } from '../../content/planets.ts';
import { fmt } from '../../core/format.ts';
import { assignCrew, buyCrew, buySlot, slotCount, slotsUsed } from '../../core/crew.ts';
import { perkPoints } from '../../core/nova.ts';
import { crewCost, slotCost } from '../../core/prices.ts';
import { openPanel } from '../modal.ts';
import { host } from './host.ts';

/** The shared crew pool. pi is the planet the panel was opened from: "Work here" sends crew there. */
export function openCrew(pi: number) {
	openPanel({
		id: 'crew',
		title: `Crew · ${PLANETS[pi].name}`,
		render: () => {
			const g = host.game();
			const used = slotsUsed(g);
			const total = slotCount(g);
			const free = used < total;
			const rows = CREW_ORDER.map((id) => {
				const def = CREW[id];
				const lv = g.crew[id] || 0;
				const at = g.crewAt[id];
				const here = at === pi;
				const cost = crewCost(g, id);
				const maxed = lv >= CREW_MAX;
				const where = !lv ? '' : at === undefined ? `<span class="crew__where">Resting</span>` : `<span class="crew__where" style="color:${PLANETS[at].light}">On ${PLANETS[at].name}</span>`;
				const level = lv ? `<small>Lv ${lv}/${CREW_MAX}</small>` : '';
				let place = '';
				if (lv && here) place = `<button class="btn btn--small btn--ghost" data-act="rest" data-arg="${id}">Rest</button>`;
				else if (lv) place = `<button class="btn btn--small btn--ghost" data-act="here" data-arg="${id}" ${at !== undefined || free ? '' : 'disabled'}>${at === undefined ? 'Work here' : 'Move here'}</button>`;
				const buy = maxed ? `<button class="btn btn--small" disabled>Max</button>` : `<button class="btn btn--small ${lv ? '' : 'btn--gold'}" data-act="buy" data-arg="${id}" ${g.credits >= cost ? '' : 'disabled'}>${lv ? 'Train' : 'Hire'} ${fmt(cost)}</button>`;
				return `<div class="row crew ${here ? 'is-on' : ''} ${lv ? '' : 'is-new'}"><span class="crew__badge" style="--c:${def.color}">${def.name[0]}</span><div><div class="row__name">${def.name}${level}</div><div class="row__desc"><b>${def.title}.</b> ${crewText(id, Math.max(1, lv))}</div>${where}</div><div class="crew__btns">${place}${buy}</div></div>`;
			}).join('');
			const next = slotCost(g);
			const points = perkPoints(g);
			const showDust = g.stardust > 0 || g.unlocks.includes('prestige');
			const slotBtn = !next ? `<button class="btn btn--small" disabled>All slots open</button>` : showDust ? `<button class="btn btn--small btn--gold" data-act="slot" ${points >= next ? '' : 'disabled'}>New slot ✦ ${next}</button>` : '';
			const stats = `<div class="crew__slots"><div class="stat"><small>Crew working</small><b>${used} / ${total}</b></div>${slotBtn}</div>`;
			const dustNote = next ? (showDust ? ` More slots cost stardust (✦ ${points} free).` : ' More slots cost stardust from a Nova Reset.') : '';
			return `${stats}<p>Crew boost the planet they work on. Hire once and keep them for good: crew, levels and slots stay through a Nova Reset.${dustNote}</p><div class="rows">${rows}</div>`;
		},
		act: (name, el) => {
			const g = host.game();
			const id = el.dataset.arg as CrewId;
			let ok = false;
			if (name === 'buy') ok = buyCrew(g, id);
			if (name === 'here') ok = assignCrew(g, id, pi);
			if (name === 'rest') ok = assignCrew(g, id, -1);
			if (name === 'slot') ok = buySlot(g);
			if (ok) {
				host.sound(name === 'buy' || name === 'slot' ? 'upgrade' : 'click');
				host.afterBuy();
			} else host.sound('error');
		},
	});
}

/** One line on what a crew member does at a level. */
function crewText(id: CrewId, lv: number): string {
	const { role, per } = CREW[id];
	const pct = (n: number) => `+${Math.round(n * 100)}%`;
	const n = per * lv;
	switch (role) {
		case 'drill':
			return `Drills dig ${pct(n)} faster.`;
		case 'machine':
			return `Other machines work ${pct(n)} faster.`;
		case 'ship':
			return `Ships fly ${pct(n)} faster and carry ${pct(n / 3)} more.`;
		case 'sell':
			return `Cargo sells for ${pct(n)} more.`;
	}
}
