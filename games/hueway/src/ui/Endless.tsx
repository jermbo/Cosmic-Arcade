/** The Endless modes: a menu, the Clock run (fast) and the Road trip (calm). */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Paths } from '../app/game.ts';
import { useLines } from '../app/lines.ts';
import type { EndlessSave, Leg, Settings } from '../app/save.ts';
import { formatTime } from '../app/save.ts';
import type { Earning, Looks } from '../app/shop.ts';
import { CLOCK, clockBoard, clockSize, entryRow, exitRow, roadBoard, roadSize } from '../core/endless.ts';
import type { Puzzle } from '../core/types.ts';
import { Board } from './Board.tsx';
import { CoinChip, Icon } from './bits.tsx';
import type { TintMood } from './Tint.tsx';
import { Tint } from './Tint.tsx';

// ------------------------------------------------------------------ menu

export function EndlessMenu({ endless, onClock, onRoad, onNewTrip, onBack }: { endless: EndlessSave; onClock: () => void; onRoad: () => void; onNewTrip: () => void; onBack: () => void }) {
	const going = endless.stops > 0 || !!endless.paths;
	return (
		<main className="menu page">
			<header className="bar">
				<button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>Endless</b>
				</div>
			</header>
			<p className="lead">Two ways to keep going. One is quick, one is calm.</p>

			<button type="button" className="mode-card clock-card" onClick={onClock}>
				<span className="mode-art" aria-hidden="true">
					<svg viewBox="0 0 60 60">
						<circle cx="30" cy="32" r="22" className="ma-face" />
						<path d="M30 32 L30 18 M30 32 L40 38" className="ma-hand" />
						<rect x="25" y="4" width="10" height="6" rx="3" className="ma-face" />
					</svg>
				</span>
				<span className="mode-text">
					<b>Clock run</b>
					<span>Race the clock. Each board you solve adds time, and the boards grow.</span>
					<small>{endless.clockBest > 0 ? `Best: ${endless.clockBest} board${endless.clockBest === 1 ? '' : 's'}` : 'No runs yet'}</small>
				</span>
				<span className="mode-go">Play</span>
			</button>

			<div className="mode-card road-card">
				<span className="mode-art" aria-hidden="true">
					<svg viewBox="0 0 60 60">
						<path d="M6 44 C 20 44 18 16 32 16 C 46 16 42 40 54 40" className="ma-road" />
						<circle cx="6" cy="44" r="5" className="ma-dot" />
						<circle cx="54" cy="40" r="5" className="ma-dot" />
					</svg>
				</span>
				<span className="mode-text">
					<b>Road trip</b>
					<span>No clock. Each board carries the red road on to the next.</span>
					<small>
						{going ? `On stop ${endless.stops + 1}` : 'A new trip'}
						{endless.bestTrip > 0 && ` · Longest trip: ${endless.bestTrip} stops`}
					</small>
				</span>
				<span className="mode-btns">
					<button type="button" className="btn primary" onClick={onRoad}>
						{going ? 'Continue' : 'Start'}
					</button>
					{going && (
						<button type="button" className="btn" onClick={onNewTrip}>
							New trip
						</button>
					)}
				</span>
			</div>
		</main>
	);
}

// ------------------------------------------------------------------ the board with its tools

interface RunBoardProps {
	p: Puzzle;
	looks: Looks;
	settings: Settings;
	initial?: Paths;
	onChange?: (paths: Paths) => void;
	onSolved: () => void;
	onDrawing?: (color: number) => void;
	/** Small marks at the left and right edge where the road comes in and leaves. */
	edges?: { inRow: number; outRow: number };
	children?: ReactNode;
}

/** One board and its tools. Keyed by the puzzle id, so each board starts clean. */
function RunBoard({ p, looks, settings, initial, onChange, onSolved, onDrawing, edges }: RunBoardProps) {
	const lines = useLines(p, { initial, haptics: settings.haptics, onChange, onSolved: () => onSolved() });
	useEffect(() => onDrawing?.(lines.drawing), [lines.drawing, onDrawing]);
	const at = (row: number) => `${((row + 0.5) / p.h) * 100}%`;
	return (
		<>
			<div className={`board-wrap${edges ? ' with-edges' : ''}`}>
				<div className="board-frame">
					{edges && <span className="edge-in" style={{ top: at(edges.inRow) }} aria-hidden="true" />}
					<Board
						puzzle={p}
						paths={lines.view}
						lineLook={looks.line}
						dotLook={looks.dot}
						marks={settings.dotMarks}
						tint={settings.fillTint}
						drawing={lines.drawing}
						linked={lines.linked}
						pulse={lines.pulse}
						solved={lines.solved}
						onDown={lines.down}
						onMove={lines.move}
						onUp={lines.up}
						label={`${p.w} by ${p.h} board, ${lines.progress.linked} of ${lines.progress.total} lines linked, ${lines.progress.fillPct}% filled`}
					/>
					{edges && <span className="edge-out" style={{ top: at(edges.outRow) }} aria-hidden="true" />}
				</div>
			</div>
			<footer className="tools two">
				<button type="button" className="tool" onClick={lines.undo} disabled={!lines.canUndo}>
					<Icon name="undo" />
					<span>Undo</span>
				</button>
				<button type="button" className="tool" onClick={lines.clear} disabled={lines.solved || lines.progress.filled === p.pairs.length * 2}>
					<Icon name="reset" />
					<span>Clear</span>
				</button>
			</footer>
		</>
	);
}

function Earned({ earned, coins }: { earned: Earning[]; coins: number }) {
	return (
		<>
			{earned.length > 0 && (
				<ul className="earned">
					{earned.map((e, i) => (
						<li key={i} style={{ ['--i' as string]: i }}>
							<span>{e.label}</span>
							<b>+{e.coins}</b>
						</li>
					))}
				</ul>
			)}
			<div className="coins-row">
				<CoinChip coins={coins} />
			</div>
		</>
	);
}

// ------------------------------------------------------------------ clock run

interface ClockProps {
	looks: Looks;
	settings: Settings;
	best: number;
	covered: boolean;
	backSignal: number;
	onFinish: (boards: number) => { earned: Earning[]; isBest: boolean; coins: number };
	onSettings: () => void;
	onExit: () => void;
}

export function ClockRun({ looks, settings, best, covered, backSignal, onFinish, onSettings, onExit }: ClockProps) {
	const [run, setRun] = useState(() => String(Date.now()));
	const [phase, setPhase] = useState<'ready' | 'run' | 'over'>('ready');
	const [n, setN] = useState(0);
	const [left, setLeft] = useState(CLOCK.startMs);
	const [bonus, setBonus] = useState<{ ms: number; key: number } | null>(null);
	const [result, setResult] = useState<{ earned: Earning[]; isBest: boolean; coins: number; boards: number } | null>(null);
	const [drawing, setDrawing] = useState(-1);
	const [cheer, setCheer] = useState(false);
	const size = clockSize(n);
	const p = useMemo(() => clockBoard(run, n), [run, n]);
	// Make the next board early, so it is ready the moment this one is solved.
	useEffect(() => {
		const id = window.setTimeout(() => clockBoard(run, n + 1), 200);
		return () => clearTimeout(id);
	}, [run, n]);

	const nRef = useRef(n);
	nRef.current = n;
	const end = () => {
		setPhase('over');
		const boards = nRef.current;
		setResult({ ...onFinish(boards), boards });
		audio.play('solve');
		audio.duck(3);
	};

	// The clock: it stops while a dialog is open or the game is out of view.
	useEffect(() => {
		if (phase !== 'run' || covered) return;
		let t = performance.now();
		const id = window.setInterval(() => {
			const now = performance.now();
			const dt = document.visibilityState === 'visible' ? now - t : 0;
			t = now;
			setLeft((l) => Math.max(0, l - dt));
		}, 100);
		return () => clearInterval(id);
	}, [phase, covered]);
	useEffect(() => {
		if (phase === 'run' && left <= 0) end();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [left, phase]);

	// Back: during a run it ends the run; otherwise it leaves.
	const firstBack = useRef(backSignal);
	useEffect(() => {
		if (backSignal === firstBack.current) return;
		if (phase === 'run') end();
		else onExit();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [backSignal]);

	const solved = () => {
		const add = CLOCK.bonusMs(size);
		setBonus({ ms: add, key: Date.now() });
		setLeft((l) => l + add);
		setCheer(true);
		window.setTimeout(() => {
			setCheer(false);
			setN((x) => x + 1);
		}, 700);
	};

	const again = () => {
		setRun(String(Date.now()));
		setN(0);
		setLeft(CLOCK.startMs);
		setResult(null);
		setPhase('run');
		audio.play('page');
	};

	const low = phase === 'run' && left < 10_000;
	const mood: TintMood = cheer ? 'happy' : low ? 'wow' : drawing >= 0 ? 'draw' : 'idle';

	return (
		<div className="play endless-play">
			<header className="bar">
				<button type="button" className="icon-btn" onClick={() => (phase === 'run' ? end() : onExit())} aria-label={phase === 'run' ? 'End the run' : 'Back'}>
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>Clock run</b>
					<span>
						Board {n + 1} · {size}×{size}
					</span>
				</div>
				<span className="score-chip" aria-label={`${n} boards solved`}>
					{n}
				</span>
				<button type="button" className="icon-btn" onClick={onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</header>

			<div className={`clock-face${low ? ' low' : ''}`}>
				<Tint mood={mood} color={drawing} size={42} />
				<b aria-live="off">{formatTime(left)}</b>
				{bonus && (
					<span key={bonus.key} className="clock-bonus">
						+{bonus.ms / 1000}s
					</span>
				)}
				<div className="clock-bar" aria-hidden="true">
					<i style={{ width: `${Math.min(100, (left / CLOCK.startMs) * 100)}%` }} />
				</div>
			</div>

			<RunBoard key={p.id} p={p} looks={looks} settings={settings} onSolved={solved} onDrawing={setDrawing} />

			{phase === 'ready' && (
				<div className="sheet-back">
					<div className="sheet" role="dialog" aria-modal="true" aria-label="Clock run">
						<Tint mood="wow" color={4} size={56} />
						<h2>Clock run</h2>
						<p>
							You start with {CLOCK.startMs / 1000} seconds. Each board you solve adds time. Every two boards, the board grows.
						</p>
						{best > 0 && <p className="badge">Best: {best} boards</p>}
						<div className="row">
							<button type="button" className="btn" onClick={onExit}>
								Back
							</button>
							<button type="button" className="btn primary" onClick={again} autoFocus>
								Start
							</button>
						</div>
					</div>
				</div>
			)}

			{phase === 'over' && result && (
				<div className="sheet-back">
					<div className="sheet results" role="dialog" aria-modal="true" aria-label="Run over">
						<Tint mood="happy" color={result.isBest ? 2 : -1} size={60} />
						<h2>{left <= 0 ? 'Time’s up!' : 'Run over'}</h2>
						<div className="stats two">
							<div>
								<span>Boards</span>
								<b>{result.boards}</b>
							</div>
							<div>
								<span>Biggest</span>
								<b>{result.boards ? `${clockSize(result.boards - 1)}×${clockSize(result.boards - 1)}` : '–'}</b>
							</div>
						</div>
						{result.isBest && result.boards > 0 && <p className="badge">New best run</p>}
						<Earned earned={result.earned} coins={result.coins} />
						<div className="row">
							<button type="button" className="btn" onClick={onExit}>
								Menu
							</button>
							<button type="button" className="btn primary" onClick={again} autoFocus>
								Again
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ------------------------------------------------------------------ road trip

/** One past stop on the map: the road bright, the other lines faint. */
function MapLeg({ leg, inY, h }: { leg: Leg; inY: number; h: number }) {
	const s = h / leg.size;
	const pt = (c: number) => `${(c % leg.size) * s + s / 2} ${Math.floor(c / leg.size) * s + s / 2}`;
	const last = leg.road[leg.road.length - 1];
	const road = `M 0 ${inY * h} L ${leg.road.map(pt).join(' L ')} L ${leg.size * s} ${Math.floor(last / leg.size) * s + s / 2}`;
	return (
		<svg className="map-leg" viewBox={`0 0 ${leg.size * s} ${h}`} width={leg.size * s} height={h} aria-hidden="true">
			<rect width={leg.size * s} height={h} className="map-ground" />
			{leg.others.map((line, i) => (
				<path key={i} d={`M ${line.map(pt).join(' L ')}`} className="map-other" style={{ stroke: `var(--c${i + 1})` }} />
			))}
			<path d={road} className="map-road" />
		</svg>
	);
}

interface RoadProps {
	endless: EndlessSave;
	looks: Looks;
	settings: Settings;
	onSave: (paths: Paths) => void;
	onStop: (leg: Leg) => { earned: Earning[]; coins: number };
	onNewTrip: () => void;
	onSettings: () => void;
	onExit: () => void;
}

export function RoadTrip({ endless, looks, settings, onSave, onStop, onNewTrip, onSettings, onExit }: RoadProps) {
	const { trip, stops, legs } = endless;
	const lastLeg = legs[legs.length - 1];
	const entry = stops > 0 && lastLeg ? Math.floor(lastLeg.road[lastLeg.road.length - 1] / lastLeg.size) : null;
	const p = useMemo(() => roadBoard(String(trip), stops, entry), [trip, stops, entry]);
	const [toast, setToast] = useState<{ earned: Earning[]; key: number } | null>(null);
	const [drawing, setDrawing] = useState(-1);
	const [cheer, setCheer] = useState(false);
	const [askNew, setAskNew] = useState(false);
	const mapRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		mapRef.current?.scrollTo({ left: mapRef.current.scrollWidth, behavior: 'smooth' });
	}, [stops]);
	// Make the next stop early, in the background.
	useEffect(() => {
		const id = window.setTimeout(() => roadBoard(String(trip), stops + 1, exitRow(p)), 300);
		return () => clearTimeout(id);
	}, [trip, stops, p]);

	const solved = () => {
		setCheer(true);
		const leg: Leg = { size: p.w, road: p.solution[0], others: p.solution.slice(1) };
		window.setTimeout(() => {
			const res = onStop(leg);
			setToast({ earned: res.earned, key: Date.now() });
			setCheer(false);
			audio.play('coin');
		}, 800);
	};

	const H = 52;
	// Where the road enters each map leg, as a share of its height.
	const inYs = legs.map((leg, i) => {
		if (i === 0) return (Math.floor(leg.road[0] / leg.size) + 0.5) / leg.size;
		const prev = legs[i - 1];
		return (Math.floor(prev.road[prev.road.length - 1] / prev.size) + 0.5) / prev.size;
	});
	const fromStart = legs.length === stops;

	return (
		<div className="play endless-play road">
			<header className="bar">
				<button type="button" className="icon-btn" onClick={onExit} aria-label="Back">
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>Road trip</b>
					<span>
						Stop {stops + 1} · {roadSize(stops)}×{roadSize(stops)}
					</span>
				</div>
				<button type="button" className="icon-btn" onClick={() => setAskNew(true)} aria-label="New trip">
					<Icon name="shuffle" />
				</button>
				<button type="button" className="icon-btn" onClick={onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</header>

			<div className="road-map" ref={mapRef} aria-label={`Map: ${stops} stops so far`}>
				{fromStart && (
					<span className="map-start" aria-hidden="true">
						<svg viewBox="0 0 20 28" width={16} height={22}>
							<path d="M10 27 C 4 18 1 14 1 9.5 A 9 9 0 0 1 19 9.5 C 19 14 16 18 10 27 Z" className="pin" />
							<circle cx="10" cy="9.5" r="3.6" className="pin-hole" />
						</svg>
					</span>
				)}
				{legs.map((leg, i) => (
					<MapLeg key={stops - legs.length + i} leg={leg} inY={inYs[i]} h={H} />
				))}
				<span className="map-next" style={{ height: H, width: H }}>
					<Tint size={26} color={drawing >= 0 ? drawing : 0} mood={cheer ? 'happy' : drawing >= 0 ? 'draw' : 'idle'} />
				</span>
				{toast && (
					<span key={toast.key} className="road-toast">
						+{toast.earned.reduce((s, e) => s + e.coins, 0)}
					</span>
				)}
			</div>

			<RunBoard
				key={p.id}
				p={p}
				looks={looks}
				settings={settings}
				initial={endless.paths}
				onChange={onSave}
				onSolved={solved}
				onDrawing={setDrawing}
				edges={{ inRow: entryRow(p), outRow: exitRow(p) }}
			/>
			<p className="key-help">The red road comes in on the left and leaves on the right. The next stop starts where it leaves.</p>

			{askNew && (
				<div className="sheet-back" onClick={() => setAskNew(false)}>
					<div className="sheet small" role="dialog" aria-modal="true" aria-label="New trip" onClick={(e) => e.stopPropagation()}>
						<h2>Start a new trip?</h2>
						<p>This trip ends at {stops} stop{stops === 1 ? '' : 's'}. Your longest trip stays.</p>
						<div className="row">
							<button type="button" className="btn" onClick={() => setAskNew(false)}>
								Keep going
							</button>
							<button
								type="button"
								className="btn primary"
								onClick={() => {
									setAskNew(false);
									onNewTrip();
								}}
							>
								New trip
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
