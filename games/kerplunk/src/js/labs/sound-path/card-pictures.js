// The picture on each card of the Sound Path.
// Instruments, power-up sets and small sounds: the real sound, played into a buffer, as a shape.
// Clear and chain styles: their notes as blocks (time to the right, pitch up).

import { renderSound } from '../../audio/sound-player.js';
import { planClear } from '../../audio/clear-chime.js';
import { BODIES } from '../../audio/instrument-bodies.js';
import { tuning } from '../../feel/tuning.js';
import { shapeOf, drawShape } from '../../audio/sound-scope.js';
import { withValues } from './hear.js';

const sound = tuning.sound;
const PICTURE_SECONDS = 1.2;
const cssVariable = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const blockColor = (index) => cssVariable(`--c${index % 5}`) || '#888888';

/** Short words for a sound's shape, so you can compare without terms: short or long, pure or bright. */
function describe(shape, noteHz) {
	const tail = shape.levels.findIndex((level, i) => i > 3 && level < 0.08);
	const seconds = ((tail < 0 ? shape.levels.length : tail) / shape.levels.length) * PICTURE_SECONDS;
	const length = seconds < 0.18 ? 'Very short' : seconds < 0.45 ? 'Short' : seconds < 0.8 ? 'Rings a bit' : 'Rings long';
	const brightness = shape.hz / noteHz;
	const pitch = noteHz < 250 ? 'low ' : noteHz > 600 ? 'high ' : '';
	const tone = brightness < 1.15 ? 'pure' : brightness < 1.6 ? 'warm' : brightness < 2.6 ? 'bright' : 'sparkly';
	return `${length} · ${pitch}${tone}`;
}

/** A picture of a real sound: it plays into a buffer with the card's values, and the card shows its shape. */
function renderPicture(card, values, play, { seconds = PICTURE_SECONDS, index = 0, tags }) {
	const rendering = withValues(values, () => renderSound(play, seconds));
	rendering.then((buffer) => {
		const shape = shapeOf(buffer);
		if (!shape) return;
		drawShape(card.querySelector('.shape'), shape, blockColor(index));
		card.querySelector('.tags').textContent = tags(shape);
	});
}

export function drawBodyShape(card, name, index) {
	const noteHz = sound.landPlunkPitch * Math.pow(2, BODIES[name].shift / 12);
	renderPicture(card, { body: name }, (player) => player.land(2), { index, tags: (shape) => describe(shape, noteHz) });
}

export function drawPowerShape(card, name, index) {
	renderPicture(card, { powerStyle: name }, (player) => player.blast(), { index, tags: () => 'Picture: the Blast' });
}

export function drawSmallShape(card, name, index) {
	renderPicture(card, { smallStyle: name }, (player) => player.pick(), { seconds: 0.4, index, tags: () => 'Picture: picking up a piece' });
}

/** Notes as blocks on a canvas: time to the right, pitch up. Each note is { note, at, faded, size, color }. */
function drawNoteBlocks(canvas, notes) {
	const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
	const width = canvas.clientWidth || 200;
	const height = canvas.clientHeight || 48;
	canvas.width = Math.round(width * pixelRatio);
	canvas.height = Math.round(height * pixelRatio);
	const ctx = canvas.getContext('2d');
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	const lowest = Math.min(...notes.map((n) => n.note)) - 1;
	const highest = Math.max(...notes.map((n) => n.note)) + 1;
	const lastAt = Math.max(...notes.map((n) => n.at)) || 1;
	const baseSize = Math.min(14, height / 3.4);
	const ink = cssVariable('--ink') || '#111111';
	ctx.fillStyle = ink;
	ctx.fillRect(0, height - 2, width, 2);
	notes.forEach((note, i) => {
		const size = baseSize * (note.size || 1);
		const x = 3 + (note.at / lastAt) * (width - size - 6);
		const y = height - 4 - size - ((note.note - lowest) / Math.max(1, highest - lowest)) * (height - size - 8);
		ctx.globalAlpha = note.faded ? 0.4 : 1;
		ctx.fillStyle = blockColor(note.color ?? i);
		ctx.fillRect(x, y, size, size);
		ctx.strokeStyle = ink;
		ctx.lineWidth = 2;
		ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
		ctx.globalAlpha = 1;
	});
}

/** The clear step: the notes of one clear in this mood. Faded blocks play only on a big group. */
export function drawClearNotes(card, name, mood) {
	withValues({ clearStyle: name, scale: mood }, () => {
		const smallGroupNotes = planClear(1, 3).notes.length;
		const notes = planClear(1, 6).notes.map((note, i) => ({ ...note, faded: i >= smallGroupNotes }));
		drawNoteBlocks(card.querySelector('.shape'), notes);
		card.querySelector('.tags').textContent = `${smallGroupNotes} notes · faded: extra on a big group`;
	});
}

/** The chain step: four chain steps in a row, each in its own color. Bigger blocks are louder. */
export function drawChainNotes(card, name) {
	withValues({ chainStyle: name }, () => {
		const notes = [];
		let offset = 0;
		for (let chain = 1; chain <= 4; chain++) {
			const plan = planClear(chain, 3);
			const span = Math.max(...plan.notes.map((n) => n.at)) + 1.5;
			for (const note of plan.notes) notes.push({ note: note.note, at: offset + note.at, color: chain - 1, size: Math.min(1.25, 0.75 + note.gain * 2) });
			offset += span;
		}
		drawNoteBlocks(card.querySelector('.shape'), notes);
		card.querySelector('.tags').textContent = 'Chain steps 1 to 4, one color each';
	});
}
