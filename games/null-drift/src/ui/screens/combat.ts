import { CARDS } from '../../data/cards.ts';
import { NODE_INFO } from '../../data/nodes.ts';
import { canPlay, effectiveNoise, endTurn, ENERGY, living, playCard, type Daemon } from '../../rules/combat.ts';
import { endRun, openReward } from '../../rules/run.ts';
import { recordEnding } from '../../rules/session.ts';
import { TRACE_LETHAL } from '../../rules/trace.ts';
import { settleLogs, type App } from '../app.ts';
import { cardHtml, fmt } from '../card-view.ts';
import { anyDialogOpen, openDeck } from '../dialogs.ts';
import { dur, floatText, gsap, pulseClass, shake, wait } from '../fx.ts';
import { sigil } from '../sigils.ts';

function daemonHtml(d: Daemon): string {
	return `
		<article class="daemon" data-uid="${d.uid}" data-sigil="${d.sigil}">
			<div class="daemon__intent" data-intent></div>
			<div class="daemon__sigil">${sigil(d.sigil)}</div>
			<h3 class="daemon__name">${d.name}</h3>
			<div class="hp" aria-label="Integrity">
				<span class="hp__fill"></span>
				<span class="hp__text" data-hp></span>
			</div>
			<div class="daemon__tags">
				<span class="chip chip--green" data-mask></span>
				<span class="chip chip--gold" data-target>TARGET</span>
			</div>
		</article>`;
}

export function mountCombat(app: App): () => void {
	const run = app.run!;
	const c = run.combat!;
	const type = c.nodeType;

	app.stage.innerHTML = `
		<section class="combat combat--${type}">
			<header class="combat__head">
				<span class="combat__type">${NODE_INFO[type].glyph} ${NODE_INFO[type].label}</span>
				<span class="dim">TURN <b data-turn>1</b></span>
			</header>
			<div class="daemons">${c.daemons.map(daemonHtml).join('')}</div>
			<div class="operator panel">
				<div class="operator__energy" aria-label="Energy">
					<span class="operator__label">ENERGY</span>
					<span class="pips" data-energy></span>
				</div>
				<div class="operator__mask">
					<span class="operator__label">MASK</span>
					<b class="green" data-mask-op>0</b>
				</div>
				<div class="operator__incoming" data-incoming></div>
				<div class="operator__piles">
					<button class="pile" type="button" data-act="deck" title="View deck (D)">DRAW <b data-draw>0</b></button>
					<span class="pile">DISCARD <b data-discard>0</b></span>
				</div>
				<button class="btn btn--primary btn--end" type="button" data-act="end">END TURN <kbd>E</kbd></button>
			</div>
			<div class="hand" data-hand aria-label="Hand"></div>
			<details class="panel logpanel logpanel--combat">
				<summary class="panel__title">SYS LOG</summary>
				<ul class="log" data-log>${app.logHtml()}</ul>
			</details>
		</section>`;
	settleLogs(app.stage);

	const $ = <T extends HTMLElement = HTMLElement>(sel: string) => app.stage.querySelector<T>(sel)!;
	const handEl = $('[data-hand]');
	const daemonEl = (uid: number) => app.stage.querySelector<HTMLElement>(`.daemon[data-uid="${uid}"]`);
	const endBtn = $<HTMLButtonElement>('[data-act="end"]');
	let busy = false;

	const updateDaemons = (flipIntents = false) => {
		const firstAlive = living(c)[0];
		for (const d of c.daemons) {
			const el = daemonEl(d.uid);
			if (!el) continue;
			el.style.setProperty('--hp', String(d.hp / d.maxHp));
			el.querySelector('[data-hp]')!.textContent = `${d.hp}/${d.maxHp}`;
			const mask = el.querySelector<HTMLElement>('[data-mask]')!;
			mask.hidden = d.mask <= 0;
			mask.textContent = `MASK ${d.mask}`;
			el.querySelector<HTMLElement>('[data-target]')!.hidden = d !== firstAlive;
			el.classList.toggle('is-target', d === firstAlive);
			const intent = el.querySelector<HTMLElement>('[data-intent]')!;
			if (d.hp > 0) {
				const atk = d.intent.kind === 'attack';
				intent.className = `daemon__intent intent--${d.intent.kind}`;
				intent.innerHTML = atk ? `<span aria-hidden="true">▼</span> ATK <b>${d.intent.value}</b>` : `<span aria-hidden="true">◆</span> DEF <b>${d.intent.value}</b>`;
				intent.title = atk ? `Adds ${d.intent.value} trace at end of turn unless masked.` : `Gains ${d.intent.value} mask this turn.`;
				if (flipIntents) gsap.from(intent, { rotationX: 90, opacity: 0, duration: dur(0.3), ease: 'back.out(2)' });
			} else {
				intent.className = 'daemon__intent intent--dead';
				intent.textContent = 'NULLED';
			}
		}
	};

	const updateOperator = () => {
		$('[data-turn]').textContent = String(c.turn);
		$('[data-energy]').innerHTML = Array.from({ length: Math.max(ENERGY, c.energy) }, (_, i) => `<span class="pip${i < c.energy ? ' is-on' : ''}"></span>`).join('');
		$('[data-energy]').setAttribute('aria-label', `${c.energy} of ${ENERGY}`);
		$('[data-mask-op]').textContent = String(c.mask);
		$('[data-draw]').textContent = String(c.drawPile.length);
		$('[data-discard]').textContent = String(c.discard.length);
		const incoming = living(c).reduce((s, d) => s + (d.intent.kind === 'attack' ? d.intent.value : 0), 0);
		const through = Math.max(0, incoming - c.mask);
		const lethal = run.trace + through >= TRACE_LETHAL;
		$('[data-incoming]').innerHTML = `
			<span class="operator__label">INCOMING</span>
			<span><b class="coral">${incoming}</b> − <b class="green">${Math.min(c.mask, incoming)}</b> masked = <b class="${lethal ? 'red blink' : through ? 'coral' : 'green'}">+${through} TRACE</b>${lethal ? ' <b class="red">LETHAL</b>' : ''}</span>`;
		$('[data-incoming]').classList.toggle('is-lethal', lethal);
		app.hud.update(run);
	};

	const renderHand = (newFrom: number) => {
		handEl.innerHTML = c.hand
			.map((id, i) => cardHtml(run, id, { index: i, button: true, locked: !canPlay(run, i), hint: String(i + 1) }))
			.join('');
		handEl.style.setProperty('--count', String(c.hand.length));
		const fresh = [...handEl.children].slice(newFrom);
		if (fresh.length) {
			const pile = $('[data-act="deck"]').getBoundingClientRect();
			fresh.forEach((el) => {
				const r = el.getBoundingClientRect();
				gsap.from(el, {
					x: pile.left - r.left,
					y: pile.top - r.top,
					rotation: -12,
					scale: 0.4,
					opacity: 0,
					duration: dur(0.38),
					ease: 'power3.out',
					delay: dur(0.06 * fresh.indexOf(el)),
					clearProps: 'transform,opacity',
				});
			});
		}
	};

	const finishBoot = async () => {
		app.log('TRACE COMPLETE. Socket burned.', 'err');
		document.documentElement.classList.add('is-booting');
		await wait(1100);
		document.documentElement.classList.remove('is-booting');
		endRun(run, 'booted');
		app.flags.unlocked = recordEnding(app.session, run);
		app.go('ending');
	};

	const finishWin = async () => {
		app.log(`Socket clear. ${NODE_INFO[type].label} down in ${c.turn} turn${c.turn > 1 ? 's' : ''}.`, 'ok');
		endBtn.disabled = true;
		await wait(850);
		openReward(run);
		app.go('reward');
	};

	const play = async (index: number) => {
		if (busy || anyDialogOpen()) return;
		const el = handEl.querySelector<HTMLElement>(`[data-index="${index}"]`);
		if (!el) return;
		if (!canPlay(run, index)) {
			shake(el, 5, 0.3);
			pulseClass($('[data-energy]'), 'is-short', 500);
			return;
		}
		busy = true;
		app.hud.preview(null);
		const target = living(c)[0];
		const hitsAll = CARDS[c.hand[index]].hitsAll;
		const res = playCard(run, index)!;
		const keep = c.hand.length - res.drawn;

		// Fly the card toward its target, or up for skills.
		const goal = (res.card.damage && !hitsAll ? daemonEl(target.uid) : null) ?? (res.card.damage ? $('.daemons') : $('.operator'));
		const a = el.getBoundingClientRect();
		const b = goal.getBoundingClientRect();
		await gsap.to(el, {
			x: b.left + b.width / 2 - (a.left + a.width / 2),
			y: b.top + b.height / 2 - (a.top + a.height / 2),
			scale: 0.55,
			rotation: res.card.damage ? 8 : 0,
			opacity: 0,
			duration: dur(0.28),
			ease: 'power2.in',
		});

		for (const h of res.hits) {
			const del = daemonEl(h.uid);
			if (h.absorbed) floatText(del, `−${h.absorbed} MASK`, 'green', -36);
			if (h.damage) floatText(del, `−${h.damage}`, 'coral');
			shake(del, h.damage ? 8 : 4);
			pulseClass(del, 'is-hit', 400);
			if (h.killed) {
				del?.classList.add('is-dead');
				app.log(`${c.daemons.find((d) => d.uid === h.uid)!.name} nulled.`, 'ok');
			}
		}
		if (res.card.mask) floatText($('[data-mask-op]'), `+${res.card.mask} MASK`, 'green');
		if (res.cycles) floatText(app.hud.cyclesEl(), `+${res.cycles}`, 'gold', 40);
		if (res.noise > 0) floatText(app.hud.traceEl(), `+${fmt(res.noise)} NOISE`, 'coral', 40);
		if (res.noise < 0) floatText(app.hud.traceEl(), `${fmt(res.noise)} VENT`, 'green', 40);
		if (res.noise >= 6) shake(app.hud.traceEl(), 4);

		updateDaemons();
		renderHand(keep);
		updateOperator();
		if (res.drawn) app.log(`${res.card.name}: drew ${res.drawn}.`, 'sys');

		if (res.booted) return finishBoot();
		if (res.cleared) return finishWin();
		if (run.trace >= 85) app.log(`Trace at ${Math.floor(run.trace)}. Go quiet.`, 'warn');
		busy = false;
	};

	const doEndTurn = async () => {
		if (busy || anyDialogOpen() || living(c).length === 0) return;
		busy = true;
		endBtn.disabled = true;
		app.hud.preview(null);
		const before = c.mask;
		const res = endTurn(run)!;

		// Old hand drops away.
		const cards = [...handEl.children];
		if (cards.length) await gsap.to(cards, { y: 60, opacity: 0, duration: dur(0.22), stagger: dur(0.03), ease: 'power2.in' });

		for (const atk of res.attackers) {
			const el = daemonEl(atk.uid);
			if (!el) continue;
			await gsap.to(el, { y: 26, scale: 1.06, duration: dur(0.12), ease: 'power2.in', yoyo: true, repeat: 1 });
			floatText($('.operator'), `${atk.value}`, 'coral', -30);
		}
		if (res.incoming) {
			if (res.blocked) floatText($('[data-mask-op]'), `MASKED ${res.blocked}`, 'green');
			if (res.through) {
				floatText(app.hud.traceEl(), `+${res.through} TRACE`, 'red', 40);
				shake(app.stage, Math.min(14, 4 + res.through / 2), 0.4);
				pulseClass(document.documentElement, 'is-struck', 450);
				app.log(`Hit for ${res.incoming}. Mask ${before} held ${res.blocked}. +${res.through} trace.`, 'warn');
			} else {
				app.log(`Hit for ${res.incoming}. Mask held it all.`, 'ok');
			}
		} else {
			app.log('No attacks this turn.', 'sys');
		}
		app.hud.update(run);
		if (res.booted) return finishBoot();

		await wait(200);
		updateDaemons(true);
		updateOperator();
		renderHand(0);
		endBtn.disabled = false;
		busy = false;
	};

	// Wire input.
	handEl.addEventListener('click', (e) => {
		const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
		if (card) play(Number(card.dataset.index));
	});
	handEl.addEventListener('pointerover', (e) => {
		const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
		if (!card || busy) return;
		app.hud.preview(effectiveNoise(run, CARDS[card.dataset.card!].noise));
	});
	handEl.addEventListener('pointerleave', () => app.hud.preview(null));
	handEl.addEventListener('focusin', (e) => {
		const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
		if (card && !busy) app.hud.preview(effectiveNoise(run, CARDS[card.dataset.card!].noise));
	});
	handEl.addEventListener('focusout', () => app.hud.preview(null));
	endBtn.addEventListener('click', doEndTurn);
	$('[data-act="deck"]').addEventListener('click', () => openDeck(run));

	const onKey = (e: KeyboardEvent) => {
		if (anyDialogOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
		if (/^[1-7]$/.test(e.key)) play(Number(e.key) - 1);
		else if (e.key === 'e' || e.key === 'E') doEndTurn();
		else if (e.key === 'd' || e.key === 'D') openDeck(run);
	};
	window.addEventListener('keydown', onKey);

	// Intro.
	const names = c.daemons.map((d) => d.name).join(', ');
	app.log(`${c.daemons.length} daemon${c.daemons.length > 1 ? 's' : ''} on socket: ${names}.`, type === 'boss' || type === 'elite' ? 'warn' : 'sys');
	updateDaemons();
	updateOperator();
	renderHand(0);
	gsap.from(app.stage.querySelectorAll('.daemon'), { y: -40, opacity: 0, duration: dur(0.45), stagger: dur(0.12), ease: 'power3.out', clearProps: 'transform,opacity' });

	return () => {
		window.removeEventListener('keydown', onKey);
		app.hud.preview(null);
	};
}
