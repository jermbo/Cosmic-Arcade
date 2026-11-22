// The power-up bar under the well (Endless only; Timed has none), and the aim of a Blast.
// With no power-up in use, the bar shows the bag: a chip for each slot. While a Prism waits for
// its color, it shows the colors to pick. While a power-up is in use, it shows a cancel button.

import { drawCard, drawDashedOutline, drawCross, roundRect, pulse, MONO_FONT, DANGER_RED } from './canvas-shapes.js';
import { drawPowerIcon, POWER_NAMES } from './power-icons.js';

const TOUCH_ROOM = 0.12; // cells around each button that still count as a tap on it

/** The buttons of the bar: [{ type: 'chip' | 'color' | 'cancel', x, y, w, h, ... }]. */
export function barButtons(view) {
	const { bar, cell, game, power } = view;
	if (game.autoPowers) return [];
	const gap = cell * 0.2;
	const cancel = { type: 'cancel', x: bar.x + bar.w - cell * 0.9, y: bar.y, w: cell * 0.9, h: bar.h };
	if (!power) return bagChips(bar, cell, gap, game.bagSize);
	if (power.kind === 'prism' && power.stage === 'color') return [...colorChoices(bar, gap, cancel, game.colors), cancel];
	return [cancel];
}

function bagChips(bar, cell, gap, count) {
	const w = Math.min(cell * 2.2, (bar.w - gap * (count - 1)) / count);
	const firstX = bar.x + (bar.w - (w * count + gap * (count - 1))) / 2;
	const chips = [];
	for (let index = 0; index < count; index++) chips.push({ type: 'chip', index, x: firstX + index * (w + gap), y: bar.y, w, h: bar.h });
	return chips;
}

function colorChoices(bar, gap, cancel, colorCount) {
	const size = bar.h * 0.9;
	const room = bar.w - cancel.w - gap;
	const step = Math.min(size + gap * 1.4, room / colorCount);
	const choices = [];
	for (let color = 0; color < colorCount; color++) choices.push({ type: 'color', color, x: bar.x + color * step, y: bar.y + (bar.h - size) / 2, w: size, h: size });
	return choices;
}

/** The bar button under a point, or null. */
export function hitBar(view, px, py) {
	if (!view.game || !view.bar) return null;
	const room = view.cell * TOUCH_ROOM;
	const isUnder = (button) => px >= button.x - room && px < button.x + button.w + room && py >= button.y - room && py < button.y + button.h + room;
	return barButtons(view).find(isUnder) || null;
}

export function drawBar(view) {
	const { cell, power, bar } = view;
	for (const button of barButtons(view)) {
		if (button.type === 'chip') drawChip(view, button);
		else if (button.type === 'color') drawColorChoice(view, button);
		else drawCancel(view, button);
	}
	const message = barMessage(power);
	if (message) drawBarText(view, message, { x: bar.x + cell * 0.1, y: bar.y + bar.h / 2, size: Math.max(10, Math.round(cell * 0.26)) });
}

/** What the bar tells the player to do while a power-up is in use. */
function barMessage(power) {
	if (!power) return '';
	if (power.kind !== 'prism') return 'Touch the well to aim, let go to blast';
	return power.stage === 'color' ? '' : 'Tap a piece to paint it';
}

function drawBarText(view, text, { x, y, size, color = view.theme.text }) {
	const { ctx } = view;
	ctx.font = `500 ${size}px ${MONO_FONT}`;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = color;
	ctx.fillText(text.toUpperCase(), x, y);
}

/** A slot of the power-up bag: a dashed outline when empty, or a card with the power-up and its name. A new one pops. */
function drawChip(view, chip) {
	const { ctx, cell, game, theme } = view;
	const kind = game.bag[chip.index];
	const popped = kind ? view.chipPop[chip.index] ?? 1 : 1; // 0 when it just came, 1 when settled
	const scale = 1 + Math.sin(popped * Math.PI) * 0.18 + (1 - popped) * 0.2;
	ctx.save();
	ctx.translate(chip.x + chip.w / 2, chip.y + chip.h / 2);
	ctx.scale(scale, scale);
	ctx.translate(-chip.w / 2, -chip.h / 2);
	if (kind) {
		drawCard(ctx, theme, 0, 0, chip.w, chip.h, { fill: theme.card, outline: Math.min(theme.outlineWidth, 2.5), shadow: Math.min(theme.shadowOffset, 3) });
		drawPowerIcon(ctx, kind, cell * 0.42, chip.h / 2, chip.h * 0.56, theme.ink);
		drawBarText(view, POWER_NAMES[kind], { x: cell * 0.78, y: chip.h / 2 + 1, size: Math.max(9, Math.round(cell * 0.24)) });
	} else {
		drawDashedOutline(ctx, theme, 1, 1, chip.w - 2, chip.h - 2, { dash: cell * 0.12, gap: cell * 0.1, alpha: 0.5 });
	}
	ctx.restore();
}

/** A color to pick for the Prism, with a pulsing outline. */
function drawColorChoice(view, choice) {
	const { ctx, theme } = view;
	ctx.drawImage(view.sprites.plain[choice.color], choice.x, choice.y, choice.w, choice.h);
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = 2;
	ctx.globalAlpha = 0.55 + 0.45 * Math.sin(view.time * 7 + choice.color);
	roundRect(ctx, choice.x - 3, choice.y - 3, choice.w + 6, choice.h + 6, theme.cornerRadius);
	ctx.stroke();
	ctx.globalAlpha = 1;
}

/** The cross that cancels the power-up in use. */
function drawCancel(view, button) {
	const { ctx, cell, theme } = view;
	drawCard(ctx, theme, button.x + 4, button.y + 2, button.w - 8, button.h - 4, { fill: theme.card, outline: 2, shadow: 3 });
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = 3;
	drawCross(ctx, button.x + button.w / 2, button.y + button.h / 2, cell * 0.14);
}

/** Shows what a Blast would clear while the player aims it: the 3x3 area, and a red outline on each block in it. */
export function drawAim(view) {
	const { power, aim } = view;
	if (!aim || !power || power.kind !== 'blast') return;
	const { ctx, cell, game, theme } = view;
	const areaX = view.boardX + (aim.x - 1) * cell;
	const areaY = view.boardY + (aim.y - 1) * cell;
	ctx.globalAlpha = 0.12;
	ctx.fillStyle = theme.ink;
	ctx.fillRect(areaX, areaY, cell * 3, cell * 3);
	ctx.globalAlpha = 1;
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = theme.outlineWidth;
	ctx.setLineDash([cell * 0.2, cell * 0.12]);
	roundRect(ctx, areaX + 1, areaY + 1, cell * 3 - 2, cell * 3 - 2, theme.cornerRadius);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.strokeStyle = DANGER_RED;
	ctx.globalAlpha = 0.7 + pulse(view.time, 8) * 0.3;
	for (const index of game.blastArea(aim.x, aim.y)) {
		const x = view.boardX + game.columnOf(index) * cell;
		const y = view.boardY + game.rowOf(index) * cell;
		roundRect(ctx, x + 3, y + 3, cell - 6, cell - 6, cell * 0.08);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}
