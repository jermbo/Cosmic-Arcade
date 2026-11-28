import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KIT_PATH = /^\/kit\/?$/;

/**
 * The cozy kit page at /kit/, in dev only (it is a tool for making games, not part of the site).
 * Each visit rebuilds it from the kit's files, so a reload shows the latest themes and parts.
 * @returns {import('astro').AstroIntegration}
 */
export function kitPageInDev() {
	return {
		name: 'kit-page-in-dev',
		hooks: {
			'astro:server:setup': ({ server, logger }) => {
				const root = server.config.root;
				const kit = join(root, 'games', 'cozy-kit');

				server.middlewares.use((request, response, next) => {
					const path = (request.url ?? '').split('?')[0];
					if (!KIT_PATH.test(path)) return next();
					try {
						execFileSync('node', [join(kit, 'scripts', 'make-page.js')], { stdio: 'pipe' });
						response.setHeader('Content-Type', 'text/html; charset=utf-8');
						response.end(readFileSync(join(kit, 'page', 'index.html')));
					} catch (error) {
						response.statusCode = 500;
						response.setHeader('Content-Type', 'text/plain; charset=utf-8');
						response.end(`The kit page did not build:\n\n${error.stderr?.toString() || error.message}`);
					}
				});

				logger.info('Cozy kit page: /kit/');
			},
		},
	};
}
