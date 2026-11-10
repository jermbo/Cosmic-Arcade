// The two views that draw the game: the space map and the planet.

import { sfx } from './audio.ts';
import { saveGame } from './core/save.ts';
import { PlanetView } from './view/planet.ts';
import { SpaceView } from './view/space.ts';
import { session } from './session.ts';
import { select, updateInspect } from './ui/inspect.ts';
import { relayout, updatePlanetHeader } from './ui/screens.ts';
import { toast } from './ui/toasts.ts';
import { updateToolbar } from './ui/toolbar.ts';

export const space = new SpaceView();

export const pv = new PlanetView({
	sound: (n) => sfx[n](),
	toast: (t) => toast(t, 'warn'),
	select: (c) => select(c),
	changed: () => {
		updateInspect();
		updateToolbar();
		relayout();
		updatePlanetHeader();
	},
	expanded: () => {
		sfx.unlock();
		saveGame(session.g);
		relayout();
		updatePlanetHeader();
	},
});
