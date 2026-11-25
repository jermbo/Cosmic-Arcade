// The end of a run: night falls over the field, then the score and the payout.

import { art } from '../../art/index.ts';
import type { SkyView } from '../../art/types.ts';
import { WORLD } from '../../rules/data/balance.ts';
import { clearLayers, onBack } from '../../ui/dom.ts';
import { summaryPanel, upgradesPanel } from '../../ui/panels.ts';
import { music, sfx } from '../audio.ts';
import { goTitle, startNewRun } from '../flow.ts';
import { k, sceneSetup, visibleWorld } from '../k.ts';
import { game, persist } from '../state.ts';

export function summaryScene() {
	sceneSetup();
	clearLayers();
	const run = game.save.run;
	if (!run || !run.result) {
		goTitle();
		return;
	}
	const won = run.result === 'won';
	const act = Math.min(2, run.act);
	const best = game.save.meta.best?.score === run.score && run.score > 0;
	// The run is over: it leaves the save now. The summary keeps its own copy.
	game.save.run = null;
	persist();
	let time = 0;
	const sky: SkyView = { act, dusk: won ? 0.75 : 1, time: 0, view: visibleWorld(), dim: won ? 0 : 0.2, seed: 3 };
	music(act, false);
	document.documentElement.style.setProperty('--accent', art.palette(act).accent);
	if (won) setTimeout(() => sfx('win'), 300);

	k.add([
		{
			draw() {
				sky.view = visibleWorld();
				sky.view.x -= 30;
				sky.view.y -= 30;
				sky.view.w += 60;
				sky.view.h += 60;
				sky.time = time;
				art.sky(sky);
				art.land(sky);
				art.archer({ x: WORLD.archerX + 30, y: WORLD.groundY - 12, angle: won ? -1.2 : 0.3, pull: 0, sinceShot: 9, sinceHurt: 9, time, act, bonus: won ? 'crown' : null, dead: !won, sinceDead: 5 });
			},
		},
	]);
	k.onUpdate(() => (time += k.dt()));

	const show = () =>
		summaryPanel(run, best, {
			upgrades: () => upgradesPanel(show),
			again: () => startNewRun(show),
			title: () => goTitle(),
		});
	setTimeout(show, 700);
	onBack(() => goTitle());
}
