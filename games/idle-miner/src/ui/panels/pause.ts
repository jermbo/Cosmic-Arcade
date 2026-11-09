// The pause panel: stats, and the way to help, settings and the title.

import { fmt, fmtTime } from '../../core/format.ts';
import { closePanel, openPanel } from '../modal.ts';
import { host } from './host.ts';
import { openHow } from './how-to-play.ts';
import { openSettings } from './settings.ts';

export function openPause() {
	openPanel({
		id: 'pause',
		title: 'Paused',
		render: () => {
			const g = host.game();
			return `<div class="stats">
				<div class="stat"><small>Play time</small><b>${fmtTime(g.stats.playTime)}</b></div>
				<div class="stat"><small>Earned in all</small><b>${fmt(g.stats.allEarned)}</b></div>
				<div class="stat"><small>Flights</small><b>${fmt(g.stats.flights)}</b></div>
				<div class="stat"><small>Items sold</small><b>${fmt(g.stats.shipped)}</b></div>
			</div>
			<div class="menu-list">
				<button class="btn" data-act="resume">Resume</button>
				<button class="btn btn--ghost" data-act="how">How to play</button>
				<button class="btn btn--ghost" data-act="settings">Settings and save</button>
				<button class="btn btn--ghost" data-act="title">Title screen</button>
			</div>`;
		},
		act: (name) => {
			if (name === 'resume') closePanel();
			if (name === 'how') openHow();
			if (name === 'settings') openSettings();
			if (name === 'title') {
				closePanel();
				host.toTitle();
			}
		},
	});
}
