// Playing sounds with values that are not locked in yet, so each card can play its own option.

import { audio } from '../../audio/sound-player.js';
import { tuning } from '../../feel/tuning.js';

const sound = tuning.sound;
const CHAIN_GAP_MS = 380; // between the steps of a chain
const DROP_TO_CLEAR_MS = 450; // from a drop to its clear, when a card plays both

/** Runs `run` with some sound values in place of the ones in use. Sounds are scheduled at once, so it can switch back. */
export function withValues(values, run) {
	const before = {};
	for (const key of Object.keys(values)) before[key] = sound[key];
	Object.assign(sound, values);
	try {
		return run();
	} finally {
		Object.assign(sound, before);
	}
}

/** Plays with some values, now or after `ms`. */
function hear(values, play, ms = 0) {
	audio.unlock();
	if (ms) setTimeout(() => withValues(values, play), ms);
	else withValues(values, play);
}

/** What the "hear" buttons of a card play. Each gets the card's values. */
export const SOUNDS = {
	drop: (values) => hear(values, () => audio.land(2)),
	clear: (values) => hear(values, () => audio.clear(1, 3)),
	big: (values) => hear(values, () => audio.clear(1, 6)),
	chain: (values) => {
		for (let chain = 1; chain <= 5; chain++) hear(values, () => audio.clear(chain, chain > 3 ? 5 : 3), (chain - 1) * CHAIN_GAP_MS);
	},
	chainLong: (values) => {
		for (let chain = 1; chain <= 8; chain++) hear(values, () => audio.clear(chain, 3), (chain - 1) * CHAIN_GAP_MS * 0.9);
	},
	dropThenClear: (values) => {
		SOUNDS.drop(values);
		hear(values, () => audio.clear(1, 3), DROP_TO_CLEAR_MS);
	},
	powerUpEarned: (values) => hear(values, () => audio.powerUpEarned()),
	blast: (values) => hear(values, () => audio.blast()),
	remix: (values) => {
		hear(values, () => audio.remixCharge());
		hear(values, () => audio.remixBoom(), 900);
		for (let i = 0; i < 8; i++) hear(values, () => audio.remixTick(i), 1250 + i * 70);
	},
	allClear: (values) => hear(values, () => audio.allClear()),
	gameOver: (values) => hear(values, () => audio.gameOver()),
	best: (values) => hear(values, () => audio.best()),
	earnedThenBlast: (values) => {
		SOUNDS.powerUpEarned(values);
		hear(values, () => audio.blast(), 700);
	},
	ui: (values) => hear(values, () => audio.ui()),
	pick: (values) => hear(values, () => audio.pick()),
	move: (values) => hear(values, () => audio.move()),
	deny: (values) => hear(values, () => audio.deny()),
	tick: (values) => {
		for (let i = 0; i < 4; i++) hear(values, () => audio.tick(i >= 2), i * 500);
	},
	smallDemo: (values) => {
		hear(values, () => audio.ui());
		hear(values, () => audio.pick(), 350);
		hear(values, () => audio.move(), 600);
		hear(values, () => audio.move(), 750);
		hear(values, () => audio.deny(), 1100);
	},
};

// A short run of the whole sound, from a tap to a big moment: [milliseconds, sound].
const DEMO = [
	[0, () => audio.ui()],
	[300, () => audio.pick()],
	[550, () => audio.move()],
	[700, () => audio.move()],
	[1000, () => audio.land(2)],
	[1450, () => audio.clear(1, 3)],
	[1850, () => audio.clear(2, 3)],
	[2250, () => audio.clear(3, 5)],
	[2900, () => audio.powerUpEarned()],
	[3700, () => audio.blast()],
	[4500, () => audio.remixCharge()],
	[5400, () => audio.remixBoom()],
	...Array.from({ length: 8 }, (_, i) => [5750 + i * 70, () => audio.remixTick(i)]),
	[6700, () => audio.allClear()],
	[8000, () => audio.deny()],
];

export function playDemo() {
	for (const [ms, play] of DEMO) hear({}, play, ms);
}
