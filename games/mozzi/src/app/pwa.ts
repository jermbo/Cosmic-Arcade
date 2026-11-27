// Offline play (service worker), the install button and the "update ready" note.
// The same setup as Wordkin.

const UPDATE_CHECK_MS = 30 * 60 * 1000;

interface InstallEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<unknown>;
}

let installEvent: InstallEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let updateRequested = false;

/** True when the game runs as an installed app, not in a browser tab. */
export const isStandalone = () =>
	window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** True when the browser offers an install prompt we can show. */
export const canInstall = () => installEvent !== null;

export async function promptInstall() {
	const e = installEvent;
	if (!e) return;
	installEvent = null;
	e.prompt();
	try {
		await e.userChoice;
	} catch {
		// The prompt was closed.
	}
}

let started = false;

/** `changed` runs when the install button should show or hide. Safe to call twice (React StrictMode). */
export function setupPwa(changed: () => void) {
	if (started) return;
	started = true;
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		installEvent = e as InstallEvent;
		changed();
	});
	window.addEventListener('appinstalled', () => {
		installEvent = null;
		void navigator.storage?.persist?.();
		changed();
	});

	// Ask the browser to keep the save (coins, streak) even when storage runs low.
	if (isStandalone()) void navigator.storage?.persist?.();

	// The dev server has no service worker. Add ?dev to a build URL to turn it off too.
	const devMode = import.meta.env.DEV || new URLSearchParams(location.search).has('dev');
	if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
	if (devMode) {
		navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()));
		return;
	}

	const note = document.createElement('button');
	note.type = 'button';
	note.className = 'update-note';
	note.hidden = true;
	note.textContent = 'Update ready. Tap to reload.';
	document.body.append(note);
	note.addEventListener('click', () => {
		updateRequested = true;
		const waiting = registration?.waiting;
		if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
		else location.reload();
	});

	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (updateRequested) location.reload();
	});
	const start = async () => {
		try {
			registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
		} catch {
			// No service worker here (for example a private window). The game still plays.
			return;
		}
		const check = () => {
			if (registration?.waiting && navigator.serviceWorker.controller) note.hidden = false;
		};
		const track = (sw: ServiceWorker | null) => sw?.addEventListener('statechange', () => sw.state === 'installed' && check());
		check();
		track(registration.installing);
		registration.addEventListener('updatefound', () => track(registration!.installing));
		setInterval(() => registration?.update().catch(() => {}), UPDATE_CHECK_MS);
	};
	if (document.readyState === 'complete') void start();
	else window.addEventListener('load', () => void start());
}
