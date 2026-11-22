// The Sound Path: build the sound of Kerplunk one decision at a time.
// Each step picks one thing, and plays its options with what the steps before it locked in:
// 1 the drop (the instrument body), 2 the clear (its style and the mood), 3 the chain,
// 4 the power-ups and big moments, 5 the small sounds. Then "Your sound" sums it up.
// "Lock it in" saves the choice in this browser, and the game plays with it.

import { audio } from '../../audio/sound-player.js';
import { BODIES } from '../../audio/instrument-bodies.js';
import { tuning, saveTuning, tuningDiff } from '../../feel/tuning.js';
import { CLEAR_STYLES, CHAIN_STYLES, POWER_STYLES, SMALL_STYLES, MOODS } from '../../feel/sound-styles.js';
import { startScope } from '../../audio/sound-scope.js';
import { $, toast, copyText, wearGameTheme, unlockAudioOnTouch } from '../lab-page.js';
import { SOUNDS, playDemo } from './hear.js';
import { drawClearNotes } from './card-pictures.js';
import { STEPS, draft } from './steps.js';

const sound = tuning.sound;
const PROGRESS_KEY = 'kerplunk.soundpath.v1';

wearGameTheme();

// ---- progress: which steps are locked in ----

function readProgress() {
	try {
		return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
	} catch {
		return {};
	}
}

const progress = readProgress();
// A body locked before the steps kept their own record still counts as a done drop step.
if (sound.body !== 'classic') progress.drop = true;

function saveProgress() {
	try {
		localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
	} catch {
		// Storage is blocked: the steps still work in this visit.
	}
}

// ---- moving between steps ----

let step = null;
draft.mood = sound.scale;

/** A step is open when every step before it is locked in. */
function isOpen(index) {
	return STEPS.slice(0, index).every((earlier) => earlier.summary || progress[earlier.id]);
}

function buildStepButtons() {
	const nav = $('steps');
	nav.textContent = '';
	STEPS.forEach((each, i) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = each.summary ? each.label : `${i + 1} · ${each.label}${progress[each.id] ? ' ✓' : ''}`;
		const open = isOpen(i);
		button.disabled = !open;
		button.className = each === step ? 'now' : progress[each.id] ? 'done' : 'later';
		if (each === step) button.setAttribute('aria-current', 'step');
		button.title = open ? '' : 'Lock in the step before it first';
		button.addEventListener('click', () => goTo(each.id));
		nav.append(button);
	});
}

function goTo(id) {
	const index = STEPS.findIndex((each) => each.id === id);
	if (index < 0 || !isOpen(index)) return;
	step = STEPS[index];
	history.replaceState(null, '', `#${id}`);
	draft.pick = null;
	draft.mood = sound.scale;
	$('stepTitle').textContent = step.title;
	$('stepIntro').textContent = step.intro || '';
	$('builtOn').hidden = index === 0 || step.summary;
	$('builtOn').textContent = `Built on: ${builtOn(index)}`;
	$('moodBox').hidden = !step.mood;
	$('lockbar').hidden = Boolean(step.summary);
	if (step.mood) buildMoods();
	if (step.summary) buildSummary();
	else buildCards();
	buildStepButtons();
	if (!step.summary) choose(sound[step.key]);
	window.scrollTo({ top: 0 });
}

/** What the steps before this one locked in, in a few words. */
function builtOn(index) {
	const parts = [];
	if (index > 0) parts.push((BODIES[sound.body] || BODIES.classic).label);
	if (index > 1) parts.push(`${CLEAR_STYLES[sound.clearStyle].label} · ${MOODS[sound.scale].label}`);
	if (index > 2) parts.push(CHAIN_STYLES[sound.chainStyle].label);
	if (index > 3) parts.push(`${POWER_STYLES[sound.powerStyle].label} power-ups`);
	return parts.join(' · ');
}

// ---- moods (the clear step) ----

function buildMoods() {
	const row = $('moods');
	row.textContent = '';
	for (const [name, mood] of Object.entries(MOODS)) {
		const button = document.createElement('button');
		button.type = 'button';
		button.setAttribute('role', 'radio');
		button.dataset.mood = name;
		button.textContent = mood.label;
		button.addEventListener('click', () => pickMood(name));
		row.append(button);
	}
	showMood();
}

function pickMood(name) {
	draft.mood = name;
	showMood();
	for (const card of document.querySelectorAll('.body-card')) drawClearNotes(card, card.dataset.option, draft.mood);
	SOUNDS.chain(step.values(draft.pick || sound[step.key]));
	updateLock();
}

function showMood() {
	for (const button of $('moods').children) button.setAttribute('aria-checked', String(button.dataset.mood === draft.mood));
	$('moodHint').textContent = MOODS[draft.mood].blurb;
}

// ---- the cards ----

function buildCards() {
	$('groups').textContent = '';
	let index = 0;
	for (const group of step.groups) {
		const names = Object.keys(step.options).filter((name) => group.test(step.options[name], name));
		if (!names.length) continue;
		const section = document.createElement('section');
		section.className = 'body-group';
		const heading = document.createElement('h2');
		heading.textContent = group.title;
		const grid = document.createElement('div');
		grid.className = 'body-grid';
		for (const name of names) grid.append(optionCard(name, step.options[name], index++));
		section.append(heading, grid);
		$('groups').append(section);
	}
	showBadges();
}

/** A card for one option: its name, a few words, a picture, and buttons to hear it. A tap plays it and picks it. */
function optionCard(name, option, index) {
	const card = document.createElement('article');
	card.className = 'body-card';
	card.dataset.option = name;
	card.tabIndex = 0;
	card.setAttribute('role', 'button');
	card.setAttribute('aria-label', `${option.label}. Tap to hear and pick it.`);
	card.innerHTML = `
		<div class="body-head">
			<h3></h3>
			<span class="badge" hidden>In the game</span>
		</div>
		<p class="blurb"></p>
		<canvas class="shape"></canvas>
		<p class="tags label">…</p>
		<div class="hear" role="group" aria-label="Hear it"></div>`;
	card.querySelector('h3').textContent = option.label;
	card.querySelector('.blurb').textContent = option.blurb;
	for (const [label, soundName] of step.hear) card.querySelector('.hear').append(hearButton(label, soundName, name));
	const tryIt = () => {
		SOUNDS[step.tap](step.values(name));
		choose(name);
	};
	card.addEventListener('click', tryIt);
	card.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		tryIt();
	});
	const currentStep = step;
	requestAnimationFrame(() => currentStep.picture(card, name, index));
	return card;
}

function hearButton(label, soundName, optionName) {
	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = `▶ ${label}`;
	button.addEventListener('click', (event) => {
		event.stopPropagation();
		SOUNDS[soundName](step.values(optionName));
		choose(optionName);
	});
	return button;
}

/** The "In the game" badge is on the option the game uses now. */
function showBadges() {
	for (const card of document.querySelectorAll('.body-card')) card.querySelector('.badge').hidden = card.dataset.option !== sound[step.key];
}

function choose(name) {
	if (!step.options || !step.options[name]) return;
	draft.pick = name;
	for (const card of document.querySelectorAll('.body-card')) card.classList.toggle('on', card.dataset.option === name);
	updateLock();
}

// ---- locking in ----

/** The lock button is on while the pick differs from what the game uses, or the step is not done yet. */
function updateLock() {
	if (step.summary) return;
	const values = step.values(draft.pick || sound[step.key]);
	const inUse = Object.entries(values).every(([key, value]) => sound[key] === value);
	const done = progress[step.id] && inUse;
	$('lock').disabled = !draft.pick || done;
	$('lock').textContent = done ? 'Locked in' : 'Lock it in';
	const label = draft.pick ? step.options[draft.pick].label : 'None yet';
	$('pickName').textContent = step.mood && draft.pick ? `${label} · ${MOODS[draft.mood].label}` : label;
	const next = STEPS[STEPS.indexOf(step) + 1];
	$('next').hidden = !progress[step.id] || !next;
	$('next').textContent = next && next.summary ? 'See your sound →' : 'Next →';
}

$('lock').addEventListener('click', () => {
	if (!draft.pick) return;
	Object.assign(sound, step.values(draft.pick));
	if (!saveTuning()) return toast('Could not save. This browser is blocking site storage.');
	progress[step.id] = true;
	saveProgress();
	showBadges();
	buildStepButtons();
	updateLock();
	toast('Locked in. The game uses it now.');
});

$('next').addEventListener('click', () => {
	const next = STEPS[STEPS.indexOf(step) + 1];
	if (next) goTo(next.id);
});

// ---- your sound ----

function buildSummary() {
	const box = $('groups');
	box.textContent = '';
	const panel = document.createElement('section');
	panel.className = 'summary';
	const code = document.createElement('textarea');
	code.readOnly = true;
	code.hidden = true;
	code.spellcheck = false;
	const note = document.createElement('p');
	note.className = 'hint';
	note.textContent = 'The demo plays a tap, a pick-up, a drop, a chain of 3, a power-up, a Blast, a Remix, an all clear and a "no". The game already uses this sound in this browser.';
	panel.append(summaryList(), summaryActions(code), note, code);
	box.append(panel);
}

/** Each pick, with a Change button that goes back to its step. */
function summaryList() {
	const picks = [
		['drop', 'Instrument', (BODIES[sound.body] || BODIES.classic).label],
		['clear', 'Clear', `${CLEAR_STYLES[sound.clearStyle].label} · ${MOODS[sound.scale].label}`],
		['chain', 'Chain', CHAIN_STYLES[sound.chainStyle].label],
		['power', 'Power-ups', POWER_STYLES[sound.powerStyle].label],
		['small', 'Small sounds', SMALL_STYLES[sound.smallStyle].label],
	];
	const list = document.createElement('dl');
	for (const [id, name, value] of picks) {
		const term = document.createElement('dt');
		term.textContent = name;
		const detail = document.createElement('dd');
		const bold = document.createElement('b');
		bold.textContent = value;
		const change = document.createElement('button');
		change.type = 'button';
		change.textContent = 'Change';
		change.addEventListener('click', () => goTo(id));
		detail.append(bold, change);
		list.append(term, detail);
	}
	return list;
}

function summaryActions(code) {
	const actions = document.createElement('div');
	actions.className = 'summary-actions';
	const demo = document.createElement('button');
	demo.type = 'button';
	demo.className = 'primary';
	demo.textContent = '▶ Play a demo';
	demo.addEventListener('click', playDemo);
	const playLink = document.createElement('a');
	playLink.className = 'button-link';
	playLink.href = '../index.html';
	playLink.textContent = 'Play the game';
	const copy = document.createElement('button');
	copy.type = 'button';
	copy.textContent = 'Copy settings';
	copy.addEventListener('click', async () => {
		code.value = JSON.stringify(tuningDiff(), null, '\t');
		code.hidden = false;
		if (await copyText(code.value)) toast('Copied. Send it to Claude to make it the sound for everyone.');
		else toast('Select the text below and copy it.');
	});
	actions.append(demo, playLink, copy);
	return actions;
}

// ---- start ----

// The Sound Path plays no music.
audio.musicOn = false;
unlockAudioOnTouch();
startScope($('scope'));
// Open the step in the address, or the first step that is not locked in yet.
const wanted = STEPS.findIndex((each) => each.id === location.hash.slice(1));
const firstOpen = STEPS.find((each, i) => !each.summary && isOpen(i) && !progress[each.id]) || STEPS[STEPS.length - 1];
goTo(wanted >= 0 && isOpen(wanted) ? STEPS[wanted].id : firstOpen.id);
