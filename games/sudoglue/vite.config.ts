import { defineConfig } from 'vite';

// Relative paths, because the arcade serves the build from /games/<slug>/play/.
export default defineConfig({
	base: './',
	oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
});
