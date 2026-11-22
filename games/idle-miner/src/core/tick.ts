// The tick: machines work, belts move items, ships fly and sell. Also the time the player was away.

import { BASE_OFFLINE_HOURS } from '../content/economy.ts';
import { CRATE_SIZE } from '../content/items.ts';
import { BELT_SPACING, BUF_IN, BUF_OUT, MACHINES } from '../content/machines.ts';
import { SHIP } from '../content/ships.ts';
import { DX, DY, opposite } from './direction.ts';
import type { Dir } from './direction.ts';
import { isCrate, kindOf, planetOfKind } from './items.ts';
import { beltSpeed, levelSpeed } from './levels.ts';
import { statAdd } from './effects.ts';
import { TILE_ORE } from './tiles.ts';
import { cellIdx, cellX, cellY, inPlay, ownedBounds } from './grid.ts';
import { tilesOf } from './planet-map.ts';
import type { BeltItem, Game, Machine, PlanetState } from './game.ts';
import { emitOn, setEvents, emit } from './events.ts';
import { stepIncome, earn } from './income.ts';
import { sellMult, itemValue } from './prices.ts';
import { idx, bridgeSpan, bridgeOk, uses, derived } from './layout.ts';
import { crewOf, syncCrew } from './crew.ts';
import { travelTime, shipCap, padCap } from './ships.ts';

function accepts(m: Machine, k: number): boolean {
	return uses(m, k) && m.inb.length < (MACHINES[m.t].holds ?? BUF_IN);
}

/** Try to move an item into cell (x, y), moving in direction dir. */
function push(p: PlanetState, x: number, y: number, dir: Dir, k: number, pi: number): boolean {
	if (!inPlay(x, y, p, pi)) return false;
	const m = p.cells[idx(x, y)];
	if (!m) return false;
	switch (m.t) {
		case 'belt': {
			if (m.d === opposite(dir)) return false;
			const last = m.items[m.items.length - 1];
			if (last && last.p < BELT_SPACING) return false;
			m.items.push({ k, p: 0, e: dir });
			return true;
		}
		case 'cross': {
			// Two lanes: across (left/right) and down (up/down). Each keeps its own spacing.
			let last: BeltItem | undefined;
			for (const it of m.items) {
				if (it.e % 2 !== dir % 2) continue;
				if (it.e !== dir) return false;
				last = it;
			}
			if (last && last.p < BELT_SPACING) return false;
			m.items.push({ k, p: 0, e: dir });
			return true;
		}
		case 'bridge': {
			if (dir === opposite(m.d)) return false;
			const span = m.end || m.link === undefined ? 1 : bridgeSpan(idx(x, y), m.link);
			const last = m.items[m.items.length - 1];
			if (last && last.p < BELT_SPACING / span) return false;
			m.items.push({ k, p: 0, e: m.end ? dir : m.d });
			return true;
		}
		case 'pad':
			if (p.pad.length >= padCap(p)) return false;
			p.pad.push(k);
			return true;
		case 'drill':
		case 'pylon':
			return false;
		default:
			if (accepts(m, k)) {
				m.inb.push(k);
				return true;
			}
			// Items a machine cannot use slide straight through it, so mixed belts never jam.
			if (!uses(m, k)) {
				const thru = (m.thru ??= []);
				const last = thru[thru.length - 1];
				if (thru.length + m.out.length >= BUF_OUT || (last && last.p < BELT_SPACING)) return false;
				thru.push({ k, p: 0, e: dir });
				return true;
			}
			return false;
	}
}

/** Moves a line of items forward by step. The front one leaves through out() at the end. */
function moveLine(items: BeltItem[], step: number, span: number, out: (k: number) => boolean) {
	const front = items[0];
	front.p += step;
	if (front.p >= 1) {
		if (out(front.k)) items.shift();
		else front.p = 1;
	}
	const gap = BELT_SPACING / span;
	for (let n = items[0] === front ? 1 : 0; n < items.length; n++) {
		const lim = n === 0 ? 1 : items[n - 1].p - gap;
		items[n].p = Math.min(items[n].p + step, lim);
	}
}

function moveCross(p: PlanetState, i: number, m: Machine, bs: number, pi: number) {
	const x = cellX(i);
	const y = cellY(i);
	for (const lane of [0, 1]) {
		const items = m.items.filter((it) => it.e % 2 === lane);
		if (!items.length) continue;
		const e = items[0].e;
		moveLine(items, bs, 1, (k) => push(p, x + DX[e], y + DY[e], e, k, pi));
		// keep the other lane, plus what is left of this one
		m.items = m.items.filter((it) => it.e % 2 !== lane).concat(items);
	}
}

function tryOutput(p: PlanetState, i: number, m: Machine, dt: number, pi: number) {
	if (!m.out.length) {
		m.stuck = 0;
		return;
	}
	const x = cellX(i);
	const y = cellY(i);
	if (push(p, x + DX[m.d], y + DY[m.d], m.d, m.out[0], pi)) {
		m.out.shift();
		m.stuck = 0;
	} else if (m.out.length >= BUF_OUT) m.stuck = (m.stuck || 0) + dt;
}

/** Moves pass-through items across a machine, like a short belt that ends in its output. */
function moveThru(m: Machine, bs: number) {
	const thru = m.thru;
	if (!thru || !thru.length) return;
	const front = thru[0];
	front.p = Math.min(1, front.p + bs);
	if (front.p >= 1 && m.out.length < BUF_OUT) {
		m.out.push(front.k);
		thru.shift();
	}
	for (let n = thru[0] === front ? 1 : 0; n < thru.length; n++) {
		const lim = n === 0 ? 1 : thru[n - 1].p - BELT_SPACING;
		thru[n].p = Math.min(thru[n].p + bs, lim);
	}
}

function startJob(m: Machine): boolean {
	const def = MACHINES[m.t];
	if (m.t === 'compactor') {
		const counts = new Map<number, number>();
		for (const k of m.inb) counts.set(k, (counts.get(k) || 0) + 1);
		for (const [k, c] of counts) {
			if (c >= CRATE_SIZE) {
				let left = CRATE_SIZE;
				m.inb = m.inb.filter((v) => (v === k && left-- > 0 ? false : true));
				m.job = true;
				m.prog = 0;
				m.kind = k + 5;
				return true;
			}
		}
		return false;
	}
	if (m.inb.length < def.need || m.out.length + def.outCount > BUF_OUT) return false;
	const k = m.inb[0];
	m.inb.splice(0, def.need);
	m.kind = kindOf(planetOfKind(k), def.outForm);
	m.job = true;
	m.prog = 0;
	return true;
}

function tickPlanet(g: Game, pi: number, dt: number) {
	const p = g.planets[pi];
	const boost = derived(p, pi);
	const crew = crewOf(p);
	const bs = beltSpeed(g) * dt;
	const tiles = tilesOf(pi, g.blasted[pi]);
	const box = ownedBounds(p);
	for (let y = box.y0; y <= box.y1; y++) {
		for (let x = box.x0; x <= box.x1; x++) {
			const i = cellIdx(x, y);
			const m = p.cells[i];
			if (!m) continue;
			let working = false;
			switch (m.t) {
			case 'belt': {
				const items = m.items;
				if (!items.length) break;
				const front = items[0];
				front.p += bs;
				if (front.p >= 1) {
					const x = cellX(i);
					const y = cellY(i);
					if (push(p, x + DX[m.d], y + DY[m.d], m.d, front.k, pi)) items.shift();
					else front.p = 1;
				}
				for (let n = items[0] === front ? 1 : 0; n < items.length; n++) {
					const lim = n === 0 ? 1 : items[n - 1].p - BELT_SPACING;
					items[n].p = Math.min(items[n].p + bs, lim);
				}
				break;
			}
			case 'cross':
				if (m.items.length) moveCross(p, i, m, bs, pi);
				break;
			case 'bridge': {
				if (!m.items.length) break;
				const x = cellX(i);
				const y = cellY(i);
				if (m.end) {
					moveLine(m.items, bs, 1, (k) => push(p, x + DX[m.d], y + DY[m.d], m.d, k, pi));
				} else if (bridgeOk(p, i, m)) {
					const span = bridgeSpan(i, m.link!);
					const ex = cellX(m.link!);
					const ey = cellY(m.link!);
					moveLine(m.items, bs / span, span, (k) => push(p, ex, ey, m.d, k, pi));
				}
				break;
			}
			case 'drill': {
				if (tiles[i] === TILE_ORE && m.out.length < BUF_OUT) {
					m.prog += (dt / MACHINES.drill.time) * levelSpeed(m.lv) * boost[i] * crew.drill;
					working = true;
					if (m.prog >= 1) {
						m.prog -= 1;
						m.out.push(kindOf(pi, 0));
						emit({ type: 'made', planet: pi, cell: i, t: m.t });
					}
				}
				tryOutput(p, i, m, dt, pi);
				break;
			}
			case 'pad':
			case 'pylon':
				working = m.t === 'pylon';
				break;
			default: {
				if (!m.job) startJob(m);
				if (m.job) {
					const def = MACHINES[m.t];
					m.prog += (dt / def.time) * levelSpeed(m.lv) * boost[i] * crew.machine;
					working = true;
					if (m.prog >= 1) {
						const k = m.kind ?? kindOf(pi, def.outForm);
						for (let c = 0; c < def.outCount; c++) m.out.push(k);
						m.job = false;
						m.prog = 0;
						emit({ type: 'made', planet: pi, cell: i, t: m.t });
						startJob(m);
					}
				}
				moveThru(m, bs);
				tryOutput(p, i, m, dt, pi);
			}
			}
			if (m.glow !== undefined || working) m.glow = Math.max(0, Math.min(1, (m.glow || 0) + (working ? dt * 4 : -dt * 2)));
		}
	}
	tickShips(g, pi, dt);
}

function tickShips(g: Game, pi: number, dt: number) {
	const p = g.planets[pi];
	const cap = shipCap(p);
	const T = travelTime(p, pi);
	let docked = false;
	for (const s of p.ships) {
		if (s.ph === 0) {
			if (docked) continue;
			docked = true;
			// Load fast, but not all at once, so the pad visibly empties.
			let load = Math.max(1, Math.round(dt * SHIP.loadPerSecond));
			while (load-- > 0 && s.cargo.length < cap && p.pad.length) s.cargo.push(p.pad.shift()!);
			if (s.cargo.length) s.wait += dt;
			if (s.cargo.length >= cap || (s.cargo.length && s.wait >= SHIP.wait)) {
				s.ph = 1;
				s.t = 0;
				emit({ type: 'depart', planet: pi });
			}
		} else {
			s.t += dt / T;
			if (s.t >= 1) {
				s.t = 0;
				if (s.ph === 1) {
					sell(g, pi, s.cargo);
					s.cargo = [];
					s.ph = 2;
				} else {
					s.ph = 0;
					s.wait = 0;
					emit({ type: 'dock', planet: pi });
				}
			}
		}
	}
}

function sell(g: Game, pi: number, cargo: number[]) {
	let v = 0;
	let count = 0;
	for (const k of cargo) {
		v += itemValue(k);
		count += isCrate(k) ? CRATE_SIZE : 1;
	}
	v *= sellMult(g) * crewOf(g.planets[pi]).sell;
	earn(g, v, true);
	g.stats.shipped += count;
	g.stats.flights++;
	emit({ type: 'sold', planet: pi, amount: v, count });
}

export function tick(g: Game, dt: number) {
	g.stats.playTime += dt;
	stepIncome(dt);
	syncCrew(g);
	for (let pi = 0; pi < g.planets.length; pi++) if (g.planets[pi].unlocked) tickPlanet(g, pi, dt);
}

export function offlineCapHours(g: Game) {
	return BASE_OFFLINE_HOURS + statAdd(g, 'awayHours');
}

/** Runs the game for time spent away. Returns what happened. */
export function catchUp(g: Game, seconds: number) {
	const capped = Math.min(seconds, offlineCapHours(g) * 3600);
	const before = { credits: g.runEarned, shipped: g.stats.shipped, flights: g.stats.flights };
	const was = emitOn;
	setEvents(false);
	const live = Math.min(capped, 240);
	const step = 0.1;
	let t = 0;
	let markEarned = g.runEarned;
	let markShipped = g.stats.shipped;
	let markFlights = g.stats.flights;
	const markAt = Math.max(0, live - 120);
	while (t < live) {
		tick(g, step);
		t += step;
		if (t - step < markAt && t >= markAt) {
			markEarned = g.runEarned;
			markShipped = g.stats.shipped;
			markFlights = g.stats.flights;
		}
	}
	const rest = capped - live;
	if (rest > 0) {
		const span = Math.max(1, live - markAt);
		const rate = (g.runEarned - markEarned) / span;
		earn(g, rate * rest, false);
		g.stats.shipped += Math.round(((g.stats.shipped - markShipped) / span) * rest);
		g.stats.flights += Math.round(((g.stats.flights - markFlights) / span) * rest);
	}
	setEvents(was);
	return {
		away: seconds,
		counted: capped,
		earned: g.runEarned - before.credits,
		shipped: g.stats.shipped - before.shipped,
		flights: g.stats.flights - before.flights,
	};
}
