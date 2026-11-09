// Marks the goals and the unlocks that the player has reached, and pays the goal rewards.

import { GOAL_REWARD } from '../content/economy.ts';
import { GOALS } from '../content/goals.ts';
import { goalProgress } from './goals.ts';
import { anyMet } from './checks.ts';
import { ALL_UNLOCKS } from './unlocks.ts';
import { emit } from './events.ts';
import { earn, incomeRate } from './income.ts';
import type { Game } from './game.ts';

/** Marks finished goals and new features. Sends events for the view. */
export function checkProgress(g: Game) {
	g.peakIncome = Math.max(g.peakIncome || 0, incomeRate());
	for (const u of ALL_UNLOCKS) {
		if (!g.unlocks.includes(u.id) && anyMet(g, u.when)) {
			g.unlocks.push(u.id);
			emit({ type: 'unlock', id: u.id, title: u.title, text: u.text });
		}
	}
	// Any goal can finish early. The hint always shows the first one not done.
	for (const goal of GOALS) {
		if (g.goals.includes(goal.id)) continue;
		const [have, want] = goalProgress(g, goal);
		if (have < want) continue;
		g.goals.push(goal.id);
		const reward = Math.max(GOAL_REWARD.min, Math.round(incomeRate() * GOAL_REWARD.incomeSeconds));
		earn(g, reward);
		emit({ type: 'goal', text: goal.text, reward });
	}
}
