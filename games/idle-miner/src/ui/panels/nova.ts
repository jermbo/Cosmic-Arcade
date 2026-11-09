// The Nova Reset panel: reset the run for stardust, and spend stardust on perks.

import { DUST_BONUS, NOVA_KIT, PRESTIGE_PLANET, STARDUST } from '../../content/nova.ts';
import { PERKS } from '../../content/perks.ts';
import type { PerkId } from '../../content/perks.ts';
import { PLANETS } from '../../content/planets.ts';
import { statAdd } from '../../core/effects.ts';
import { fmt } from '../../core/format.ts';
import { planetIndex } from '../../core/planet-id.ts';
import { buyPerk, canPrestige, perkPoints, prestigeGain } from '../../core/nova.ts';
import { closePanel, openPanel } from '../modal.ts';
import { host } from './host.ts';

export function openNova() {
	openPanel({
		id: 'nova',
		title: 'Nova Reset',
		render: () => {
			const g = host.game();
			const gain = prestigeGain(g);
			const ready = canPrestige(g);
			const bonus = Math.round(g.stardust * DUST_BONUS * 100);
			const points = perkPoints(g);
			let top = `<div class="stats">
				<div class="stat"><small>Stardust</small><b>✦ ${g.stardust}</b></div>
				<div class="stat"><small>Sales bonus</small><b>+${bonus}%</b></div>
				<div class="stat"><small>Reset now for</small><b>✦ ${gain}</b></div>
			</div>`;
			if (!g.planets[planetIndex(PRESTIGE_PLANET)].unlocked && g.stats.resets === 0) {
				top = `<p>Unlock <b>${PLANETS[planetIndex(PRESTIGE_PLANET)].name}</b> to use the Nova Reset.</p>`;
			} else {
				top += `<p>A Nova Reset starts a new run: planets, machines, ships, credits and research go back to zero. You get stardust for what you earned this run. Each stardust adds <b>+${DUST_BONUS * 100}%</b> to all sales, forever, and <b>${fmt(NOVA_KIT)}</b> starting credits to each new run.</p>`;
				top += `<button class="btn btn--gold" style="width:100%" data-act="reset" ${ready ? '' : 'disabled'}>${ready ? `Reset for ✦ ${gain} stardust` : `Earn more first (✦ 1 at ${fmt(STARDUST.firstAt)} this run)`}</button>`;
			}
			const perks = (Object.keys(PERKS) as PerkId[])
				.map((id) => {
					const def = PERKS[id];
					const owned = !!g.perks[id];
					return `<div class="perk ${owned ? 'is-owned' : ''}"><b>${def.name}</b><span>${def.desc}</span>${owned ? '<span>Owned</span>' : `<button class="btn btn--small btn--gold" data-act="perk" data-arg="${id}" ${points >= def.cost ? '' : 'disabled'}>✦ ${def.cost}</button>`}</div>`;
				})
				.join('');
			return `${top}<h3 style="margin:18px 0 0">Perks <small style="color:var(--muted);font-weight:500">· ✦ ${points} free to spend</small></h3><p style="margin-top:4px">Perks cost stardust but keep its sales bonus. They stay through resets. Stardust also buys crew slots.</p><div class="perks">${perks}</div>`;
		},
		act: (name, el) => {
			const g = host.game();
			if (name === 'perk') {
				if (buyPerk(g, el.dataset.arg as PerkId)) {
					host.sound('upgrade');
					host.afterBuy();
				} else host.sound('error');
			}
			if (name === 'reset') confirmNova();
		},
	});
}

function confirmNova() {
	const g = host.game();
	const gain = prestigeGain(g);
	openPanel({
		id: 'nova-confirm',
		title: 'Go nova?',
		render: () => `<p>Your run resets. You keep stardust, perks and stats.</p><p>You get <b>✦ ${gain}</b>. All sales will be <b>+${Math.round((g.stardust + gain) * DUST_BONUS * 100)}%</b>, and the next run starts with <b>${fmt((g.stardust + gain) * NOVA_KIT + statAdd(g, 'startCredits'))}</b> credits.</p><div class="card__row"><button class="btn btn--ghost" data-act="no">Not yet</button><button class="btn btn--gold" data-act="yes">Go nova</button></div>`,
		act: (name) => {
			if (name === 'no') openNova();
			if (name === 'yes') {
				closePanel();
				host.prestige();
			}
		},
	});
}
