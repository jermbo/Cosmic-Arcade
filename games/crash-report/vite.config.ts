import { defineConfig } from 'vite';

export default defineConfig({
	// Relative paths, so the build works in any folder of the arcade.
	base: './',
	build: {
		chunkSizeWarningLimit: 3000,
	},
});
