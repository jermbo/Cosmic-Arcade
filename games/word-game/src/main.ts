import '@fontsource/archivo-black/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './style.css';
import { boot } from './app.ts';
import { unlockAudio } from './audio.ts';
import { loadDictionary } from './core/dictionary.ts';
import { save } from './save.ts';

document.documentElement.classList.toggle('calm', save.settings.lessMotion);

// Browsers start audio only after a tap or key press.
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });

boot(document.getElementById('app')!);

// The word list is big: load it once the title is on screen.
setTimeout(() => void loadDictionary(), 300);
