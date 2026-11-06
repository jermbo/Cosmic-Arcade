// Offline cache for Glintwell. Bump VERSION (and js/version.js) for each release.
// A new VERSION makes a new cache; the page then shows "Update ready, tap to reload".

const VERSION = '1.1.0';
const CACHE = `glintwell-${VERSION}`;
const FILES = [
	'./',
	'index.html',
	'manifest.webmanifest',
	'css/style.css',
	'js/main.js',
	'js/engine.js',
	'js/view.js',
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
