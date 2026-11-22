// The marks on a block. Each block style gives each color a second clue, so the five colors
// stay different for color-blind players and in grayscale. Every mark is drawn into a square of
// `size` pixels with its top left corner at (0, 0). `color` is the color number, 0 to 4.

import { roundRect } from '../canvas-shapes.js';

const PATTERN_ALPHA = 0.8;

/** Patterns: stripes, dots, plain, checks, rings. The caller clips the pattern to the block. */
export function drawPattern(ctx, color, size, ink) {
	const unit = size / 40; // the patterns were drawn for a 40px block
	ctx.fillStyle = ink;
	ctx.strokeStyle = ink;
	ctx.globalAlpha = PATTERN_ALPHA;
	if (color === 0) drawStripes(ctx, size, unit);
	else if (color === 1) drawDots(ctx, size, unit);
	else if (color === 3) drawChecks(ctx, size, unit);
	else if (color === 4) drawRings(ctx, size, unit);
	// Color 2 stays plain.
	ctx.globalAlpha = 1;
}

function drawStripes(ctx, size, unit) {
	ctx.lineWidth = 2 * unit;
	ctx.beginPath();
	for (let start = -size; start < size * 2; start += 7 * unit) {
		ctx.moveTo(start, size);
		ctx.lineTo(start + size, 0);
	}
	ctx.stroke();
}

function drawDots(ctx, size, unit) {
	for (let y = 3.5 * unit; y < size; y += 7 * unit) {
		for (let x = 3.5 * unit; x < size; x += 7 * unit) {
			ctx.beginPath();
			ctx.arc(x, y, 1.6 * unit, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

function drawChecks(ctx, size, unit) {
	const square = 5 * unit;
	for (let y = 0, row = 0; y < size; y += square, row++) {
		for (let x = (row % 2) * square; x < size; x += square * 2) ctx.fillRect(x, y, square, square);
	}
}

function drawRings(ctx, size, unit) {
	ctx.lineWidth = 2 * unit;
	for (let radius = 4 * unit; radius < size * 0.75; radius += 5 * unit) {
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
		ctx.stroke();
	}
}

/** Symbols: a solid triangle, circle, diamond, square or plus. */
export function drawSymbol(ctx, color, size, markColor) {
	const center = size / 2;
	const r = size * 0.21; // the "radius" of the symbol
	ctx.fillStyle = markColor;
	ctx.beginPath();
	switch (color) {
		case 0: // triangle
			ctx.moveTo(center, center - r * 1.05);
			ctx.lineTo(center + r * 1.1, center + r * 0.85);
			ctx.lineTo(center - r * 1.1, center + r * 0.85);
			break;
		case 1: // circle
			ctx.arc(center, center, r, 0, Math.PI * 2);
			break;
		case 2: // diamond
			ctx.moveTo(center, center - r * 1.2);
			ctx.lineTo(center + r * 1.2, center);
			ctx.lineTo(center, center + r * 1.2);
			ctx.lineTo(center - r * 1.2, center);
			break;
		case 3: // square
			ctx.rect(center - r * 0.9, center - r * 0.9, r * 1.8, r * 1.8);
			break;
		default: {
			// plus
			const arm = r * 0.42;
			ctx.rect(center - r * 1.1, center - arm, r * 2.2, arm * 2);
			ctx.rect(center - arm, center - r * 1.1, arm * 2, r * 2.2);
		}
	}
	ctx.closePath();
	ctx.fill();
}

// Where the dots of each die face go: -1, 0 or 1 steps from the middle.
const PIP_SPOTS = [
	[[0, 0]],
	[[-1, -1], [1, 1]],
	[[-1, -1], [0, 0], [1, 1]],
	[[-1, -1], [1, -1], [-1, 1], [1, 1]],
	[[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
];

/** Dice pips: Ember has 1 dot, up to Dusk with 5 dots. */
export function drawPips(ctx, color, size, markColor) {
	const step = size * 0.22;
	ctx.fillStyle = markColor;
	for (const [across, down] of PIP_SPOTS[color]) {
		ctx.beginPath();
		ctx.arc(size / 2 + across * step, size / 2 + down * step, size * 0.075, 0, Math.PI * 2);
		ctx.fill();
	}
}

/** Faces: grumpy, happy, sleepy, surprised, wink. A blink closes each open eye. */
export function drawFace(ctx, color, size, markColor, blink) {
	const face = faceTools(ctx, size, markColor, blink);
	const { center, eyeGap, eyeY, mouthY } = face;
	switch (color) {
		case 0: // grumpy: slanted brows, flat mouth
			face.eye(center - eyeGap, size * 0.05);
			face.eye(center + eyeGap, size * 0.05);
			face.line(center - eyeGap - size * 0.08, eyeY - size * 0.14, center - eyeGap + size * 0.07, eyeY - size * 0.07);
			face.line(center + eyeGap + size * 0.08, eyeY - size * 0.14, center + eyeGap - size * 0.07, eyeY - size * 0.07);
			face.line(center - size * 0.1, mouthY, center + size * 0.1, mouthY);
			break;
		case 1: // happy: round eyes, smile
			face.eye(center - eyeGap, size * 0.06);
			face.eye(center + eyeGap, size * 0.06);
			face.arc(center, mouthY - size * 0.07, size * 0.13, 0.15, 0.85);
			break;
		case 2: // sleepy: closed eyes, small round mouth
			for (const x of [center - eyeGap, center + eyeGap]) face.arc(x, eyeY - size * 0.02, size * 0.065, 0.1, 0.9);
			face.arc(center, mouthY, size * 0.045, 0, 2);
			break;
		case 3: // surprised: big eyes, round open mouth
			face.eye(center - eyeGap, size * 0.085);
			face.eye(center + eyeGap, size * 0.085);
			ctx.beginPath();
			ctx.ellipse(center, mouthY + size * 0.01, size * 0.07, size * 0.09, 0, 0, Math.PI * 2);
			ctx.fill();
			break;
		default: // wink: one eye open, one closed, half smile
			face.eye(center - eyeGap, size * 0.06);
			face.closedEye(center + eyeGap);
			face.arc(center - size * 0.02, mouthY - size * 0.08, size * 0.13, 0.1, 0.6);
	}
	ctx.lineCap = 'butt';
}

/** The drawing tools of a face, and where its eyes and mouth go. */
function faceTools(ctx, size, markColor, blink) {
	const center = size / 2;
	const eyeGap = size * 0.17; // from the middle to each eye
	const eyeY = center - size * 0.06;
	const mouthY = center + size * 0.17;
	ctx.fillStyle = markColor;
	ctx.strokeStyle = markColor;
	ctx.lineWidth = size * 0.055;
	ctx.lineCap = 'round';
	const line = (x1, y1, x2, y2) => {
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	};
	const openEye = (x, radius) => {
		ctx.beginPath();
		ctx.arc(x, eyeY, radius, 0, Math.PI * 2);
		ctx.fill();
	};
	const closedEye = (x, halfWidth = size * 0.07) => line(x - halfWidth, eyeY, x + halfWidth, eyeY);
	// An arc stroke; from and to count in half turns (1 is half a circle).
	const arc = (x, y, radius, from, to) => {
		ctx.beginPath();
		ctx.arc(x, y, radius, Math.PI * from, Math.PI * to);
		ctx.stroke();
	};
	const eye = (x, radius) => (blink ? closedEye(x) : openEye(x, radius));
	return { center, eyeGap, eyeY, mouthY, line, eye, closedEye, arc };
}

/** The outline path of a Silhouettes block: square, circle, leaf, octagon, arch. */
export function silhouettePath(ctx, color, x, y, width) {
	const centerX = x + width / 2;
	const centerY = y + width / 2;
	ctx.beginPath();
	switch (color) {
		case 0: // square
			roundRect(ctx, x, y, width, width, width * 0.08);
			return;
		case 1: // circle
			ctx.arc(centerX, centerY, width / 2, 0, Math.PI * 2);
			break;
		case 2: {
			// A leaf: the top-left and bottom-right corners are round, the others are sharp.
			const r = width * 0.48;
			ctx.moveTo(x + r, y);
			ctx.lineTo(x + width, y);
			ctx.lineTo(x + width, y + width - r);
			ctx.arcTo(x + width, y + width, x + width - r, y + width, r);
			ctx.lineTo(x, y + width);
			ctx.lineTo(x, y + r);
			ctx.arcTo(x, y, x + r, y, r);
			break;
		}
		case 3: {
			// An octagon: a square with its corners cut off.
			const cut = width * 0.29;
			ctx.moveTo(x + cut, y);
			ctx.lineTo(x + width - cut, y);
			ctx.lineTo(x + width, y + cut);
			ctx.lineTo(x + width, y + width - cut);
			ctx.lineTo(x + width - cut, y + width);
			ctx.lineTo(x + cut, y + width);
			ctx.lineTo(x, y + width - cut);
			ctx.lineTo(x, y + cut);
			break;
		}
		default:
			// An arch: a round top and a flat bottom.
			ctx.moveTo(x, y + width);
			ctx.lineTo(x, y + width / 2);
			ctx.arc(centerX, y + width / 2, width / 2, Math.PI, 0);
			ctx.lineTo(x + width, y + width);
	}
	ctx.closePath();
}
