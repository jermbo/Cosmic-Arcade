// The secret Feel Lab: play a moment of the game again and again, and tune how it moves and sounds.
// Open labs/feel-lab.html (there is a link in the shape lab). "Save to game" keeps the feel in this browser.
// The stage (stage.js) uses the real game. The knobs (knob-controls.js) change the live tuning.

import { audio } from '../../audio/sound-player.js';
import { store } from '../../app/storage.js';
import { paintPalette, BLOCK_STYLES } from '../../view/sprites/block-sprites.js';
import { tuning, resetTuning, tuningDiff, saveTuning, clearSavedTuning } from '../../feel/tuning.js';
import { startScope } from '../../audio/sound-scope.js';
import { $, toast, copyText, wearGameTheme, unlockAudioOnTouch, setPressed } from '../lab-page.js';
import { MOTION_GROUPS, SOUND_GROUPS, MOTION_PRESETS, SOUND_PRESETS, SCENES } from './knob-list.js';
import { canvas, view, stage, frame, play, replaySoon, newBoard } from './stage.js';
import { lab, buildGroups, buildSoundList, buildPresets, previewSound, chainClimb, refresh, toggleCompare, endAllCompares, resetCompareButton, markDirty } from './knob-controls.js';

const SPEEDS = [
	[1, '1×'],
	[0.5, '½×'],
	[0.25, '¼×'],
];
const STYLE_NAMES = { patterns: 'Patterns', symbols: 'Symbols', pips: 'Dice pips', silhouettes: 'Silhouettes', faces: 'Faces' };

let blockStyle = BLOCK_STYLES.includes(store.looks.style) ? store.looks.style : 'patterns';

function showLooks() {
	const theme = wearGameTheme();
	paintPalette(theme.blocks);
	view.setLooks(theme, blockStyle);
	if (!document.fonts) return;
	for (const font of [`20px '${theme.displayFont}'`, "500 20px 'DM Mono'"]) document.fonts.load(font).catch(() => {});
}

// ---- save, copy, reset ----

$('save').addEventListener('click', () => {
	endAllCompares();
	const diff = tuningDiff();
	if (!Object.keys(diff).length) {
		clearSavedTuning();
		lab.saved = JSON.stringify(diff);
		markDirty();
		return toast('Nothing changed: the game uses the built-in feel.');
	}
	if (!saveTuning()) return toast('Could not save. This browser is blocking site storage.');
	lab.saved = JSON.stringify(diff);
	markDirty();
	toast('Saved. Reload the game to play with this feel.');
});

$('copy').addEventListener('click', async () => {
	endAllCompares();
	const text = JSON.stringify(tuningDiff(), null, '\t');
	$('code').value = text;
	$('exportPanel').hidden = false;
	if (await copyText(text)) toast('Copied. Send it to Claude to make it the feel for everyone.');
	else toast('Select the text below and copy it.');
	$('exportPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('reset').addEventListener('click', () => {
	if (!confirm('Put every knob back to the built-in value, and remove the saved feel from the game?')) return;
	lab.compare.motion = lab.compare.sound = null;
	resetCompareButton('motion');
	resetCompareButton('sound');
	resetTuning();
	clearSavedTuning();
	lab.saved = JSON.stringify(tuningDiff());
	refresh('motion');
	refresh('sound');
	toast('Back to the built-in feel.');
});

// ---- stage controls ----

/** A row of toggle buttons, one pressed at a time. */
function buttonRow(into, options, isOn, onPick) {
	for (const [value, label] of options) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		setPressed(button, isOn(value));
		button.addEventListener('click', () => {
			onPick(value);
			[...into.children].forEach((other, i) => setPressed(other, isOn(options[i][0])));
		});
		into.append(button);
	}
}

function buildStageControls() {
	buttonRow($('scenes'), SCENES, (name) => name === stage.scene, (name) => {
		stage.scene = name;
		play();
	});
	buttonRow($('speeds'), SPEEDS, (speed) => speed === stage.speed, (speed) => (stage.speed = speed));
	for (const style of BLOCK_STYLES) $('blockStyle').add(new Option(STYLE_NAMES[style] || style, style));
	$('blockStyle').value = blockStyle;
	$('blockStyle').addEventListener('change', () => {
		blockStyle = $('blockStyle').value;
		showLooks();
		view.layout();
	});
	$('play').addEventListener('click', play);
	$('loop').addEventListener('click', () => {
		stage.loop = !stage.loop;
		setPressed($('loop'), stage.loop);
		if (stage.loop && !stage.busy) play();
	});
	$('newBoard').addEventListener('click', () => {
		newBoard();
		play();
	});
	audio.musicOn = false;
	$('music').addEventListener('click', toggleMusic);
	canvas.addEventListener('pointerdown', play);
	document.addEventListener('keydown', (event) => {
		if (event.code !== 'Space' || event.target.closest('input, select, button, textarea')) return;
		event.preventDefault();
		play();
	});
}

function toggleMusic() {
	audio.unlock();
	const on = !audio.musicOn;
	audio.setMusic(on);
	audio.startMusic();
	setPressed($('music'), on);
}

function buildTabs() {
	const parts = ['motion', 'sound'];
	for (const part of parts) {
		$(`tab-${part}`).addEventListener('click', () => {
			for (const other of parts) {
				$(`tab-${other}`).setAttribute('aria-selected', String(other === part));
				$(`pane-${other}`).hidden = other !== part;
			}
		});
	}
}

// ---- start ----

unlockAudioOnTouch();
showLooks();
buildTabs();
buildStageControls();
buildGroups('motion', MOTION_GROUPS, $('motionKnobs'), (key) => {
	if (key === 'remixStyle') view.remixStyle = tuning.motion.remixStyle;
	replaySoon();
});
buildGroups('sound', SOUND_GROUPS, $('soundKnobs'), previewSound);
buildSoundList();
buildPresets('motion', MOTION_PRESETS, $('motionPresets'));
buildPresets('sound', SOUND_PRESETS, $('soundPresets'));
$('motionCompare').addEventListener('click', () => toggleCompare('motion'));
$('soundCompare').addEventListener('click', () => toggleCompare('sound'));
$('climb').addEventListener('click', () => chainClimb(8));
markDirty();

startScope($('scope'));
new ResizeObserver(() => view.resize()).observe($('stageBox'));
view.resize();
requestAnimationFrame(frame);
play();

// For the console: feelLab.tuning, feelLab.view, feelLab.stage.
window.feelLab = { stage, lab, view, tuning };
