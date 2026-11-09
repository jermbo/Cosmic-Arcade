// Goals: the "what next" list, and the features that open up as you play.

import { MACHINES, PLANETS } from './data.ts';
import { countAll, countOf, earn, emit, incomeRate, machineUnlocked } from './sim.ts';
import type { Game } from './state.ts';

export interface Goal {
	id: string;
	text: string;
	/** where the hint points: 'space', 'planet:<n>', 'research', 'ships:<n>', 'prestige' */
	where: string;
	progress: (g: Game) => [number, number];
}

const maxLv = (g: Game) => {
	let lv = 1;
	for (const p of g.planets) for (const m of p.cells) if (m && m.t !== 'pad') lv = Math.max(lv, m.lv);
	return lv;
};
const maxLvOf = (g: Game, t: string) => {
	let lv = 0;
	for (const p of g.planets) for (const m of p.cells) if (m && m.t === t) lv = Math.max(lv, m.lv);
	return lv;
};
/** Best income seen this run. */
const peak = (g: Game) => {
	g.peakIncome = Math.max(g.peakIncome || 0, incomeRate());
	return g.peakIncome;
};
const bool = (b: boolean): [number, number] => [b ? 1 : 0, 1];
const n = (have: number, want: number): [number, number] => [Math.min(have, want), want];

export const GOALS: Goal[] = [
	{ id: 'tap', text: 'Tap Cinder to mine ore', where: 'space', progress: (g) => n(g.stats.taps, 8) },
	{ id: 'drill', text: 'Open Cinder and build a drill on ore', where: 'planet:0', progress: (g) => bool(countAll(g, 'drill') >= 1) },
	{ id: 'belt', text: 'Drag belts from the drill to the launch pad', where: 'planet:0', progress: (g) => bool(g.stats.flights >= 1 || g.planets[0].pad.length > 0 || g.planets[0].ships.some((s) => s.cargo.length > 0)) },
	{ id: 'ship', text: 'Wait for the ship to sell your ore at home', where: 'space', progress: (g) => bool(g.stats.flights >= 1) },
	{ id: 'drills3', text: 'Build 3 drills on Cinder', where: 'planet:0', progress: (g) => n(countOf(g, 0, 'drill'), 3) },
	{ id: 'smelter', text: 'Put a smelter on the belt. Bars sell for 4x', where: 'planet:0', progress: (g) => bool(countAll(g, 'smelter') >= 1) },
	{ id: 'ship2', text: 'Buy a second ship for Cinder', where: 'ships:0', progress: (g) => n(g.planets[0].up.ships, 1) },
	{ id: 'upgrade', text: 'Tap a drill and upgrade it', where: 'planet:0', progress: (g) => bool(maxLvOf(g, 'drill') >= 2) },
	{ id: 'research', text: 'Research Power Gloves to tap harder', where: 'research', progress: (g) => n(g.research.tap, 1) },
	{ id: 'drills6', text: 'Build 6 drills on Cinder', where: 'planet:0', progress: (g) => n(countOf(g, 0, 'drill'), 6) },
	{ id: 'cargo', text: 'Upgrade Cinder cargo or engines 3 times', where: 'ships:0', progress: (g) => n(g.planets[0].up.cargo + g.planets[0].up.speed, 3) },
	{ id: 'smelt3', text: 'Upgrade a smelter to level 3', where: 'planet:0', progress: (g) => n(maxLvOf(g, 'smelter'), 3) },
	{ id: 'belts', text: 'Research Mag Belts to speed up belts', where: 'research', progress: (g) => n(g.research.belt, 1) },
	{ id: 'drills8', text: 'Build 8 drills on Cinder', where: 'planet:0', progress: (g) => n(countOf(g, 0, 'drill'), 8) },
	{ id: 'market', text: 'Research Trade Deals to sell for more', where: 'research', progress: (g) => n(g.research.market, 1) },
	{ id: 'glacia', text: 'Unlock Glacia', where: 'space', progress: (g) => bool(g.planets[1].unlocked) },
	{ id: 'glacia2', text: 'Build 2 drills on Glacia', where: 'planet:1', progress: (g) => n(countOf(g, 1, 'drill'), 2) },
	{ id: 'crusher', text: 'Put a crusher before a smelter', where: 'planet:1', progress: (g) => bool(countAll(g, 'crusher') >= 1) },
	{ id: 'glaciaShip', text: 'Buy a second ship for Glacia', where: 'ships:1', progress: (g) => n(g.planets[1].up.ships, 1) },
	{ id: 'glacia6', text: 'Build 6 drills on Glacia', where: 'planet:1', progress: (g) => n(countOf(g, 1, 'drill'), 6) },
	{ id: 'crusher2', text: 'Add a crusher on Cinder too', where: 'planet:0', progress: (g) => n(countOf(g, 0, 'crusher'), 1) },
	{ id: 'level5', text: 'Upgrade any machine to level 5', where: 'planet:1', progress: (g) => n(maxLv(g), 5) },
	{ id: 'belts3', text: 'Get Mag Belts to level 3', where: 'research', progress: (g) => n(g.research.belt, 3) },
	{ id: 'inc40', text: 'Reach 40 credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 40) },
	{ id: 'market2', text: 'Get Trade Deals to level 2', where: 'research', progress: (g) => n(g.research.market, 2) },
	{ id: 'inc100', text: 'Reach 100 credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 100) },
	{ id: 'verdance', text: 'Unlock Verdance', where: 'space', progress: (g) => bool(g.planets[2].unlocked) },
	{ id: 'polisher', text: 'Put a polisher after a smelter. Gems sell high', where: 'planet:2', progress: (g) => bool(countAll(g, 'polisher') >= 1) },
	{ id: 'verd5', text: 'Build 5 drills on Verdance', where: 'planet:2', progress: (g) => n(countOf(g, 2, 'drill'), 5) },
	{ id: 'polish2', text: 'Have polishers on 2 planets', where: 'planet:1', progress: (g) => n(g.planets.filter((_, i) => countOf(g, i, 'polisher') > 0).length, 2) },
	{ id: 'ships3', text: 'Have 3 ships on one route', where: 'ships:2', progress: (g) => n(Math.max(...g.planets.map((p) => p.up.ships)) + 1, 3) },
	{ id: 'drills25', text: 'Have 25 drills across your planets', where: 'space', progress: (g) => n(countAll(g, 'drill'), 25) },
	{ id: 'level8', text: 'Upgrade any machine to level 8', where: 'planet:2', progress: (g) => n(maxLv(g), 8) },
	{ id: 'inc500', text: 'Reach 500 credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 500) },
	{ id: 'verd10', text: 'Build 10 drills on Verdance', where: 'planet:2', progress: (g) => n(countOf(g, 2, 'drill'), 10) },
	{ id: 'inc1k', text: 'Reach 1K credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 1000) },
	{ id: 'tap3', text: 'Get Power Gloves to level 3', where: 'research', progress: (g) => n(g.research.tap, 3) },
	{ id: 'inc2k', text: 'Reach 2K credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 2000) },
	{ id: 'solara', text: 'Unlock Solara', where: 'space', progress: (g) => bool(g.planets[3].unlocked) },
	{ id: 'pylon', text: 'Build an overdrive pylon next to machines', where: 'planet:3', progress: (g) => bool(countAll(g, 'pylon') >= 1) },
	{ id: 'solara5', text: 'Build 5 drills on Solara', where: 'planet:3', progress: (g) => n(countOf(g, 3, 'drill'), 5) },
	{ id: 'market5', text: 'Get Trade Deals to level 5', where: 'research', progress: (g) => n(g.research.market, 5) },
	{ id: 'inc5k', text: 'Reach 5K credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 5000) },
	{ id: 'pylon3', text: 'Have 3 overdrive pylons', where: 'planet:3', progress: (g) => n(countAll(g, 'pylon'), 3) },
	{ id: 'inc10k', text: 'Reach 10K credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 10000) },
	{ id: 'level10', text: 'Upgrade any machine to level 10', where: 'planet:2', progress: (g) => n(maxLv(g), 10) },
	{ id: 'inc25k', text: 'Reach 25K credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 25000) },
	{ id: 'umbra', text: 'Unlock Umbra', where: 'space', progress: (g) => bool(g.planets[4].unlocked) },
	{ id: 'compactor', text: 'Build a compactor right before a pad', where: 'planet:4', progress: (g) => bool(countAll(g, 'compactor') >= 1) },
	{ id: 'prestige', text: 'Do a Nova Reset for stardust', where: 'prestige', progress: (g) => bool(g.stats.resets >= 1) },
	{ id: 'perk', text: 'Spend stardust on a perk', where: 'prestige', progress: (g) => bool(Object.keys(g.perks).length > 0) },
	{ id: 'inc250k', text: 'Reach 250K credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 250000) },
	{ id: 'umbra8', text: 'Build 8 drills on Umbra', where: 'planet:4', progress: (g) => n(countOf(g, 4, 'drill'), 8) },
	{ id: 'inc1m', text: 'Reach 1M credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 1000000) },
	{ id: 'halcyon', text: 'Unlock Halcyon', where: 'space', progress: (g) => bool(g.planets[5].unlocked) },
	{ id: 'forge', text: 'Build a fusion forge after polishers', where: 'planet:5', progress: (g) => bool(countAll(g, 'forge') >= 1) },
	{ id: 'inc10m', text: 'Reach 10M credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 10000000) },
	{ id: 'forge3', text: 'Have 3 fusion forges', where: 'planet:5', progress: (g) => n(countAll(g, 'forge'), 3) },
	{ id: 'inc100m', text: 'Reach 100M credits per second', where: 'space', progress: (g) => n(Math.floor(peak(g)), 100000000) },
	{ id: 'beacon', text: 'Light the Star Beacon in Research', where: 'research', progress: (g) => bool(g.beaconLit) },
];

export function currentGoal(g: Game): Goal | null {
	for (const goal of GOALS) if (!g.goals.includes(goal.id)) return goal;
	return null;
}

interface Unlock {
	id: string;
	title: string;
	text: string;
	when: (g: Game) => boolean;
}

export const UNLOCKS: Unlock[] = [
	{ id: 'smelter', title: 'New machine: Smelter', text: 'Melts ore into bars that sell for 4x.', when: (g) => countAll(g, 'drill') >= 3 || g.runEarned >= 150 },
	{ id: 'ships', title: 'Shipyard open', text: 'Buy more ships, faster engines and bigger holds.', when: (g) => g.stats.flights >= 1 },
	{ id: 'research', title: 'Research lab online', text: 'Upgrades that help every planet.', when: (g) => g.runEarned >= 250 },
	{ id: 'prestige', title: 'Nova Reset ready', text: 'Reset your run for stardust: a lasting boost to all sales.', when: (g) => g.planets[3].unlocked },
	...PLANETS.map((p, i) => ({
		id: `m-${i}`,
		title: p.newMachine ? `New machine: ${MACHINES[p.newMachine].name}` : '',
		text: p.newMachine ? MACHINES[p.newMachine].desc : '',
		when: (g: Game) => i > 0 && !!p.newMachine && machineUnlocked(g, p.newMachine),
	})).filter((u) => u.title),
];

/** Marks finished goals and new features. Sends events for the view. */
export function checkProgress(g: Game) {
	for (const u of UNLOCKS) {
		if (!g.unlocks.includes(u.id) && u.when(g)) {
			g.unlocks.push(u.id);
			emit({ type: 'unlock', id: u.id, title: u.title, text: u.text });
		}
	}
	// Any goal can finish early. The hint always shows the first one not done.
	for (const goal of GOALS) {
		if (g.goals.includes(goal.id)) continue;
		const [have, want] = goal.progress(g);
		if (have < want) continue;
		g.goals.push(goal.id);
		// A small reward: about 15 seconds of income.
		const reward = Math.max(5, Math.round(incomeRate() * 15));
		earn(g, reward);
		emit({ type: 'goal', text: goal.text, reward });
	}
}
