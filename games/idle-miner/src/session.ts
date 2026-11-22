// The running game and the screen it is on. The files of the UI share it.

import type { Game } from './core/game.ts';
import { clearPlanetTileCache } from './core/planet-map.ts';
import { loadGame } from './core/save.ts';
import { newGame } from './core/state.ts';

clearPlanetTileCache();
const saved = loadGame();

export const session = {
	g: saved ?? newGame(),
	hadSave: !!saved,
	started: false,
	view: 'space' as 'space' | 'planet',
	/** The size of the screen in CSS pixels, and the pixel ratio of the canvas. */
	W: 0,
	H: 0,
	dpr: 1,
	/** Seconds since the page opened, for animation. */
	time: 0,
	/** The credits the HUD shows. They count up to the real number. */
	shownCredits: 0,
	/** A white flash over the screen, in seconds left. */
	flash: 0,
	/** A fake game that runs behind the title screen. */
	demo: null as Game | null,
};
session.shownCredits = session.g.credits;
