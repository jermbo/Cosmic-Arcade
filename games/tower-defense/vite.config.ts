import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Relative paths, because the arcade serves the build from /games/<slug>/play/.
export default defineConfig({
	base: './',
	build: {
		// three.js alone is about 700 kB.
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
				editor: resolve(__dirname, 'editor.html'),
			},
		},
	},
});
