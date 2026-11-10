// The ships panel of a planet: more ships, faster engines, bigger holds.

import { PLANETS } from '../../content/planets.ts';
import { SHIP, SHIP_UPS } from '../../content/ships.ts';
import type { ShipUpgrade } from '../../content/ships.ts';
import { shipUpCost } from '../../core/prices.ts';
import { shipCap, travelTime } from '../../core/ships.ts';
import { buyShipUp } from '../../core/shop.ts';
import { openPanel } from '../modal.ts';
import { buyButton } from './buy-button.ts';
import { host } from './host.ts';

export function openShips(pi: number) {
	openPanel({
		id: 'ships',
		title: `${PLANETS[pi].name} ships`,
		render: () => {
			const g = host.game();
			const p = g.planets[pi];
			const cap = shipCap(p);
			const trip = travelTime(p, pi) * 2 + SHIP.wait;
			const flow = (p.ships.length * cap) / trip;
			const stats = `<div class="stats">
				<div class="stat"><small>Ships</small><b>${p.ships.length}</b></div>
				<div class="stat"><small>Cargo each</small><b>${cap}</b></div>
				<div class="stat"><small>Round trip</small><b>${trip.toFixed(1)}s</b></div>
				<div class="stat"><small>Can move</small><b>${flow.toFixed(1)}/s</b></div>
			</div>`;
			const rows = (['ships', 'speed', 'cargo'] as ShipUpgrade[])
				.map((u) => {
					const def = SHIP_UPS[u];
					const lv = p.up[u];
					const cost = shipUpCost(g, pi, u);
					const maxed = lv >= def.max;
					return `<div class="row ${maxed ? 'row--done' : ''}"><div><div class="row__name">${def.name}<small>Lv ${lv}/${def.max}</small></div><div class="row__desc">${def.desc}</div></div>${buyButton('ship', u, cost, g.credits >= cost, maxed)}</div>`;
				})
				.join('');
			const full = p.pad.length > 30;
			return `${stats}<p>${full ? '<b style="color:#ff8a9c">The pad is backing up.</b> Ships cannot keep up. ' : ''}Ships load at the launch pad and fly cargo home to sell.</p><div class="rows">${rows}</div>`;
		},
		act: (name, el) => {
			if (name !== 'ship') return;
			if (buyShipUp(host.game(), pi, el.dataset.arg as ShipUpgrade)) {
				host.sound('buy');
				host.afterBuy();
			} else host.sound('error');
		},
	});
}
