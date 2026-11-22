// Connects each button of the page to what it does. A button names its job in its data-action
// attribute (for example <button data-action="play-timed">), and this list finds the function.

import { audio } from '../audio/sound-player.js';
import { $, hideModals } from '../app/dom.js';
import { app, state } from '../play/session.js';
import { startGame, beginGame, quitToTitle, pause, resume } from '../play/game-flow.js';
import { toggleWarmup, togglePower, openBanPicker, clearBan, canPayBoosts, pickedBoosts, payBoosts } from '../screens/boosts-screen.js';
import { openShop } from '../screens/shop/shop-screen.js';
import { rerollTray, rerollFromOver, extendTime, secondWind } from '../play/second-chances.js';
import { openSettings, closeSettings, resetLab, resetBest } from '../screens/settings-screen.js';
import { openTutorial, tutorialStep, closeTutorial } from '../screens/tutorial/tutorial.js';
import { dismissIosHint } from '../app/install.js';

const ACTIONS = {
	// The title screen
	'play-endless': () => startGame('endless'),
	'play-timed': () => startGame('timed'),
	shop: openShop,
	'shop-back': () => hideModals(),
	settings: () => openSettings(),
	tutorial: () => openTutorial(),
	'dismiss-ios': dismissIosHint,

	// The boosts screen
	'start-warmup': toggleWarmup,
	'start-power': (button) => togglePower(button.dataset.kind),
	'start-ban': openBanPicker,
	'ban-none': clearBan,
	'start-go': startWithBoosts,
	'start-skip': () => beginGame(state.pendingMode, null),

	// During a game, the pause screen and the game over screen
	reroll: rerollTray,
	'reroll-over': rerollFromOver,
	'extend-time': extendTime,
	'second-wind': secondWind,
	resume,
	restart: () => startGame(state.mode),
	quit: quitToTitle,

	// The settings and the tutorial
	'close-settings': () => closeSettings(),
	'lab-reset': resetLab,
	'reset-best': resetBest,
	'tutorial-next': () => tutorialStep(1),
	'tutorial-skip': () => closeTutorial(),
};

function startWithBoosts() {
	if (!canPayBoosts()) return audio.deny();
	const boosts = pickedBoosts();
	payBoosts();
	beginGame(state.pendingMode, boosts);
}

app.addEventListener('click', (event) => {
	const button = event.target.closest('[data-action]');
	if (!button || !ACTIONS[button.dataset.action]) return;
	audio.ui();
	ACTIONS[button.dataset.action](button);
});

$('pause-button').addEventListener('click', () => {
	audio.ui();
	pause();
});
