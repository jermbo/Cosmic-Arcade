import { LAYERS } from '../../data/layers.ts';
import { FLOORS } from '../../rules/map.ts';
import { traceShown } from '../../rules/trace.ts';
import type { App } from '../app.ts';
import { countUp, dur, gsap } from '../fx.ts';

const LINES = {
	booted: ['Socket burned. The Watch has your fingerprint.', 'Kestrel Unit 09 dropped from the stack.'],
	jacked: ['You pulled the plug yourself. Smart. Or scared.', 'Clean exit. Partial take.'],
	cleared: ['Root access. The layer goes dark behind you.', 'The Warden is null. The stack remembers.'],
};

export function mountEnding(app: App): void {
	const run = app.run!;
	const end = run.ending!;
	const win = end.kind === 'cleared';
	const opened = app.flags.unlocked ? LAYERS[run.layer.index + 1] : null;
	app.flags.unlocked = false;
	const [line1, line2] = LINES[end.kind];

	app.stage.innerHTML = `
		<section class="ending ending--${end.kind}">
			<p class="eyebrow">${win ? 'OK' : end.kind === 'booted' ? 'ERR' : 'WARN'} // RUN TERMINATED</p>
			<h1 class="title glitch" data-text="${end.cause}">${end.cause}</h1>
			<p class="ending__line">${line1}<br><span class="dim">${line2}</span></p>
			${opened ? `<p class="ending__unlock">NEW LAYER OPEN: <b class="gold">${opened.code} ${opened.name}</b></p>` : ''}
			${win && run.layer.index === LAYERS.length - 1 ? '<p class="ending__unlock gold">ALL FIVE LAYERS CLEARED. THE STACK IS YOURS.</p>' : ''}
			<div class="panel ending__stats">
				<dl class="stats">
					<div><dt>LAYER</dt><dd>${run.layer.code} ${run.layer.name}</dd></div>
					<div><dt>FLOOR</dt><dd>${run.floor}/${FLOORS}</dd></div>
					<div><dt>FINAL TRACE</dt><dd class="coral">${traceShown(run.trace)}</dd></div>
					<div><dt>FIGHTS WON</dt><dd>${run.stats.fights}</dd></div>
					<div><dt>DAEMONS NULLED</dt><dd>${run.stats.kills}</dd></div>
					<div><dt>CARDS PLAYED</dt><dd>${run.stats.cardsPlayed}</dd></div>
					<div><dt>CYCLES HELD</dt><dd>${end.cycles}</dd></div>
					<div><dt>BANKED ${win ? '(100%)' : '(40%)'}</dt><dd class="gold ending__bank" data-bank>0</dd></div>
				</dl>
				<p class="dim small">SEED ${run.seedLabel} // ${run.seed}</p>
			</div>
			<div class="reward__actions">
				<button class="btn btn--primary" type="button" data-act="again">NEW DESCENT</button>
				<button class="btn btn--ghost" type="button" data-act="menu">MAIN MENU</button>
			</div>
		</section>`;

	countUp(app.stage.querySelector('[data-bank]'), 0, end.banked, 1.2);
	gsap.from(app.stage.querySelectorAll('.ending > *'), { y: 16, opacity: 0, duration: dur(0.4), stagger: dur(0.08), ease: 'power2.out', clearProps: 'transform,opacity' });

	app.stage.querySelector('[data-act="again"]')!.addEventListener('click', () => app.go('layers'));
	app.stage.querySelector('[data-act="menu"]')!.addEventListener('click', () => app.go('menu'));
	app.stage.querySelector<HTMLButtonElement>('[data-act="again"]')!.focus();

}
