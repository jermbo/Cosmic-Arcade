import './dev-drive.ts';
import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './ui/styles.css';
import displayFont from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';
import { art } from './art/index.ts';
import { loadAudio, unlockAudio } from './game/audio.ts';
import { k } from './game/k.ts';
import { setupPwa } from './game/pwa.ts';
import { battleScene } from './game/scenes/battle.ts';
import { mapScene } from './game/scenes/map.ts';
import { summaryScene } from './game/scenes/summary.ts';
import { titleScene } from './game/scenes/title.ts';
import { applySettings } from './game/state.ts';
import { setupBack, setupRotate } from './ui/dom.ts';

art.load();
k.loadFont('display', displayFont, { outline: { width: 4, color: k.rgb('#0d0a10') }, filter: 'linear' });
k.load(loadAudio());
unlockAudio();
applySettings();

k.scene('title', titleScene);
k.scene('map', mapScene);
k.scene('battle', battleScene);
k.scene('summary', summaryScene);

setupBack();
setupRotate();
setupPwa(() => {});

// On a phone, the first tap asks for full screen in landscape.
const coarse = window.matchMedia('(pointer: coarse)').matches;
if (coarse) {
	const once = () => {
		window.removeEventListener('pointerup', once);
		const el = document.documentElement;
		if (document.fullscreenElement || !el.requestFullscreen) return;
		el.requestFullscreen({ navigationUI: 'hide' })
			.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
			.catch(() => {});
	};
	window.addEventListener('pointerup', once);
}

k.onLoad(() => k.go('title'));

if (import.meta.env.DEV) Object.assign(window, { __rq: { k } });
