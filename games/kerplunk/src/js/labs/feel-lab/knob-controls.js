// The controls of the Feel Lab: a slider or a menu for each knob, the presets, and Compare.
// A knob changes the live tuning at once, so the stage and the sounds use it right away.

import { audio } from '../../audio/sound-player.js';
import { tuning, setTuning, resetTuning, tuningDiff } from '../../feel/tuning.js';
import { DEFAULT_TUNING } from '../../feel/default-tuning.js';
import { $, toast } from '../lab-page.js';
import { view, replaySoon } from './stage.js';
import { SOUND_LIST } from './knob-list.js';

const PARTS = ['motion', 'sound'];
const deepCopy = (value) => JSON.parse(JSON.stringify(value));

export const lab = {
	compare: { motion: null, sound: null }, // your values, kept while you hear the built-in ones
	saved: JSON.stringify(tuningDiff()), // what "Save to game" saved last
};

const rows = { motion: [], sound: [] };

/** A number with as many decimals as its step. */
function formatValue(value, step) {
	if (typeof value !== 'number') return value;
	const decimals = step >= 1 ? 0 : Math.min(3, String(step).split('.')[1].length);
	return value.toFixed(decimals);
}

/**
 * One knob: a name, its value (tap it to go back to the built-in value), a slider or a menu, and a hint.
 * target is the object the knob changes, and base has the built-in values.
 */
function knobRow(part, knob, { onChange, target = tuning[part], base = DEFAULT_TUNING[part], id }) {
	const row = document.createElement('div');
	row.className = 'knob';
	const head = document.createElement('div');
	head.className = 'knob-head';
	const label = document.createElement('label');
	label.textContent = knob.label;
	label.htmlFor = id;
	const valueButton = document.createElement('button');
	valueButton.type = 'button';
	valueButton.className = 'knob-value';
	valueButton.title = 'Back to the built-in value';
	head.append(label, valueButton);
	const input = knob.options ? knobMenu(knob) : knobSlider(knob);
	input.id = id;

	const show = () => {
		const value = target[knob.key];
		input.value = value;
		const changed = value !== base[knob.key];
		valueButton.textContent = knob.options ? (changed ? 'changed' : 'built-in') : formatValue(value, knob.step);
		valueButton.classList.toggle('on', changed);
		input.disabled = Boolean(lab.compare[part]);
	};
	const set = (value, finished) => {
		target[knob.key] = value;
		show();
		markDirty();
		if (part === 'sound') audio.applyTuning();
		if (finished) onChange?.(knob.key);
	};
	const read = () => (knob.options ? input.value : Number(input.value));
	input.addEventListener('input', () => set(read(), false));
	input.addEventListener('change', () => set(read(), true));
	valueButton.addEventListener('click', () => set(base[knob.key], true));

	row.append(head, input);
	if (knob.hint) {
		const hint = document.createElement('p');
		hint.className = 'knob-hint';
		hint.textContent = knob.hint;
		row.append(hint);
	}
	row.show = show;
	show();
	return row;
}

function knobMenu(knob) {
	const menu = document.createElement('select');
	for (const [value, text] of knob.options) menu.add(new Option(text, value));
	return menu;
}

function knobSlider(knob) {
	const slider = document.createElement('input');
	slider.type = 'range';
	slider.min = knob.min;
	slider.max = knob.max;
	slider.step = knob.step;
	return slider;
}

function foldingGroup(title, open) {
	const box = document.createElement('details');
	box.className = 'group';
	box.open = open;
	const summary = document.createElement('summary');
	summary.textContent = title;
	box.append(summary);
	return box;
}

/** A folding group of knobs for each group in the list. */
export function buildGroups(part, groups, into, onChange) {
	for (const group of groups) {
		const box = foldingGroup(group.title, true);
		for (const knob of group.knobs) {
			const row = knobRow(part, knob, { onChange, id: `${part}-${knob.key}` });
			rows[part].push(row);
			box.append(row);
		}
		into.append(box);
	}
}

const EACH_SOUND_KNOBS = [
	{ key: 'volume', label: 'Volume', min: 0, max: 2, step: 0.05 },
	{ key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1 },
	{ key: 'length', label: 'Length', min: 0.25, max: 3, step: 0.05 },
];

/** Each game sound: a play button and its own volume, pitch and length. */
export function buildSoundList() {
	const into = $('soundList');
	for (const group of SOUND_LIST) {
		const box = foldingGroup(group.title, false);
		for (const [name, label, playIt] of group.sounds) box.append(soundCard(name, label, playIt));
		into.append(box);
	}
}

function soundCard(name, label, playIt) {
	const card = document.createElement('div');
	card.className = 'sound';
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'sound-play';
	button.textContent = `▶ ${label}`;
	button.addEventListener('click', () => {
		audio.unlock();
		playIt(audio);
	});
	card.append(button);
	const options = { target: tuning.sound.each[name], base: DEFAULT_TUNING.sound.each[name], onChange: () => playIt(audio) };
	for (const knob of EACH_SOUND_KNOBS) {
		const row = knobRow('sound', knob, { ...options, id: `each-${name}-${knob.key}` });
		// The rows keep the object they change, so a preset or a reset (which change it in place) shows at once.
		rows.sound.push(row);
		card.append(row);
	}
	return card;
}

// ---- hearing a change ----

// A changed sound knob plays a sound that uses it. null plays nothing; a knob not listed plays a clear.
const SOUND_PREVIEW = {
	thudPitch: () => audio.land(2),
	thudLength: () => audio.land(2),
	thudNoise: () => audio.land(2),
	landPlunk: () => audio.land(2),
	landPlunkPitch: () => audio.land(2),
	music: null,
	tempo: null,
	scale: () => chainClimb(4),
	clearRoot: () => chainClimb(3),
	clearStyle: () => chainClimb(3),
	chainStyle: () => chainClimb(5),
	powerStyle: () => audio.blast(),
	smallStyle: () => {
		audio.pick();
		setTimeout(() => audio.deny(), 300);
	},
};

export function previewSound(key) {
	if (key in SOUND_PREVIEW) return SOUND_PREVIEW[key]?.();
	audio.clear(2, 4);
}

/** Plays the clear chime of chains 1 to `steps`, one after the other. */
export function chainClimb(steps = 8) {
	audio.unlock();
	for (let chain = 1; chain <= steps; chain++) setTimeout(() => audio.clear(chain, chain > 4 ? 5 : 3), (chain - 1) * 380);
}

// ---- presets, compare, refresh ----

/** Shows the tuning on every knob of a part again, after it changed all at once. */
export function refresh(part) {
	for (const row of rows[part]) row.show();
	if (part === 'sound') audio.applyTuning();
	if (part === 'motion') view.remixStyle = tuning.motion.remixStyle;
	markDirty();
}

/** A button for each preset. A preset starts from the built-in values. */
export function buildPresets(part, presets, into) {
	for (const preset of Object.values(presets)) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = preset.label;
		button.addEventListener('click', () => usePreset(part, preset));
		into.append(button);
	}
}

function usePreset(part, preset) {
	endCompare(part);
	resetTuning(part);
	setTuning({ [part]: preset.values });
	refresh(part);
	toast(`${preset.label}. Every ${part} knob starts from this now.`);
	showChange(part);
}

/** After a whole part changed: hear the sound, or see the motion. */
function showChange(part) {
	if (part === 'sound') chainClimb(4);
	else replaySoon();
}

/** Compare: hear or see the built-in values, then go back to yours. */
export function toggleCompare(part) {
	if (lab.compare[part]) {
		endCompare(part);
	} else {
		lab.compare[part] = deepCopy(tuning[part]);
		resetTuning(part);
		const button = $(`${part}Compare`);
		button.setAttribute('aria-pressed', 'true');
		button.textContent = 'Now: built-in. Tap for yours';
		refresh(part);
	}
	showChange(part);
}

export function endCompare(part) {
	if (!lab.compare[part]) return;
	setTuning({ [part]: lab.compare[part] });
	lab.compare[part] = null;
	resetCompareButton(part);
	refresh(part);
}

export function resetCompareButton(part) {
	const button = $(`${part}Compare`);
	button.setAttribute('aria-pressed', 'false');
	button.textContent = 'Compare with built-in';
}

export function endAllCompares() {
	for (const part of PARTS) endCompare(part);
}

/** The "not saved" mark shows when the knobs differ from what was saved. */
export function markDirty() {
	const comparing = lab.compare.motion || lab.compare.sound;
	const mine = comparing ? null : JSON.stringify(tuningDiff());
	$('dirty').hidden = mine === null || mine === lab.saved;
}
