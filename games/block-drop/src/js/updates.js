// The service worker: offline play, and the "Update ready" toast.

import { $ } from './dom.js';

const UPDATE_CHECK_MS = 30 * 60 * 1000;

let updateRequested = false;
let registration = null;

function showUpdateToast() {
	$('update-toast').hidden = false;
}

$('update-toast').addEventListener('click', () => {
	const waiting = registration && registration.waiting;
	updateRequested = true;
	if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
	else location.reload();
});

// Add ?dev to the URL to turn the offline cache off while you edit files.
const devMode = new URLSearchParams(location.search).has('dev');
if (devMode && 'serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()));
	if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

if ('serviceWorker' in navigator && window.isSecureContext && !devMode) {
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		// The first install also changes the controller; only reload when the player asked.
		if (updateRequested) location.reload();
	});
	window.addEventListener('load', async () => {
		try {
			registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
		} catch {
			// No service worker here (for example in a private window): the game plays without offline mode.
			return;
		}
		const check = () => {
			if (registration.waiting && navigator.serviceWorker.controller) showUpdateToast();
		};
		// The update can start before this code runs, so also watch a worker that is already installing.
		const track = (sw) => sw && sw.addEventListener('statechange', () => sw.state === 'installed' && check());
		check();
		track(registration.installing);
		registration.addEventListener('updatefound', () => track(registration.installing));
		// A failed check means the network is down. The next check tries again.
		setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS);
	});
}

/** Asks the browser to look for a new version now. */
export function checkForUpdate() {
	// A failed check means the network is down. The next check tries again.
	if (registration) registration.update().catch(() => {});
}
