// The feel of the game: the numbers behind the sounds and the motion, in one place.
// The Feel Lab (feel-lab.html) changes them live. "Save to game" keeps them in this browser,
// and the game uses them the next time it starts. To make them the defaults for everyone,
// paste the lab's "Copy settings" over DEFAULT_TUNING.
//
// The game reads `tuning` each time it plays a sound or draws a frame. Change values in place:
// never swap tuning.motion or tuning.sound for a new object.

const KEY = 'kerplunk.tuning.v1';

// The game sounds. Each one has its own volume, pitch (in semitones) and length.
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

export const DEFAULT_TUNING = {
	motion: {
		gravity: 70, // cells per second squared, pulling blocks up to the ceiling
		dropSpeed: 4, // cells per second when a dropped piece starts to rise
		landSquash: 0.3, // how flat a dropped piece gets when it lands
		settleSquash: 0.22, // how flat a loose block gets when it rises and lands
		squashSpring: 16, // how fast a squashed block gets its shape back
		landShake: 1.5, // the shake of the well when a piece lands, in pixels
		clearTime: 0.34, // seconds: a cleared block hops, then falls and turns while it shrinks
		clearStagger: 0.035, // seconds between the blocks of one group
		hopPart: 0.3, // the part of clearTime spent on the hop
		hopSize: 3, // pixels up and left on the hop
		fallSize: 17, // pixels down on the fall
		fallSpin: 0.25, // turn on the fall, in radians
		fallEase: 2, // 1 is a steady fall, more is a slow start and a fast end
		clearGrow: 0.06, // how much a block grows on the hop
		clearEnd: 0.4, // the size of a block at the end of the fall
		chainShake: 3, // the shake on a chain of 3 or more; each chain step adds 1
		blastShake: 8,
		shakeTime: 0.107, // seconds for a shake to fall to half
		stickerTime: 1.1, // seconds a points sticker stays; a big one stays a little longer
		stickerRise: 0.9, // how far a sticker rises, in cells
		stickerPop: 0.15, // how much a sticker overshoots when it shows
		stickerTilt: -4, // degrees
		trayPop: 0.25, // seconds for a new tray piece to pop in
		remixStyle: 'scatter',
	},
	sound: {
		volume: 0.8, // all sound effects
		music: 0.32,
		tempo: 76, // music beats per minute
		bright: 20000, // a filter on the sound effects: lower is softer and darker
		echoSend: 1, // how much of each chime goes into the echo
		echoTime: 0.36,
		echoFeedback: 0.32,
		barWave: 'sine', // the body of the wooden bar: sine, triangle, square or sawtooth
		barLength: 0.55, // seconds the bar rings at most
		knock: 0.22, // the short knock above the bar's note
		knockPitch: 4, // the knock's pitch, as a multiple of the note
		click: 0.06, // the tiny click at the start of the bar
		popFrom: 0.62, // a plunk starts this low under its note ...
		popSlide: 1.8, // ... and jumps up by this much
		popLength: 0.11,
		body: 'classic', // the instrument of every note: a key of BODIES in bodies.js
		clearStyle: 'rise', // how a clear plays its notes: a key of CLEAR_STYLES
		chainStyle: 'climb', // how a chain builds: a key of CHAIN_STYLES
		powerStyle: 'classic', // the power-ups and big moments: a key of POWER_STYLES
		smallStyle: 'classic', // taps, pick-ups, moves, "no" and the tick: a key of SMALL_STYLES
		scale: 'pentatonic',
		clearRoot: 72, // the first note of the clear chime (a MIDI note: 72 is C5)
		clearSpread: 0.055, // seconds between the notes of one clear chime
		thudPitch: 120, // the low thud when a piece lands, in Hz
		thudLength: 0.12,
		thudNoise: 0.5, // the knock of noise in the thud
		landPlunk: 0.55, // the plunk on top of the thud
		landPlunkPitch: 330,
		each: Object.fromEntries(SOUND_NAMES.map((name) => [name, { volume: 1, pitch: 0, length: 1 }])),
	},
};

const copy = (value) => JSON.parse(JSON.stringify(value));

/** Copies the values of `from` into `into`, but only keys the defaults have, with the same type. */
function mergeInto(into, from, shape) {
	if (!from || typeof from !== 'object') return;
	for (const key of Object.keys(shape)) {
		if (!(key in from)) continue;
		const want = shape[key];
		const got = from[key];
		if (want && typeof want === 'object') mergeInto(into[key], got, want);
		else if (typeof got === typeof want && (typeof got !== 'number' || Number.isFinite(got))) into[key] = got;
	}
}

function read() {
	try {
		const raw = window.localStorage.getItem(KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export const tuning = copy(DEFAULT_TUNING);
const saved = typeof window === 'undefined' ? null : read();
mergeInto(tuning, saved, DEFAULT_TUNING);
if (saved) console.info('Kerplunk: playing with the feel saved from the Feel Lab.');

/** True when this browser has a feel saved from the lab. */
export function hasSavedTuning() {
	return Boolean(read());
}

/** Sets part of the tuning, in place. `values` is shaped like DEFAULT_TUNING (or a part of it). */
export function setTuning(values) {
	mergeInto(tuning, values, DEFAULT_TUNING);
}

/** Puts one part ('motion' or 'sound'), or all of it, back to the built-in values. */
export function resetTuning(part) {
	const fresh = copy(DEFAULT_TUNING);
	if (part) setTuning({ [part]: fresh[part] });
	else setTuning(fresh);
}

/** Only the values that differ from the built-in ones. */
export function tuningDiff(from = tuning, base = DEFAULT_TUNING) {
	const out = {};
	for (const key of Object.keys(base)) {
		if (base[key] && typeof base[key] === 'object') {
			const inner = tuningDiff(from[key], base[key]);
			if (Object.keys(inner).length) out[key] = inner;
		} else if (from[key] !== base[key]) out[key] = from[key];
	}
	return out;
}

/** Keeps the tuning in this browser. Returns false when the browser blocks storage. */
export function saveTuning() {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(tuningDiff()));
		return true;
	} catch {
		return false;
	}
}

export function clearSavedTuning() {
	try {
		window.localStorage.removeItem(KEY);
	} catch {
		// Nothing was saved, or storage is blocked: either way the game uses the built-in feel.
	}
}

/** The notes of a scale, `count` long, climbing octave after octave. */
export function scaleNotes(name, count = 13) {
	const steps = SCALES[name] || SCALES.pentatonic;
	const out = [];
	for (let i = 0; i < count; i++) out.push(steps[i % steps.length] + 12 * Math.floor(i / steps.length));
	return out;
}
