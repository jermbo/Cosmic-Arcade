// The lists of sound choices: the scales, the moods, and the styles of the clear, the chain,
// the power-ups and the small sounds. The Sound Path and the Feel Lab show them as options.

// The game sounds. Each one has its own volume, pitch (in semitones) and length in the tuning.
// "forge" is the power-up earned sound and "flare" is the Blast. They keep their old names here,
// so a feel saved in the browser before the rename still loads.
export const SOUND_NAMES = [
	'ui',
	'pick',
	'move',
	'deny',
	'land',
	'clear',
	'forge',
	'flare',
	'remixCharge',
	'remixRattle',
	'remixBoom',
	'remixTick',
	'tile',
	'tick',
	'allClear',
	'gameOver',
	'best',
];

// Each scale is a list of steps in semitones. The clear chime climbs it with each chain step.
export const SCALES = {
	pentatonic: [0, 2, 4, 7, 9],
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 3, 5, 7, 10],
	dreamy: [0, 2, 4, 6, 7, 11],
	blues: [0, 3, 5, 6, 7, 10],
};

const SEMITONES_PER_OCTAVE = 12;

/** The notes of a scale, `count` long, climbing octave after octave. */
export function scaleNotes(name, count = 13) {
	const steps = SCALES[name] || SCALES.pentatonic;
	const notes = [];
	for (let i = 0; i < count; i++) {
		const octave = Math.floor(i / steps.length);
		notes.push(steps[i % steps.length] + SEMITONES_PER_OCTAVE * octave);
	}
	return notes;
}

// How one clear plays its notes. Each note is [scale step, octave, when], where `when` counts in
// clearSpread seconds and the steps count up from the chain's own note. `big` adds notes for a
// group of 4 or more. `under` puts the low plunk under the chime.
export const CLEAR_STYLES = {
	rise: { label: 'Rise', blurb: 'Two notes up, and a third on a big group. The sound today.', notes: [[0, 0, 0], [2, 0, 1]], big: [[0, 1, 2]], under: true },
	strum: { label: 'Strum', blurb: 'Three notes almost at once, like a quick strum.', notes: [[0, 0, 0], [1, 0, 0.35], [2, 0, 0.7]], big: [[0, 1, 1.05]], under: true },
	sparkle: { label: 'Sparkle', blurb: 'A fast run of four notes up. Busy and shiny.', notes: [[0, 0, 0], [1, 0, 0.6], [2, 0, 1.2], [3, 0, 1.8]], big: [[0, 1, 2.4]], under: false },
	hop: { label: 'Hop', blurb: 'One note, then the same note an octave up. Bouncy.', notes: [[0, 0, 0], [0, 1, 1.4]], big: [[2, 1, 2.4]], under: true },
	bounce: { label: 'Bounce', blurb: 'Up, then back down a step. Playful.', notes: [[0, 0, 0], [2, 0, 1.2], [1, 0, 2.4]], big: [[3, 0, 3.6]], under: true },
	cascade: { label: 'Cascade', blurb: 'A short run that tumbles down to the note.', notes: [[3, 0, 0], [2, 0, 0.8], [1, 0, 1.6], [0, 0, 2.4]], big: [[0, -1, 3.2]], under: false },
	chord: { label: 'Chord', blurb: 'Three notes together, one solid ding.', notes: [[0, 0, 0], [2, 0, 0], [4, 0, 0]], big: [[0, 1, 0]], under: true },
};

// The moods: each picks a scale, the notes every chime and chain uses.
export const MOODS = {
	pentatonic: { label: 'Happy', blurb: 'Can’t go wrong. The sound today.' },
	major: { label: 'Sunny', blurb: 'Bright and cheerful.' },
	dreamy: { label: 'Magic', blurb: 'Floaty and a bit wondrous.' },
	minor: { label: 'Moody', blurb: 'Cool and mysterious.' },
	blues: { label: 'Cheeky', blurb: 'A bit jazzy and sly.' },
};

// How a chain builds from one clear to the next.
export const CHAIN_STYLES = {
	climb: { label: 'Climb', blurb: 'Each step starts one note higher. The sound today.' },
	leap: { label: 'Leap', blurb: 'Each step jumps two notes. It gets high fast.' },
	stack: { label: 'Stack', blurb: 'Each step adds one more note on top. Long chains get long.' },
	shine: { label: 'Shine', blurb: 'From step 3, a soft sparkle an octave up joins in.' },
	swell: { label: 'Swell', blurb: 'Each step gets a bit louder, with more echo.' },
};

// The power-ups and the big moments: earned, Blast, Remix, all clear, game over and new best.
export const POWER_STYLES = {
	classic: { label: 'Today', blurb: 'The power-up sounds Kerplunk has now.' },
	instrument: { label: 'Your instrument', blurb: 'Big runs and chords played on your drop instrument, with a low boom.' },
	cartoon: { label: 'Cartoon', blurb: 'A laser Blast, a slide-whistle Remix, coin blips and boings.' },
	arcade: { label: 'Arcade', blurb: '8-bit beeps and sweeps, like an old game console.' },
	magic: { label: 'Magic', blurb: 'Glass bells, music-box twinkles and a soft whoosh.' },
};

// The small sounds: a button tap, picking up a piece, moving it, "no", and the clock tick.
export const SMALL_STYLES = {
	classic: { label: 'Today', blurb: 'Short beeps. The sound today.' },
	soft: { label: 'Soft', blurb: 'Tiny quiet notes on your drop instrument.' },
	clicky: { label: 'Clicky', blurb: 'Dry wooden clicks and tocks.' },
	bubbly: { label: 'Bubbly', blurb: 'Little water blips.' },
	cartoon: { label: 'Cartoon', blurb: 'Pops, squeaks and a boing for "no".' },
	hush: { label: 'Hush', blurb: 'Barely there. For players who like it quiet.' },
};
