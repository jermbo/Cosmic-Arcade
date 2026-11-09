// A bot that plays the game rules fast, to check pacing.
// Run: node tools/bot.ts [minutes] [tapsPerSecond]
// It prints when each goal and unlock happens, and flags long gaps.

import { BUF_IN, DX, DY, MACHINES, PERKS, PLANETS, TILE_ORE, TILE_ROCK, opposite } from '../src/core/data.ts';
import { STRIDE, buyablePlots, countOreInCells, nextPlotCost, ownedBounds, plotCells } from '../src/core/grid.ts';
import type { Dir, MachineType, PerkId, ResearchId, ShipUpgrade } from '../src/core/data.ts';
import { GOALS, checkProgress, currentGoal } from '../src/core/goals.ts';
import * as sim from '../src/core/sim.ts';
import { newGame, tilesOf } from '../src/core/state.ts';
import type { Game } from '../src/core/state.ts';

const minutes = Number(process.argv[2] || 60);
const tapsPerSec = Number(process.argv[3] ?? 4);
const quiet = process.argv.includes('--quiet');

let g: Game = newGame();
const DT = 0.1;
let t = 0;
const log: { t: number; what: string }[] = [];
const note = (what: string) => log.push({ t, what });

// ---------- layout planning ----------

const CHAIN: (MachineType | null)[] = ['compactor', 'forge', 'polisher', 'smelter', 'crusher'];
interface Plan {
	chain: number[];
	/** direction items move in each chain cell (toward the pad) */
	dirs: Dir[];
	net: Set<number>;
}
const plans: Plan[] = [];

const idx = sim.idx;
const xy = (i: number) => [i % STRIDE, Math.floor(i / STRIDE)] as const;

function planFor(pi: number): Plan {
	if (plans[pi]) return plans[pi];
	const tiles = tilesOf(pi);
	const [px, py] = PLANETS[pi].pad;
	const pad = idx(px, py);
	// Find a path of 5 free cells from the pad, preferring plain ground and straight runs.
	let best: { cells: number[]; dirs: Dir[]; score: number } | null = null;
	const walk = (cells: number[], dirs: Dir[], score: number) => {
		if (cells.length === 5) {
			const [ex, ey] = xy(cells[4]);
			let open = 0;
			const pl = g.planets[pi];
			for (let oy = -2; oy <= 2; oy++)
				for (let ox = -2; ox <= 2; ox++)
					if (sim.inGrid(g, pi, ex + ox, ey + oy) && tiles[idx(ex + ox, ey + oy)] !== TILE_ROCK) open++;
			score += open * 0.15;
			if (!best || score > best.score) best = { cells: cells.slice(), dirs: dirs.slice(), score };
			return;
		}
		const [x, y] = xy(cells.length ? cells[cells.length - 1] : pad);
		for (const d of [0, 1, 2, 3] as Dir[]) {
			const nx = x + DX[d];
			const ny = y + DY[d];
			if (!sim.inGrid(g, pi, nx, ny)) continue;
			const n = idx(nx, ny);
			if (n === pad || cells.includes(n) || tiles[n] === TILE_ROCK) continue;
			const straight = dirs.length && opposite(dirs[dirs.length - 1]) === d ? 0.2 : 0;
			cells.push(n);
			dirs.push(opposite(d));
			walk(cells, dirs, score + (tiles[n] === TILE_ORE ? 0 : 1) + straight);
			cells.pop();
			dirs.pop();
		}
	};
	walk([], [], 0);
	if (!best) throw new Error('no chain spot on planet ' + pi);
	const b = best as { cells: number[]; dirs: Dir[] };
	plans[pi] = { chain: b.cells, dirs: b.dirs, net: new Set() };
	return plans[pi];
}

function free(pi: number, i: number) {
	return !g.planets[pi].cells[i] && tilesOf(pi)[i] !== TILE_ROCK;
}

/** Lays belts from a start cell to the network. Returns cost, or -1. */
function pathToNet(pi: number, start: number, dryRun: boolean): number {
	const plan = planFor(pi);
	const tiles = tilesOf(pi);
	const head = plan.chain[plan.chain.length - 1];
	const dist = new Map<number, number>();
	const prev = new Map<number, number>();
	const queue: [number, number][] = [[start, 0]];
	dist.set(start, 0);
	let goal = -1;
	let goalFrom = -1;
	while (queue.length) {
		queue.sort((a, b) => a[1] - b[1]);
		const [c, dc] = queue.shift()!;
		if (dc > (dist.get(c) ?? Infinity)) continue;
		const [x, y] = xy(c);
		let done = false;
		for (const d of [0, 1, 2, 3] as Dir[]) {
			const nx = x + DX[d];
			const ny = y + DY[d];
			if (!sim.inGrid(g, pi, nx, ny)) continue;
			const n = idx(nx, ny);
			const m = g.planets[pi].cells[n];
			if (n === head || n === plan.chain[3] || (plan.net.has(n) && m && m.t === 'belt' && m.d !== opposite(d))) {
				goal = n;
				goalFrom = c;
				done = true;
				break;
			}
			if (!free(pi, n) || plan.chain.includes(n)) continue;
			const w = dc + (tiles[n] === TILE_ORE ? 6 : 1);
			if (w < (dist.get(n) ?? Infinity)) {
				dist.set(n, w);
				prev.set(n, c);
				queue.push([n, w]);
			}
		}
		if (done) break;
	}
	if (goal < 0) return -1;
	const path: number[] = [];
	for (let c = goalFrom; c !== undefined; c = prev.get(c)!) {
		path.push(c);
		if (c === start) break;
	}
	path.reverse(); // start .. goalFrom
	const cost = path.length * sim.buildCost(g, pi, 'belt');
	if (dryRun) return cost;
	if (g.credits < cost) return -1;
	for (let k = 0; k < path.length; k++) {
		const [x, y] = xy(path[k]);
		const next = k + 1 < path.length ? path[k + 1] : goal;
		const [nx, ny] = xy(next);
		const d = ([0, 1, 2, 3] as Dir[]).find((dd) => x + DX[dd] === nx && y + DY[dd] === ny)!;
		sim.place(g, pi, x, y, 'belt', d);
		plan.net.add(path[k]);
	}
	return cost;
}

function ensureChain(pi: number): boolean {
	const plan = planFor(pi);
	const cells = g.planets[pi].cells;
	for (let k = 0; k < plan.chain.length; k++) {
		const c = plan.chain[k];
		if (cells[c]) continue;
		const [x, y] = xy(c);
		if (!sim.place(g, pi, x, y, 'belt', plan.dirs[k])) return false;
	}
	return true;
}

/** Next ore tile we can drill and hook up, with its full cost. */
function nextDrillSpot(pi: number): { ore: number; cost: number; start: number; dir: Dir } | null {
	const tiles = tilesOf(pi);
	const plan = planFor(pi);
	const cells = g.planets[pi].cells;
	let best: { ore: number; cost: number; start: number; dir: Dir } | null = null;
	for (let i = 0; i < tiles.length; i++) {
		if (tiles[i] !== TILE_ORE || cells[i] || plan.chain.includes(i)) continue;
		const [x, y] = xy(i);
		for (const d of [0, 1, 2, 3] as Dir[]) {
			const nx = x + DX[d];
			const ny = y + DY[d];
			if (!sim.inGrid(g, pi, nx, ny)) continue;
			const n = idx(nx, ny);
			const m = cells[n];
			let cost: number;
			if (m && m.t === 'belt' && plan.net.has(n) && m.d !== opposite(d)) cost = 0;
			else if (n === plan.chain[plan.chain.length - 1]) cost = 0;
			else if (free(pi, n) && !plan.chain.includes(n) && tiles[n] !== TILE_ORE) {
				cost = pathToNet(pi, n, true);
				if (cost < 0) continue;
				cost += sim.buildCost(g, pi, 'belt');
			} else continue;
			cost += sim.buildCost(g, pi, 'drill');
			if (!best || cost < best.cost) best = { ore: i, cost, start: n, dir: d };
		}
	}
	return best;
}

function buildDrill(pi: number): boolean {
	const spot = nextDrillSpot(pi);
	if (!spot || g.credits < spot.cost) return false;
	if (!ensureChain(pi)) return false;
	const cells = g.planets[pi].cells;
	if (!cells[spot.start]) {
		const before = g.credits;
		// belt at start points along the path to the network
		const plan = planFor(pi);
		const tmp = pathToNet(pi, spot.start, false);
		if (tmp < 0) {
			g.credits = before;
			return false;
		}
		void plan;
	}
	const [x, y] = xy(spot.ore);
	return sim.place(g, pi, x, y, 'drill', spot.dir);
}

// ---------- decisions ----------

function upgradeLowest(pi: number, t: MachineType): { cost: number; run: () => boolean } | null {
	const cells = g.planets[pi].cells;
	let best = -1;
	for (let i = 0; i < cells.length; i++) {
		const m = cells[i];
		if (m && m.t === t && m.lv < MACHINES[t].maxLv && (best < 0 || m.lv < cells[best]!.lv)) best = i;
	}
	if (best < 0) return null;
	const [x, y] = xy(best);
	return { cost: sim.machineUpCost(pi, cells[best]!), run: () => sim.upgradeMachine(g, pi, x, y) };
}

function setStage(pi: number, k: number, t: MachineType): boolean {
	const plan = planFor(pi);
	const c = plan.chain[k];
	const m = g.planets[pi].cells[c];
	if (m && m.t === t) return false;
	if (g.credits < sim.buildCost(g, pi, t) + 2) return false;
	const [x, y] = xy(c);
	if (m) sim.removeAt(g, pi, x, y);
	return sim.place(g, pi, x, y, t, plan.dirs[k]);
}

interface Option {
	what: string;
	cost: number;
	score: number;
	run: () => boolean;
}

function options(): Option[] {
	const opts: Option[] = [];
	const rate = Math.max(1, sim.incomeRate());
	for (let pi = 0; pi < g.planets.length; pi++) {
		const p = g.planets[pi];
		if (!p.unlocked) continue;
		const val = PLANETS[pi].value;
		const plan = planFor(pi);
		const drills = sim.countOf(g, pi, 'drill');
		let blocked = 0;
		for (const m of p.cells) if (m && m.t === 'drill' && m.out.length >= 4) blocked++;
		const jam = drills > 0 && blocked / drills > 0.3;
		const goal = currentGoal(g)?.id || '';
		// processing stages
		for (let k = 0; k < CHAIN.length; k++) {
			const t = CHAIN[k]!;
			if (!sim.machineUnlocked(g, t)) continue;
			if (t === 'compactor' && pi < 1) continue;
			const m = p.cells[plan.chain[k]];
			if (m && m.t === t) {
				// upgrade when it is the bottleneck
				if (m.lv < MACHINES[t].maxLv && (m.inb.length >= BUF_IN - 1 || (t === 'compactor' && m.inb.length >= 8) || (goal === 'smelt3' && t === 'smelter'))) {
					opts.push({ what: `up ${t} p${pi}`, cost: sim.machineUpCost(pi, m), score: 3, run: () => sim.upgradeMachine(g, pi, ...xy(plan.chain[k])) });
				}
			} else if (drills >= 2 || (goal === 'crusher2' && t === 'crusher')) {
				opts.push({ what: `build ${t} p${pi}`, cost: sim.buildCost(g, pi, t), score: 4, run: () => setStage(pi, k, t) });
			}
		}
		// drills
		const spot = nextDrillSpot(pi);
		const drillGoal = (['drills3', 'drills6', 'drills8'].includes(goal) && pi === 0) || (['glacia2', 'glacia6'].includes(goal) && pi === 1) || (goal === 'verd5' && pi === 2) || (goal === 'solara5' && pi === 3) || goal === 'drills25';
		if (spot) opts.push({ what: `drill p${pi}`, cost: spot.cost, score: drills === 0 || drillGoal ? 10 : jam ? 0.3 : 2, run: () => buildDrill(pi) });
		// land: the plot with the most ore, when there is no room left or the goal asks
		const forSale = buyablePlots(p);
		if (forSale.length && (!spot || goal === 'survey')) {
			const tiles = tilesOf(pi, g.blasted[pi]);
			const plot = forSale.reduce((a, b) => (countOreInCells(tiles, plotCells(b)) > countOreInCells(tiles, plotCells(a)) ? b : a));
			opts.push({ what: `land p${pi}`, cost: nextPlotCost(pi, p), score: goal === 'survey' ? 5 : 3, run: () => sim.buyPlot(g, pi, plot).ok });
		}
		const up = upgradeLowest(pi, 'drill');
		if (up && (drills >= 3 || goal === 'upgrade')) opts.push({ what: `up drill p${pi}`, cost: up.cost, score: goal === 'upgrade' ? 5 : jam ? 0.2 : 1.6, run: up.run });
		if (jam && g.unlocks.includes('research') && g.research.belt < sim.RESEARCH.belt.max) opts.push({ what: 'research belt', cost: sim.researchCost(g, 'belt'), score: 3, run: () => sim.buyResearch(g, 'belt') });
		// pylon next to the chain
		if (sim.machineUnlocked(g, 'pylon') && sim.countOf(g, pi, 'pylon') < 2) {
			const near = [plan.chain[2], plan.chain[3]].flatMap((c) => {
				const [x, y] = xy(c);
				return [0, 1, 2, 3]
					.map((d) => [x + DX[d], y + DY[d]] as const)
					.filter(([a, b]) => sim.inGrid(g, pi, a, b) && free(pi, idx(a, b)) && !plan.net.has(idx(a, b)));
			});
			if (near.length) opts.push({ what: `pylon p${pi}`, cost: sim.buildCost(g, pi, 'pylon'), score: 2.5, run: () => sim.place(g, pi, near[0][0], near[0][1], 'pylon', 0) });
		}
		const pyl = upgradeLowest(pi, 'pylon');
		if (pyl) opts.push({ what: `up pylon p${pi}`, cost: pyl.cost, score: 1.2, run: pyl.run });
		// ships when the pad backs up
		const padFull = p.pad.length > 20;
		if (goal === 'market' && g.unlocks.includes('research')) opts.push({ what: 'research market', cost: sim.researchCost(g, 'market'), score: 5, run: () => sim.buyResearch(g, 'market') });
		if (goal === 'glaciaShip' && pi === 1) opts.push({ what: 'ships p1', cost: sim.shipUpCost(g, 1, 'ships'), score: 5, run: () => sim.buyShipUp(g, 1, 'ships') });
		if ((goal === 'belts' || goal === 'belts3') && g.unlocks.includes('research')) opts.push({ what: 'research belt', cost: sim.researchCost(g, 'belt'), score: 5, run: () => sim.buyResearch(g, 'belt') });
		if (goal === 'research' && g.unlocks.includes('research')) opts.push({ what: 'research tap', cost: sim.researchCost(g, 'tap'), score: 5, run: () => sim.buyResearch(g, 'tap') });
		const shipGoal = pi === 0 && ['ship2', 'cargo', 'ships3'].includes(goal);
		for (const u of ['cargo', 'speed', 'ships'] as ShipUpgrade[]) {
			if (p.up[u] >= sim.SHIP_UPS[u].max) continue;
			opts.push({ what: `${u} p${pi}`, cost: sim.shipUpCost(g, pi, u), score: padFull || shipGoal ? 4 : 0.8, run: () => sim.buyShipUp(g, pi, u) });
		}
		void val;
	}
	if (g.unlocks.includes('research')) {
		for (const r of ['belt', 'tap', 'market', 'offline'] as ResearchId[]) {
			if (g.research[r] >= sim.RESEARCH[r].max) continue;
			const s = r === 'market' ? 2.2 : r === 'belt' ? 1.4 : r === 'tap' ? (tapsPerSec > 0 ? 1.5 : 0) : 0.2;
			opts.push({ what: `research ${r}`, cost: sim.researchCost(g, r), score: s, run: () => sim.buyResearch(g, r) });
		}
		if (g.planets[5].unlocked && !g.beaconLit) opts.push({ what: 'beacon', cost: sim.researchCost(g, 'beacon'), score: 5, run: () => sim.buyResearch(g, 'beacon') });
	}
	const next = g.planets.findIndex((p) => !p.unlocked);
	if (next > 0) {
		const cost = PLANETS[next].unlock;
		opts.push({ what: `unlock ${PLANETS[next].name}`, cost, score: 6, run: () => sim.unlockPlanet(g, next) });
		void rate;
	}
	return opts;
}

function decide() {
	const rate = Math.max(0.5, sim.incomeRate());
	const opts = options();
	// Value: score, but prefer cheap things. Ignore anything that would take > 3 min to afford.
	let best: Option | null = null;
	let bestV = -Infinity;
	for (const o of opts) {
		if ((banned.get(o.what) || 0) > t) continue;
		const wait = Math.max(0, o.cost - g.credits) / rate;
		if (wait > 60) continue;
		if (o.what.startsWith('unlock') && g.credits < o.cost) continue;
		const v = o.score / Math.log10(10 + o.cost / rate);
		if (v > bestV) {
			bestV = v;
			best = o;
		}
	}
	if (!best) return;
	// Save up for the planet when it is near.
	const unlock = opts.find((o) => o.what.startsWith('unlock'));
	if (unlock && unlock !== best && unlock.cost < rate * 400) {
		if (g.credits >= unlock.cost) best = unlock;
		else if (best.cost > (unlock.cost - g.credits) * 0.15) return;
	}
	if (g.credits >= best.cost) {
		const ok = best.run();
		if (!ok) {
			fails[best.what] = (fails[best.what] || 0) + 1;
			banned.set(best.what, t + 30);
		}
		if (ok) {
			buys[best.what.split(' ')[0]] = (buys[best.what.split(' ')[0]] || 0) + 1;
			if (best.what.startsWith('unlock') || best.what.startsWith('build') || best.what === 'beacon') note(`${best.what}  (income ${fmt(sim.incomeRate())}/s)`);
		}
	}
}

const buys: Record<string, number> = {};
const fails: Record<string, number> = {};
const banned = new Map<string, number>();

// ---------- run ----------

let tapAcc = 0;
let decideAcc = 0;
let prestiged = 0;
sim.setEvents(true);
while (t < minutes * 60) {
	sim.tick(g, DT);
	t += DT;
	const tr = t < 180 ? Math.max(tapsPerSec, tapsPerSec ? 5 : 0) : tapsPerSec * 0.3;
	tapAcc += tr * DT;
	while (tapAcc >= 1) {
		tapAcc -= 1;
		const top = g.planets.reduce((a, p, i) => (p.unlocked ? i : a), 0);
		sim.tap(g, top);
	}
	decideAcc += DT;
	if (decideAcc >= 0.5) {
		decideAcc = 0;
		decide();
		checkProgress(g);
		for (const e of sim.events) {
			if (e.type === 'goal') note('GOAL ' + e.text);
			if (e.type === 'unlock') note('UNLOCK ' + e.title);
		}
		sim.events.length = 0;
		// Reset when it doubles our stardust, after Solara.
		if (sim.canPrestige(g) && sim.prestigeGain(g) >= Math.max(6, g.stardust * 1.5) && g.planets[4].unlocked && !g.planets[5].unlocked) {
			note(`PRESTIGE +${sim.prestigeGain(g)} stardust (run earned ${fmt(g.runEarned)})`);
			g = sim.prestige(g);
			plans.length = 0;
			prestiged++;
			for (const id of Object.keys(PERKS) as PerkId[]) sim.buyPerk(g, id);
			note('perks: ' + Object.keys(g.perks).join(','));
		}
	}
	if (Math.floor(t) % 300 === 0 && Math.abs(t - Math.round(t)) < DT / 2 && !quiet) {
		const drills = g.planets.map((p, i) => (p.unlocked ? sim.countOf(g, i, 'drill') : '-')).join('/');
		console.log(`  [${clock(t)}] credits ${fmt(g.credits)}  income ${fmt(sim.incomeRate())}/s  drills ${drills}  planets ${g.planets.filter((p) => p.unlocked).length}`);
	}
}

function clock(s: number) {
	const m = Math.floor(s / 60);
	const r = Math.floor(s % 60);
	return `${m}:${String(r).padStart(2, '0')}`;
}
function fmt(n: number) {
	const units = ['', 'K', 'M', 'B', 'T', 'Qa'];
	let u = 0;
	while (Math.abs(n) >= 1000 && u < units.length - 1) {
		n /= 1000;
		u++;
	}
	return (u ? n.toFixed(1) : n.toFixed(0)) + units[u];
}

let last = 0;
let worst = 0;
for (const e of log) {
	const gap = e.t - last;
	const flag = gap > 180 && e.t < 3600 ? '   <-- long gap' : '';
	if (e.t < 3600 && (e.what.startsWith('GOAL') || e.what.startsWith('UNLOCK') || e.what.startsWith('unlock') || e.what.startsWith('build'))) worst = Math.max(worst, gap);
	console.log(`${clock(e.t).padStart(6)}  ${e.what}${flag}`);
	if (e.what.startsWith('GOAL') || e.what.startsWith('UNLOCK') || e.what.startsWith('unlock') || e.what.startsWith('build')) last = e.t;
}
console.log(`\nGoals done: ${g.goals.length}/${GOALS.length}. Prestiges: ${prestiged}. Stardust: ${g.stardust}. Worst gap in hour 1: ${clock(worst)}`);
console.log('buys', JSON.stringify(buys));
console.log('fails', JSON.stringify(fails));

if (process.argv.includes('--map')) {
	const sym: Record<string, string> = { drill: 'D', smelter: 'S', crusher: 'C', polisher: 'P', pylon: 'Y', compactor: 'K', forge: 'F', pad: '#' };
	const arrow = ['>', 'v', '<', '^'];
	g.planets.forEach((p, pi) => {
		if (!p.unlocked) return;
		console.log(`\n${PLANETS[pi].name}  ships ${p.ships.length} cargo ${p.up.cargo} speed ${p.up.speed}  pad ${p.pad.length}`);
		const tiles = tilesOf(pi);
		const box = ownedBounds(p);
		for (let y = box.y0; y <= box.y1; y++) {
			let row = '';
			for (let x = box.x0; x <= box.x1; x++) {
				const m = p.cells[idx(x, y)];
				const tl = tiles[idx(x, y)];
				row += m ? (m.t === 'belt' ? arrow[m.d] : sym[m.t] + (m.lv > 9 ? '+' : m.lv)) .padEnd(2) : tl === TILE_ORE ? 'o ' : tl === TILE_ROCK ? 'X ' : '. ';
			}
			console.log('  ' + row);
		}
	});
}
if (process.argv.includes('--opts')) {
	console.log('credits', fmt(g.credits), 'rate', fmt(sim.incomeRate()));
	for (const o of options()) console.log(o.what, fmt(o.cost), o.score);
	console.log('spot1', JSON.stringify(nextDrillSpot(1)));
	g.planets[1].cells.forEach((m, i) => m && m.t !== 'belt' && console.log(i, m.t, m.lv, 'in', m.inb.length, 'out', m.out.length));
}
