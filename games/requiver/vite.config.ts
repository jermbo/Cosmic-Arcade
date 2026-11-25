import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
		name: 'requiver-service-worker',
		apply: 'build',
		generateBundle(_options, bundle) {
			const files = ['./', 'index.html', ...Object.keys(bundle), ...listFiles('public')].filter((f, i, all) => !f.endsWith('.map') && f !== 'sw.js' && all.indexOf(f) === i);
			const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
			const source = `// Made by vite.config.ts at build time. Keeps the game playable offline.
const CACHE = 'requiver-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith('requiver-') && k !== CACHE).map((k) => caches.delete(k))))
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

/** Dev only: POST /__shot saves a PNG data URL to .shots/, so a hidden test tab can show what it drew. */
function devShots(): Plugin {
	return {
		name: 'requiver-dev-shots',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__shot', (req, res) => {
				let body = '';
				req.on('data', (chunk) => (body += chunk));
				req.on('end', () => {
					const { name, data } = JSON.parse(body) as { name: string; data: string };
					mkdirSync('.shots', { recursive: true });
					writeFileSync(join('.shots', `${name.replace(/[^a-z0-9-]/gi, '')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
					res.end('ok');
				});
			});
		},
	};
}

// Relative paths, because the arcade serves the build from /games/<slug>/play/.
export default defineConfig({
	base: './',
	plugins: [serviceWorker(), devShots()],
});
