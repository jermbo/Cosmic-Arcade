import './css/base.css';
import './css/hud.css';
import './css/screens.css';
import './css/map.css';
import './css/combat.css';
import './css/cards.css';
import { createApp } from './ui/app.ts';

const app = createApp(document.querySelector<HTMLElement>('#app')!);
app.go('boot');

// Dev only: poke the run from the console, e.g. nd.run.trace = 95.
if (import.meta.env.DEV) Object.assign(window, { nd: app });
