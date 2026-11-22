// Events the rules send to the view: a sale, a new item, a ship that leaves or docks, an unlock, a goal.

import type { MachineType } from '../content/machines.ts';

export type GameEvent =
	| { type: 'sold'; planet: number; amount: number; count: number }
	| { type: 'made'; planet: number; cell: number; t: MachineType }
	| { type: 'depart'; planet: number }
	| { type: 'dock'; planet: number }
	| { type: 'unlock'; id: string; title: string; text: string }
	| { type: 'goal'; text: string; reward: number };

export const events: GameEvent[] = [];

export let emitOn = true;

export function setEvents(on: boolean) {
	emitOn = on;
	events.length = 0;
}

export function emit(e: GameEvent) {
	if (emitOn && events.length < 400) events.push(e);
}
