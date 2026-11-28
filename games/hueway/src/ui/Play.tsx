/** The play screen: the board, Tint, tools, the first-time tips and the results. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Drag, Paths } from '../app/game.ts';
import { cutColors, dragTo, dragView, emptyPaths, hintColor, isLinked, isSolved, progress, samePaths, showLine, startDrag } from '../app/game.ts';
import type { GameSave, Settings } from '../app/save.ts';
import { formatTime } from '../app/save.ts';
import type { Earning, Looks } from '../app/shop.ts';
import type { Puzzle } from '../core/types.ts';
import { Board, DEMO } from './Board.tsx';
import { CoinChip, Icon } from './bits.tsx';
import type { TintMood } from './Tint.tsx';
import { Tint } from './Tint.tsx';

export interface FinishResult {
	isBest: boolean;
	best: number | null;
	streak: number;
	dailyToday: boolean;
	earned: Earning[];
	coins: number;
}

interface PlayProps {
	puzzle: Puzzle;
	label: string;
	sub: string;
	saved?: GameSave;
	settings: Settings;
	looks: Looks;
	calm: boolean;
	keysShown: boolean;
	tutorial: boolean;
	onTutorialDone: () => void;
	onSave: (g: GameSave) => void;
	onFinish: (f: { time: number; hints: number; moves: number; perfect: boolean }) => FinishResult;
	onQuit: () => void;
	onNext?: () => void;
	nextLabel?: string;
	onSettings: () => void;
	backSignal: number;
	/** True while a dialog covers the game (the timer stops). */
	covered: boolean;
}

export function Play(props: PlayProps) {
	const { puzzle: p, settings, looks } = props;
	const [paths, setPaths] = useState<Paths>(() => props.saved?.paths ?? emptyPaths(p));
	const [drag, setDrag] = useState<Drag | null>(null);
	const [history, setHistory] = useState<Paths[]>([]);
	const [elapsed, setElapsed] = useState(props.saved?.elapsed ?? 0);
	const [hints, setHints] = useState(props.saved?.hints ?? 0);
	const [moves, setMoves] = useState(props.saved?.moves ?? 0);
	const [lastColor, setLastColor] = useState(props.saved?.lastColor ?? -1);
	const [shown, setShown] = useState<number[]>(props.saved?.shown ?? []);
	const [solved, setSolved] = useState(false);
	const [result, setResult] = useState<(FinishResult & { time: number; moves: number; perfect: boolean }) | null>(null);
	const [pulse, setPulse] = useState(-1);
	const [cursor, setCursor] = useState(-1);
	const [mood, setMood] = useState<TintMood>('idle');
	const [tintColor, setTintColor] = useState(-1);
	const [tips, setTips] = useState(props.tutorial);
	const [restartAsk, setRestartAsk] = useState(false);

	const dragRef = useRef<Drag | null>(null);
	const pathsRef = useRef(paths);
	pathsRef.current = paths;
	const lastActive = useRef(Date.now());

	const view = drag ? dragView(drag) : paths;
	const linked = useMemo(() => p.pairs.map((_, k) => isLinked(p, view, k)), [p, view]);
	const pr = progress(p, view);

	// The timer runs while the board is in view and not solved.
	const paused = solved || props.covered || tips;
	useEffect(() => {
		if (paused) return;
		let last = performance.now();
		const id = window.setInterval(() => {
			const now = performance.now();
			if (document.visibilityState === 'visible') setElapsed((e) => e + (now - last));
			last = now;
			// Tint dozes off after a while with no moves.
			if (Date.now() - lastActive.current > 45000) setMood((m) => (m === 'idle' ? 'sleepy' : m));
		}, 250);
		return () => clearInterval(id);
	}, [paused]);

	// Keep the game saved as it goes.
	const saveRef = useRef<GameSave | null>(null);
	saveRef.current = solved ? null : { paths, elapsed, hints, moves, lastColor, shown };
	useEffect(() => {
		if (saveRef.current) props.onSave(saveRef.current);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paths, hints, moves]);
	useEffect(
		() => () => {
			if (saveRef.current) props.onSave(saveRef.current);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	// The back button leaves the game (it is saved).
	const firstBack = useRef(props.backSignal);
	useEffect(() => {
		if (props.backSignal === firstBack.current) return;
		if (tips) return closeTips();
		props.onQuit();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.backSignal]);

	const wake = () => {
		lastActive.current = Date.now();
		setMood((m) => (m === 'sleepy' ? 'idle' : m));
	};
	const buzz = (ms: number) => settings.haptics && navigator.vibrate?.(ms);

	function closeTips() {
		setTips(false);
		props.onTutorialDone();
		audio.play('ui');
	}

	function win(next: Paths, hintsNow: number, movesNow: number) {
		setSolved(true);
		setMood('happy');
		setTintColor(-1);
		setCursor(-1);
		audio.play('solve');
		audio.duck(4);
		buzz(30);
		const perfect = hintsNow === 0 && movesNow <= p.pairs.length;
		const res = props.onFinish({ time: elapsed, hints: hintsNow, moves: movesNow, perfect });
		window.setTimeout(() => setResult({ ...res, time: elapsed, moves: movesNow, perfect }), props.calm ? 300 : 1300);
		void next;
	}

	/** Makes `next` the board, with undo. `color` is the line that moved (for the move count). */
	function commit(next: Paths, color: number) {
		const before = pathsRef.current;
		if (samePaths(before, next)) return;
		setHistory((h) => [...h.slice(-80), before]);
		setPaths(next);
		let movesNow = moves;
		if (color >= 0 && color !== lastColor) {
			movesNow = moves + 1;
			setMoves(movesNow);
			setLastColor(color);
		}
		if (isSolved(p, next)) win(next, hints, movesNow);
	}

	function down(cell: number) {
		if (solved || tips) return;
		wake();
		const d = startDrag(p, pathsRef.current, cell);
		if (!d) return;
		dragRef.current = d;
		setDrag(d);
		setTintColor(d.color);
		setMood('draw');
		audio.play('pick');
		buzz(6);
	}

	function move(cell: number) {
		const d = dragRef.current;
		if (!d) return;
		const next = dragTo(p, d, cell);
		if (next === d || next.path === d.path) return;
		const beforeView = dragView(d);
		const afterView = dragView(next);
		if (next.path.length > d.path.length) {
			audio.step(next.color, next.path.length);
			if (isLinked(p, afterView, next.color)) {
				audio.play('link');
				setPulse(next.color);
				setMood('wow');
				buzz(14);
			}
		}
		if (cutColors(next, afterView).length > cutColors(d, beforeView).length) audio.play('cut');
		dragRef.current = next;
		setDrag(next);
	}

	function up() {
		const d = dragRef.current;
		if (!d) return;
		dragRef.current = null;
		setDrag(null);
		const next = dragView(d);
		if (d.path.length === 1 && d.base[d.color].length > 1) audio.play('clear');
		setMood((m) => (m === 'draw' || m === 'wow' ? 'idle' : m));
		commit(next, d.color);
	}

	function undo() {
		if (solved || !history.length) return;
		wake();
		setPaths(history[history.length - 1]);
		setHistory((h) => h.slice(0, -1));
		audio.play('undo');
	}

	function restart() {
		setRestartAsk(false);
		if (solved) return;
		commit(emptyPaths(p), -1);
		setShown([]);
		audio.play('clear');
	}

	function hint() {
		if (solved) return;
		wake();
		const k = hintColor(p, pathsRef.current);
		if (k < 0) return;
		const next = showLine(p, pathsRef.current, k);
		const hintsNow = hints + 1;
		setHints(hintsNow);
		setShown((s) => [...new Set([...s, k])]);
		setHistory((h) => [...h.slice(-80), pathsRef.current]);
		setPaths(next);
		setPulse(k);
		setTintColor(k);
		setMood('wow');
		audio.play('hint');
		window.setTimeout(() => setMood('idle'), 900);
		if (isSolved(p, next)) win(next, hintsNow, moves);
	}

	// The pulse plays once.
	useEffect(() => {
		if (pulse < 0) return;
		const id = window.setTimeout(() => setPulse(-1), 700);
		return () => clearTimeout(id);
	}, [pulse]);

	// Keyboard: arrows move, Space or Enter picks up and drops a line.
	const keyState = useRef({ down, move, up, undo, hint });
	keyState.current = { down, move, up, undo, hint };
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (props.covered || solved || tips || restartAsk) return;
			if (e.target instanceof HTMLElement && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
			const k = keyState.current;
			const dirs: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
			if (dirs[e.key]) {
				e.preventDefault();
				if (cursor < 0) return setCursor(0);
				const r = Math.floor(cursor / p.w) + dirs[e.key][0];
				const col = (cursor % p.w) + dirs[e.key][1];
				if (r < 0 || r >= p.h || col < 0 || col >= p.w) return;
				const next = r * p.w + col;
				if (dragRef.current) {
					k.move(next);
					// A blocked step keeps the cursor on the line's end.
					const path = dragRef.current.path;
					if (path[path.length - 1] !== next) return audio.play('blocked');
				}
				setCursor(next);
			} else if (e.key === ' ' || e.key === 'Enter') {
				e.preventDefault();
				if (dragRef.current) k.up();
				else if (cursor >= 0) k.down(cursor);
				else setCursor(0);
			} else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
				e.preventDefault();
				if (!dragRef.current) k.undo();
			} else if (e.key === 'h' || e.key === 'H') {
				if (!dragRef.current) k.hint();
			} else if (e.key === 'Escape' && dragRef.current) {
				e.preventDefault();
				e.stopPropagation();
				k.up();
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [p, props.covered, solved, tips, restartAsk, cursor]);

	const timeText = formatTime(elapsed);

	return (
		<div className="play" data-size={p.w}>
			<header className="bar">
				<button type="button" className="icon-btn" onClick={props.onQuit} aria-label="Back to the menu">
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>{props.label}</b>
					<span>{props.sub}</span>
				</div>
				{settings.showTimer && (
					<span className="timer" aria-label={`Time ${timeText}`}>
						{timeText}
					</span>
				)}
				<button type="button" className="icon-btn" onClick={props.onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</header>

			<div className="status">
				<Tint color={tintColor} mood={mood} size={46} />
				<div className="status-text" aria-live="polite">
					<span>
						<b>{pr.linked}</b>/{pr.total} lines
					</span>
					<span>
						<b>{pr.fillPct}%</b> filled
					</span>
				</div>
				<div className="fill-meter" aria-hidden="true">
					<i style={{ width: `${pr.fillPct}%` }} />
				</div>
			</div>

			<div className="board-wrap">
				<Board
					puzzle={p}
					paths={view}
					lineLook={looks.line}
					dotLook={looks.dot}
					marks={settings.dotMarks}
					tint={settings.fillTint}
					drawing={drag ? drag.color : -1}
					linked={linked}
					cursor={props.keysShown && !solved ? cursor : -1}
					pulse={pulse}
					solved={solved}
					onDown={down}
					onMove={move}
					onUp={up}
					label={`${p.w} by ${p.h} board, ${pr.linked} of ${pr.total} lines linked, ${pr.fillPct}% filled`}
				/>
			</div>

			<footer className="tools">
				<button type="button" className="tool" onClick={undo} disabled={!history.length || solved}>
					<Icon name="undo" />
					<span>Undo</span>
				</button>
				<button type="button" className="tool" onClick={() => setRestartAsk(true)} disabled={solved || pr.filled === p.pairs.length * 2}>
					<Icon name="reset" />
					<span>Clear</span>
				</button>
				<button type="button" className="tool tool-hint" onClick={hint} disabled={solved}>
					<Icon name="bulb" />
					<span>Hint{hints > 0 ? ` · ${hints}` : ''}</span>
				</button>
			</footer>
			{props.keysShown && <p className="key-help">Arrows move · Space picks up and drops · Z undo · H hint</p>}

			{restartAsk && (
				<div className="sheet-back" onClick={() => setRestartAsk(false)}>
					<div className="sheet small" role="dialog" aria-modal="true" aria-label="Clear the board" onClick={(e) => e.stopPropagation()}>
						<h2>Clear every line?</h2>
						<p>The dots stay. You can undo this.</p>
						<div className="row">
							<button type="button" className="btn" onClick={() => setRestartAsk(false)}>
								Keep them
							</button>
							<button type="button" className="btn primary" onClick={restart} autoFocus>
								Clear
							</button>
						</div>
					</div>
				</div>
			)}

			{tips && (
				<div className="sheet-back">
					<div className="sheet tips" role="dialog" aria-modal="true" aria-label="How to play">
						<Tint mood="happy" color={1} size={54} />
						<h2>Join the colors</h2>
						<Board puzzle={DEMO} paths={DEMO.solution} lineLook={looks.line} dotLook={looks.dot} marks={settings.dotMarks} tint={settings.fillTint} drawing={-1} linked={[true, true]} className="demo" label="A solved 3 by 3 board" />
						<ol>
							<li>Drag from a dot to the dot of the same color.</li>
							<li>Lines can't cross. Draw over a line to cut it.</li>
							<li>Fill every square to win.</li>
						</ol>
						<button type="button" className="btn primary wide" onClick={closeTips} autoFocus>
							Let’s go
						</button>
					</div>
				</div>
			)}

			{result && (
				<div className="sheet-back">
					<div className="sheet results" role="dialog" aria-modal="true" aria-label="Puzzle solved">
						<Tint mood="happy" color={result.perfect ? 4 : -1} size={64} />
						<h2>{result.perfect ? 'Perfect!' : 'Solved!'}</h2>
						<div className="stats">
							<div>
								<span>Time</span>
								<b>{formatTime(result.time)}</b>
							</div>
							<div>
								<span>Moves</span>
								<b>
									{result.moves}/{p.pairs.length}
								</b>
							</div>
							<div>
								<span>{result.dailyToday ? 'Streak' : 'Best'}</span>
								<b>{result.dailyToday ? `${result.streak} day${result.streak === 1 ? '' : 's'}` : result.best !== null ? formatTime(result.best) : '–'}</b>
							</div>
						</div>
						{result.isBest && <p className="badge">New best time</p>}
						{result.earned.length > 0 ? (
							<ul className="earned">
								{result.earned.map((e, i) => (
									<li key={i} style={{ ['--i' as string]: i }}>
										<span>{e.label}</span>
										<b>+{e.coins}</b>
									</li>
								))}
							</ul>
						) : (
							<p className="muted">Solved before, so no coins this time.</p>
						)}
						<div className="coins-row">
							<CoinChip coins={result.coins} />
						</div>
						<div className="row">
							<button type="button" className="btn" onClick={props.onQuit}>
								Menu
							</button>
							{props.onNext && (
								<button type="button" className="btn primary" onClick={props.onNext} autoFocus>
									{props.nextLabel ?? 'Next'}
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
