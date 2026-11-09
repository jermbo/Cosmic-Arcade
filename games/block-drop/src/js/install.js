// Install help: the install button, the iPhone hint, and the link back to the arcade.

import { store } from './storage.js';
import { $ } from './dom.js';
import { save } from './session.js';

let installEvent = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
	e.preventDefault();
	installEvent = e;
	$('install-button').hidden = false;
});

window.addEventListener('appinstalled', () => {
	installEvent = null;
	$('install-button').hidden = true;
});

$('install-button').addEventListener('click', async () => {
	if (!installEvent) return;
	installEvent.prompt();
	try {
		await installEvent.userChoice;
	} catch {
		// The prompt was closed.
	}
	installEvent = null;
	$('install-button').hidden = true;
});

if (isIOS && !isStandalone() && !store.iosHintDismissed) $('ios-hint').hidden = false;
if (location.pathname.includes('/play/') && !isStandalone()) $('arcade-link').hidden = false;

export function dismissIosHint() {
	$('ios-hint').hidden = true;
	store.iosHintDismissed = true;
	save();
}
