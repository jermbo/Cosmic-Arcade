// The panel that says what the factories made while the player was away.

import { fmt, fmtTime } from '../../core/format.ts';
import { closePanel, openPanel } from '../modal.ts';

export function openAway(r: { away: number; counted: number; earned: number; shipped: number; flights: number }, capHours: number) {
	const capped = r.counted < r.away;
	openPanel({
		id: 'away',
		title: 'While you were away',
		render: () => `<div class="away">
			<p>You were gone for <b>${fmtTime(r.away)}</b>. Your factories kept working.</p>
			<div class="away__big">+${fmt(r.earned)}</div>
			<div class="stats"><div class="stat"><small>Flights home</small><b>${fmt(r.flights)}</b></div><div class="stat"><small>Items sold</small><b>${fmt(r.shipped)}</b></div></div>
			${capped ? `<p>Only the first <b>${capHours} hours</b> count. Research Night Shift to work longer.</p>` : ''}
			<button class="btn btn--gold btn--big" style="width:100%" data-act="ok">Collect</button>
		</div>`,
		act: (name) => name === 'ok' && closePanel(),
	});
}
