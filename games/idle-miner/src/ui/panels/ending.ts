// The ending panel, when the Star Beacon is lit.

import { fmt, fmtTime } from '../../core/format.ts';
import { closePanel, openPanel } from '../modal.ts';
import { host } from './host.ts';

export function openEnding() {
	openPanel({
		id: 'ending',
		title: 'The beacon is lit',
		render: () => {
			const g = host.game();
			return `<div class="away"><p>Light from your Star Beacon reaches every corner of the system. The cargo routes you built now carry ore from six worlds.</p>
			<div class="away__big">✦</div>
			<div class="stats"><div class="stat"><small>Play time</small><b>${fmtTime(g.stats.playTime)}</b></div><div class="stat"><small>Earned in all</small><b>${fmt(g.stats.allEarned)}</b></div><div class="stat"><small>Flights</small><b>${fmt(g.stats.flights)}</b></div><div class="stat"><small>Resets</small><b>${g.stats.resets}</b></div></div>
			<p>Thanks for playing. You can keep building, or go nova and grow even faster.</p>
			<button class="btn" style="width:100%" data-act="ok">Keep playing</button></div>`;
		},
		act: (name) => name === 'ok' && closePanel(),
	});
}
