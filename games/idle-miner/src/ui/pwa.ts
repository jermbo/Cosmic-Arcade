// Offline play (service worker), the "update ready" toast and the install button.

const UPDATE_CHECK_MS = 30 * 60 * 1000;

interface InstallEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<unknown>;
}

let installEvent: InstallEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let updateRequested = false;

export function setupPwa() {
	const installBtn = document.getElementById('btn-install')!;
	const updateToast = document.getElementById('update-toast')!;
	const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		installEvent = e as InstallEvent;
		installBtn.hidden = false;
	});
	window.addEventListener('appinstalled', () => {
		installEvent = null;
		installBtn.hidden = true;
	});
	installBtn.addEventListener('click', async () => {
		if (!installEvent) return;
		installEvent.prompt();
		try {
			await installEvent.userChoice;
		} catch {
			// The prompt was closed.
		}
		installEvent = null;
		installBtn.hidden = true;
	});

	if (location.pathname.includes('/play/') && !isStandalone()) document.getElementById('arcade-link')!.hidden = false;

	updateToast.addEventListener('click', () => {
		updateRequested = true;
		const waiting = registration?.waiting;
		if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
		else location.reload();
	});

	// The dev server has no service worker. Add ?dev to a build URL to turn it off too.
	const devMode = import.meta.env.DEV || new URLSearchParams(location.search).has('dev');
	if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
	if (devMode) {
		navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()));
		return;
	}
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (updateRequested) location.reload();
	});
	window.addEventListener('load', async () => {
		try {
			registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
		} catch {
			// No service worker here (for example a private window). The game still plays.
			return;
		}
		const check = () => {
			if (registration?.waiting && navigator.serviceWorker.controller) updateToast.hidden = false;
		};
		const track = (sw: ServiceWorker | null) => sw?.addEventListener('statechange', () => sw.state === 'installed' && check());
		check();
		track(registration.installing);
		registration.addEventListener('updatefound', () => track(registration!.installing));
		setInterval(() => registration?.update().catch(() => {}), UPDATE_CHECK_MS);
	});
}
