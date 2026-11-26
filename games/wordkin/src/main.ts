import '@fontsource/archivo-black/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './style.css';
import { boot } from './app.ts';
import { unlockAudio } from './audio.ts';
import { loadDictionary } from './core/dictionary.ts';
import { save } from './save.ts';
import { setupPwa } from './ui/pwa.ts';
import { applyLooks } from './shop/wallet.ts';

document.documentElement.classList.toggle('calm', save.settings.lessMotion);
applyLooks();

// Browsers start audio only after a tap or key press.
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });

boot(document.getElementById('app')!);

// Offline play and the install button. The title screen listens for `pwa-change`.
setupPwa(() => dispatchEvent(new Event('pwa-change')));

// The word list is big (76k words). Load it when the phone is idle, so its parse
// never lands in the middle of an animation. Guesses before then are all accepted.
const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500));
idle(() => void loadDictionary());
