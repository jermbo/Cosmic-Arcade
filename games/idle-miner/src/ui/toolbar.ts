// The toolbar of a planet: one button for each machine the player can build, and Remove.

import { sfx } from '../audio.ts';
import { BUILD_ORDER, MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { fmt } from '../core/format.ts';
import { toolOnPlanet } from '../core/build.ts';
import { buildCost } from '../core/prices.ts';
import { machineIcon } from '../view/draw.ts';
import type { Tool } from '../view/planet.ts';
import { session } from '../session.ts';
import { ui } from './elements.ts';
import { select } from './inspect.ts';
import { relayout } from './screens.ts';
import { pv } from '../views.ts';

let toolbarKey = '';

export function availableTools(): MachineType[] {
	const pi = pv.pi;
	return BUILD_ORDER.filter((t) => toolOnPlanet(session.g, pi, t));
}

const seenTools = new Set<string>(['drill', 'belt']);

/** Makes the next updateToolbar build its buttons again. */
export function markToolbarStale() {
	toolbarKey = '';
}

export function updateToolbar() {
	if (session.view !== 'planet') return;
	const tools = availableTools();
	const key = tools.join(',') + '|' + pv.pi;
	if (key !== toolbarKey) {
		toolbarKey = key;
		ui.toolbar.innerHTML = '';
		tools.forEach((t, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'tool';
			b.dataset.tool = t;
			b.title = `${MACHINES[t].name} (${i + 1})`;
			b.setAttribute('aria-label', MACHINES[t].name);
			b.append(machineIcon(t, 34));
			b.insertAdjacentHTML('beforeend', `<span class="tool__name">${MACHINES[t].short}</span><span class="tool__cost"></span>`);
			if (!seenTools.has(t) && session.g.stats.playTime > 5) b.classList.add('is-new');
			ui.toolbar.append(b);
		});
		const r = document.createElement('button');
		r.type = 'button';
		r.className = 'tool tool--remove';
		r.dataset.tool = 'remove';
		r.title = 'Remove (0)';
		r.innerHTML = `<span class="tool__x"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg></span><span class="tool__name">Remove</span><span class="tool__cost">refund</span>`;
		ui.toolbar.append(r);
		requestAnimationFrame(relayout);
	}
	for (const b of ui.toolbar.querySelectorAll<HTMLElement>('.tool')) {
		const t = b.dataset.tool as MachineType | 'remove';
		b.classList.toggle('is-active', pv.tool === t);
		b.setAttribute('aria-pressed', String(pv.tool === t));
		if (t === 'remove') continue;
		const cost = buildCost(session.g, pv.pi, t);
		const el = b.querySelector('.tool__cost')!;
		const txt = fmt(cost);
		if (el.textContent !== txt) el.textContent = txt;
		b.classList.toggle('is-poor', session.g.credits < cost);
	}
}

export function setTool(t: Tool) {
	pv.tool = t;
	if (t) select(null);
	sfx.click();
	updateToolbar();
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initToolbar() {
	ui.toolbar.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('.tool');
		if (!b) return;
		const t = b.dataset.tool as Tool;
		b.classList.remove('is-new');
		if (t) seenTools.add(t);
		setTool(pv.tool === t ? null : t);
	});
}
