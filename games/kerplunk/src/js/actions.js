// Connects each button (its data-action) to what it does.

import { audio } from './audio.js';
import { $, hideModals } from './dom.js';
import { app, state } from './session.js';
import { startGame, beginGame, quitToTitle, pause, resume } from './flow.js';
import { toggleWarmup, togglePower, openBanPicker, clearBan, canPayBoosts, pickedBoosts, payBoosts } from './boosts.js';
import { openShop } from './shop-screen.js';
import { rerollTray, rerollFromOver, extendTime, secondWind } from './second-chances.js';
import { openSettings, closeSettings, resetLab, resetBest } from './settings.js';
import { openTutorial, tutorialStep, closeTutorial } from './tutorial.js';
import { dismissIosHint } from './install.js';

const actions = {
	'play-daily': () => startGame('daily'),
	shop: openShop,
	'shop-back': () => hideModals(),
	reroll: rerollTray,
	'reroll-over': rerollFromOver,
	'extend-time': extendTime,
	'start-warmup': toggleWarmup,
	'start-power': (btn) => togglePower(btn.dataset.kind),
	'start-ban': openBanPicker,
	'ban-none': clearBan,
	'start-go': () => {
		if (!canPayBoosts()) return audio.deny();
		const boosts = pickedBoosts();
		payBoosts();
		beginGame(state.pendingMode, boosts);
	},
	'start-skip': () => beginGame(state.pendingMode, null),
	'second-wind': secondWind,
	'play-endless': () => startGame('endless'),
	'play-timed': () => startGame('timed'),
	resume,
	restart: () => startGame(state.mode),
	quit: quitToTitle,
	settings: () => openSettings(),
	'close-settings': () => closeSettings(),
	tutorial: () => openTutorial(),
	'tutorial-next': () => tutorialStep(1),
	'tutorial-skip': () => closeTutorial(),
	'dismiss-ios': dismissIosHint,
	'lab-reset': resetLab,
	'reset-best': resetBest,
};

app.addEventListener('click', (e) => {
	const btn = e.target.closest('[data-action]');
	if (!btn || !actions[btn.dataset.action]) return;
	audio.ui();
	actions[btn.dataset.action](btn);
});

$('pause-button').addEventListener('click', () => {
	audio.ui();
	pause();
});
