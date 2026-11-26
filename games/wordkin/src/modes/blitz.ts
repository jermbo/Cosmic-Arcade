// Blitz: sort as many groups as you can before the clock runs out.
// A right group adds time, a wrong pick takes some away. New boards keep coming.
import { buzz, sfx } from '../audio.ts';
import { buildBoard } from '../core/builder.ts';
import { BLITZ } from '../core/economy.ts';
import { makeRng } from '../core/rng.ts';
import { DIFFICULTY, LEVEL_EMOJI, TUNING } from '../core/tuning.ts';
import type { Level } from '../core/types.ts';
import { SortBoard } from '../ui/board.ts';
import { h, wait } from '../ui/dom.ts';
import { calm, pulse, toast } from '../ui/fx.ts';
import { pushKeys } from '../ui/nav.ts';
import { Shell } from '../ui/shell.ts';
import { noteSticker } from '../ui/stickers.ts';
import type { GameCtx, ModeGame } from './ctx.ts';

export function startBlitz(ctx: GameCtx): ModeGame {
	const diff = DIFFICULTY[ctx.difficulty];
	const shell = new Shell({
		title: 'Blitz',
		tag: ctx.tag ?? `${Math.round(BLITZ.seconds / 60)} min · ${diff.name}`,
		hearts: 0,
		scale: TUNING.scoreScale[ctx.difficulty],
		hints: diff.hints,
		onHint: () => (over || !board ? null : board.hintKin() ? 'Psst… tiles with the same number are kin.' : null),
		onBack: ctx.exit,
		onHelp: ctx.help,
	});
	let left = BLITZ.seconds * 1000;
	let last = performance.now();
	let shownSec = -1;
	let over = false;
	let groups = 0;
	let boards = 0;
	let mistakes = 0;
	let combo = 0;
	let board: SortBoard | null = null;
	let boardNo = 0;
	const solvedLevels: Level[] = [];

	// The clock: a bar that drains (moved by transform only) and the seconds left.
	const fill = h('span', { class: 'clock__fill' });
	const secs = h('strong', { class: 'clock__secs' });
	const count = h('span', { class: 'clock__count' }, '0 groups');
	const clock = h('div', { class: 'clock' }, h('div', { class: 'clock__bar' }, fill), h('div', { class: 'clock__row' }, secs, count));
	const boardBox = h('div', { class: 'blitz__board' });
	shell.main.append(clock, boardBox);

	function newBoard() {
		const rng = makeRng(`${ctx.seed}|${boardNo++}`);
		const next = new SortBoard(buildBoard(rng, { levels: diff.levels }), {
			canPlay: () => !over,
			onSolve: (g, _bar, given) => {
				if (given) return;
				groups++;
				combo++;
				solvedLevels.push(g.level);
				noteSticker(g.id, shell.kip);
				shell.addScore(Math.round(BLITZ.pointsPerGroup * (1 + (combo - 1) * TUNING.comboBonus)));
				addTime(BLITZ.solveBonus);
				sfx.solve(combo);
				shell.kip.react('happy');
				count.textContent = `${groups} ${groups === 1 ? 'group' : 'groups'}`;
				if (next.done) void boardDone();
			},
			onMistake: () => {
				combo = 0;
				mistakes++;
				addTime(-BLITZ.mistakePenalty);
				shell.kip.react('sad');
			},
		});
		board = next;
		boardBox.replaceChildren(next.el);
		if (!calm()) pulse(next.el, 'panel--in');
	}

	async function boardDone() {
		boards++;
		shell.addScore(BLITZ.boardBonus);
		toast(`Board cleared! +${BLITZ.boardBonus}`);
		await wait(calm() ? 200 : 650);
		if (!over) newBoard();
	}

	function addTime(s: number) {
		left = Math.max(0, left + s * 1000);
		const tag = h('span', { class: `clock__delta${s < 0 ? ' clock__delta--minus' : ''}` }, `${s > 0 ? '+' : '−'}${Math.abs(s)}s`);
		clock.append(tag);
		setTimeout(() => tag.remove(), 900);
		pulse(clock, s < 0 ? 'clock--hit' : 'clock--plus');
		if (s < 0) buzz(50);
	}

	// One frame loop. It pauses while a card covers the game or the tab is hidden.
	let raf = 0;
	const tick = (now: number) => {
		const dt = Math.min(100, now - last);
		last = now;
		const paused = document.hidden || !!document.querySelector('.modal:not(.modal--out)');
		if (!over && !paused) left -= dt;
		const k = Math.max(0, left) / (BLITZ.seconds * 1000);
		fill.style.transform = `scaleX(${Math.min(1, k)})`;
		const s = Math.ceil(Math.max(0, left) / 1000);
		if (s !== shownSec) {
			shownSec = s;
			secs.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
			clock.classList.toggle('clock--low', s <= 10);
			if (s <= 5 && s > 0 && !over) sfx.tick(s);
		}
		if (!over && left <= 0) void end();
		if (!over) raf = requestAnimationFrame(tick);
	};

	async function end() {
		over = true;
		board?.setEnabled(false);
		shell.kip.react('wow', 0);
		toast("Time's up!", 1600);
		sfx.lose();
		await wait(1100);
		const stars = BLITZ.stars.filter((n) => groups >= n).length;
		ctx.finish({
			won: groups > 0,
			score: shell.score,
			stars,
			lines: [`Sorted ${groups} ${groups === 1 ? 'group' : 'groups'} · ${boards} ${boards === 1 ? 'board' : 'boards'} cleared`, `${mistakes} wrong ${mistakes === 1 ? 'pick' : 'picks'}`],
			grid: solvedLevels.map((l) => LEVEL_EMOJI[l]).join(''),
			groups,
		});
	}

	const releaseKeys = pushKeys((key) => {
		if (key === 'Enter') board?.submitKey();
	});
	newBoard();
	raf = requestAnimationFrame((t) => {
		last = t;
		tick(t);
	});

	return {
		el: shell.el,
		hints: () => shell.hintsUsed,
		destroy: () => {
			over = true;
			cancelAnimationFrame(raf);
			releaseKeys();
			shell.destroy();
		},
	};
}
