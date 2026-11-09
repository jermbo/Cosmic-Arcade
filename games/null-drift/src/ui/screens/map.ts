import { DAEMONS } from '../../data/daemons.ts';
import { NODE_INFO } from '../../data/nodes.ts';
import { COLS, FLOORS, ROWS, type MapNode } from '../../rules/map.ts';
import { canJackOut, currentNode, depthMeters, enterNode, jackOut, reachableIds } from '../../rules/run.ts';
import { recordEnding } from '../../rules/session.ts';
import { traceShown } from '../../rules/trace.ts';
import { settleLogs, type App } from '../app.ts';
import { anyDialogOpen, confirmBox, openDeck } from '../dialogs.ts';
import { dur, gsap, wait } from '../fx.ts';

const pos = (n: MapNode) => ({ x: ((n.col + 0.5) / COLS) * 100, y: ((n.row + 0.5) / ROWS) * 100 });

export function mountMap(app: App): () => void {
	const run = app.run!;
	const map = run.map;
	const reach = new Set(reachableIds(run));
	const here = currentNode(run);
	const byId = new Map(map.nodes.map((n) => [n.id, n]));

	const taken = new Set<string>();
	for (let i = 1; i < run.visited.length; i++) taken.add(`${run.visited[i - 1]}>${run.visited[i]}`);

	const edges = map.nodes
		.flatMap((n) =>
			n.exits.map((id) => {
				const a = pos(n);
				const b = pos(byId.get(id)!);
				const cls = taken.has(`${n.id}>${id}`) ? 'is-taken' : here?.id === n.id && reach.has(id) ? 'is-open' : '';
				return `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
			}),
		)
		.join('');

	const entryStubs = here
		? ''
		: map.nodes
				.filter((n) => n.row === 0)
				.map((n) => {
					const p = pos(n);
					return `<line class="is-open" x1="${p.x}" y1="0" x2="${p.x}" y2="${p.y}"/>`;
				})
				.join('');

	const nodes = map.nodes
		.map((n) => {
			const p = pos(n);
			const info = NODE_INFO[n.type];
			const state = [
				reach.has(n.id) ? 'is-reachable' : '',
				run.visited.includes(n.id) ? 'is-visited' : '',
				here?.id === n.id ? 'is-here' : '',
			].join(' ');
			return `
				<button class="node node--${n.type} ${state}" type="button" data-node="${n.id}"
					style="--x:${p.x}%;--y:${p.y}%" ${reach.has(n.id) ? '' : 'aria-disabled="true"'}
					aria-label="${info.label}, row ${n.row + 1}${reach.has(n.id) ? ', reachable' : ''}">
					<span class="node__glyph">${info.glyph}</span>
					<span class="node__label">${info.label}</span>
				</button>`;
		})
		.join('');

	const marketNote =
		run.marketFloor === run.floor ? `<span class="green">MARKET ROW ON THIS FLOOR</span>` : run.marketFloor > run.floor ? `MARKET ON FLOOR ${run.marketFloor}` : 'MARKET PASSED';

	app.stage.innerHTML = `
		<section class="mapscreen">
			<div class="mapscreen__board panel">
				<header class="board-head">
					<span>FLOOR ${run.floor}/${FLOORS} // ${here ? `ROW ${here.row + 1}` : 'ENTRY'}</span>
					<span class="dim">${marketNote}</span>
				</header>
				<div class="board">
					<svg class="board__edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${entryStubs}${edges}</svg>
					${nodes}
				</div>
				<p class="board-hint dim">${here ? 'Pick the next node. Paths only go down.' : 'Pick an entry socket.'}</p>
			</div>
			<aside class="mapscreen__side">
				<div class="panel node-info" aria-live="polite"></div>
				<div class="panel logpanel">
					<h2 class="panel__title">SYS LOG</h2>
					<ul class="log" data-log>${app.logHtml()}</ul>
				</div>
				<div class="mapscreen__actions">
					<button class="btn" type="button" data-act="deck">DECK ${run.deck.length}</button>
					<button class="btn btn--warn" type="button" data-act="jack" ${canJackOut(run) ? '' : 'disabled'}>JACK OUT</button>
				</div>
			</aside>
		</section>`;
	settleLogs(app.stage);

	const infoEl = app.stage.querySelector<HTMLElement>('.node-info')!;
	const showInfo = (n: MapNode | null) => {
		if (!n) {
			infoEl.innerHTML = `
				<h2 class="panel__title">STATUS</h2>
				<dl class="stats">
					<div><dt>TRACE</dt><dd class="coral">${traceShown(run.trace)}/100</dd></div>
					<div><dt>CYCLES</dt><dd class="gold">${run.cycles}</dd></div>
					<div><dt>DEPTH</dt><dd>${depthMeters(run)}m</dd></div>
					<div><dt>JACK OUT NOW</dt><dd>keep ${Math.round(run.cycles * 0.4)}</dd></div>
				</dl>`;
			return;
		}
		const info = NODE_INFO[n.type];
		const roster = n.type === 'merchant' ? [] : run.layer.rosters[n.type].map((id) => DAEMONS[id].name);
		const pay = Math.round(info.payout * run.mods.salvage);
		infoEl.innerHTML = `
			<h2 class="panel__title node-info__title node-info__title--${n.type}">${info.glyph} ${info.label}</h2>
			<p>${info.blurb}</p>
			<dl class="stats">
				${roster.length ? `<div><dt>DAEMONS</dt><dd>${roster.join(' · ')}</dd></div>` : ''}
				${pay ? `<div><dt>PAYOUT</dt><dd class="gold">${pay} cyc</dd></div>` : ''}
				${n.type === 'boss' ? '<div><dt>CARD</dt><dd>none</dd></div>' : ''}
				<div><dt>STATUS</dt><dd>${reach.has(n.id) ? '<span class="green">REACHABLE</span>' : run.visited.includes(n.id) ? 'CLEARED' : 'OUT OF PATH'}</dd></div>
			</dl>`;
	};
	showInfo(null);

	let leaving = false;
	const enter = async (id: string) => {
		if (leaving || !reach.has(id)) return;
		const n = byId.get(id)!;
		leaving = true;
		const el = app.stage.querySelector(`[data-node="${id}"]`);
		el?.classList.add('is-entering');
		const result = enterNode(run, id);
		if (!result) {
			leaving = false;
			return;
		}
		app.log(`Breach ${NODE_INFO[n.type].label} at row ${n.row + 1}.`, n.type === 'elite' || n.type === 'boss' ? 'warn' : 'ok');
		await wait(380);
		app.go(result);
	};

	app.stage.querySelectorAll<HTMLButtonElement>('[data-node]').forEach((b) => {
		const n = byId.get(b.dataset.node!)!;
		b.addEventListener('click', () => enter(n.id));
		b.addEventListener('pointerenter', () => showInfo(n));
		b.addEventListener('focus', () => showInfo(n));
		b.addEventListener('pointerleave', () => showInfo(null));
		b.addEventListener('blur', () => showInfo(null));
	});

	app.stage.querySelector('[data-act="deck"]')!.addEventListener('click', () => openDeck(run));
	app.stage.querySelector('[data-act="jack"]')!.addEventListener('click', async () => {
		const keep = Math.round(run.cycles * 0.4);
		const ok = await confirmBox('JACK OUT?', `Leave the stack now. You keep <b class="gold">${keep}</b> of ${run.cycles} cycles (40%).`, 'JACK OUT', 'STAY IN');
		if (!ok || !jackOut(run)) return;
		app.flags.unlocked = recordEnding(app.session, run);
		app.go('ending');
	});

	const onKey = (e: KeyboardEvent) => {
		if (anyDialogOpen()) return;
		if (e.key === 'd' || e.key === 'D') openDeck(run);
	};
	window.addEventListener('keydown', onKey);

	// Floor splash on a fresh floor.
	if (app.flags.newFloor) {
		app.flags.newFloor = false;
		const splash = document.createElement('div');
		splash.className = 'splash';
		splash.innerHTML = `<p class="eyebrow">${run.layer.code} // ${run.layer.name}</p><h2 class="glitch" data-text="FLOOR ${run.floor}">FLOOR ${run.floor}</h2><p>DEPTH ${depthMeters(run)}m${run.floor === FLOORS ? ' // ROOT AHEAD' : ''}</p>`;
		app.stage.append(splash);
		gsap.timeline({ onComplete: () => splash.remove() })
			.from(splash, { opacity: 0, duration: dur(0.25) })
			.from(splash.querySelector('h2'), { letterSpacing: '0.6em', duration: dur(0.6), ease: 'power3.out' }, 0)
			.to(splash, { opacity: 0, duration: dur(0.4), delay: dur(0.9) });
		gsap.from(app.stage.querySelectorAll('.node'), { scale: 0, opacity: 0, duration: dur(0.3), stagger: dur(0.03), delay: dur(0.5), ease: 'back.out(2)', clearProps: 'transform,opacity' });
	} else {
		app.stage.querySelector<HTMLButtonElement>('.node.is-reachable')?.focus({ preventScroll: true });
	}

	return () => window.removeEventListener('keydown', onKey);
}
