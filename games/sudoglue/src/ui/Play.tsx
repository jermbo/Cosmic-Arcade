/** The play screen: the window, the controls, hints, pause, results and the first-play tutorial. */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Event, Game } from '../app/game.ts';
import { clashCells, newGame, pairCounts, step, toSave } from '../app/game.ts';
import type { Pad } from '../app/input.ts';
import { moveFocus, useGamepad, useKeys } from '../app/input.ts';
import type { GameSave, Settings } from '../app/save.ts';
import { formatTime } from '../app/save.ts';
import { LINES } from '../core/grid.ts';
import type { Puzzle } from '../core/types.ts';
import { GLASS, cellBox } from './art.ts';
import { Icon, MiniPane, NumeralIcon } from './bits.tsx';
import type { FxApi } from './Fx.tsx';
import { Fx } from './Fx.tsx';
import type { Mood } from './Gloop.tsx';
import { Gloop } from './Gloop.tsx';
import { HintPanel, marksFor } from './HintPanel.tsx';
import { PairRack, Tray } from './Tray.tsx';
import { Window } from './Window.tsx';

export interface FinishInfo {
	isBest: boolean;
	best: number | null;
	streak: number;
	dailyToday: boolean;
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
	brushMode: boolean;
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

const MOODS_MS = 900;

export function Play(props: Props) {
	const { puzzle, settings, calm } = props;
	const [game, dispatch] = useReducer(step, undefined, () => newGame(puzzle, props.saved));
	const [paused, setPaused] = useState(false);
	const [confirmReset, setConfirmReset] = useState(false);
	const [result, setResult] = useState<(FinishInfo & { time: number; hints: number; shown: number }) | null>(null);
	const [bumps, setBumps] = useState<number[]>(() => Array(16).fill(0));
	const [sweeps, setSweeps] = useState<[number, number][]>([]);
	const [shake, setShake] = useState<number[]>([]);
	const [flash, setFlash] = useState<number[]>([]);
	const [mood, setMood] = useState<Mood>('idle');
	const [toast, setToast] = useState('');
	const [tut, setTut] = useState(props.tutorial ? 0 : -1);
	const [brush, setBrush] = useState<{ num: number; color: number }>({ num: -1, color: -1 });
	const fx = useRef<FxApi>(null);
	// The window fills the space the controls leave, at its own shape (400 × 456).
	const wrap = useRef<HTMLDivElement>(null);
	const [boxW, setBoxW] = useState(300);
	useEffect(() => {
		const el = wrap.current;
		if (!el) return;
		const fit = () => setBoxW(Math.floor(Math.max(160, Math.min(el.clientWidth - 8, (el.clientHeight - 36) * (400 / 456), 660))));
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		fit();
		return () => ro.disconnect();
	}, []);
	const sweepId = useRef(1);
	const gameRef = useRef(game);
	gameRef.current = game;

	const clashes = useMemo(() => (settings.showClashes ? clashCells(game.board) : new Set<number>()), [game.board, settings.showClashes]);
	const counts = useMemo(() => pairCounts(game.board), [game.board]);
	const marks = marksFor(game.hint, flash);
	const blocked = paused || !!result || confirmReset;

	const say = useCallback((text: string) => {
		setToast(text);
		window.setTimeout(() => setToast((t) => (t === text ? '' : t)), 1800);
	}, []);
	const moodFor = useCallback((m: Mood, ms = MOODS_MS) => {
		setMood(m);
		window.setTimeout(() => setMood((now) => (now === m ? 'idle' : now)), ms);
	}, []);
	const buzz = useCallback((ms: number) => settings.haptics && navigator.vibrate?.(ms), [settings.haptics]);

	// ---------------------------------------------------------------- feel: sound, particles, motion
	useEffect(() => {
		for (const e of game.events) react(e);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [game.tick]);

	function react(e: Event) {
		switch (e.kind) {
			case 'select':
				audio.play('select');
				break;
			case 'place': {
				const { cx, cy } = cellBox(e.cell);
				setBumps((b) => b.map((v, i) => (i === e.cell ? v + 1 : v)));
				audio.play(e.axis === 'num' ? (`num${e.value}` as 'num0') : (`color${e.value}` as 'color0'));
				if (e.full) {
					audio.play('squish', { delay: 0.03 });
					audio.play('click', { delay: 0.16 });
					fx.current?.burst('glue', cx, cy, 12);
					buzz(12);
					moodFor('squeeze', 420);
				} else buzz(6);
				if (tut === 1 && e.axis === 'num') setTut(2);
				if (tut === 2 && e.axis === 'color') setTut(3);
				break;
			}
			case 'erase':
				audio.play('erase');
				break;
			case 'note':
				audio.play('note');
				break;
			case 'undo':
				audio.play('undo');
				break;
			case 'locked':
				audio.play('locked');
				setShake([e.cell]);
				window.setTimeout(() => setShake([]), 380);
				say('That part is set in lead. It can’t change.');
				break;
			case 'clash':
				audio.play('clash', { delay: 0.12 });
				setShake(e.cells);
				window.setTimeout(() => setShake([]), 420);
				moodFor('worry', 1300);
				buzz(30);
				break;
			case 'lines':
				audio.play('shimmer', { delay: 0.2 });
				moodFor('wink');
				for (const li of e.lines) {
					const id = sweepId.current++;
					setSweeps((s) => [...s, [id, li]]);
					window.setTimeout(() => setSweeps((s) => s.filter(([k]) => k !== id)), 1100);
					for (const c of LINES[li].cells) {
						const { cx, cy } = cellBox(c);
						window.setTimeout(() => fx.current?.burst('glint', cx, cy - 20, 2), 200 + Math.random() * 400);
					}
				}
				break;
			case 'solved': {
				audio.duck(5);
				audio.play('click');
				audio.play('solve', { delay: 0.25 });
				moodFor('cheer', 4000);
				buzz(40);
				window.setTimeout(() => {
					for (let i = 0; i < 16; i++) {
						const { cx, cy } = cellBox(i);
						window.setTimeout(() => fx.current?.burst('shard', cx, cy, 3), i * 45);
						window.setTimeout(() => fx.current?.burst('mote', cx, cy, 2), 600 + i * 30);
					}
				}, 200);
				const info = props.onFinish({ time: game.elapsed, hints: game.hints, shown: game.shown });
				window.setTimeout(() => setResult({ ...info, time: game.elapsed, hints: game.hints, shown: game.shown }), calm ? 900 : 2300);
				break;
			}
			case 'hint':
				audio.play('hint');
				moodFor('think', 1200);
				break;
			case 'reset':
				audio.play('page');
				break;
		}
	}

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

	// Save the clock when leaving the screen.
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

	// The phone's back button opens pause (or closes what is open), never leaves.
	const firstBack = useRef(props.backSignal);
	useEffect(() => {
		if (props.backSignal === firstBack.current) return;
		if (confirmReset) setConfirmReset(false);
		else if (game.hint) dispatch({ type: 'closeHint' });
		else if (result) props.onQuit();
		else setPaused((p) => !p);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.backSignal]);

	// ---------------------------------------------------------------- actions
	const tapTile = (cell: number) => {
		if (blocked) return;
		if (props.brushMode && (brush.num >= 0 || brush.color >= 0)) {
			if (brush.num >= 0) dispatch({ type: 'set', axis: 'num', value: brush.num, cell });
			if (brush.color >= 0) dispatch({ type: 'set', axis: 'color', value: brush.color, cell });
			return;
		}
		dispatch({ type: 'select', cell });
		if (tut === 0) setTut(1);
	};
	const pressNum = (v: number) => {
		if (props.brushMode) return setBrush((b) => ({ ...b, num: b.num === v ? -1 : v }));
		dispatch({ type: 'set', axis: 'num', value: v });
	};
	const pressColor = (v: number) => {
		if (props.brushMode) return setBrush((b) => ({ ...b, color: b.color === v ? -1 : v }));
		dispatch({ type: 'set', axis: 'color', value: v });
	};
	const pickPair = (p: number) => {
		if (props.brushMode) return setBrush({ num: p >> 2, color: p & 3 });
		const cells = game.board.num.flatMap((n, i) => (n * 4 + game.board.color[i] === p && n >= 0 && game.board.color[i] >= 0 ? [i] : []));
		setFlash(cells);
		window.setTimeout(() => setFlash([]), 1200);
		audio.play('ui');
		if (!cells.length) say(`The ${GLASS[p & 3].name.toLowerCase()} ${(p >> 2) + 1} isn’t in the window yet.`);
	};
	const cycle = (axis: 'num' | 'color') => {
		const now = (axis === 'num' ? game.board.num : game.board.color)[game.sel];
		if (now === 3) dispatch({ type: 'set', axis, value: 3 }); // picking it again clears it
		else dispatch({ type: 'set', axis, value: now + 1 });
	};
	const focusTile = (cell: number) => document.querySelector<SVGElement>(`[data-cell="${cell}"]`)?.focus();

	useKeys((e) => {
		if (props.covered || e.target instanceof HTMLInputElement) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			if (confirmReset) setConfirmReset(false);
			else if (game.hint) dispatch({ type: 'closeHint' });
			else if (!result) setPaused((p) => !p);
			return;
		}
		if (blocked) {
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
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
		if (mod) return;
		if ('1234'.includes(k) && k) pressNum(Number(k) - 1);
		else if ('5678'.includes(k) && k) pressColor(Number(k) - 5);
		else if ('qwer'.includes(k) && k) pressColor('qwer'.indexOf(k));
		else if (k === 'backspace' || k === 'delete' || k === '0' || k === 'x') dispatch({ type: 'erase' });
		else if (k === 'n' || k === ' ') {
			e.preventDefault();
			dispatch({ type: 'toggleNotes' });
		} else if (k === 'z') dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
		else if (k === 'y') dispatch({ type: 'redo' });
		else if (k === 'h') dispatch({ type: 'hint' });
		else if (k === 'enter' && game.hint) dispatch({ type: 'hintLevel', level: game.hint.level === 1 ? 2 : 3 });
		else if (k === 'p') setPaused(true);
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
	return (
		<div className={`play${paused ? ' is-paused' : ''}${g.solved ? ' is-solved' : ''}${g.hint ? ' hint-open' : ''}`} data-layer>
			<header className="bar">
				<button className="icon-btn" onClick={() => setPaused(true)} aria-label="Pause">
					<Icon name="pause" />
				</button>
				<div className="bar-title">
					<b>{props.label}</b>
					<span>{props.sub}</span>
				</div>
				{settings.showTimer ? (
					<div className="timer" aria-label="Time">
						{formatTime(g.elapsed)}
					</div>
				) : (
					<div className="timer" />
				)}
			</header>

			<div className="stage">
				<div className="window-wrap" ref={wrap}>
					<div className={`light-pool${g.solved ? ' on' : ''}`} aria-hidden="true" />
					<div className="window-box" style={{ width: boxW }}>
						<Window
							board={g.board}
							givens={puzzle.givens}
							noteNum={g.notes.num}
							noteColor={g.notes.color}
							sel={g.sel}
							showSel={!paused}
							clashes={clashes}
							helpers={settings.helpers && !marks}
							marks={marks}
							bumps={bumps}
							sweeps={sweeps}
							shake={calm ? [] : shake}
							solved={g.solved}
							motion={!calm}
							litLines={g.litLines}
							onTap={tapTile}
							onFocusCell={(cell) => dispatch({ type: 'select', cell })}
						/>
						<Fx ref={fx} calm={calm} />
						{paused && <div className="frost" aria-hidden="true" />}
					</div>
					<div className="sill" aria-hidden="true" style={{ width: boxW + 18 }}>
						<Gloop mood={mood} size={54} />
					</div>
				</div>

				<div className="side">
					{g.hint ? (
						<HintPanel
							view={g.hint}
							keys={props.keysShown}
							onWhy={() => dispatch({ type: 'hintLevel', level: 2 })}
							onShow={() => dispatch({ type: 'hintLevel', level: 3 })}
							onClose={() => dispatch({ type: 'closeHint' })}
							onFlash={setFlash}
						/>
					) : null}
					<div className={`controls${g.hint ? ' dim' : ''}`}>
						<Tray
							board={g.board}
							givens={puzzle.givens}
							sel={g.sel}
							notesMode={g.notesMode}
							noteNum={g.notes.num[g.sel]}
							noteColor={g.notes.color[g.sel]}
							keys={props.keysShown}
							canUndo={g.past.length > 0}
							canRedo={g.future.length > 0}
							hintsUsed={g.hints}
							brush={props.brushMode ? brush : null}
							onNum={pressNum}
							onColor={pressColor}
							onErase={() => dispatch({ type: 'erase' })}
							onUndo={() => dispatch({ type: 'undo' })}
							onRedo={() => dispatch({ type: 'redo' })}
							onNotes={() => dispatch({ type: 'toggleNotes' })}
							onHint={() => dispatch({ type: 'hint' })}
						/>
						<PairRack counts={counts} onPick={pickPair} pickedPair={props.brushMode && brush.num >= 0 && brush.color >= 0 ? brush.num * 4 + brush.color : -1} />
					</div>
				</div>
			</div>

			{toast && (
				<div className="toast" role="status">
					{toast}
				</div>
			)}

			{tut >= 0 && !paused && <Coach step={tut} keys={props.keysShown} onNext={() => setTut((t) => t + 1)} onDone={() => { setTut(-1); props.onTutorialDone(); }} />}

			{paused && !result && (
				<div className="overlay" data-layer>
					<div className="card modal pause" role="dialog" aria-label="Paused">
						<h2>Paused</h2>
						<p className="muted">
							{props.label} · {formatTime(g.elapsed)}
						</p>
						<div className="stack">
							<button className="btn btn-main" autoFocus onClick={() => setPaused(false)}>
								<Icon name="play" /> Back to the glass
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
						<p>All your panes and notes come off this window. The clock keeps running. You can undo it.</p>
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

			{result && (
				<div className="overlay results-overlay" data-layer>
					<div className="card modal results" role="dialog" aria-label="Window mended">
						<div className="results-gloop">
							<Gloop mood="cheer" size={72} />
						</div>
						<h2>Window mended!</h2>
						<p className="muted">{props.label}</p>
						<dl className="stats">
							<div>
								<dt>Time</dt>
								<dd>{formatTime(result.time)}</dd>
							</div>
							<div>
								<dt>Hints</dt>
								<dd>
									{result.hints}
									{result.shown > 0 && <small> ({result.shown} shown)</small>}
								</dd>
							</div>
							<div>
								<dt>Best</dt>
								<dd>{result.best !== null ? formatTime(result.best) : '–'}</dd>
							</div>
							{result.dailyToday && (
								<div>
									<dt>Streak</dt>
									<dd>
										{result.streak} day{result.streak === 1 ? '' : 's'}
									</dd>
								</div>
							)}
						</dl>
						{result.isBest && <p className="best-badge">New best time! Smooth as glass.</p>}
						{result.hints === 0 && <p className="clean-badge">No hints. Not a smudge on it.</p>}
						<div className="stack">
							{props.onNext && (
								<button className="btn btn-main" autoFocus onClick={props.onNext}>
									<Icon name="play" /> {props.nextLabel ?? 'Next window'}
								</button>
							)}
							<button className="btn" autoFocus={!props.onNext} onClick={props.onQuit}>
								<Icon name="home" /> Back to the workshop
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/** The first-play tutorial: four short coach cards that move on as you do each thing. */
function Coach({ step: s, keys, onNext, onDone }: { step: number; keys: boolean; onNext: () => void; onDone: () => void }) {
	const cards = [
		{ title: 'Pick a tile', body: keys ? 'Tap a pane in the window, or use the arrow keys.' : 'Tap a pane in the window.' },
		{ title: 'Give it a number', body: keys ? 'Tap a number below, or press 1–4.' : 'Tap a number below.' },
		{ title: 'Now a glass color', body: keys ? 'Tap a color, or press Q W E R. A pane with both is glued in.' : 'Tap a color. A pane with both is glued in.' },
	];
	if (s >= 3) {
		return (
			<div className="overlay" data-layer>
				<div className="card modal coach-rules" role="dialog" aria-label="The rules">
					<h2>The rules</h2>
					<ul className="rules-list">
						<li>
							<b>Rows and columns:</b> each has every number <NumeralIcon v={0} size={16} />–<NumeralIcon v={3} size={16} /> once and every color once.
						</li>
						<li>
							<b>Pairs:</b> each number + color pair, like <MiniPane n={1} c={0} size={20} /> ruby 2, is used once in the whole window.
						</li>
						<li>
							<b>Lead and glue:</b> parts with a dark badge or corner rivets are set in lead and stay. Yours are held with glue.
						</li>
						<li>
							<b>Stuck?</b> <Icon name="bulb" size={16} /> Hint shows where to look, then why, then what.
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
			<span className="coach-step">{s + 1}/4</span>
			<div>
				<b>{c.title}</b>
				<p>{c.body}</p>
			</div>
			<button className="link" onClick={onNext}>
				Skip
			</button>
		</div>
	);
}
