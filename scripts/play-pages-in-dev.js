import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PLAY_FOLDER = /^\/games\/[^/]+\/play\/(.*\/)?$/;

/**
 * The dev server does not open index.html for a folder in public/, but every host does.
 * So in dev, a request for a folder of a published build gets its index.html.
 * @returns {import('astro').AstroIntegration}
 */
export function playPagesInDev() {
	return {
		name: 'play-pages-in-dev',
		hooks: {
			'astro:server:setup': ({ server }) => {
				const publicFolder = server.config.publicDir;

				server.middlewares.use((request, _response, next) => {
					const [path, query] = (request.url ?? '').split('?');
					const isPlayFolder = PLAY_FOLDER.test(path);
					if (isPlayFolder && existsSync(join(publicFolder, decodeURI(path), 'index.html'))) {
						request.url = `${path}index.html${query ? `?${query}` : ''}`;
					}
					next();
				});
			},
		},
	};
}
