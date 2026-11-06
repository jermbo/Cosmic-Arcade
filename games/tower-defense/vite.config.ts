import { defineConfig } from 'vite';

// Relative paths, because the arcade serves the build from /games/<slug>/play/.
export default defineConfig({
	base: './',
	build: {
		// three.js alone is about 700 kB.
		chunkSizeWarningLimit: 1000,
	},
});
