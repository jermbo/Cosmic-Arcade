import { DAEMONS } from '../../data/daemons.ts';
import { LAYERS, type LayerDef } from '../../data/layers.ts';
import type { App } from '../app.ts';

function threats(layer: LayerDef): string {
	const ids = new Set(Object.values(layer.rosters).flat());
	return [...ids].map((id) => DAEMONS[id].name).filter((n, i, a) => a.indexOf(n) === i).join(' · ');
}

export function mountLayers(app: App): () => void {
	let pick = Math.min(app.session.unlocked, LAYERS.length) - 1;

	app.stage.innerHTML = `
		<section class="layers">
			<header class="screen-head">
				<p class="eyebrow">SELECT TARGET LAYER</p>
				<h1 class="screen-title">CORP STACK</h1>
			</header>
			<div class="layers__body">
				<ol class="stack" role="listbox" aria-label="Layers">
					${LAYERS.map((l) => {
						const locked = l.index >= app.session.unlocked;
						return `
						<li>
							<button class="stack__layer${locked ? ' is-locked' : ''}" type="button" role="option" data-layer="${l.index}" ${locked ? 'aria-disabled="true"' : ''}>
								<span class="stack__code">${l.code}</span>
								<span class="stack__name">${l.name}</span>
								<span class="stack__state">${locked ? 'LOCKED' : 'OPEN'}</span>
							</button>
						</li>`;
					}).join('')}
				</ol>
				<aside class="panel layers__info" aria-live="polite"></aside>
			</div>
			<footer class="layers__foot">
				<button class="btn btn--ghost" type="button" data-act="back">BACK</button>
				<label class="seed-field">
					<span>SEED</span>
					<input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="random" maxlength="10" data-seed>
				</label>
				<button class="btn btn--primary" type="button" data-act="go">JACK IN</button>
			</footer>
		</section>`;

	const info = app.stage.querySelector<HTMLElement>('.layers__info')!;
	const buttons = [...app.stage.querySelectorAll<HTMLButtonElement>('[data-layer]')];
	const seedInput = app.stage.querySelector<HTMLInputElement>('[data-seed]')!;

	const render = () => {
		const l = LAYERS[pick];
		buttons.forEach((b, i) => {
			b.classList.toggle('is-picked', i === pick);
			b.setAttribute('aria-selected', String(i === pick));
		});
		const w = l.weights;
		const total = w.combat + w.cache + w.unknown + w.elite;
		info.innerHTML = `
			<h2 class="panel__title">${l.code} // ${l.name}</h2>
			<p>${l.blurb}</p>
			<dl class="stats">
				<div><dt>DAEMONS</dt><dd>${threats(l)}</dd></div>
				<div><dt>ELITE RATE</dt><dd>${Math.round((w.elite / total) * 100)}% base</dd></div>
				<div><dt>ROOT</dt><dd class="coral">NULL WARDEN</dd></div>
				<div><dt>FLOORS</dt><dd>4 // 3 GATES + ROOT</dd></div>
			</dl>`;
	};
	render();

	buttons.forEach((b, i) =>
		b.addEventListener('click', () => {
			if (i >= app.session.unlocked) {
				info.innerHTML = `<h2 class="panel__title">${LAYERS[i].code} // LOCKED</h2><p class="coral">ACCESS DENIED. Clear ${LAYERS[i - 1].name} first.</p>`;
				return;
			}
			pick = i;
			render();
		}),
	);

	const go = () => {
		const seed = Number.parseInt(seedInput.value.replace(/\D/g, ''), 10) || 0;
		app.startRun(pick, seed);
	};
	app.stage.querySelector('[data-act="go"]')!.addEventListener('click', go);
	app.stage.querySelector('[data-act="back"]')!.addEventListener('click', () => app.go('menu'));

	const onKey = (e: KeyboardEvent) => {
		if (e.target instanceof HTMLInputElement) {
			if (e.key === 'Enter') go();
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const next = pick + (e.key === 'ArrowDown' ? 1 : -1);
			if (next >= 0 && next < app.session.unlocked) {
				pick = next;
				render();
				buttons[pick].focus();
			}
		}
		if (e.key === 'Escape') app.go('menu');
	};
	window.addEventListener('keydown', onKey);
	buttons[pick].focus();
	return () => window.removeEventListener('keydown', onKey);
}
