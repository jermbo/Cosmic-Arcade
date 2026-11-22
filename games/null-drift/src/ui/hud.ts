import { FLOORS } from '../rules/map.ts';
import { depthMeters, type Run } from '../rules/run.ts';
import { TRACE_LETHAL, traceShown } from '../rules/trace.ts';
import { countUp, pulseClass } from './fx.ts';

export interface Hud {
	el: HTMLElement;
	show(on: boolean): void;
	/** New run: count from zero, not from the last run. */
	reset(): void;
	update(run: Run): void;
	/** Shows a ghost bar for trace a card would add or vent. */
	preview(amount: number | null): void;
	traceEl(): HTMLElement;
	cyclesEl(): HTMLElement;
}

export function traceLevel(trace: number): 'low' | 'mid' | 'high' | 'crit' {
	if (trace >= 85) return 'crit';
	if (trace >= 65) return 'high';
	if (trace >= 35) return 'mid';
	return 'low';
}

export function createHud(onDeck: () => void, onSettings: () => void): Hud {
	const el = document.createElement('header');
	el.className = 'hud';
	el.hidden = true;
	el.innerHTML = `
		<div class="hud__where">
			<span class="hud__layer" data-hud="layer"></span>
			<span class="hud__stat">FLOOR <b data-hud="floor">1</b>/${FLOORS}</span>
			<span class="hud__stat">DEPTH <b data-hud="depth">0</b>m</span>
			<span class="hud__seed" data-hud="seed"></span>
		</div>
		<div class="trace" data-level="low" role="meter" aria-label="Trace" aria-valuemin="0" aria-valuemax="${TRACE_LETHAL}" aria-valuenow="0">
			<span class="trace__label">TRACE</span>
			<span class="trace__track">
				<span class="trace__fill"></span>
				<span class="trace__ghost"></span>
				<span class="trace__ticks"></span>
			</span>
			<span class="trace__value"><b data-hud="trace">0</b><small>/${TRACE_LETHAL}</small></span>
		</div>
		<div class="hud__right">
			<span class="hud__cycles" data-hud="cycles-box">CYC <b data-hud="cycles">0</b></span>
			<span class="hud__mods" data-hud="mods"></span>
			<button class="btn btn--icon" type="button" data-hud="deck" title="Deck (D)">DECK</button>
			<button class="btn btn--icon" type="button" data-hud="settings" title="Settings" aria-label="Settings">SYS</button>
		</div>`;

	const q = (k: string) => el.querySelector<HTMLElement>(`[data-hud="${k}"]`)!;
	const trace = el.querySelector<HTMLElement>('.trace')!;
	q('deck').addEventListener('click', onDeck);
	q('settings').addEventListener('click', onSettings);

	let lastTrace = 0;
	let lastCycles = 0;
	let current = 0;

	return {
		el,
		show(on) {
			el.hidden = !on;
		},
		reset() {
			lastTrace = 0;
			lastCycles = 0;
		},
		update(run) {
			q('layer').textContent = `${run.layer.code} ${run.layer.name}`;
			q('floor').textContent = String(run.floor);
			q('depth').textContent = String(depthMeters(run));
			q('seed').textContent = run.seedLabel;
			current = run.trace;
			const shown = traceShown(run.trace);
			trace.style.setProperty('--p', String(Math.min(1, run.trace / TRACE_LETHAL)));
			trace.dataset.level = traceLevel(run.trace);
			trace.setAttribute('aria-valuenow', String(shown));
			countUp(q('trace'), traceShown(lastTrace), shown, 0.4);
			if (run.trace > lastTrace + 0.01) pulseClass(trace, 'is-rising', 600);
			if (run.trace < lastTrace - 0.01) pulseClass(trace, 'is-falling', 600);
			lastTrace = run.trace;

			countUp(q('cycles'), lastCycles, run.cycles, 0.6);
			if (run.cycles !== lastCycles) pulseClass(q('cycles-box'), 'is-bump', 500);
			lastCycles = run.cycles;

			const mods = [];
			if (run.mods.salvage > 1) mods.push('<span class="chip chip--gold" title="Olivine Splice: payouts x1.18">SPLICE</span>');
			if (run.mods.damper) mods.push('<span class="chip chip--green" title="Signal Baffle: -2 noise per card">BAFFLE</span>');
			if (run.mods.ventBonus) mods.push('<span class="chip chip--green" title="Deep Vent Kit: vents x1.4">VENT+</span>');
			q('mods').innerHTML = mods.join('');
		},
		preview(amount) {
			if (amount === null || amount === 0) {
				trace.style.removeProperty('--ghost-from');
				trace.style.removeProperty('--ghost-to');
				trace.classList.remove('has-ghost');
				return;
			}
			const next = Math.min(TRACE_LETHAL, Math.max(0, current + amount));
			const a = Math.min(1, Math.min(current, next) / TRACE_LETHAL);
			const b = Math.min(1, Math.max(current, next) / TRACE_LETHAL);
			trace.style.setProperty('--ghost-from', String(a));
			trace.style.setProperty('--ghost-to', String(b));
			trace.dataset.ghost = amount > 0 ? 'up' : 'down';
			trace.classList.add('has-ghost');
		},
		traceEl: () => trace,
		cyclesEl: () => q('cycles-box'),
	};
}
