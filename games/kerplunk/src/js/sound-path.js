// The Sound Path: build the sound of Kerplunk one decision at a time.
// Each step picks one thing, and plays its options with what the steps before it locked in:
// 1 the drop (the instrument body), 2 the clear (its style and the mood), 3 the chain,
// 4 the power-ups and big moments, 5 the small sounds. Then "Your sound" sums it up.
// "Lock it in" saves the choice in this browser, and the game plays with it.

import { audio, planClear, renderSound } from './audio.js';
import { BODIES } from './bodies.js';
import { tuning, saveTuning, tuningDiff, CLEAR_STYLES, CHAIN_STYLES, POWER_STYLES, SMALL_STYLES, MOODS } from './tuning.js';
import { store } from './storage.js';
import { themeFor } from './themes.js';
import { writeVariables } from './theme-vars.js';
import { startScope, shapeOf, drawShape } from './sound-scope.js';

const $ = (id) => document.getElementById(id);
const S = tuning.sound;
const PROGRESS_KEY = 'kerplunk.soundpath.v1';
const CHAIN_GAP = 380; // ms between the steps of a chain
const DROP_TO_CLEAR = 450; // ms from a drop to its clear, when a card plays both

writeVariables(themeFor(store.looks));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---- progress ----

function readProgress() {
	try {
		return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
	} catch {
		return {};
	}
}
const progress = readProgress();
// A body locked before the steps kept their own record still counts as a done drop step.
if (S.body !== 'classic') progress.drop = true;

function saveProgress() {
	try {
		localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
	} catch {
		// Storage is blocked: the steps still work in this visit.
	}
}

// ---- hearing things ----

/** Runs `run` with some sound values in place of the ones in use. Sounds are scheduled at once, so it can switch back. */
function withValues(values, run) {
	const before = {};
	for (const key of Object.keys(values)) before[key] = S[key];
	Object.assign(S, values);
	try {
		return run();
	} finally {
		Object.assign(S, before);
	}
}

/** Plays with some values, now or after `ms`. */
function hear(values, play, ms = 0) {
	audio.unlock();
	if (ms) setTimeout(() => withValues(values, play), ms);
	else withValues(values, play);
}

const sounds = {
	drop: (v) => hear(v, () => audio.land(2)),
	clear: (v) => hear(v, () => audio.clear(1, 3)),
	big: (v) => hear(v, () => audio.clear(1, 6)),
	chain: (v) => {
		for (let c = 1; c <= 5; c++) hear(v, () => audio.clear(c, c > 3 ? 5 : 3), (c - 1) * CHAIN_GAP);
	},
	chainLong: (v) => {
		for (let c = 1; c <= 8; c++) hear(v, () => audio.clear(c, 3), (c - 1) * CHAIN_GAP * 0.9);
	},
	dropThenClear: (v) => {
		sounds.drop(v);
		hear(v, () => audio.clear(1, 3), DROP_TO_CLEAR);
	},
	forge: (v) => hear(v, () => audio.forge('flare')),
	flare: (v) => hear(v, () => audio.flare()),
	remix: (v) => {
		hear(v, () => audio.remixCharge());
		hear(v, () => audio.remixBoom(), 900);
		for (let i = 0; i < 8; i++) hear(v, () => audio.remixTick(i), 1250 + i * 70);
	},
	allClear: (v) => hear(v, () => audio.allClear()),
	gameOver: (v) => hear(v, () => audio.gameOver()),
	best: (v) => hear(v, () => audio.best(), 0),
	earnedThenBlast: (v) => {
		sounds.forge(v);
		hear(v, () => audio.flare(), 700);
	},
	ui: (v) => hear(v, () => audio.ui()),
	pick: (v) => hear(v, () => audio.pick()),
	move: (v) => hear(v, () => audio.move()),
	deny: (v) => hear(v, () => audio.deny()),
	tick: (v) => {
		for (let i = 0; i < 4; i++) hear(v, () => audio.tick(i >= 2), i * 500);
	},
	smallDemo: (v) => {
		hear(v, () => audio.ui());
		hear(v, () => audio.pick(), 350);
		hear(v, () => audio.move(), 600);
		hear(v, () => audio.move(), 750);
		hear(v, () => audio.deny(), 1100);
	},
};

/** A short run of the whole sound, from a tap to a big moment. */
function playDemo() {
	const at = (ms, play) => hear({}, play, ms);
	at(0, () => audio.ui());
	at(300, () => audio.pick());
	at(550, () => audio.move());
	at(700, () => audio.move());
	at(1000, () => audio.land(2));
	at(1450, () => audio.clear(1, 3));
	at(1850, () => audio.clear(2, 3));
	at(2250, () => audio.clear(3, 5));
	at(2900, () => audio.forge('flare'));
	at(3700, () => audio.flare());
	at(4500, () => audio.remixCharge());
	at(5400, () => audio.remixBoom());
	for (let i = 0; i < 8; i++) at(5750 + i * 70, () => audio.remixTick(i));
	at(6700, () => audio.allClear());
	at(8000, () => audio.deny());
}

// ---- pictures ----

/** Short words for a sound's shape, so you can compare without terms: short or long, pure or bright. */
function describe(shape, note) {
	const tail = shape.levels.findIndex((v, i) => i > 3 && v < 0.08);
	const seconds = ((tail < 0 ? shape.levels.length : tail) / shape.levels.length) * 1.2;
	const length = seconds < 0.18 ? 'Very short' : seconds < 0.45 ? 'Short' : seconds < 0.8 ? 'Rings a bit' : 'Rings long';
	const ratio = shape.hz / note;
	const pitch = note < 250 ? 'low ' : note > 600 ? 'high ' : '';
	const tone = ratio < 1.15 ? 'pure' : ratio < 1.6 ? 'warm' : ratio < 2.6 ? 'bright' : 'sparkly';
	return `${length} · ${pitch}${tone}`;
}

/** A picture of a real sound: it plays into a buffer with the card's values, and the card shows its shape. */
function renderPicture(el, values, play, { seconds = 1.2, index = 0, tags }) {
	const job = withValues(values, () => renderSound(play, seconds));
	job.then((buf) => {
		const shape = shapeOf(buf);
		if (!shape) return;
		drawShape(el.querySelector('.shape'), shape, cssVar(`--c${index % 5}`) || '#888888');
		el.querySelector('.tags').textContent = tags(shape);
	});
}

function drawBodyShape(el, name, index) {
	const note = S.landPlunkPitch * Math.pow(2, BODIES[name].shift / 12);
	renderPicture(el, { body: name }, (a) => a.land(2), { index, tags: (shape) => describe(shape, note) });
}

function drawPowerShape(el, name, index) {
	renderPicture(el, { powerStyle: name }, (a) => a.flare(), { index, tags: () => 'Picture: the Blast' });
}

function drawSmallShape(el, name, index) {
	renderPicture(el, { smallStyle: name }, (a) => a.pick(), { seconds: 0.4, index, tags: () => 'Picture: picking up a piece' });
}

/** Notes as blocks on a canvas: time to the right, pitch up. Each note is { note, at, faded, size }. */
function drawNoteBlocks(canvas, notes) {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const w = canvas.clientWidth || 200;
	const h = canvas.clientHeight || 48;
	canvas.width = Math.round(w * dpr);
	canvas.height = Math.round(h * dpr);
	const ctx = canvas.getContext('2d');
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const lo = Math.min(...notes.map((n) => n.note)) - 1;
	const hi = Math.max(...notes.map((n) => n.note)) + 1;
	const last = Math.max(...notes.map((n) => n.at)) || 1;
	const base = Math.min(14, h / 3.4);
	const ink = cssVar('--ink') || '#111111';
	ctx.fillStyle = ink;
	ctx.fillRect(0, h - 2, w, 2);
	notes.forEach((n, i) => {
		const size = base * (n.size || 1);
		const x = 3 + (n.at / last) * (w - size - 6);
		const y = h - 4 - size - ((n.note - lo) / Math.max(1, hi - lo)) * (h - size - 8);
		ctx.globalAlpha = n.faded ? 0.4 : 1;
		ctx.fillStyle = cssVar(`--c${(n.color ?? i) % 5}`) || '#888888';
		ctx.fillRect(x, y, size, size);
		ctx.strokeStyle = ink;
		ctx.lineWidth = 2;
		ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
		ctx.globalAlpha = 1;
	});
}

/** The clear step: the notes of one clear. Faded blocks play only on a big group. */
function drawClearNotes(el, name) {
	withValues({ clearStyle: name, scale: draft.mood }, () => {
		const small = planClear(1, 3).notes.length;
		const notes = planClear(1, 6).notes.map((n, i) => ({ ...n, faded: i >= small }));
		drawNoteBlocks(el.querySelector('.shape'), notes);
		el.querySelector('.tags').textContent = `${small} notes · faded: extra on a big group`;
	});
}

/** The chain step: four chain steps in a row, each in its own color. Bigger blocks are louder. */
function drawChainNotes(el, name) {
	withValues({ chainStyle: name }, () => {
		const notes = [];
		let offset = 0;
		for (let c = 1; c <= 4; c++) {
			const plan = planClear(c, 3);
			const span = Math.max(...plan.notes.map((n) => n.at)) + 1.5;
			for (const n of plan.notes) notes.push({ note: n.note, at: offset + n.at, color: c - 1, size: Math.min(1.25, 0.75 + n.gain * 2) });
			offset += span;
		}
		drawNoteBlocks(el.querySelector('.shape'), notes);
		el.querySelector('.tags').textContent = 'Chain steps 1 to 4, one color each';
	});
}

// ---- the steps ----

const one = (title) => [{ title, test: () => true }];

const STEPS = [
	{
		id: 'drop',
		label: 'The drop',
		title: 'Step 1 · The drop',
		intro: 'Pick the instrument. You hear it every time a piece lands, and the clear and the chain are built on it. Tap a card to hear a drop and then a clear.',
		key: 'body',
		groups: [
			{ title: 'You liked these', test: (o) => o.group === 'liked' },
			{ title: 'Cartoon', test: (o) => o.group === 'cartoon' },
			{ title: 'New to try', test: (o, name) => !o.group && name !== 'classic' },
			{ title: 'Today’s sound', test: (o, name) => name === 'classic' },
		],
		options: BODIES,
		values: (name) => ({ body: name }),
		hear: [
			['Drop', 'drop'],
			['Clear', 'clear'],
			['Chain', 'chain'],
		],
		tap: 'dropThenClear',
		picture: drawBodyShape,
	},
	{
		id: 'clear',
		label: 'Clear',
		title: 'Step 2 · The clear',
		intro: 'Pick how a clear plays its notes. Each card plays with your drop instrument. Pick a mood first: it sets the notes for every card.',
		key: 'clearStyle',
		mood: true,
		groups: one('Clear styles'),
		options: CLEAR_STYLES,
		values: (name) => ({ clearStyle: name, scale: draft.mood }),
		hear: [
			['Clear', 'clear'],
			['Big group', 'big'],
			['Chain', 'chain'],
		],
		tap: 'dropThenClear',
		picture: drawClearNotes,
	},
	{
		id: 'chain',
		label: 'Chain',
		title: 'Step 3 · The chain',
		intro: 'A chain is clears one after another. Pick how it builds, so a long chain feels bigger and bigger. Each card plays your clear.',
		key: 'chainStyle',
		groups: one('Chain styles'),
		options: CHAIN_STYLES,
		values: (name) => ({ chainStyle: name }),
		hear: [
			['Chain of 5', 'chain'],
			['Long chain', 'chainLong'],
		],
		tap: 'chain',
		picture: drawChainNotes,
	},
	{
		id: 'power',
		label: 'Power-ups',
		title: 'Step 4 · Power-ups and big moments',
		intro: 'The loud, special sounds: earning a power-up, a Blast, a Remix, an all clear, game over and a new best. Tap a card to hear a power-up earned and then a Blast.',
		key: 'powerStyle',
		groups: one('Power-up sets'),
		options: POWER_STYLES,
		values: (name) => ({ powerStyle: name }),
		hear: [
			['Earned', 'forge'],
			['Blast', 'flare'],
			['Remix', 'remix'],
			['All clear', 'allClear'],
			['Game over', 'gameOver'],
			['New best', 'best'],
		],
		tap: 'earnedThenBlast',
		picture: drawPowerShape,
	},
	{
		id: 'small',
		label: 'Small sounds',
		title: 'Step 5 · The small sounds',
		intro: 'The little sounds you hear all the time: a button tap, picking up a piece, moving it, "no", and the clock tick in Timed. They should be easy on the ear. Tap a card to hear a few in a row.',
		key: 'smallStyle',
		groups: one('Small-sound sets'),
		options: SMALL_STYLES,
		values: (name) => ({ smallStyle: name }),
		hear: [
			['Tap', 'ui'],
			['Pick up', 'pick'],
			['Move', 'move'],
			['No', 'deny'],
			['Tick', 'tick'],
		],
		tap: 'smallDemo',
		picture: drawSmallShape,
	},
	{ id: 'done', label: 'Your sound', title: 'Your sound', summary: true },
];

const draft = { pick: null, mood: S.scale };
let step = null;

/** A step is open when every step before it is locked in. */
function isOpen(index) {
	return STEPS.slice(0, index).every((s) => s.summary || progress[s.id]);
}

function buildSteps() {
	const nav = $('steps');
	nav.textContent = '';
	STEPS.forEach((s, i) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = s.summary ? s.label : `${i + 1} · ${s.label}${progress[s.id] ? ' ✓' : ''}`;
		const open = isOpen(i);
		btn.disabled = !open;
		btn.className = s === step ? 'now' : progress[s.id] ? 'done' : 'later';
		if (s === step) btn.setAttribute('aria-current', 'step');
		btn.title = open ? '' : 'Lock in the step before it first';
		btn.addEventListener('click', () => go(s.id));
		nav.append(btn);
	});
}

function go(id) {
	const index = STEPS.findIndex((s) => s.id === id);
	if (index < 0 || !isOpen(index)) return;
	step = STEPS[index];
	history.replaceState(null, '', `#${id}`);
	draft.pick = null;
	draft.mood = S.scale;
	$('stepTitle').textContent = step.title;
	$('stepIntro').textContent = step.intro || '';
	$('builtOn').hidden = index === 0 || step.summary;
	$('builtOn').textContent = `Built on: ${builtOn(index)}`;
	$('moodBox').hidden = !step.mood;
	$('lockbar').hidden = Boolean(step.summary);
	if (step.mood) buildMoods();
	if (step.summary) buildSummary();
	else buildCards();
	buildSteps();
	if (!step.summary) choose(S[step.key]);
	window.scrollTo({ top: 0 });
}

/** What the steps before this one locked in, in a few words. */
function builtOn(index) {
	const parts = [];
	if (index > 0) parts.push((BODIES[S.body] || BODIES.classic).label);
	if (index > 1) parts.push(`${CLEAR_STYLES[S.clearStyle].label} · ${MOODS[S.scale].label}`);
	if (index > 2) parts.push(CHAIN_STYLES[S.chainStyle].label);
	if (index > 3) parts.push(`${POWER_STYLES[S.powerStyle].label} power-ups`);
	return parts.join(' · ');
}

// ---- moods ----

function buildMoods() {
	const row = $('moods');
	row.textContent = '';
	for (const [name, mood] of Object.entries(MOODS)) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('role', 'radio');
		btn.dataset.mood = name;
		btn.textContent = mood.label;
		btn.addEventListener('click', () => {
			draft.mood = name;
			showMood();
			for (const el of document.querySelectorAll('.body-card')) drawClearNotes(el, el.dataset.option);
			sounds.chain(step.values(draft.pick || S[step.key]));
			updateLock();
		});
		row.append(btn);
	}
	showMood();
}

function showMood() {
	for (const btn of $('moods').children) btn.setAttribute('aria-checked', String(btn.dataset.mood === draft.mood));
	$('moodHint').textContent = MOODS[draft.mood].blurb;
}

// ---- the cards ----

function card(name, option, index) {
	const el = document.createElement('article');
	el.className = 'body-card';
	el.dataset.option = name;
	el.tabIndex = 0;
	el.setAttribute('role', 'button');
	el.setAttribute('aria-label', `${option.label}. Tap to hear and pick it.`);
	el.innerHTML = `
		<div class="body-head">
			<h3></h3>
			<span class="badge" hidden>In the game</span>
		</div>
		<p class="blurb"></p>
		<canvas class="shape"></canvas>
		<p class="tags label">…</p>
		<div class="hear" role="group" aria-label="Hear it"></div>`;
	el.querySelector('h3').textContent = option.label;
	el.querySelector('.blurb').textContent = option.blurb;
	const hearRow = el.querySelector('.hear');
	for (const [label, sound] of step.hear) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = `▶ ${label}`;
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			sounds[sound](step.values(name));
			choose(name);
		});
		hearRow.append(btn);
	}
	const tryIt = () => {
		sounds[step.tap](step.values(name));
		choose(name);
	};
	el.addEventListener('click', tryIt);
	el.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			tryIt();
		}
	});
	requestAnimationFrame(() => step.picture(el, name, index));
	return el;
}

function buildCards() {
	$('groups').textContent = '';
	let index = 0;
	for (const group of step.groups) {
		const names = Object.keys(step.options).filter((name) => group.test(step.options[name], name));
		if (!names.length) continue;
		const section = document.createElement('section');
		section.className = 'body-group';
		const h = document.createElement('h2');
		h.textContent = group.title;
		const grid = document.createElement('div');
		grid.className = 'body-grid';
		for (const name of names) grid.append(card(name, step.options[name], index++));
		section.append(h, grid);
		$('groups').append(section);
	}
	showBadges();
}

function showBadges() {
	for (const el of document.querySelectorAll('.body-card')) el.querySelector('.badge').hidden = el.dataset.option !== S[step.key];
}

function choose(name) {
	if (!step.options || !step.options[name]) return;
	draft.pick = name;
	for (const el of document.querySelectorAll('.body-card')) el.classList.toggle('on', el.dataset.option === name);
	updateLock();
}

/** The lock button is on while the pick differs from what the game uses, or the step is not done yet. */
function updateLock() {
	if (step.summary) return;
	const values = step.values(draft.pick || S[step.key]);
	const same = Object.entries(values).every(([k, v]) => S[k] === v);
	const done = progress[step.id] && same;
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
	Object.assign(S, step.values(draft.pick));
	if (!saveTuning()) return toast('Could not save. This browser is blocking site storage.');
	progress[step.id] = true;
	saveProgress();
	showBadges();
	buildSteps();
	updateLock();
	toast('Locked in. The game uses it now.');
});

$('next').addEventListener('click', () => {
	const next = STEPS[STEPS.indexOf(step) + 1];
	if (next) go(next.id);
});

// ---- your sound ----

function buildSummary() {
	const box = $('groups');
	box.textContent = '';
	const rows = [
		['drop', 'Instrument', (BODIES[S.body] || BODIES.classic).label],
		['clear', 'Clear', `${CLEAR_STYLES[S.clearStyle].label} · ${MOODS[S.scale].label}`],
		['chain', 'Chain', CHAIN_STYLES[S.chainStyle].label],
		['power', 'Power-ups', POWER_STYLES[S.powerStyle].label],
		['small', 'Small sounds', SMALL_STYLES[S.smallStyle].label],
	];
	const panel = document.createElement('section');
	panel.className = 'summary';
	const list = document.createElement('dl');
	for (const [id, name, value] of rows) {
		const dt = document.createElement('dt');
		dt.textContent = name;
		const dd = document.createElement('dd');
		const b = document.createElement('b');
		b.textContent = value;
		const change = document.createElement('button');
		change.type = 'button';
		change.textContent = 'Change';
		change.addEventListener('click', () => go(id));
		dd.append(b, change);
		list.append(dt, dd);
	}
	const actions = document.createElement('div');
	actions.className = 'summary-actions';
	const demo = document.createElement('button');
	demo.type = 'button';
	demo.className = 'primary';
	demo.textContent = '▶ Play a demo';
	demo.addEventListener('click', playDemo);
	const play = document.createElement('a');
	play.className = 'button-link';
	play.href = 'index.html';
	play.textContent = 'Play the game';
	const copy = document.createElement('button');
	copy.type = 'button';
	copy.textContent = 'Copy settings';
	const code = document.createElement('textarea');
	code.readOnly = true;
	code.hidden = true;
	code.spellcheck = false;
	copy.addEventListener('click', async () => {
		code.value = JSON.stringify(tuningDiff(), null, '\t');
		code.hidden = false;
		try {
			await navigator.clipboard.writeText(code.value);
			toast('Copied. Send it to Claude to make it the sound for everyone.');
		} catch {
			toast('Select the text below and copy it.');
		}
	});
	actions.append(demo, play, copy);
	const note = document.createElement('p');
	note.className = 'hint';
	note.textContent = 'The demo plays a tap, a pick-up, a drop, a chain of 3, a power-up, a Blast, a Remix, an all clear and a "no". The game already uses this sound in this browser.';
	panel.append(list, actions, note, code);
	box.append(panel);
}

let toastTimer = 0;
function toast(text) {
	const el = $('toast');
	el.textContent = text;
	el.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

// Phones block audio until the first tap. The Sound Path plays no music.
audio.musicOn = false;
for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });

startScope($('scope'));
// Open the step in the address, or the first step that is not locked in yet.
const wanted = STEPS.findIndex((s) => s.id === location.hash.slice(1));
const firstOpen = STEPS.find((s, i) => !s.summary && isOpen(i) && !progress[s.id]) || STEPS[STEPS.length - 1];
go(wanted >= 0 && isOpen(wanted) ? STEPS[wanted].id : firstOpen.id);
