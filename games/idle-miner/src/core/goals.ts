// The goals: which one is next, and how far along it is.

import { GOALS } from '../content/goals.ts';
import type { Goal } from '../content/goals.ts';
import { isMet, measure } from './checks.ts';
import type { Game } from './game.ts';

export function currentGoal(g: Game): Goal | null {
	for (const goal of GOALS) if (!g.goals.includes(goal.id)) return goal;
	return null;
}

/** What the goal bar shows: how much the player has, and how much the goal wants. */
export function goalProgress(g: Game, goal: Goal): [have: number, want: number] {
	if (goal.yesNo) return [isMet(g, goal.check) ? 1 : 0, 1];
	return measure(g, goal.check);
}
