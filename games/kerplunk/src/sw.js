// Offline cache for Kerplunk. Bump VERSION (and js/app/version.js) for each release.
// A new VERSION makes a new cache; the page then shows "Update ready, tap to reload".
// FILES lists every file the game needs offline. The labs (labs/) are not cached.

const VERSION = '2.0.0';
const CACHE = `kerplunk-${VERSION}`;
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
	'js/app/dom.js',
	'js/app/install.js',
	'js/app/storage.js',
	'js/app/updates.js',
	'js/app/version.js',
	'js/audio/clear-chime.js',
	'js/audio/instrument-bodies.js',
	'js/audio/instrument-parts.js',
	'js/audio/music.js',
	'js/audio/notes.js',
	'js/audio/power-sound-sets.js',
	'js/audio/small-sound-sets.js',
	'js/audio/sound-player.js',
	'js/audio/sound-scope.js',
	'js/feel/default-tuning.js',
	'js/feel/motion-styles.js',
	'js/feel/player-feel.js',
	'js/feel/sound-profiles.js',
	'js/feel/sound-styles.js',
	'js/feel/tuning.js',
	'js/input/buttons.js',
	'js/input/cheats.js',
	'js/input/keyboard.js',
	'js/input/pointer.js',
	'js/looks/looks.js',
	'js/looks/theme-variables.js',
	'js/looks/themes.js',
	'js/main.js',
	'js/play/game-end.js',
	'js/play/game-flow.js',
	'js/play/juice.js',
	'js/play/move.js',
	'js/play/second-chances.js',
	'js/play/session.js',
	'js/play/use-power-ups.js',
	'js/rules/board.js',
	'js/rules/bot.js',
	'js/rules/game-settings.js',
	'js/rules/game.js',
	'js/rules/pieces.js',
	'js/rules/power-ups.js',
	'js/rules/random.js',
	'js/rules/scoring.js',
	'js/rules/second-wind.js',
	'js/rules/shapes/shape-art.js',
	'js/rules/shapes/shape-list.js',
	'js/rules/timed-mode.js',
	'js/screens/boosts-screen.js',
	'js/screens/game-over-screen.js',
	'js/screens/hud.js',
	'js/screens/settings-screen.js',
	'js/screens/shop/motion-preview.js',
	'js/screens/shop/shop-screen.js',
	'js/screens/shop/theme-preview.js',
	'js/screens/title.js',
	'js/screens/tutorial/tutorial-pictures.js',
	'js/screens/tutorial/tutorial.js',
	'js/shop/prices.js',
	'js/shop/shop-items.js',
	'js/shop/wallet.js',
	'js/view/block-motion.js',
	'js/view/canvas-shapes.js',
	'js/view/draw-tray.js',
	'js/view/draw-well.js',
	'js/view/easing.js',
	'js/view/effects.js',
	'js/view/layout.js',
	'js/view/power-bar.js',
	'js/view/power-icons.js',
	'js/view/remix-show.js',
	'js/view/remix-styles.js',
	'js/view/sprites/block-marks.js',
	'js/view/sprites/block-sprites.js',
	'js/view/stickers.js',
	'js/view/view.js',
	'fonts/archivo-black-latin-400-normal.woff2',
	'fonts/dm-mono-latin-500-normal.woff2',
	'fonts/space-grotesk-latin-500-normal.woff2',
	'fonts/space-grotesk-latin-700-normal.woff2',
	'fonts/bricolage-grotesque-latin-800-normal.woff2',
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
			.then((keys) => Promise.all(keys.filter((k) => (k.startsWith('kerplunk-') || k.startsWith('glintwell-')) && k !== CACHE).map((k) => caches.delete(k))))
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
