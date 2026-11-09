import { CARDS } from '../../data/cards.ts';
import type { FightType } from '../../data/nodes.ts';
import { FLOORS } from '../../rules/map.ts';
import { claimReward } from '../../rules/run.ts';
import { recordEnding } from '../../rules/session.ts';
import { GATE_SHED, traceShown } from '../../rules/trace.ts';
import type { App } from '../app.ts';
import { cardHtml } from '../card-view.ts';
import { anyDialogOpen } from '../dialogs.ts';
import { countUp, dur, gsap, wait } from '../fx.ts';

const TITLES: Record<FightType, string> = {
	combat: 'NEST PURGED',
	elite: 'ELITE ICE BROKEN',
	cache: 'CACHE CRACKED',
	unknown: 'SIGNAL RESOLVED',
	gate: 'GATE BREACHED',
	boss: 'ROOT DAEMON NULLED',
};

export function mountReward(app: App): () => void {
	const run = app.run!;
	const reward = run.reward!;
	const isGate = reward.nodeType === 'gate';
	const isBoss = reward.nodeType === 'boss';
	const shedTo = traceShown(run.trace * (1 - GATE_SHED));

	app.stage.innerHTML = `
		<section class="reward reward--${reward.nodeType}">
			<header class="screen-head">
				<p class="eyebrow">OK // SOCKET CLEAR</p>
				<h1 class="screen-title glitch" data-text="${TITLES[reward.nodeType]}">${TITLES[reward.nodeType]}</h1>
			</header>
			<div class="reward__payout panel">
				<span class="dim">PAYOUT</span>
				<b class="gold reward__cycles">+<span data-pay>0</span></b>
				<span class="dim">CYCLES${run.mods.salvage > 1 ? ' · SPLICE x1.18' : ''}</span>
			</div>
			${
				isGate
					? `<p class="reward__note">Gate open. Crossing to floor ${run.floor + 1}/${FLOORS} sheds 35% trace: <b class="coral">${traceShown(run.trace)}</b> → <b class="green">${shedTo}</b>.</p>`
					: ''
			}
			${
				isBoss
					? `<p class="reward__note">Root access. ${run.layer.name} is yours. No card from the root, only cycles.</p>
						<div class="reward__actions"><button class="btn btn--primary" type="button" data-pick="-1">CLAIM ROOT</button></div>`
					: `<p class="eyebrow reward__ask">SPLICE ONE CARD INTO THE DECK</p>
						<div class="reward__cards">
							${reward.choices.map((id, i) => cardHtml(run, id, { button: true, index: i, hint: String(i + 1) })).join('')}
						</div>
						<div class="reward__actions"><button class="btn btn--ghost" type="button" data-pick="-1">SKIP // CYCLES ONLY</button></div>`
			}
		</section>`;

	countUp(app.stage.querySelector('[data-pay]'), 0, reward.cycles, 0.9);
	gsap.from(app.stage.querySelectorAll('.reward__cards .card'), { y: 40, opacity: 0, rotationY: 60, duration: dur(0.45), stagger: dur(0.1), delay: dur(0.3), ease: 'power3.out', clearProps: 'transform,opacity' });

	let done = false;
	const pick = async (i: number) => {
		if (done) return;
		done = true;
		const chosen = reward.choices[i];
		const el = app.stage.querySelector<HTMLElement>(`.reward__cards [data-index="${i}"]`);
		if (chosen && el) {
			el.classList.add('is-picked');
			await gsap.to(el, { y: -30, scale: 1.08, duration: dur(0.25), ease: 'power2.out' });
			await gsap.to(el, { opacity: 0, y: -80, duration: dur(0.25) });
		}
		const prevTrace = run.trace;
		const result = claimReward(run, i);
		if (chosen) app.log(`${CARDS[chosen].name} spliced. Deck ${run.deck.length}.`, 'gold');
		else app.log(`Payout ${reward.cycles} cycles banked to run.`, 'gold');

		if (result === 'cleared') {
			app.flags.unlocked = recordEnding(app.session, run);
			app.go('ending');
			return;
		}
		if (result === 'next-floor') {
			app.log(`Gate crossed. Trace ${traceShown(prevTrace)} → ${traceShown(run.trace)}.`, 'ok');
			app.flags.newFloor = true;
			app.hud.update(run);
			await wait(250);
		}
		app.go('map');
	};

	app.stage.querySelectorAll<HTMLButtonElement>('[data-pick], .reward__cards .card').forEach((b) =>
		b.addEventListener('click', () => pick(Number(b.dataset.pick ?? b.dataset.index))),
	);

	const onKey = (e: KeyboardEvent) => {
		if (anyDialogOpen()) return;
		const n = Number(e.key);
		if (n >= 1 && n <= reward.choices.length) pick(n - 1);
		if (e.key === 'Escape' || (isBoss && e.key === 'Enter')) pick(-1);
	};
	window.addEventListener('keydown', onKey);
	return () => window.removeEventListener('keydown', onKey);
}
