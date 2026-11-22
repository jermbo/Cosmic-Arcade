// The preview of an animation style in the shop: a tiny well where a block rises, lands between
// two blocks of its color, and the three clear, with the numbers of this style. It loops while
// the shop shows it, and stops by itself when the card leaves the page.

import { motionValues } from '../../feel/player-feel.js';
import { activeTheme } from '../../looks/looks.js';
import { makeElement } from '../../app/dom.js';
import { clearPose } from '../../view/draw-well.js';

const CELL = 13; // px
const GAME_CELL = 44; // the hop and fall sizes are in pixels of a game cell about this big
const START_ROWS_BELOW = 2.6; // where the block starts, in cells below the ceiling
const LAND_PAUSE = 0.35; // seconds between the landing and the clear
const LOOP_PAUSE = 0.6; // seconds after the clear before it plays again

export function motionPreview(style) {
	const motion = motionValues(style.id);
	const canvas = makeElement('canvas', 'motion-preview');
	const width = CELL * 7;
	const height = CELL * 3.4;
	const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.round(width * pixelRatio);
	canvas.height = Math.round(height * pixelRatio);
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.setAttribute('aria-hidden', 'true');
	const ctx = canvas.getContext('2d');
	const scene = { ctx, theme: activeTheme(), width, height, pixelRatio, motion };
	const block = freshBlock(motion);
	let last = performance.now();

	function frame(now) {
		if (!canvas.isConnected) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		updateBlock(block, motion, dt);
		drawScene(scene, block);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	return canvas;
}

/** The moving block. phase is 'rise', then 'land', then 'clear'. y is in cells below the ceiling. */
function freshBlock(motion) {
	return { phase: 'rise', t: 0, y: START_ROWS_BELOW, vy: motion.dropSpeed, sx: 1, sy: 1, shake: 0 };
}

function updateBlock(block, motion, dt) {
	block.t += dt;
	block.shake *= Math.pow(0.5, dt / Math.max(0.01, motion.shakeTime));
	block.sx += (1 - block.sx) * Math.min(1, dt * motion.squashSpring);
	block.sy += (1 - block.sy) * Math.min(1, dt * motion.squashSpring);
	if (block.phase === 'rise') rise(block, motion, dt);
	else if (block.phase === 'land' && block.t > LAND_PAUSE) Object.assign(block, { phase: 'clear', t: 0 });
	else if (block.phase === 'clear' && block.t > motion.clearTime + motion.clearStagger * 2 + LOOP_PAUSE) Object.assign(block, freshBlock(motion), { shake: block.shake });
}

function rise(block, motion, dt) {
	block.vy += motion.gravity * dt;
	block.y -= block.vy * dt;
	if (block.y > 0) return;
	block.y = 0;
	block.sy = 1 - motion.landSquash;
	block.sx = 1 + motion.landSquash * 0.67;
	block.shake = motion.landShake * (CELL / GAME_CELL) * 2;
	block.phase = 'land';
	block.t = 0;
}

function drawScene(scene, block) {
	const { ctx, theme, width, height, pixelRatio, motion } = scene;
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	ctx.clearRect(0, 0, width, height);
	ctx.save();
	ctx.translate((Math.random() * 2 - 1) * block.shake, (Math.random() * 2 - 1) * block.shake);
	// The ceiling of the well.
	ctx.fillStyle = theme.ink;
	ctx.fillRect(0, 0, width, 2);
	const left = (width - CELL * 3) / 2;
	const columnX = (column) => left + CELL * (column + 0.5);
	const top = 2 + CELL / 2;
	if (block.phase === 'clear') drawClear(scene, columnX, top, block.t, motion);
	else drawLanding(scene, columnX, top, block);
	ctx.restore();
}

/** The two waiting blocks, and the landing block that squashes against the ceiling. */
function drawLanding(scene, columnX, top, block) {
	const { ctx } = scene;
	drawSquare(scene, columnX(0), top);
	drawSquare(scene, columnX(2), top);
	ctx.save();
	ctx.translate(columnX(1), top + block.y * CELL - (CELL * (1 - block.sy)) / 2);
	ctx.scale(block.sx, block.sy);
	drawSquare(scene, 0, 0);
	ctx.restore();
}

/** The clear: each block hops up and left, then falls and turns while it shrinks, one after the other. */
function drawClear(scene, columnX, top, t, motion) {
	for (const column of [0, 1, 2]) {
		const ownTime = Math.max(0, t - column * motion.clearStagger);
		if (ownTime >= Math.max(0.01, motion.clearTime)) continue;
		const pose = clearPose(ownTime, motion.clearGrow, motion, CELL / GAME_CELL);
		drawSquare(scene, columnX(column) + pose.dx, top + pose.dy, pose.scale, pose.rot, pose.alpha);
	}
}

/** A plain Moss square with an outline, centered at (x, y). */
function drawSquare({ ctx, theme }, x, y, size = 1, rot = 0, alpha = 1) {
	const side = CELL * size;
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.fillStyle = theme.blocks[2];
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = 1.5;
	ctx.fillRect(-side / 2, -side / 2, side, side);
	ctx.strokeRect(-side / 2, -side / 2, side, side);
	ctx.restore();
}
