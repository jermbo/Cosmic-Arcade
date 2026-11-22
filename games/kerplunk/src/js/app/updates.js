// The service worker: offline play, and the "Update ready" toast.
// Add ?dev to the URL to turn the offline cache off while you edit files.

import { $ } from './dom.js';

const UPDATE_CHECK_MS = 30 * 60 * 1000;
const devMode = new URLSearchParams(location.search).has('dev');
const canUseServiceWorker = 'serviceWorker' in navigator;

let updateRequested = false;
let registration = null;

$('update-toast').addEventListener('click', () => {
	const waiting = registration && registration.waiting;
	updateRequested = true;
	if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
	else location.reload();
});

if (devMode && canUseServiceWorker) removeOfflineCache();
if (canUseServiceWorker && window.isSecureContext && !devMode) {
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		// The first install also changes the controller; only reload when the player asked.
		if (updateRequested) location.reload();
	});
	window.addEventListener('load', registerWorker);
}

function removeOfflineCache() {
	navigator.serviceWorker.getRegistrations().then((list) => list.forEach((worker) => worker.unregister()));
	if (window.caches) caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}

async function registerWorker() {
	try {
		registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
	} catch {
		// No service worker here (for example in a private window): the game plays without offline mode.
		return;
	}
	showToastIfWaiting();
	// The update can start before this code runs, so also watch a worker that is already installing.
	watchInstall(registration.installing);
	registration.addEventListener('updatefound', () => watchInstall(registration.installing));
	setInterval(checkForUpdate, UPDATE_CHECK_MS);
}

function showToastIfWaiting() {
	if (registration.waiting && navigator.serviceWorker.controller) $('update-toast').hidden = false;
}

function watchInstall(worker) {
	if (!worker) return;
	worker.addEventListener('statechange', () => {
		if (worker.state === 'installed') showToastIfWaiting();
	});
}

/** Asks the browser to look for a new version now. */
export function checkForUpdate() {
	// A failed check means the network is down. The next check tries again.
	if (registration) registration.update().catch(() => {});
}
