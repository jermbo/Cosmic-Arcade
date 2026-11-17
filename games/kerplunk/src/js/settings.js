// Settings: sound, vibration, shake, and the Lab choices.

import { DEFAULT_LAB } from './engine.js';
import { audio } from './audio.js';
import { store } from './storage.js';
import { $, showModal, hideModals } from './dom.js';
import { state, view, save } from './session.js';
import { updateBestLabels } from './title.js';

export function openSettings() {
	state.modalReturn = state.screen === 'title' ? 'title' : 'screen-pause';
	syncSettings();
	showModal('screen-settings');
	$('screen-title').hidden = true;
}

export function closeSettings() {
	if (state.modalReturn === 'title') {
		hideModals();
		$('screen-title').hidden = false;
	} else {
		showModal(state.modalReturn);
	}
}

export function syncSettings() {
	for (const input of document.querySelectorAll('[data-setting]')) input.checked = Boolean(store.settings[input.dataset.setting]);
	for (const input of document.querySelectorAll('.lab input[type=radio]')) {
		input.checked = String(store.lab[input.name]) === input.value;
	}
}

export function applySettings() {
	audio.setSfx(store.settings.sfx);
	audio.setMusic(store.settings.music);
	view.fx.shakeOn = store.settings.shake;
}

document.addEventListener('change', (e) => {
	const input = e.target;
	if (input.dataset.setting) {
		store.settings[input.dataset.setting] = input.checked;
		applySettings();
		save();
		audio.ui();
	} else if (input.closest('.lab')) {
		let value = input.value;
		if (input.name === 'pieces') value = Number(value);
		store.lab[input.name] = value;
		save();
		audio.ui();
	}
});

export function initSettings() {
	$('vibrate-row').hidden = !('vibrate' in navigator);
	applySettings();
}

export function resetLab() {
	store.lab = { ...DEFAULT_LAB };
	save();
	syncSettings();
}

const RESET_DONE_MS = 1500; // how long "Best scores reset" stays on the button
const RESET_ARMED_MS = 3000; // how long the button waits for the second tap

/** The first tap arms the button, and a second tap resets the best scores. */
export function resetBest() {
	const b = $('reset-best');
	if (b.dataset.armed) {
		store.best = { endless: 0, timed: 0 };
		save();
		updateBestLabels();
		b.textContent = 'Best scores reset';
		delete b.dataset.armed;
		setTimeout(() => (b.textContent = 'Reset best scores'), RESET_DONE_MS);
	} else {
		b.dataset.armed = '1';
		b.textContent = 'Tap again to reset';
		setTimeout(() => {
			if (b.dataset.armed) {
				delete b.dataset.armed;
				b.textContent = 'Reset best scores';
			}
		}, RESET_ARMED_MS);
	}
}
