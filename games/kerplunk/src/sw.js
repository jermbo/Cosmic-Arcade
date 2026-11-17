// Offline cache for Glintwell. Bump VERSION (and js/version.js) for each release.
// A new VERSION makes a new cache; the page then shows "Update ready, tap to reload".

const VERSION = '1.12.0';
const CACHE = `glintwell-${VERSION}`;
const FILES = [
	'./',
	'index.html',
	'manifest.webmanifest',
	'css/base.css',
	'css/hud.css',
	'css/button.css',
	'css/screen.css',
	'css/panel.css',
	'css/settings.css',
	'css/tutorial.css',
	'css/shop.css',
	'css/notice.css',
	'js/main.js',
	'js/actions.js',
	'js/pointer.js',
	'js/keyboard.js',
	'js/flow.js',
	'js/move.js',
	'js/ending.js',
	'js/over-screen.js',
	'js/powers.js',
	'js/boosts.js',
	'js/shop-screen.js',
	'js/second-chances.js',
	'js/settings.js',
	'js/tutorial.js',
	'js/tutorial-art.js',
	'js/install.js',
	'js/updates.js',
	'js/cheats.js',
	'js/dom.js',
	'js/session.js',
	'js/daily.js',
	'js/hud.js',
	'js/title.js',
	'js/engine.js',
	'js/bot.js',
	'js/prices.js',
	'js/shape-list.js',
	'js/shapes.js',
	'js/shop.js',
	'js/wallet.js',
	'js/view.js',
	'js/remix-styles.js',
	'js/fx.js',
	'js/sprites.js',
	'js/audio.js',
	'js/storage.js',
	'js/version.js',
	'icons/favicon.svg',
	'icons/icon-32.png',
	'icons/icon-192.png',
	'icons/icon-512.png',
	'icons/maskable-192.png',
	'icons/maskable-512.png',
	'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
	// cache: 'reload' skips the HTTP cache, so a new version never stores old files.
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith('glintwell-') && k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
	event.respondWith(
		caches.open(CACHE).then(async (cache) => {
			// ignoreVary: some hosts send "Vary: Origin", and module scripts would then miss the cache.
			const hit = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
			if (hit) return hit;
			try {
				return await fetch(request);
			} catch (err) {
				if (request.mode === 'navigate') {
					const page = await cache.match('index.html');
					if (page) return page;
				}
				throw err;
			}
		}),
	);
});
