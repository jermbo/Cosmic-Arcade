// What the panels need from the rest of the game. main.ts gives it once, at boot.

import type { Game } from '../../core/game.ts';

export interface PanelHost {
	game: () => Game;
	sound: (name: 'buy' | 'error' | 'click' | 'upgrade') => void;
	toast: (text: string, kind?: string) => void;
	afterBuy: () => void;
	save: () => void;
	resetAll: () => void;
	loadGame: (g: Game) => void;
	prestige: () => void;
	toTitle: () => void;
	settingsChanged: () => void;
}

export let host: PanelHost;
export function initPanels(h: PanelHost) {
	host = h;
}
