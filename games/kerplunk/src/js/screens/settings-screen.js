// The settings screen: sound, vibration, shake, the Lab choices, and resetting the best scores.

import { DEFAULT_LAB } from '../rules/game-settings.js';
import { audio } from '../audio/sound-player.js';
import { store } from '../app/storage.js';
import { $, showModal, hideModals } from '../app/dom.js';
import { state, view, save } from '../play/session.js';
import { updateBestLabels } from './title.js';

const RESET_DONE_MS = 1500; // how long "Best scores reset" stays on the button
const RESET_ARMED_MS = 3000; // how long the button waits for the second tap
const RESET_LABEL = 'Reset best scores';

export function openSettings() {
	state.modalReturn = state.screen === 'title' ? 'title' : 'screen-pause';
	syncSettings();
	showModal('screen-settings');
	$('screen-title').hidden = true;
}

export function closeSettings() {
	if (state.modalReturn !== 'title') {
		showModal(state.modalReturn);
		return;
	}
	hideModals();
	$('screen-title').hidden = false;
}

/** Shows the saved settings on the switches and radio buttons. */
export function syncSettings() {
	for (const input of document.querySelectorAll('[data-setting]')) input.checked = Boolean(store.settings[input.dataset.setting]);
	for (const input of document.querySelectorAll('.lab input[type=radio]')) input.checked = String(store.lab[input.name]) === input.value;
}

/** Puts the settings to work: sound, music and shake. */
export function applySettings() {
	audio.setSfx(store.settings.sfx);
	audio.setMusic(store.settings.music);
	view.effects.shakeOn = store.settings.shake;
}

document.addEventListener('change', (event) => {
	const input = event.target;
	if (input.dataset.setting) changeSetting(input);
	else if (input.closest('.lab')) changeLabChoice(input);
});

function changeSetting(input) {
	store.settings[input.dataset.setting] = input.checked;
	applySettings();
	save();
	audio.ui();
}

function changeLabChoice(input) {
	store.lab[input.name] = input.name === 'pieces' ? Number(input.value) : input.value;
	save();
	audio.ui();
}

export function initSettings() {
	$('vibrate-row').hidden = !('vibrate' in navigator);
	applySettings();
}

export function resetLab() {
	store.lab = { ...DEFAULT_LAB };
	save();
	syncSettings();
}

/** The first tap arms the button, and a second tap resets the best scores. */
export function resetBest() {
	const button = $('reset-best');
	if (button.dataset.armed) confirmReset(button);
	else armReset(button);
}

function armReset(button) {
	button.dataset.armed = '1';
	button.textContent = 'Tap again to reset';
	setTimeout(() => {
		if (!button.dataset.armed) return;
		delete button.dataset.armed;
		button.textContent = RESET_LABEL;
	}, RESET_ARMED_MS);
}

function confirmReset(button) {
	store.best = { endless: 0, timed: 0 };
	save();
	updateBestLabels();
	button.textContent = 'Best scores reset';
	delete button.dataset.armed;
	setTimeout(() => (button.textContent = RESET_LABEL), RESET_DONE_MS);
}
