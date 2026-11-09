// The HUD at the top: credits, income, stardust, and the goal bar.

import { sfx } from '../audio.ts';
import { PLANETS } from '../content/planets.ts';
import { fmt } from '../core/format.ts';
import { GOALS } from '../content/goals.ts';
import { currentGoal, goalProgress } from '../core/goals.ts';
import { planetIndex } from '../core/planet-id.ts';
import { findProblem } from '../core/blocks.ts';
import type { Problem } from '../core/blocks.ts';
import { incomeRate } from '../core/income.ts';
import { canPrestige, prestigeGain } from '../core/nova.ts';
import { buildCost } from '../core/prices.ts';
import { openNova } from './panels/nova.ts';
import { openResearch } from './panels/research.ts';
import { openShips } from './panels/ships.ts';
import { session } from '../session.ts';
import { ui } from './elements.ts';
import { select } from './inspect.ts';
import { updateCard } from './planet-card.ts';
import { toPlanet, toSpace, updatePlanetHeader } from './screens.ts';
import { pv, space } from '../views.ts';

let problemWhere: { planet: number; cell: number; kind: Problem['kind'] } | null = null;

function goToGoal() {
	sfx.click();
	if (problemWhere) {
		if (session.view !== 'planet' || pv.pi !== problemWhere.planet) toPlanet(problemWhere.planet);
		const m = session.g.planets[problemWhere.planet].cells[problemWhere.cell];
		if (m?.t === 'pad') openShips(problemWhere.planet);
		else select(problemWhere.cell);
		return;
	}
	const goal = currentGoal(session.g);
	if (!goal) return;
	const where = goal.where;
	if (where === 'research') {
		if (session.g.unlocks.includes('research')) openResearch();
	} else if (where === 'prestige') {
		openNova();
	} else if (where === 'space' || 'space' in where) {
		if (session.view !== 'space') toSpace();
		if (where !== 'space') space.selected = planetIndex(where.space);
		updateCard();
	} else if ('planet' in where) {
		const pi = planetIndex(where.planet);
		if (session.g.planets[pi].unlocked) toPlanet(pi);
	} else {
		const pi = planetIndex(where.ships);
		openShips(session.g.planets[pi].unlocked ? pi : 0);
	}
}

export function bumpCredits() {
	ui.credits.classList.add('is-bump');
	setTimeout(() => ui.credits.classList.remove('is-bump'), 120);
}

export function updateHud() {
	const txt = fmt(session.shownCredits);
	if (ui.credits.textContent !== txt) ui.credits.textContent = txt;
	const inc = `${fmt(incomeRate())} / s`;
	if (ui.income.textContent !== inc) ui.income.textContent = inc;
	ui.dust.hidden = session.g.stardust <= 0;
	ui.dustN.textContent = String(session.g.stardust);
	ui.research.hidden = !session.g.unlocks.includes('research');
	ui.nova.hidden = !session.g.unlocks.includes('prestige');
	ui.crew.hidden = !session.g.unlocks.includes('crew');
	ui.nova.classList.toggle('is-ready', canPrestige(session.g) && prestigeGain(session.g) >= Math.max(1, session.g.stardust));
	if (session.view === 'planet' && session.started) updatePlanetHeader();
}

export function updateGoal() {
	const goal = currentGoal(session.g);
	const prob = session.g.tutorial >= 99 ? findProblem(session.g) : null;
	problemWhere = prob ? { planet: prob.planet, cell: prob.cell, kind: prob.kind } : null;
	if (prob) {
		ui.goal.classList.add('is-warn');
		ui.goal.classList.toggle('is-slow', prob.kind === 'slow');
		ui.goalTag.textContent = prob.kind === 'slow' ? 'Slow' : 'Fix';
		const hint = prob.kind === 'pad' ? 'Tap to open ships' : 'Tap to jump there';
		const text = `${prob.text} · ${hint}`;
		if (ui.goalText.textContent !== text) ui.goalText.textContent = text;
		ui.goalFill.style.width = '0%';
		return;
	}
	ui.goal.classList.remove('is-warn', 'is-slow');
	if (!goal) {
		ui.goalTag.textContent = 'Done';
		ui.goalText.textContent = session.g.beaconLit ? 'The beacon is lit. Go nova to grow faster.' : 'All goals done!';
		ui.goalFill.style.width = '100%';
		return;
	}
	const [have, want] = goalProgress(session.g, goal);
	let text = goal.text;
	const planetIdx = goal.check.kind === 'planetOpen' ? planetIndex(goal.check.planet) : -1;
	if (planetIdx > 0) {
		const cost = PLANETS[planetIdx].unlock;
		text = `${goal.text} · ${fmt(Math.min(session.g.credits, cost))} / ${fmt(cost)}`;
		ui.goalFill.style.width = `${Math.min(100, (session.g.credits / cost) * 100)}%`;
	} else {
		if (want > 1) {
			text += ` (${fmt(have)}/${fmt(want)})`;
			const pi = typeof goal.where === 'object' && 'planet' in goal.where ? planetIndex(goal.where.planet) : -1;
			if (have < want && pi >= 0 && session.g.credits < buildCost(session.g, pi, 'drill')) {
				text += ` · need ${fmt(buildCost(session.g, pi, 'drill'))} for next drill`;
			}
		}
		ui.goalFill.style.width = `${(have / want) * 100}%`;
	}
	ui.goalTag.textContent = `Next ${session.g.goals.length + 1}/${GOALS.length}`;
	if (ui.goalText.textContent !== text) ui.goalText.textContent = text;
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initHud() {
	ui.goal.addEventListener('click', goToGoal);
}
