// The panels: research, ships, nova reset, settings, pause, away summary, ending.

import { CREW, CREW_MAX, CREW_ORDER, PERKS, PLANETS, crewText, RESEARCH, SHIP_UPS, DUST_BONUS, PRESTIGE_PLANET } from '../core/data.ts';
import type { CrewId, PerkId, ResearchId, ShipUpgrade } from '../core/data.ts';
import { fmt, fmtTime } from '../core/format.ts';
import * as sim from '../core/sim.ts';
import { NOVA_KIT, exportSave, exportStoredSave, importSave } from '../core/state.ts';
import type { Game } from '../core/state.ts';
import { closePanel, openPanel } from './modal.ts';

export interface PanelHost {
	game: () => Game;
	sound: (name: 'buy' | 'error' | 'click' | 'upgrade') => void;
	toast: (text: string, kind?: string) => void;
	afterBuy: () => void;
	save: () => void;
	resetAll: () => void;
	loadGame: (g: Game) => void;
	prestige: () => void;
	toTitle: () => void;
	settingsChanged: () => void;
}

let host: PanelHost;
export function initPanels(h: PanelHost) {
	host = h;
}

function buyButton(act: string, arg: string, cost: number, can: boolean, maxed: boolean, unit = '') {
	if (maxed) return `<button class="btn btn--small" disabled>Max</button>`;
	return `<button class="btn btn--small" data-act="${act}" data-arg="${arg}" ${can ? '' : 'disabled'}>${unit}${fmt(cost)}</button>`;
}

// ---------- research ----------

export function openResearch() {
	openPanel({
		id: 'research',
		title: 'Research',
		render: () => {
			const g = host.game();
			const ids: ResearchId[] = ['tap', 'belt', 'blast', 'bridges', 'market', 'offline'];
			if (g.planets[5].unlocked || g.beaconLit) ids.push('beacon');
			const rows = ids
				.map((id) => {
					const def = RESEARCH[id];
					const lv = g.research[id];
					const cost = sim.researchCost(g, id);
					const maxed = lv >= def.max;
					const level = def.max > 1 ? `<small>Lv ${lv}/${def.max}</small>` : maxed ? `<small>${id === 'beacon' ? 'Lit' : 'Done'}</small>` : '';
					return `<div class="row ${maxed ? 'row--done' : ''}"><div><div class="row__name">${def.name}${level}</div><div class="row__desc">${def.desc}${effect(g, id)}</div></div>${buyButton('research', id, cost, g.credits >= cost, maxed)}</div>`;
				})
				.join('');
			return `<p>Upgrades here help every planet.</p><div class="rows">${rows}</div>`;
		},
		act: (name, el) => {
			if (name !== 'research') return;
			const g = host.game();
			const id = el.dataset.arg as ResearchId;
			if (sim.buyResearch(g, id)) {
				host.sound('upgrade');
				host.afterBuy();
				if (id === 'beacon') {
					closePanel();
					openEnding();
				}
			} else host.sound('error');
		},
	});
}

function effect(g: Game, id: ResearchId) {
	switch (id) {
		case 'tap':
			return ` Now: each tap gives ${fmt(sim.tapValue(g, topPlanet(g)))}.`;
		case 'belt':
			return ` Now: ${(1.5 + 0.4 * g.research.belt).toFixed(1)} tiles/s.`;
		case 'market':
			return ` Now: +${g.research.market * 20}%.`;
		case 'offline':
			return ` Now: ${sim.offlineCapHours(g)} hours.`;
		case 'blast': {
			const n = g.blasted.reduce((t, a) => t + a.length, 0);
			return n ? ` Rocks cleared: ${n}.` : '';
		}
		default:
			return '';
	}
}

export function topPlanet(g: Game) {
	let top = 0;
	g.planets.forEach((p, i) => p.unlocked && (top = i));
	return top;
}

// ---------- ships ----------

export function openShips(pi: number) {
	openPanel({
		id: 'ships',
		title: `${PLANETS[pi].name} ships`,
		render: () => {
			const g = host.game();
			const p = g.planets[pi];
			const cap = sim.shipCap(p);
			const trip = sim.travelTime(p, pi) * 2 + sim.SHIP_WAIT;
			const flow = (p.ships.length * cap) / trip;
			const stats = `<div class="stats">
				<div class="stat"><small>Ships</small><b>${p.ships.length}</b></div>
				<div class="stat"><small>Cargo each</small><b>${cap}</b></div>
				<div class="stat"><small>Round trip</small><b>${trip.toFixed(1)}s</b></div>
				<div class="stat"><small>Can move</small><b>${flow.toFixed(1)}/s</b></div>
			</div>`;
			const rows = (['ships', 'speed', 'cargo'] as ShipUpgrade[])
				.map((u) => {
					const def = SHIP_UPS[u];
					const lv = p.up[u];
					const cost = sim.shipUpCost(g, pi, u);
					const maxed = lv >= def.max;
					return `<div class="row ${maxed ? 'row--done' : ''}"><div><div class="row__name">${def.name}<small>Lv ${lv}/${def.max}</small></div><div class="row__desc">${def.desc}</div></div>${buyButton('ship', u, cost, g.credits >= cost, maxed)}</div>`;
				})
				.join('');
			const full = p.pad.length > 30;
			return `${stats}<p>${full ? '<b style="color:#ff8a9c">The pad is backing up.</b> Ships cannot keep up. ' : ''}Ships load at the launch pad and fly cargo home to sell.</p><div class="rows">${rows}</div>`;
		},
		act: (name, el) => {
			if (name !== 'ship') return;
			if (sim.buyShipUp(host.game(), pi, el.dataset.arg as ShipUpgrade)) {
				host.sound('buy');
				host.afterBuy();
			} else host.sound('error');
		},
	});
}

// ---------- crew ----------

/** The shared crew pool. pi is the planet the panel was opened from: "Work here" sends crew there. */
export function openCrew(pi: number) {
	openPanel({
		id: 'crew',
		title: `Crew · ${PLANETS[pi].name}`,
		render: () => {
			const g = host.game();
			const used = sim.slotsUsed(g);
			const total = sim.slotCount(g);
			const free = used < total;
			const rows = CREW_ORDER.map((id) => {
				const def = CREW[id];
				const lv = g.crew[id] || 0;
				const at = g.crewAt[id];
				const here = at === pi;
				const cost = sim.crewCost(g, id);
				const maxed = lv >= CREW_MAX;
				const where = !lv ? '' : at === undefined ? `<span class="crew__where">Resting</span>` : `<span class="crew__where" style="color:${PLANETS[at].light}">On ${PLANETS[at].name}</span>`;
				const level = lv ? `<small>Lv ${lv}/${CREW_MAX}</small>` : '';
				let place = '';
				if (lv && here) place = `<button class="btn btn--small btn--ghost" data-act="rest" data-arg="${id}">Rest</button>`;
				else if (lv) place = `<button class="btn btn--small btn--ghost" data-act="here" data-arg="${id}" ${at !== undefined || free ? '' : 'disabled'}>${at === undefined ? 'Work here' : 'Move here'}</button>`;
				const buy = maxed ? `<button class="btn btn--small" disabled>Max</button>` : `<button class="btn btn--small ${lv ? '' : 'btn--gold'}" data-act="buy" data-arg="${id}" ${g.credits >= cost ? '' : 'disabled'}>${lv ? 'Train' : 'Hire'} ${fmt(cost)}</button>`;
				return `<div class="row crew ${here ? 'is-on' : ''} ${lv ? '' : 'is-new'}"><span class="crew__badge" style="--c:${def.color}">${def.name[0]}</span><div><div class="row__name">${def.name}${level}</div><div class="row__desc"><b>${def.title}.</b> ${crewText(id, Math.max(1, lv))}</div>${where}</div><div class="crew__btns">${place}${buy}</div></div>`;
			}).join('');
			const next = sim.slotCost(g);
			const points = sim.perkPoints(g);
			const showDust = g.stardust > 0 || g.unlocks.includes('prestige');
			const slotBtn = !next ? `<button class="btn btn--small" disabled>All slots open</button>` : showDust ? `<button class="btn btn--small btn--gold" data-act="slot" ${points >= next ? '' : 'disabled'}>New slot ✦ ${next}</button>` : '';
			const stats = `<div class="crew__slots"><div class="stat"><small>Crew working</small><b>${used} / ${total}</b></div>${slotBtn}</div>`;
			const dustNote = next ? (showDust ? ` More slots cost stardust (✦ ${points} free).` : ' More slots cost stardust from a Nova Reset.') : '';
			return `${stats}<p>Crew boost the planet they work on. Hire once and keep them for good: crew, levels and slots stay through a Nova Reset.${dustNote}</p><div class="rows">${rows}</div>`;
		},
		act: (name, el) => {
			const g = host.game();
			const id = el.dataset.arg as CrewId;
			let ok = false;
			if (name === 'buy') ok = sim.buyCrew(g, id);
			if (name === 'here') ok = sim.assignCrew(g, id, pi);
			if (name === 'rest') ok = sim.assignCrew(g, id, -1);
			if (name === 'slot') ok = sim.buySlot(g);
			if (ok) {
				host.sound(name === 'buy' || name === 'slot' ? 'upgrade' : 'click');
				host.afterBuy();
			} else host.sound('error');
		},
	});
}

// ---------- nova reset ----------

export function openNova() {
	openPanel({
		id: 'nova',
		title: 'Nova Reset',
		render: () => {
			const g = host.game();
			const gain = sim.prestigeGain(g);
			const ready = sim.canPrestige(g);
			const bonus = Math.round(g.stardust * DUST_BONUS * 100);
			const points = sim.perkPoints(g);
			let top = `<div class="stats">
				<div class="stat"><small>Stardust</small><b>✦ ${g.stardust}</b></div>
				<div class="stat"><small>Sales bonus</small><b>+${bonus}%</b></div>
				<div class="stat"><small>Reset now for</small><b>✦ ${gain}</b></div>
			</div>`;
			if (!g.planets[PRESTIGE_PLANET].unlocked && g.stats.resets === 0) {
				top = `<p>Unlock <b>${PLANETS[PRESTIGE_PLANET].name}</b> to use the Nova Reset.</p>`;
			} else {
				top += `<p>A Nova Reset starts a new run: planets, machines, ships, credits and research go back to zero. You get stardust for what you earned this run. Each stardust adds <b>+${DUST_BONUS * 100}%</b> to all sales, forever, and <b>${fmt(NOVA_KIT)}</b> starting credits to each new run.</p>`;
				top += `<button class="btn btn--gold" style="width:100%" data-act="reset" ${ready ? '' : 'disabled'}>${ready ? `Reset for ✦ ${gain} stardust` : `Earn more first (✦ 1 at ${fmt(2e6)} this run)`}</button>`;
			}
			const perks = (Object.keys(PERKS) as PerkId[])
				.map((id) => {
					const def = PERKS[id];
					const owned = !!g.perks[id];
					return `<div class="perk ${owned ? 'is-owned' : ''}"><b>${def.name}</b><span>${def.desc}</span>${owned ? '<span>Owned</span>' : `<button class="btn btn--small btn--gold" data-act="perk" data-arg="${id}" ${points >= def.cost ? '' : 'disabled'}>✦ ${def.cost}</button>`}</div>`;
				})
				.join('');
			return `${top}<h3 style="margin:18px 0 0">Perks <small style="color:var(--muted);font-weight:500">· ✦ ${points} free to spend</small></h3><p style="margin-top:4px">Perks cost stardust but keep its sales bonus. They stay through resets. Stardust also buys crew slots.</p><div class="perks">${perks}</div>`;
		},
		act: (name, el) => {
			const g = host.game();
			if (name === 'perk') {
				if (sim.buyPerk(g, el.dataset.arg as PerkId)) {
					host.sound('upgrade');
					host.afterBuy();
				} else host.sound('error');
			}
			if (name === 'reset') confirmNova();
		},
	});
}

function confirmNova() {
	const g = host.game();
	const gain = sim.prestigeGain(g);
	openPanel({
		id: 'nova-confirm',
		title: 'Go nova?',
		render: () => `<p>Your run resets. You keep stardust, perks and stats.</p><p>You get <b>✦ ${gain}</b>. All sales will be <b>+${Math.round((g.stardust + gain) * DUST_BONUS * 100)}%</b>, and the next run starts with <b>${fmt((g.stardust + gain) * NOVA_KIT + (g.perks.start ? 1000 : 0))}</b> credits.</p><div class="card__row"><button class="btn btn--ghost" data-act="no">Not yet</button><button class="btn btn--gold" data-act="yes">Go nova</button></div>`,
		act: (name) => {
			if (name === 'no') openNova();
			if (name === 'yes') {
				closePanel();
				host.prestige();
			}
		},
	});
}

// ---------- settings ----------

export function openSettings(fromTitle = false) {
	openPanel({
		id: 'settings',
		title: 'Settings',
		still: true,
		render: () => {
			const s = host.game().settings;
			const save = fromTitle
				? ''
				: `<h3>Save</h3><p>The game saves by itself every few seconds on this device.</p>
				<div class="menu-list">
					<button class="btn btn--ghost" data-act="save-now">Save now</button>
					<button class="btn btn--ghost" data-act="export">Copy a save code</button>
					<textarea class="save-code" id="save-code" placeholder="Paste a save code here" aria-label="Save code"></textarea>
					<button class="btn btn--ghost" data-act="import">Load the save code</button>
					<button class="btn btn--danger" data-act="reset">Erase all progress</button>
				</div>`;
			return `<div class="setting"><label for="set-sfx">Sound effects</label><input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-act="sfx"></div>
				<div class="setting"><label for="set-music">Music</label><input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}" data-act="music"></div>
				<div class="setting"><label for="set-vib">Vibration on tap</label><input id="set-vib" type="checkbox" ${s.vibrate ? 'checked' : ''} data-act="vibrate"></div>
				<div class="setting"><label for="set-rm">Less motion</label><input id="set-rm" type="checkbox" ${s.reduceMotion ? 'checked' : ''} data-act="motion"></div>
				${save}`;
		},
		act: (name, el) => {
			const g = host.game();
			const s = g.settings;
			const input = el as HTMLInputElement;
			switch (name) {
				case 'sfx':
					s.sfx = Number(input.value);
					break;
				case 'music':
					s.music = Number(input.value);
					break;
				case 'vibrate':
					s.vibrate = input.checked;
					break;
				case 'motion':
					s.reduceMotion = input.checked;
					break;
				case 'save-now':
					host.save();
					host.toast('Game saved');
					break;
				case 'export': {
					const code = exportSave(g);
					const box = document.getElementById('save-code') as HTMLTextAreaElement;
					box.value = code;
					box.select();
					navigator.clipboard?.writeText(code).then(
						() => host.toast('Save code copied'),
						() => host.toast('Select the code and copy it'),
					);
					break;
				}
				case 'import': {
					const box = document.getElementById('save-code') as HTMLTextAreaElement;
					const loaded = importSave(box.value);
					if (!loaded) {
						host.toast('That code did not work', 'warn');
						host.sound('error');
						return;
					}
					closePanel();
					host.loadGame(loaded);
					host.toast('Save loaded');
					break;
				}
				case 'reset':
					confirmReset();
					return;
			}
			host.settingsChanged();
		},
	});
}

function confirmReset() {
	openPanel({
		id: 'reset',
		title: 'Erase everything?',
		render: () => `<p>This deletes your save on this device: planets, stardust, perks and stats. It cannot be undone.</p><div class="card__row"><button class="btn btn--ghost" data-act="no">Keep my save</button><button class="btn btn--danger" data-act="yes">Erase</button></div>`,
		act: (name) => {
			if (name === 'no') openSettings();
			if (name === 'yes') {
				closePanel();
				host.resetAll();
			}
		},
	});
}

// ---------- pause ----------

export function openPause() {
	openPanel({
		id: 'pause',
		title: 'Paused',
		render: () => {
			const g = host.game();
			return `<div class="stats">
				<div class="stat"><small>Play time</small><b>${fmtTime(g.stats.playTime)}</b></div>
				<div class="stat"><small>Earned in all</small><b>${fmt(g.stats.allEarned)}</b></div>
				<div class="stat"><small>Flights</small><b>${fmt(g.stats.flights)}</b></div>
				<div class="stat"><small>Items sold</small><b>${fmt(g.stats.shipped)}</b></div>
			</div>
			<div class="menu-list">
				<button class="btn" data-act="resume">Resume</button>
				<button class="btn btn--ghost" data-act="how">How to play</button>
				<button class="btn btn--ghost" data-act="settings">Settings and save</button>
				<button class="btn btn--ghost" data-act="title">Title screen</button>
			</div>`;
		},
		act: (name) => {
			if (name === 'resume') closePanel();
			if (name === 'how') openHow();
			if (name === 'settings') openSettings();
			if (name === 'title') {
				closePanel();
				host.toTitle();
			}
		},
	});
}

export function openHow() {
	openPanel({
		id: 'how',
		title: 'How to play',
		render: () => `<ul class="how">
			<li><b>Tap a planet</b> on the space map to mine by hand.</li>
			<li><b>Open a planet</b> and pick a tool. Put <b>drills</b> on glowing ore tiles.</li>
			<li><b>Drag</b> to lay belts. Belts point the way you drag. Drag from a drill to the <b>launch pad</b>.</li>
			<li>Put a <b>smelter</b> on the line to turn ore into bars. Bars sell for more. Items a machine cannot use pass straight through it.</li>
			<li><b>Rocks</b> block building. Research <b>Blast Charges</b>, then tap a rock with <b>Remove</b> to clear it.</li>
			<li>Research <b>Belt Bridges</b> to cross lines. Drag a belt straight across another belt to make a <b>crossing</b>. With the <b>Bridge</b> tool, drag from one end to the other to hop over up to 3 tiles.</li>
			<li><b>Tap a machine</b> to upgrade, turn or remove it. Tap a belt with the belt tool to turn it.</li>
			<li><b>Ships</b> fly cargo home. If the pad fills up, buy more ships or cargo space.</li>
			<li><b>Crew</b> boost the planet they work on. Hire them once and keep them for good. Stardust buys more crew slots.</li>
			<li>Follow the <b>Next</b> bar at the top when you are not sure what to do.</li>
			<li>The game keeps working while you are away, up to a time limit.</li>
			<li>Keys: <b>1–9</b> tools, <b>0</b> remove, <b>R</b> turn, <b>Del</b> remove, <b>Esc</b> back, <b>Tab</b> map / planet.</li>
		</ul><button class="btn" style="width:100%" data-act="ok">Got it</button>`,
		act: (name) => name === 'ok' && closePanel(),
	});
}

// ---------- away summary ----------

export function openAway(r: { away: number; counted: number; earned: number; shipped: number; flights: number }, capHours: number) {
	const capped = r.counted < r.away;
	openPanel({
		id: 'away',
		title: 'While you were away',
		render: () => `<div class="away">
			<p>You were gone for <b>${fmtTime(r.away)}</b>. Your factories kept working.</p>
			<div class="away__big">+${fmt(r.earned)}</div>
			<div class="stats"><div class="stat"><small>Flights home</small><b>${fmt(r.flights)}</b></div><div class="stat"><small>Items sold</small><b>${fmt(r.shipped)}</b></div></div>
			${capped ? `<p>Only the first <b>${capHours} hours</b> count. Research Night Shift to work longer.</p>` : ''}
			<button class="btn btn--gold btn--big" style="width:100%" data-act="ok">Collect</button>
		</div>`,
		act: (name) => name === 'ok' && closePanel(),
	});
}

// ---------- ending ----------

export function openEnding() {
	openPanel({
		id: 'ending',
		title: 'The beacon is lit',
		render: () => {
			const g = host.game();
			return `<div class="away"><p>Light from your Star Beacon reaches every corner of the system. The cargo routes you built now carry ore from six worlds.</p>
			<div class="away__big">✦</div>
			<div class="stats"><div class="stat"><small>Play time</small><b>${fmtTime(g.stats.playTime)}</b></div><div class="stat"><small>Earned in all</small><b>${fmt(g.stats.allEarned)}</b></div><div class="stat"><small>Flights</small><b>${fmt(g.stats.flights)}</b></div><div class="stat"><small>Resets</small><b>${g.stats.resets}</b></div></div>
			<p>Thanks for playing. You can keep building, or go nova and grow even faster.</p>
			<button class="btn" style="width:100%" data-act="ok">Keep playing</button></div>`;
		},
		act: (name) => name === 'ok' && closePanel(),
	});
}

// ---------- crash ----------

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The game hit an error and stopped. It no longer saves, so the last good save stays on disk. */
export function openCrash(errors: string[]) {
	const report = errors.join('\n');
	openPanel({
		id: 'crash',
		title: 'Something broke',
		locked: true,
		still: true,
		render: () => `<p>The game hit an error and stopped so it would not save a broken game. Your last save is safe.</p>
			<p>Copy your save code to keep a backup, then reload. If you are testing, please send the error below with your bug report.</p>
			<textarea class="save-code" id="crash-log" readonly aria-label="Error details">${escapeHtml(report)}</textarea>
			<div class="menu-list">
				<button class="btn btn--ghost" data-act="save">Copy save code</button>
				<button class="btn btn--ghost" data-act="log">Copy error</button>
				<button class="btn btn--gold" data-act="reload">Reload</button>
			</div>`,
		act: (name) => {
			const copy = (text: string, done: string) =>
				navigator.clipboard?.writeText(text).then(
					() => host.toast(done),
					() => host.toast('Could not copy. Select the text and copy it', 'warn'),
				);
			if (name === 'save') {
				const code = exportStoredSave();
				if (code) copy(code, 'Save code copied');
				else host.toast('No save found on this device', 'warn');
			}
			if (name === 'log') copy(report, 'Error copied');
			if (name === 'reload') location.reload();
		},
	});
}

export function openConfirmNew(onYes: () => void) {
	openPanel({
		id: 'new',
		title: 'New game?',
		render: () => `<p>Starting over erases your save on this device, with stardust and perks. It cannot be undone.</p><div class="card__row"><button class="btn btn--ghost" data-act="no">Cancel</button><button class="btn btn--danger" data-act="yes">Start over</button></div>`,
		act: (name) => {
			closePanel();
			if (name === 'yes') onYes();
		},
	});
}

