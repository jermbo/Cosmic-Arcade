// @ts-check
import { defineConfig } from 'astro/config';
import { playPagesInDev } from './scripts/play-pages-in-dev.js';

// https://astro.build/config
export default defineConfig({
	// Builds use relative paths, so every game URL must end with a slash.
	trailingSlash: 'always',
	redirects: {
		'/': '/games/',
	},
	integrations: [playPagesInDev()],
});
