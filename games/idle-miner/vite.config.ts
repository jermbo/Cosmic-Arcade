import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/** Lists every file in a folder, with paths relative to it. */
function listFiles(dir: string, root = dir): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full).split('\\').join('/')];
	});
}

/** Writes sw.js at build time, with the exact list of files to keep offline. */
function serviceWorker(): Plugin {
	return {
		name: 'idle-orbit-service-worker',
		apply: 'build',
		generateBundle(_options, bundle) {
			const files = ['./', 'index.html', ...Object.keys(bundle), ...listFiles('public')].filter((f, i, all) => !f.endsWith('.map') && f !== 'sw.js' && all.indexOf(f) === i);
			const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
			const source = `// Made by vite.config.ts at build time. Keeps the game playable offline.
const CACHE = 'idle-orbit-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith('idle-orbit-') && k !== CACHE).map((k) => caches.delete(k))))
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
`;
			this.emitFile({ type: 'asset', fileName: 'sw.js', source });
		},
	};
}

export default defineConfig({
	base: './',
	plugins: [serviceWorker()],
	build: {
		assetsInlineLimit: 0,
	},
});
