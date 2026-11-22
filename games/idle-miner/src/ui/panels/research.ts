// The research panel: upgrades that help every planet.

import { RESEARCH } from '../../content/research.ts';
import type { ResearchId } from '../../content/research.ts';
import { BELT_SPEED } from '../../content/machines.ts';
import { anyMet } from '../../core/checks.ts';
import { grantsPower, statAdd } from '../../core/effects.ts';
import { fmt } from '../../core/format.ts';
import { tapValue } from '../../core/hand-mining.ts';
import { researchCost } from '../../core/prices.ts';
import { buyResearch } from '../../core/shop.ts';
import { offlineCapHours } from '../../core/tick.ts';
import type { Game } from '../../core/game.ts';
import { closePanel, openPanel } from '../modal.ts';
import { buyButton } from './buy-button.ts';
import { openEnding } from './ending.ts';
import { host } from './host.ts';

export function openResearch() {
	openPanel({
		id: 'research',
		title: 'Research',
		render: () => {
			const g = host.game();
			const ids = (Object.keys(RESEARCH) as ResearchId[]).filter((id) => {
				const shownWhen = RESEARCH[id].shownWhen;
				return !shownWhen || anyMet(g, shownWhen);
			});
			const rows = ids
				.map((id) => {
					const def = RESEARCH[id];
					const lv = g.research[id];
					const cost = researchCost(g, id);
					const maxed = lv >= def.max;
					const level = def.max > 1 ? `<small>Lv ${lv}/${def.max}</small>` : maxed ? `<small>${def.doneLabel ?? 'Done'}</small>` : '';
					return `<div class="row ${maxed ? 'row--done' : ''}"><div><div class="row__name">${def.name}${level}</div><div class="row__desc">${def.desc}${effect(g, id)}</div></div>${buyButton('research', id, cost, g.credits >= cost, maxed)}</div>`;
				})
				.join('');
			return `<p>Upgrades here help every planet.</p><div class="rows">${rows}</div>`;
		},
		act: (name, el) => {
			if (name !== 'research') return;
			const g = host.game();
			const id = el.dataset.arg as ResearchId;
			if (buyResearch(g, id)) {
				host.sound('upgrade');
				host.afterBuy();
				if (grantsPower(RESEARCH[id].effects, 'lightBeacon')) {
					closePanel();
					openEnding();
				}
			} else host.sound('error');
		},
	});
}

/** A line on what the research gives now, from its first effect. */
function effect(g: Game, id: ResearchId) {
	const first = RESEARCH[id].effects[0];
	if (!first) return '';
	if ('power' in first) {
		if (first.power !== 'blastRocks') return '';
		const n = g.blasted.reduce((t, a) => t + a.length, 0);
		return n ? ` Rocks cleared: ${n}.` : '';
	}
	if (!('stat' in first)) return '';
	switch (first.stat) {
		case 'tapPower':
			return ` Now: each tap gives ${fmt(tapValue(g, topPlanet(g)))}.`;
		case 'beltSpeed':
			// Research only: the speed before perks.
			return ` Now: ${(BELT_SPEED + statAdd(g, 'beltSpeed')).toFixed(1)} tiles/s.`;
		case 'sales':
			return ` Now: +${Math.round(statAdd(g, 'sales') * 100)}%.`;
		case 'awayHours':
			return ` Now: ${offlineCapHours(g)} hours.`;
		default:
			return '';
	}
}

export function topPlanet(g: Game) {
	let top = 0;
	g.planets.forEach((p, i) => p.unlocked && (top = i));
	return top;
}
