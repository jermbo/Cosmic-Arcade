/**
 * The play screen, layout C ("thumb zone"): tools in the top bar, the board, then
 * a numbers row and a colors row at the bottom, in reach of the thumb.
 * A hint opens as a sheet in place of the two rows; the board shrinks but stays in view.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Event, Game } from '../app/game.ts';
import { clashCells, newGame, pairCounts, step, toSave } from '../app/game.ts';
import type { Pad } from '../app/input.ts';
import { moveFocus, useGamepad, useKeys } from '../app/input.ts';
import type { GameSave, Settings } from '../app/save.ts';
import { formatTime } from '../app/save.ts';
import type { Earning } from '../app/shop.ts';
import { cellName } from '../core/grid.ts';
import type { Puzzle } from '../core/types.ts';
import { COLOR_NAMES, sentenceText } from '../core/words.ts';
import { colorLabel, colorName, Icon, Mini, Shape } from './bits.tsx';
import type { Face, FaceAnim } from './Board.tsx';
import { Board } from './Board.tsx';
import type { FxApi } from './Fx.tsx';
import { Fx, tileCenter } from './Fx.tsx';
import type { MozziMood } from './Mozzi.tsx';
import { lookAt, Mozzi } from './Mozzi.tsx';
import { HintPanel, marksFor } from './HintPanel.tsx';

export interface FinishInfo {
	isBest: boolean;
	best: number | null;
	streak: number;
	dailyToday: boolean;
	earned: Earning[];
	coins: number;
}

interface Props {
	puzzle: Puzzle;
	label: string;
	sub: string;
	saved?: GameSave;
	settings: Settings;
	calm: boolean;
	keysShown: boolean;
	tutorial: boolean;
	onTutorialDone: () => void;
	onSave: (g: GameSave) => void;
	onFinish: (g: { time: number; hints: number; shown: number }) => FinishInfo;
	onQuit: () => void;
	onNext?: () => void;
	nextLabel?: string;
	onSettings: () => void;
	onRules: () => void;
	/** Set by the app when the phone's back button was pressed. */
	backSignal: number;
	/** True while the settings dialog is on top: input goes there. */
	covered: boolean;
}

const NUM_KEYS = ['1', '2', '3', '4'];
const COLOR_KEYS = ['Q', 'W', 'E', 'R'];

export function Play(props: Props) {
	const { puzzle, settings, calm } = props;
	const [game, dispatch] = useReducer(step, undefined, () => newGame(puzzle, props.saved));
	const [paused, setPaused] = useState(false);
	const [confirmReset, setConfirmReset] = useState(false);
	const [pairsOpen, setPairsOpen] = useState(false);
	const [result, setResult] = useState<(FinishInfo & { time: number; hints: number; shown: number }) | null>(null);
	const [faces, setFaces] = useState<Face[]>(() => Array.from({ length: 16 }, () => ({ bump: 0, anim: '' as FaceAnim })));
	const [shake, setShake] = useState<number[]>([]);
	const [flash, setFlash] = useState<number[]>([]);
	const [toast, setToast] = useState('');
	const [live, setLive] = useState('');
	// Mozzi: a mood that falls back to idle, a tile color that hops, and a nap when left alone.
	const [mood, setMood] = useState<MozziMood>('idle');
	const [hop, setHop] = useState<{ color: number; n: number } | null>(null);
	const moodTimer = useRef(0);
	const lastAct = useRef(performance.now());
	const feel = useCallback((m: MozziMood, ms = 700) => {
		clearTimeout(moodTimer.current);
		setMood(m);
		if (m !== 'cheer') moodTimer.current = window.setTimeout(() => setMood('idle'), ms);
	}, []);
	const [tut, setTut] = useState(props.tutorial ? 0 : -1);
	const fx = useRef<FxApi>(null);
	const gameRef = useRef(game);
	gameRef.current = game;

	// The board fills the space the bars leave, as a square.
	const wrap = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState(300);
	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const fit = () => setSize(Math.floor(Math.max(180, Math.min(el.clientWidth - 30, el.clientHeight - 30, 620))));
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		fit();
		return () => ro.disconnect();
	}, []);

	const clashes = useMemo(() => (settings.showClashes ? clashCells(game.board) : new Set<number>()), [game.board, settings.showClashes]);
	const counts = useMemo(() => pairCounts(game.board), [game.board]);
	const marks = marksFor(game.hint, flash);
	const blocked = paused || !!result || confirmReset || pairsOpen;

	const say = useCallback((text: string) => {
		setToast(text);
		window.setTimeout(() => setToast((t) => (t === text ? '' : t)), 2000);
	}, []);
	/** Words for screen readers (a polite live region). */
	const tell = useCallback((text: string) => setLive((t) => (t === text ? `${text} ` : text)), []);
	const buzz = useCallback((ms: number) => settings.haptics && navigator.vibrate?.(ms), [settings.haptics]);
	const bump = (cell: number, anim: FaceAnim) => setFaces((f) => f.map((x, i) => (i === cell ? { bump: x.bump + 1, anim } : x)));

	// ---------------------------------------------------------------- feel: sound, particles, motion, and spoken updates
	useEffect(() => {
		if (game.events.length) lastAct.current = performance.now();
		for (const e of game.events) react(e);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [game.tick]);

	// Mozzi dozes off after 25 seconds without a move, and wakes on the next one.
	useEffect(() => {
		const id = window.setInterval(() => {
			if (performance.now() - lastAct.current > 25000 && !gameRef.current.solved && !gameRef.current.hint) setMood((m) => (m === 'idle' ? 'sleep' : m));
		}, 3000);
		return () => clearInterval(id);
	}, []);

	function react(e: Event) {
		const g = gameRef.current;
		switch (e.kind) {
			case 'select':
				audio.play('select');
				if (mood === 'sleep') feel('happy', 500);
				break;
			case 'place': {
				const { cx, cy } = tileCenter(e.cell);
				bump(e.cell, e.full ? 'full' : e.axis === 'num' ? 'num' : 'color');
				feel(e.full ? 'squish' : 'happy', e.full ? 550 : 450);
				if (e.axis === 'color') setHop((h) => ({ color: e.value, n: (h?.n ?? 0) + 1 }));
				audio.play(e.axis === 'num' ? (`num${e.value}` as 'num0') : (`color${e.value}` as 'color0'));
				const n = g.board.num[e.cell];
				const c = g.board.color[e.cell];
				tell(`${cellName(e.cell)}: ${[n >= 0 ? n + 1 : '', c >= 0 ? COLOR_NAMES[c] : ''].filter(Boolean).join(', ')}${e.full ? '. Glued in.' : ''}`);
				if (e.full) {
					audio.play('glue', { delay: 0.05 });
					fx.current?.burst('glue', cx, cy, 10);
					buzz(12);
				} else buzz(6);
				if (tut === 1 && e.axis === 'num') setTut(2);
				if (tut === 2 && e.axis === 'color') setTut(3);
				break;
			}
			case 'erase':
				bump(e.cell, 'erase');
				audio.play('erase');
				tell(`${cellName(e.cell)} cleared`);
				break;
			case 'note':
				audio.play('note');
				break;
			case 'undo':
				audio.play('undo');
				tell('Undone');
				break;
			case 'locked':
				audio.play('locked');
				feel('no', 900);
				setShake([e.cell]);
				window.setTimeout(() => setShake([]), 380);
				say('That part is a clue. It can’t change.');
				tell('That part is a clue.');
				break;
			case 'clash':
				audio.play('clash', { delay: 0.15 });
				window.setTimeout(() => feel('wince', 1300), 120);
				setShake(e.cells);
				window.setTimeout(() => setShake([]), 420);
				buzz(30);
				tell(`Clash: ${e.cells.map(cellName).join(' and ')} break a rule.`);
				break;
			case 'solved': {
				feel('cheer');
				audio.duck(5);
				audio.play('solve', { delay: 0.2 });
				buzz(40);
				tell('Window mended!');
				window.setTimeout(() => {
					for (let i = 0; i < 16; i++) {
						const { cx, cy } = tileCenter(i);
						window.setTimeout(() => fx.current?.burst('shard', cx, cy, 3), i * 45);
						window.setTimeout(() => fx.current?.burst('mote', cx, cy, 2), 600 + i * 30);
					}
				}, 300);
				const info = props.onFinish({ time: g.elapsed, hints: g.hints, shown: g.shown });
				window.setTimeout(() => setResult({ ...info, time: g.elapsed, hints: g.hints, shown: g.shown }), calm ? 900 : 2400);
				break;
			}
			case 'hint':
				audio.play('hint');
				feel('think', 900);
				break;
			case 'reset':
				audio.play('page');
				setFaces((f) => f.map((x) => ({ bump: x.bump + 1, anim: 'erase' })));
				break;
		}
	}

	// Read hints aloud as they open.
	useEffect(() => {
		const h = game.hint;
		if (!h) return;
		if (h.hint.kind === 'wrong') tell([h.hint.where, ...(h.level >= 2 ? h.hint.why : [])].map(sentenceText).join(' '));
		else if (h.hint.kind === 'step') {
			const ex = h.hint.ex;
			tell(h.level === 1 ? sentenceText(ex.where) : [ex.question, ...ex.reasons.map((r) => r.says), ex.answer].map(sentenceText).join(' '));
		}
	}, [game.hint, tell]);

	// ---------------------------------------------------------------- time and saving
	useEffect(() => {
		if (blocked || game.solved || tut >= 0) return;
		let last = performance.now();
		const id = window.setInterval(() => {
			const now = performance.now();
			if (document.visibilityState === 'visible') dispatch({ type: 'time', ms: now - last });
			last = now;
		}, 250);
		return () => clearInterval(id);
	}, [blocked, game.solved, tut]);

	useEffect(() => {
		if (!game.solved) props.onSave(toSave(game));
		// Save on every change, and every few seconds of time.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [game.board, game.notes, game.hints, game.shown, Math.floor(game.elapsed / 5000)]);

	useEffect(
		() => () => {
			if (!gameRef.current.solved) props.onSave(toSave(gameRef.current));
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	useEffect(() => {
		const hide = () => document.visibilityState === 'hidden' && !gameRef.current.solved && setPaused(true);
		document.addEventListener('visibilitychange', hide);
		return () => document.removeEventListener('visibilitychange', hide);
	}, []);

	// The phone's back button closes what is open, else pauses. It never leaves.
	const firstBack = useRef(props.backSignal);
	useEffect(() => {
		if (props.backSignal === firstBack.current) return;
		if (confirmReset) setConfirmReset(false);
		else if (pairsOpen) setPairsOpen(false);
		else if (game.hint) dispatch({ type: 'closeHint' });
		else if (result) props.onQuit();
		else setPaused((p) => !p);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.backSignal]);

	// ---------------------------------------------------------------- actions
	const tapTile = (cell: number) => {
		if (blocked) return;
		dispatch({ type: 'select', cell });
		if (tut === 0) setTut(1);
	};
	const pressNum = (v: number) => dispatch({ type: 'set', axis: 'num', value: v });
	const pressColor = (v: number) => dispatch({ type: 'set', axis: 'color', value: v });
	const pickPair = (p: number) => {
		const cells = game.board.num.flatMap((n, i) => (n >= 0 && game.board.color[i] >= 0 && n * 4 + game.board.color[i] === p ? [i] : []));
		setPairsOpen(false);
		setFlash(cells);
		window.setTimeout(() => setFlash([]), 1400);
		audio.play('ui');
		if (!cells.length) say(`The ${COLOR_NAMES[p & 3]} ${(p >> 2) + 1} isn’t in the window yet.`);
	};
	const cycle = (axis: 'num' | 'color') => {
		const now = (axis === 'num' ? game.board.num : game.board.color)[game.sel];
		dispatch({ type: 'set', axis, value: now === 3 ? 3 : now + 1 }); // picking 4 again clears it
	};
	const focusTile = (cell: number) => document.querySelector<HTMLElement>(`[data-cell="${cell}"]`)?.focus();

	useKeys((e) => {
		if (props.covered || e.target instanceof HTMLInputElement) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			if (confirmReset) setConfirmReset(false);
			else if (pairsOpen) setPairsOpen(false);
			else if (game.hint) dispatch({ type: 'closeHint' });
			else if (!result) setPaused((p) => !p);
			return;
		}
		if (blocked) {
			if (e.key.startsWith('Arrow')) {
				e.preventDefault();
				moveFocus(e.key.slice(5).toLowerCase() as 'up');
			}
			return;
		}
		const k = e.key.toLowerCase();
		const mod = e.metaKey || e.ctrlKey;
		const arrows: Record<string, [number, number]> = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] };
		if (arrows[k]) {
			e.preventDefault();
			dispatch({ type: 'move', dr: arrows[k][0], dc: arrows[k][1] });
			if (tut === 0) setTut(1);
			return;
		}
		if (mod && k === 'z') {
			e.preventDefault();
			dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
			return;
		}
		if (mod || e.altKey) return;
		if ('1234'.includes(k) && k) pressNum(Number(k) - 1);
		else if ('5678'.includes(k) && k) pressColor(Number(k) - 5);
		else if ('qwer'.includes(k) && k) pressColor('qwer'.indexOf(k));
		else if (k === 'backspace' || k === 'delete' || k === '0' || k === 'x') dispatch({ type: 'erase' });
		else if (k === 'n' || k === ' ') dispatch({ type: 'toggleNotes' });
		else if (k === 'z') dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
		else if (k === 'y') dispatch({ type: 'redo' });
		else if (k === 'h') dispatch({ type: 'hint' });
		else if (k === 'p') setPairsOpen(true);
		else if (k === 'enter' && game.hint) dispatch({ type: 'hintLevel', level: game.hint.level === 1 ? 2 : 3 });
		else return;
		e.preventDefault();
	});

	useGamepad((cmd: Pad) => {
		if (props.covered) return;
		const active = document.activeElement as HTMLElement | null;
		const onTile = !!active?.dataset?.cell || active === document.body || !active;
		if (cmd === 'start') {
			if (!result) setPaused((p) => !p);
			return;
		}
		if (blocked || !onTile) {
			if (cmd === 'up' || cmd === 'down' || cmd === 'left' || cmd === 'right') moveFocus(cmd);
			else if (cmd === 'a') active?.click();
			else if (cmd === 'b') {
				if (confirmReset) setConfirmReset(false);
				else if (pairsOpen) setPairsOpen(false);
				else if (paused) setPaused(false);
				else focusTile(game.sel);
			}
			return;
		}
		const dirs: Record<string, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
		if (dirs[cmd]) {
			const r = Math.floor(game.sel / 4) + dirs[cmd][0];
			const c = (game.sel % 4) + dirs[cmd][1];
			if (r < 0 || r > 3 || c < 0 || c > 3) {
				focusTile(game.sel);
				moveFocus(cmd as 'up');
			} else {
				dispatch({ type: 'select', cell: r * 4 + c });
				focusTile(r * 4 + c);
			}
			return;
		}
		if (cmd === 'a') cycle('num');
		else if (cmd === 'x') cycle('color');
		else if (cmd === 'y') dispatch({ type: 'toggleNotes' });
		else if (cmd === 'b') game.hint ? dispatch({ type: 'closeHint' }) : dispatch({ type: 'erase' });
		else if (cmd === 'lb') dispatch({ type: 'undo' });
		else if (cmd === 'rb') dispatch({ type: 'redo' });
		else if (cmd === 'select') dispatch({ type: 'hint' });
	});

	// Keep the picked tile focused for keyboard and gamepad users.
	useEffect(() => {
		const active = document.activeElement as HTMLElement | null;
		if (active?.dataset?.cell) focusTile(game.sel);
	}, [game.sel]);

	const g: Game = game;
	const selN = g.board.num[g.sel];
	const selC = g.board.color[g.sel];
	const lockN = puzzle.givens.num[g.sel] >= 0;
	const lockC = puzzle.givens.color[g.sel] >= 0;
	const used = counts.filter((c) => c > 0).length;
	/** Is the pair (n, c) already finished on another tile? */
	const pairElsewhere = (n: number, c: number) => g.board.num.some((v, i) => i !== g.sel && v === n && g.board.color[i] === c);

	return (
		<div
			className={`play${paused ? ' is-paused' : ''}${g.solved ? ' is-solved' : ''}${g.hint ? ' hint-open' : ''}${g.notesMode ? ' notes-on' : ''}`}
			data-layer
		>
			<header className="bar">
				<button className="puff tool" onClick={() => setPaused(true)} aria-label="Pause">
					<Icon name="pause" />
				</button>
				<div className="bar-title">
					<b className="timer" aria-label={`Time ${formatTime(g.elapsed)}`}>
						{settings.showTimer ? formatTime(g.elapsed) : props.label}
					</b>
					<small>{props.sub}</small>
				</div>
				<div className="bar-tools">
					<button className="puff tool" onClick={() => dispatch({ type: 'undo' })} disabled={!g.past.length} aria-label="Undo">
						<Icon name="undo" />
						{props.keysShown && <kbd>Z</kbd>}
					</button>
					<button className="puff tool redo" onClick={() => dispatch({ type: 'redo' })} disabled={!g.future.length} aria-label="Redo">
						<Icon name="redo" />
						{props.keysShown && <kbd>Y</kbd>}
					</button>
					<button className={`puff tool${g.notesMode ? ' on' : ''}`} onClick={() => dispatch({ type: 'toggleNotes' })} aria-pressed={g.notesMode} aria-label="Pencil notes">
						<Icon name="pencil" />
						{props.keysShown && <kbd>N</kbd>}
					</button>
					<button className="puff tool" onClick={() => dispatch({ type: 'erase' })} aria-label="Erase tile">
						<Icon name="erase" />
						{props.keysShown && <kbd>⌫</kbd>}
					</button>
					<button className="puff tool tool-hint" onClick={() => dispatch({ type: 'hint' })} aria-label="Hint">
						<Icon name="bulb" />
						{props.keysShown && <kbd>H</kbd>}
					</button>
				</div>
			</header>

			<main className="stage">
				<div className="board-wrap" ref={wrap}>
					<div className="board-box" style={{ ['--board' as string]: `${size}px` }}>
						<Board
							board={g.board}
							givens={puzzle.givens}
							noteNum={g.notes.num}
							noteColor={g.notes.color}
							sel={g.sel}
							showSel={!paused}
							clashes={clashes}
							helpers={settings.helpers && !marks}
							marks={marks}
							faces={faces}
							shake={calm ? [] : shake}
							solved={g.solved}
							onTap={tapTile}
							onFocusCell={(cell) => dispatch({ type: 'select', cell })}
						>
							<Fx ref={fx} calm={calm} />
						</Board>
						{paused && <div className="frost" aria-hidden="true" />}
					</div>
				</div>

				<div className="dock">
					{g.hint ? (
						<HintPanel
							view={g.hint}
							keys={props.keysShown}
							onWhy={() => dispatch({ type: 'hintLevel', level: 2 })}
							onShow={() => dispatch({ type: 'hintLevel', level: 3 })}
							onClose={() => dispatch({ type: 'closeHint' })}
							onFlash={setFlash}
						/>
					) : (
						<div className="controls">
							<div className="status">
								<span className={`mode${g.notesMode ? ' on' : ''}`} aria-live="polite">
									<Icon name="pencil" size={15} /> {g.notesMode ? 'Notes on' : 'Notes off'}
								</span>
								<Mozzi
									mood={g.solved ? 'cheer' : mood}
									look={lookAt(g.sel)}
									hop={hop}
									size={46}
									label="Mozzi. Tap for a hint."
									onClick={() => dispatch({ type: 'hint' })}
								/>
								<button className="pairs-chip" onClick={() => setPairsOpen(true)} aria-label={`Pairs used: ${used} of 16. Show all pairs.`}>
									<Icon name="grid" size={15} /> Pairs <b>{used}</b>/16
								</button>
							</div>
							<div className="keys" role="group" aria-label="Numbers">
								{[0, 1, 2, 3].map((v) => {
									const count = g.board.num.filter((n) => n === v).length;
									const on = selN === v;
									const noted = g.notesMode && g.notes.num[g.sel] & (1 << v);
									const taken = selC >= 0 && selN !== v && pairElsewhere(v, selC);
									return (
										<button
											key={v}
											className={`puff key key-num${on ? ' on' : ''}${noted ? ' noted' : ''}${taken ? ' taken' : ''}${count >= 4 ? ' spent' : ''}`}
											disabled={lockN && !g.notesMode}
											onClick={() => pressNum(v)}
											aria-pressed={on || !!noted}
											aria-label={`${v + 1}${g.notesMode ? ', note' : ''}${taken ? `, the ${COLOR_NAMES[selC]} ${v + 1} is used` : ''}`}
										>
											<span className="key-n">{v + 1}</span>
											<span className="pips" aria-hidden="true">
												{[0, 1, 2, 3].map((k) => (
													<i key={k} className={k < count ? 'full' : ''} />
												))}
											</span>
											{taken && <span className="taken-mark" aria-hidden="true"><Icon name="check" size={12} /></span>}
											{props.keysShown && <kbd>{NUM_KEYS[v]}</kbd>}
										</button>
									);
								})}
							</div>
							<div className="keys" role="group" aria-label="Glass colors">
								{[0, 1, 2, 3].map((v) => {
									const on = selC === v;
									const noted = g.notesMode && g.notes.color[g.sel] & (1 << v);
									const taken = selN >= 0 && selC !== v && pairElsewhere(selN, v);
									return (
										<button
											key={v}
											className={`puff key key-color k${v}${on ? ' on' : ''}${noted ? ' noted' : ''}${taken ? ' taken' : ''}`}
											disabled={lockC && !g.notesMode}
											onClick={() => pressColor(v)}
											aria-pressed={on || !!noted}
											aria-label={`${colorLabel(v)}${g.notesMode ? ', note' : ''}${taken ? `, the ${COLOR_NAMES[v]} ${selN + 1} is used` : ''}`}
										>
											<Shape c={v} />
											<span className="key-name">{colorName(v)}</span>
											{taken && <span className="taken-mark" aria-hidden="true"><Icon name="check" size={12} /></span>}
											{props.keysShown && <kbd>{COLOR_KEYS[v]}</kbd>}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</main>

			<div className="sr-only" aria-live="polite" role="status">
				{live}
			</div>

			{toast && (
				<div className="toast" role="status">
					{toast}
				</div>
			)}

			{tut >= 0 && !paused && (
				<Coach
					step={tut}
					keys={props.keysShown}
					onDone={() => {
						setTut(-1);
						props.onTutorialDone();
					}}
				/>
			)}

			{pairsOpen && (
				<div className="overlay sheet-overlay" data-layer onClick={() => setPairsOpen(false)}>
					<div className="sheet pairs-sheet" role="dialog" aria-label="Pairs" onClick={(e) => e.stopPropagation()}>
						<header>
							<h2>Pairs</h2>
							<button className="puff tool" onClick={() => setPairsOpen(false)} aria-label="Close" autoFocus>
								<Icon name="close" />
							</button>
						</header>
						<p className="muted">Each number + color pair is used once. Tap one to find it.</p>
						<div className="pair-table">
							<span />
							{[0, 1, 2, 3].map((c) => (
								<span key={c} className="ph">
									<Mini c={c} size={20} />
								</span>
							))}
							{[0, 1, 2, 3].map((n) => (
								<PairRow key={n} n={n} counts={counts} onPick={pickPair} />
							))}
						</div>
					</div>
				</div>
			)}

			{paused && !result && (
				<div className="overlay" data-layer>
					<div className="card modal pause" role="dialog" aria-label="Paused">
						<h2>Paused</h2>
						<p className="muted">
							{props.label} · {formatTime(g.elapsed)}
						</p>
						<div className="stack">
							<button className="btn btn-main" autoFocus onClick={() => setPaused(false)}>
								<Icon name="play" /> Keep going
							</button>
							<button className="btn" onClick={() => setConfirmReset(true)}>
								<Icon name="reset" /> Start this window over
							</button>
							<button className="btn" onClick={props.onRules}>
								<Icon name="book" /> How to play
							</button>
							<button className="btn" onClick={props.onSettings}>
								<Icon name="gear" /> Settings
							</button>
							<button className="btn" onClick={props.onQuit}>
								<Icon name="home" /> Save and leave
							</button>
						</div>
					</div>
				</div>
			)}

			{confirmReset && (
				<div className="overlay" data-layer>
					<div className="card modal" role="alertdialog" aria-label="Start over?">
						<h2>Start over?</h2>
						<p>All your tiles and notes come off this window. The clock keeps running. You can undo it.</p>
						<div className="row">
							<button className="btn" autoFocus onClick={() => setConfirmReset(false)}>
								Keep going
							</button>
							<button
								className="btn btn-main"
								onClick={() => {
									dispatch({ type: 'reset' });
									setConfirmReset(false);
									setPaused(false);
								}}
							>
								Start over
							</button>
						</div>
					</div>
				</div>
			)}

			{result && <Results r={result} label={props.label} onNext={props.onNext} nextLabel={props.nextLabel} onQuit={props.onQuit} calm={calm} />}
		</div>
	);
}

function PairRow({ n, counts, onPick }: { n: number; counts: number[]; onPick: (pair: number) => void }) {
	return (
		<>
			<span className="ph num">{n + 1}</span>
			{[0, 1, 2, 3].map((c) => {
				const k = counts[n * 4 + c];
				return (
					<button
						key={c}
						className={`pair${k === 1 ? ' used' : ''}${k > 1 ? ' twice' : ''}`}
						onClick={() => onPick(n * 4 + c)}
						aria-label={`${COLOR_NAMES[c]} ${n + 1}: ${k === 0 ? 'not used' : k === 1 ? 'used' : 'used twice'}`}
					>
						<Mini n={n} c={c} size={40} />
						{k > 0 && <span className="pair-mark">{k > 1 ? '!' : <Icon name="check" size={12} />}</span>}
					</button>
				);
			})}
		</>
	);
}

/** Window mended: stats, then coins counting up. */
function Results({ r, label, onNext, nextLabel, onQuit, calm }: { r: FinishInfo & { time: number; hints: number; shown: number }; label: string; onNext?: () => void; nextLabel?: string; onQuit: () => void; calm: boolean }) {
	const total = r.earned.reduce((s, e) => s + e.coins, 0);
	const [shown, setShown] = useState(calm ? total : 0);
	useEffect(() => {
		if (calm || total === 0) return;
		let v = 0;
		const id = window.setInterval(() => {
			v = Math.min(total, v + Math.max(1, Math.ceil(total / 24)));
			setShown(v);
			if (v % 5 === 0 || v === total) audio.play('coin', { gain: 0.6 });
			if (v >= total) clearInterval(id);
		}, 45);
		return () => clearInterval(id);
	}, [total, calm]);
	return (
		<div className="overlay results-overlay" data-layer>
			<div className="card modal results" role="dialog" aria-label="Window mended">
				<div className="results-mascot">
					<Mozzi mood="cheer" size={84} />
				</div>
				<h2>Window mended!</h2>
				<p className="muted">{label}</p>
				<dl className="stats">
					<div>
						<dt>Time</dt>
						<dd>{formatTime(r.time)}</dd>
					</div>
					<div>
						<dt>Hints</dt>
						<dd>
							{r.hints}
							{r.shown > 0 && <small> ({r.shown} shown)</small>}
						</dd>
					</div>
					<div>
						<dt>Best</dt>
						<dd>{r.best !== null ? formatTime(r.best) : '–'}</dd>
					</div>
					{r.dailyToday && (
						<div>
							<dt>Streak</dt>
							<dd>{r.streak}</dd>
						</div>
					)}
				</dl>
				{r.earned.length > 0 ? (
					<div className="earned" aria-label={`You earned ${total} coins. You have ${r.coins}.`}>
						<ul>
							{r.earned.map((e, i) => (
								<li key={e.label} style={{ ['--i' as string]: i }}>
									<span>{e.label}</span>
									<b>+{e.coins}</b>
								</li>
							))}
						</ul>
						<p className="earned-total">
							<Icon name="coin" size={20} /> <b>+{shown}</b> <span className="muted">· {r.coins} in total</span>
						</p>
					</div>
				) : (
					<p className="muted small">You mended this one before, so it earns no coins this time.</p>
				)}
				{r.isBest && <p className="badge-line">New best time!</p>}
				<div className="stack">
					{onNext && (
						<button className="btn btn-main" autoFocus onClick={onNext}>
							<Icon name="play" /> {nextLabel ?? 'Next window'}
						</button>
					)}
					<button className="btn" autoFocus={!onNext} onClick={onQuit}>
						<Icon name="home" /> Back to the workshop
					</button>
				</div>
			</div>
		</div>
	);
}

/** The first-play tutorial: short coach cards that move on as you do each thing. */
/** Coach cards move on as you act. Skip ends the whole tutorial; the rules stay in How to play. */
function Coach({ step: s, keys, onDone }: { step: number; keys: boolean; onDone: () => void }) {
	const cards = [
		{ title: 'Pick a tile', body: keys ? 'Tap a tile in the window, or use the arrow keys.' : 'Tap a tile in the window.' },
		{ title: 'Give it a number', body: keys ? 'Tap a number below, or press 1–4.' : 'Tap a number below.' },
		{ title: 'Now a color', body: keys ? 'Tap a color, or press Q W E R. A tile with both is glued in.' : 'Tap a color. A tile with both is glued in.' },
	];
	if (s >= 3) {
		return (
			<div className="overlay" data-layer>
				<div className="card modal coach-rules" role="dialog" aria-label="The rules">
					<div className="coach-hello">
						<Mozzi mood="happy" size={64} />
						<p>
							Hi, I’m <b>Mozzi</b>! I’ll keep you company. Tap me any time for a hint.
						</p>
					</div>
					<h2>The rules</h2>
					<ul className="rules-list">
						<li>
							<b>Rows and columns:</b> each has every number 1–4 once and every color once.
						</li>
						<li>
							<b>Pairs:</b> each number + color pair, like <Mini n={1} c={0} size={20} /> ruby 2, is used once in the whole window.
						</li>
						<li>
							<b>Clues:</b> bold numbers, and colors with a small bar in the corner, are clues. They can’t change.
						</li>
						<li>
							<b>Stuck?</b> Tap Mozzi or <Icon name="bulb" size={16} /> Hint. Mozzi shows where to look, then why, then what.
						</li>
					</ul>
					<p className="muted small">Gamepad: D-pad moves, A cycles numbers, X cycles colors, Y notes, B erase, Select hint, Start pause.</p>
					<button className="btn btn-main" autoFocus onClick={onDone}>
						Start mending
					</button>
				</div>
			</div>
		);
	}
	const c = cards[s];
	return (
		<div className={`coach coach-${s}`} role="status">
			<Mozzi mood={s === 0 ? 'idle' : 'happy'} size={44} />
			<span className="coach-step">{s + 1}/4</span>
			<div>
				<b>{c.title}</b>
				<p>{c.body}</p>
			</div>
			<button className="link" onClick={onDone} aria-label="Skip the tutorial">
				Skip
			</button>
		</div>
	);
}
