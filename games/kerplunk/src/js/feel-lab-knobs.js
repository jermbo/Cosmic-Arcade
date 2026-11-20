// The knobs of the Feel Lab: the name, the range and a plain hint for each number in tuning.js,
// and the presets to start from. A preset starts from the built-in values and changes only what it lists.

import { SCALES, CLEAR_STYLES, CHAIN_STYLES, POWER_STYLES, SMALL_STYLES } from './tuning.js';

const labels = (list) => Object.entries(list).map(([name, o]) => [name, o.label]);
import { REMIX_STYLES, REMIX_STYLE_NAMES } from './remix-styles.js';
import { BODIES, BODY_NAMES } from './bodies.js';
import { MOTION_STYLES } from './feels.js';

const range = (key, label, min, max, step, hint) => ({ key, label, min, max, step, hint });
const pick = (key, label, options, hint) => ({ key, label, options, hint });

export const MOTION_GROUPS = [
	{
		title: 'Landing',
		knobs: [
			range('gravity', 'Rise speed-up', 10, 200, 1, 'How hard blocks are pulled up to the ceiling.'),
			range('dropSpeed', 'Start speed', 0, 20, 0.5, 'How fast a dropped piece starts to rise.'),
			range('landSquash', 'Landing squash', 0, 0.6, 0.01, 'How flat a piece gets when it hits.'),
			range('settleSquash', 'Loose block squash', 0, 0.6, 0.01, 'The squash of loose blocks that rise after a clear.'),
			range('squashSpring', 'Spring back', 3, 40, 1, 'How fast a squashed block gets its shape back. Low is wobbly.'),
			range('trayPop', 'New piece pop', 0.05, 0.8, 0.01, 'Seconds for a new tray piece to pop in.'),
		],
	},
	{
		title: 'Clearing',
		knobs: [
			range('clearTime', 'Clear length', 0.1, 1, 0.01, 'Seconds for one block to hop and fall away.'),
			range('clearStagger', 'One after another', 0, 0.15, 0.005, 'Seconds between the blocks of a group. 0 is all at once.'),
			range('hopPart', 'Hop part', 0.05, 0.8, 0.01, 'How much of the clear is the hop, before the fall.'),
			range('hopSize', 'Hop size', 0, 16, 0.5, 'Pixels up on the hop.'),
			range('clearGrow', 'Hop grow', 0, 0.5, 0.01, 'How much a block grows on the hop.'),
			range('fallSize', 'Fall distance', 0, 60, 1, 'Pixels down on the fall.'),
			range('fallEase', 'Fall weight', 0.5, 4, 0.1, '1 falls steady. Higher starts slow and ends fast.'),
			range('fallSpin', 'Fall spin', 0, 1.5, 0.05, 'How much a block turns as it falls.'),
			range('clearEnd', 'End size', 0, 1, 0.05, 'How small a block is when it is gone.'),
		],
	},
	{
		title: 'Shake',
		knobs: [
			range('landShake', 'Landing shake', 0, 8, 0.25, 'Pixels the well shakes when a piece lands.'),
			range('chainShake', 'Chain shake', 0, 14, 0.5, 'The shake on a chain of 3 or more (plus 1 for each step).'),
			range('blastShake', 'Blast shake', 0, 24, 0.5, 'The shake of a Blast.'),
			range('shakeTime', 'Shake fade', 0.03, 0.4, 0.005, 'Seconds for a shake to fade to half.'),
		],
	},
	{
		title: 'Stickers',
		knobs: [
			range('stickerTime', 'Sticker time', 0.4, 2.5, 0.05, 'Seconds a points sticker stays.'),
			range('stickerRise', 'Sticker rise', 0, 2.5, 0.05, 'How far a sticker floats up, in cells.'),
			range('stickerPop', 'Sticker pop', 0, 0.6, 0.01, 'How much a sticker overshoots when it shows.'),
			range('stickerTilt', 'Sticker tilt', -15, 15, 0.5, 'Degrees.'),
		],
	},
	{
		title: 'Remix',
		knobs: [pick('remixStyle', 'Remix style', REMIX_STYLE_NAMES.map((name) => [name, REMIX_STYLES[name].label]), 'How the blocks fly in a Remix.')],
	},
];

const WAVES = [
	['sine', 'Sine: round, wooden'],
	['triangle', 'Triangle: a bit brighter'],
	['square', 'Square: hollow, retro'],
	['sawtooth', 'Saw: buzzy'],
];

export const SOUND_GROUPS = [
	{
		title: 'Mix',
		knobs: [
			range('volume', 'Sound volume', 0, 1.5, 0.01, 'All sound effects.'),
			range('bright', 'Brightness', 400, 20000, 100, 'Lower is softer and darker, like a blanket over the speaker.'),
			range('echoSend', 'Echo amount', 0, 3, 0.05, 'How much of each chime goes into the echo.'),
			range('echoTime', 'Echo time', 0.05, 1, 0.01, 'Seconds between echoes.'),
			range('echoFeedback', 'Echo tail', 0, 0.85, 0.01, 'How many echoes you hear. High is a long tail.'),
		],
	},
	{
		title: 'Instrument',
		knobs: [
			pick('body', 'Body', BODY_NAMES.map((name) => [name, BODIES[name].label]), 'The instrument of every note. The knobs under it shape only "Wooden (now)". The Sound Path compares them side by side.'),
			pick('barWave', 'Body', WAVES, 'The main tone of each chime.'),
			range('barLength', 'Ring length', 0.05, 2, 0.01, 'Seconds a chime rings at most.'),
			range('knock', 'Knock', 0, 1, 0.01, 'The short knock above the note. More is more like wood.'),
			range('knockPitch', 'Knock pitch', 1.5, 8, 0.05, 'The knock, as a multiple of the note. 4 is wood, 2.76 is a bell, 3 is glassy.'),
			range('click', 'Click', 0, 0.4, 0.01, 'The tiny click at the start. More is sharper.'),
		],
	},
	{
		title: 'The plunk',
		knobs: [
			range('popFrom', 'Plunk start', 0.2, 1, 0.01, 'How low the plunk starts under its note.'),
			range('popSlide', 'Plunk jump', 0.5, 4, 0.05, 'How far the pitch jumps up. 1 is no jump.'),
			range('popLength', 'Plunk length', 0.02, 0.4, 0.005, 'Seconds.'),
		],
	},
	{
		title: 'Clear chime',
		knobs: [
			pick('clearStyle', 'Clear style', labels(CLEAR_STYLES), 'How one clear plays its notes. The Sound Path compares them.'),
			pick('chainStyle', 'Chain style', labels(CHAIN_STYLES), 'How a chain builds from one clear to the next.'),
			pick('scale', 'Scale', Object.keys(SCALES).map((name) => [name, name[0].toUpperCase() + name.slice(1)]), 'The notes a chain climbs. Pentatonic always sounds nice.'),
			range('clearRoot', 'Start note', 48, 96, 1, 'The first note. 60 is middle C, 72 is one octave up.'),
			range('clearSpread', 'Note spread', 0, 0.2, 0.005, 'Seconds between the notes of one chime. 0 is a chord.'),
		],
	},
	{
		title: 'Sets',
		knobs: [
			pick('powerStyle', 'Power-ups', labels(POWER_STYLES), 'The power-up sounds and the big moments (all clear, game over, new best).'),
			pick('smallStyle', 'Small sounds', labels(SMALL_STYLES), 'Taps, picking up, moving, "no" and the clock tick.'),
		],
	},
	{
		title: 'Landing thud',
		knobs: [
			range('thudPitch', 'Thud pitch', 40, 400, 1, 'Hz. Lower is heavier.'),
			range('thudLength', 'Thud length', 0.03, 0.5, 0.01, 'Seconds.'),
			range('thudNoise', 'Thud knock', 0, 2, 0.05, 'The noise in the thud, like wood on wood.'),
			range('landPlunk', 'Plunk on top', 0, 2, 0.05, 'The water "plunk" over the thud.'),
			range('landPlunkPitch', 'Plunk pitch', 100, 1200, 5, 'Hz.'),
		],
	},
	{
		title: 'Music',
		knobs: [range('music', 'Music volume', 0, 1, 0.01, 'Turn on Music on the stage to hear it.'), range('tempo', 'Tempo', 40, 140, 1, 'Beats per minute.')],
	},
];

// The game sounds, grouped, with a plain name and a way to play each one.
export const SOUND_LIST = [
	{
		title: 'Moves',
		sounds: [
			['ui', 'Button tap', (a) => a.ui()],
			['pick', 'Pick up a piece', (a) => a.pick()],
			['move', 'Move a column', (a) => a.move()],
			['deny', 'No', (a) => a.deny()],
			['land', 'Piece lands', (a) => a.land(2)],
		],
	},
	{
		title: 'Clears',
		sounds: [
			['clear', 'Clear (chain 1)', (a) => a.clear(1, 3)],
			['tick', 'Clock tick', (a) => a.tick(false)],
		],
	},
	{
		title: 'Power-ups',
		sounds: [
			['forge', 'Power-up earned', (a) => a.forge('flare')],
			['flare', 'Blast', (a) => a.flare()],
			['remixCharge', 'Remix wind-up', (a) => a.remixCharge()],
			['remixRattle', 'Remix rattle', (a) => a.remixRattle(0.6)],
			['remixBoom', 'Remix boom', (a) => a.remixBoom()],
			['remixTick', 'Remix landing', (a) => [0, 1, 2, 3, 4].forEach((n, i) => setTimeout(() => a.remixTick(n), i * 70))],
		],
	},
	{
		title: 'Moments',
		sounds: [
			['tile', 'Logo tile', (a) => a.tile(2)],
			['allClear', 'All clear', (a) => a.allClear()],
			['gameOver', 'Game over', (a) => a.gameOver()],
			['best', 'New best', (a) => a.best()],
		],
	},
];

// The animation styles the player can buy (feels.js) are the motion presets here.
export const MOTION_PRESETS = {
	builtin: { label: 'Built-in', values: {} },
	...Object.fromEntries(MOTION_STYLES.filter((m) => m.id !== 'classic').map((m) => [m.id, { label: m.name, values: m.values }])),
};

export const SOUND_PRESETS = {
	builtin: { label: 'Wooden (built-in)', values: {} },
	glassy: {
		label: 'Glassy',
		values: { barLength: 1.1, knock: 0.14, knockPitch: 2.76, click: 0.12, echoSend: 1.8, echoFeedback: 0.42, clearRoot: 79, popFrom: 0.8, popSlide: 1.3 },
	},
	soft: {
		label: 'Soft',
		values: { volume: 0.65, bright: 2600, click: 0, knock: 0.1, thudNoise: 0.2, echoSend: 1.4, popSlide: 1.4, clearSpread: 0.07 },
	},
	punchy: {
		label: 'Punchy',
		values: { barLength: 0.3, knock: 0.4, click: 0.15, thudPitch: 90, thudLength: 0.18, thudNoise: 1, landPlunk: 0.8, popLength: 0.08, clearSpread: 0.035, echoSend: 0.4 },
	},
	chip: {
		label: 'Chiptune',
		values: { volume: 0.55, barWave: 'square', barLength: 0.25, knock: 0, click: 0, echoSend: 0.3, popFrom: 0.5, popSlide: 2, scale: 'major', bright: 6000 },
	},
	dreamy: {
		label: 'Dreamy',
		values: { scale: 'dreamy', barWave: 'triangle', barLength: 1.2, echoSend: 2, echoTime: 0.5, echoFeedback: 0.5, clearSpread: 0.09, bright: 5000, tempo: 64 },
	},
};

// The scenes on the stage: a short moment of the game that plays again and again.
export const SCENES = [
	['drop', 'Drop'],
	['clear', 'Clear'],
	['chain', 'Chain'],
	['big', 'Big group'],
	['blast', 'Blast'],
	['remix', 'Remix'],
	['earned', 'Power-up'],
];
