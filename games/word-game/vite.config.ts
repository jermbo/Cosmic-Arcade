import { defineConfig } from 'vite';

// Relative paths, because the arcade serves the build from /games/<slug>/play/.
export default defineConfig({
	base: './',
	build: {
		// The guess word list is one lazy chunk of about 600 kB (220 kB gzip).
		chunkSizeWarningLimit: 700,
	},
});
