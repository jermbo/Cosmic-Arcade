import type { Action } from './core/types.ts';
import type { Game } from './game.ts';

// What each action in the data files does. Add a new action type here.

type Handler<K extends Action['do']> = (a: Extract<Action, { do: K }>, g: Game) => void;

export const ACTIONS: { [K in Action['do']]: Handler<K> } = {
	setFlag: (a, g) => g.state.setFlag(a.flag, a.value ?? true),
	give: (a, g) => g.state.give(a.item),
	take: (a, g) => g.state.take(a.item),
	say: (a, g) => g.host.say(a.text),
	note: (a, g) => {
		g.state.addNote(a.note);
		g.host.readNote(a.note);
	},
	sound: (a, g) => g.audio.play(a.sound, g.player.eye),
	checkpoint: (a, g) => g.checkpoint(a.id),
	noise: (a, g) => g.world.noise(g.player.pos, a.radius),
	alarm: (_a, g) => {
		g.audio.play('alarm');
		g.world.alarm(g.player.pos.clone());
	},
	tutorial: (a, g) => g.tutorial(a.id),
	ending: (_a, g) => g.host.ending(),
	if: (a, g) => g.run(g.state.check(a.cond) ? a.then : a.else),
};

export function runAction(a: Action, g: Game): void {
	(ACTIONS[a.do] as (a: Action, g: Game) => void)(a, g);
}
