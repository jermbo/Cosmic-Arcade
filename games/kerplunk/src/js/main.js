// Kerplunk starts here. This file sets up the page and runs the loop that draws every frame.
//
// The folders of js/:
//   rules/    the game rules, with no page code (they also run in Node for the tests)
//   play/     a game running in the page: the session, a move, power-ups, the end of a game
//   view/     drawing the game on the canvas
//   screens/  the HTML screens: title, HUD, boosts, shop, settings, tutorial, game over
//   input/    touch, mouse, keyboard, buttons and cheats
//   audio/    every sound, made in the browser
//   feel/     the numbers behind the motion and the sound, and the styles the shop sells
//   looks/    the themes
//   shop/     prices and the wallet rules
//   app/      page plumbing: storage, install, updates, the version
//   labs/     the secret lab pages (not part of the game)

import { audio } from './audio/sound-player.js';
import { LOW_TIME_SECONDS, LOUD_TICK_SECONDS } from './rules/timed-mode.js';
import { setShapes } from './rules/shapes/shape-list.js';
import { initLooks } from './looks/looks.js';
import { loadCustomShapes } from './app/storage.js';
import { state, view, save, runWaiters } from './play/session.js';
import { updateHud, updateWallet } from './screens/hud.js';
import { checkEnd } from './play/game-end.js';
import { pause } from './play/game-flow.js';
import { initTitle, buildLogo, updateBestLabels } from './screens/title.js';
import { initSettings } from './screens/settings-screen.js';
import { checkForUpdate } from './app/updates.js';
// These files set up their own event listeners when they load.
import './input/buttons.js';
import './input/pointer.js';
import './input/keyboard.js';
import './app/install.js';
import './input/cheats.js';

const MAX_FRAME_SECONDS = 0.05; // a slow frame never moves things more than this

useCustomShapes();
unlockAudioOnFirstTouch();
stopBrowserZoom();
pauseWhenHidden();
start();

/** Shapes saved from the secret shape lab replace the built-in list. */
function useCustomShapes() {
	const customShapes = loadCustomShapes();
	if (customShapes && setShapes(customShapes)) console.info('Kerplunk: playing with the custom shapes from the shape lab.');
}

/** Phones block sound until the first tap, so every tap and key tries to wake it. */
function unlockAudioOnFirstTouch() {
	for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

/** Stops the iOS pinch zoom and double-tap zoom. */
function stopBrowserZoom() {
	document.addEventListener('gesturestart', (event) => event.preventDefault());
	document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
}

/** The game pauses, and the sound stops, when the player leaves the page. */
function pauseWhenHidden() {
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			pause();
			audio.suspend();
			return;
		}
		audio.resume();
		checkForUpdate();
	});
	window.addEventListener('blur', pause);
}

function start() {
	window.addEventListener('resize', () => view.resize());
	if (window.visualViewport) window.visualViewport.addEventListener('resize', () => view.resize());
	initTitle();
	initSettings();
	updateWallet();
	audio.startMusic();
	view.resize();
	initLooks();
	buildLogo();
	updateBestLabels();
	save();
	requestAnimationFrame(frame);
}

// ---- the main loop ----

let lastFrameTime = performance.now();

function frame(now) {
	const dt = Math.min(MAX_FRAME_SECONDS, (now - lastFrameTime) / 1000);
	lastFrameTime = now;
	if (!state.paused) {
		view.update(dt);
		runClock(dt);
		runWaiters();
	}
	updateHud(dt);
	view.draw();
	requestAnimationFrame(frame);
}

/** Timed: the clock runs down, ticks near the end, and ends the game at 0. */
function runClock(dt) {
	if (state.screen !== 'playing' || state.mode !== 'timed' || state.timeLeft <= 0) return;
	state.timeLeft -= dt;
	const wholeSeconds = Math.ceil(state.timeLeft);
	if (wholeSeconds < state.lastTick && wholeSeconds <= LOW_TIME_SECONDS && wholeSeconds >= 0) audio.tick(wholeSeconds <= LOUD_TICK_SECONDS);
	state.lastTick = wholeSeconds;
	if (state.timeLeft > 0) return;
	state.timeLeft = 0;
	checkEnd();
}
