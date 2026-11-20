// The Remix show. The engine has already moved the blocks. Here they rattle and glow (the charge),
// then every block flies on its own curve from its old cell to its new one (the flight).
// `view.remix` holds the show while it plays, and is null again when it is over.
// The show tells the view's onRemix about its moments ('charge', 'boom', 'tick', and a style's
// own events), so the game can play sounds and buzz the phone.

import { REMIX_STYLES } from './remix-styles.js';
import { visualOf } from './block-motion.js';

const CHARGE_JITTER = 0.16; // cells a block shakes at the end of the charge
const CHARGE_SWELL = 0.14; // how much a block grows at the end of the charge
const WAIT_JITTER = 0.1; // cells a block shakes while it waits for its turn to fly
const LANDING_SQUASH = { sx: 1.25, sy: 0.78 };
const TICK_GAP = 0.05; // seconds: landing ticks play at most this often

/** Starts the show for the moves of a Remix: [{ block, from, to }] (cell indexes). */
export function startRemix(view, moves, styleName = view.remixStyle) {
	const { game } = view;
	const style = REMIX_STYLES[styleName] || REMIX_STYLES.scatter;
	const mid = { x: (game.cols - 1) / 2, y: (game.rows - 1) / 2 };
	const byNewCell = moves.slice().sort((a, b) => a.to - b.to);
	const flights = moves.map((move) => {
		const from = { x: game.columnOf(move.from), y: game.rowOf(move.from) };
		const to = { x: game.columnOf(move.to), y: game.rowOf(move.to) };
		readyToFly(visualOf(view, move.block, from.x, from.y), from);
		const plan = style.plan({ from, to, mid, cols: game.cols, rows: game.rows, order: byNewCell.indexOf(move) });
		return { block: move.block, from, to, ...plan, done: false };
	});
	view.remix = {
		phase: 'charge',
		t: 0,
		flights,
		landed: 0,
		tickWait: 0,
		charge: style.charge,
		rattle: style.rattle,
		swell: style.swell ?? style.rattle,
		events: (style.events || []).map((event) => ({ ...event, fired: false })),
	};
	view.onRemix?.('charge', style.charge, style.sound);
	if (!style.charge) launch(view);
}

function readyToFly(visual, from) {
	visual.x = from.x;
	visual.y = from.y;
	visual.vy = 0;
	visual.delay = 0;
	visual.fly = true;
}

export function updateRemix(view, dt) {
	const show = view.remix;
	if (!show || !view.game) return;
	show.t += dt;
	if (show.phase === 'charge') updateCharge(view, show);
	else updateFlight(view, show, dt);
}

/** The blocks rattle and swell more and more until the launch. */
function updateCharge(view, show) {
	const charged = Math.min(1, show.t / show.charge);
	for (const flight of show.flights) {
		const visual = view.blockVisuals.get(flight.block.id);
		if (!visual) continue;
		jitter(visual, charged * CHARGE_JITTER * show.rattle);
		visual.sx = visual.sy = 1 + charged * CHARGE_SWELL * show.swell;
	}
	if (show.t >= show.charge) launch(view);
}

function launch(view) {
	view.remix.phase = 'fly';
	view.remix.t = 0;
	view.onRemix?.('boom');
}

/** Flight: every block follows the path its style gave it. */
function updateFlight(view, show, dt) {
	const { game } = view;
	show.tickWait -= dt;
	fireEvents(view, show);
	for (const flight of show.flights) {
		if (flight.done) continue;
		const visual = view.blockVisuals.get(flight.block.id);
		if (!visual) {
			flight.done = true;
			continue;
		}
		const progress = Math.min(1, Math.max(0, (show.t - flight.delay) / flight.dur));
		if (progress <= 0) {
			jitter(visual, WAIT_JITTER * show.rattle);
			continue;
		}
		const point = flight.at(progress);
		visual.jx = visual.jy = 0;
		// Paths stay inside the well.
		visual.x = Math.min(game.cols - 1, Math.max(0, point.x));
		visual.y = Math.min(game.rows - 1, Math.max(0, point.y));
		visual.rot = point.rot;
		visual.sx = visual.sy = point.s;
		if (progress >= 1) land(view, flight, visual, show);
	}
	if (show.flights.every((flight) => flight.done)) view.remix = null;
}

function fireEvents(view, show) {
	for (const event of show.events) {
		if (event.fired || show.t < event.at) continue;
		event.fired = true;
		view.onRemix?.(event.name, event.value);
	}
}

/** A block reaches its new cell: it squashes, and the landing ticks (not more often than TICK_GAP). */
function land(view, flight, visual, show) {
	flight.done = true;
	visual.fly = false;
	visual.x = flight.to.x;
	visual.y = flight.to.y;
	visual.rot = 0;
	visual.sx = LANDING_SQUASH.sx;
	visual.sy = LANDING_SQUASH.sy;
	if (show.tickWait > 0) return;
	show.tickWait = TICK_GAP;
	view.onRemix?.('tick', show.landed++);
}

/** Shakes a block by up to half of `amount` cells each way. */
function jitter(visual, amount) {
	visual.jx = (Math.random() - 0.5) * amount;
	visual.jy = (Math.random() - 0.5) * amount;
}
