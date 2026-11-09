import type { App } from '../app.ts';
import { dur, gsap } from '../fx.ts';

const LINES: [string, string][] = [
	['sys', 'NULLDRIFT BIOS 4.1.9 // TERMINAL EPOCH'],
	['ok', 'MOUNT /dev/kestrel09 .............. OK'],
	['ok', 'SPOOF CERT CHAIN .................. OK'],
	['ok', 'HANDSHAKE CORP STACK .............. OK'],
	['warn', 'DAEMONS ACTIVE ON 5/5 LAYERS'],
	['warn', 'TRACE IS LETHAL AT 100'],
	['ok', 'LOAD DECK 14/14 ................... OK'],
	['sys', 'OPERATOR KESTREL UNIT 09. READY.'],
];

export function mountBoot(app: App): () => void {
	app.stage.innerHTML = `
		<section class="boot" aria-label="Boot">
			<pre class="boot__log">${LINES.map(([lvl, t]) => `<span class="boot__line boot__line--${lvl}">${t}</span>`).join('\n')}</pre>
			<p class="boot__prompt blink">[ PRESS ANY KEY // TAP TO JACK IN ]</p>
		</section>`;
	const lines = app.stage.querySelectorAll('.boot__line');
	const prompt = app.stage.querySelector('.boot__prompt');
	const tl = gsap.timeline();
	tl.from(lines, { opacity: 0, x: -8, duration: dur(0.12), stagger: dur(0.16), ease: 'steps(3)' });
	tl.from(prompt, { opacity: 0, duration: dur(0.3) });

	let done = false;
	const next = (e: Event) => {
		if (done) return;
		if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey)) return;
		done = true;
		app.go('menu');
	};
	window.addEventListener('keyup', next);
	app.stage.addEventListener('pointerdown', next);
	return () => {
		tl.kill();
		window.removeEventListener('keyup', next);
		app.stage.removeEventListener('pointerdown', next);
	};
}
