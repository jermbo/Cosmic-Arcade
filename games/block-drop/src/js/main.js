// Glintwell: starts the game, and runs the loop that draws every frame.

import { audio } from './audio.js';
import { LOW_TIME_SECONDS, LOUD_TICK_SECONDS } from './engine.js';
import { setShapes } from './shape-list.js';
import { skinById } from './shop.js';
import { paintPalette } from './sprites.js';
import { store, loadCustomShapes } from './storage.js';
import { state, view, save, runWaiters } from './session.js';
import { updateHud, updateWallet } from './hud.js';
import { checkEnd } from './ending.js';
import { pause } from './flow.js';
import { initTitle, buildLogo, updateBestLabels } from './title.js';
import { initSettings } from './settings.js';
import { checkForUpdate } from './updates.js';
import './actions.js';
import './pointer.js';
import './keyboard.js';
import './install.js';
import './cheats.js';

// Shapes saved from the secret shape lab replace the built-in list.
const customShapes = loadCustomShapes();
const usingCustomShapes = Boolean(customShapes) && setShapes(customShapes);
if (usingCustomShapes) console.info('Glintwell: playing with the custom shapes from the shape lab.');

paintPalette(skinById(store.perks.skin).colors);

// ---- audio unlock ----

function unlockAudio() {
	audio.unlock();
}
for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, unlockAudio, { capture: true, passive: true });

// Stop iOS pinch zoom and double-tap zoom.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ---- page visibility ----

document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		pause();
		audio.suspend();
	} else {
		audio.resume();
		checkForUpdate();
	}
});
window.addEventListener('blur', pause);

// ---- main loop ----

let last = performance.now();
function frame(now) {
	const dt = Math.min(0.05, (now - last) / 1000);
	last = now;
	if (!state.paused) {
		view.update(dt);
		if (state.screen === 'playing' && state.mode === 'timed' && state.timeLeft > 0) {
			state.timeLeft -= dt;
			const whole = Math.ceil(state.timeLeft);
			if (whole < state.lastTick && whole <= LOW_TIME_SECONDS && whole >= 0) audio.tick(whole <= LOUD_TICK_SECONDS);
			state.lastTick = whole;
			if (state.timeLeft <= 0) {
				state.timeLeft = 0;
				checkEnd();
			}
		}
		runWaiters();
	}
	updateHud(dt);
	view.draw();
	requestAnimationFrame(frame);
}

// ---- boot ----

window.addEventListener('resize', () => view.resize());
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => view.resize());

initTitle();
initSettings();
updateWallet();
audio.startMusic();
view.resize();
buildLogo();
updateBestLabels();
save();
requestAnimationFrame(frame);
