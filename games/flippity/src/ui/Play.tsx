/** A game: the scores, the board, undo and hint, the bot's turns and the end sheet. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { GameState, Outcome } from '../app/game.ts';
import { applyMove, canUndo, isBotTurn, undoMove } from '../app/game.ts';
import { useKeys } from '../app/input.ts';
import type { Settings } from '../app/save.ts';
import { BOT_NAME } from '../app/save.ts';
import type { Earning } from '../app/shop.ts';
import { HELP, groupEarnings } from '../app/shop.ts';
import type { BotId } from '../core/bot.ts';
import { pickMove } from '../core/bot.ts';
import type { BotAnswer, BotAsk } from '../core/bot.worker.ts';
import type { Side } from '../core/rules.ts';
import { DARK, LIGHT, count, legalMoves } from '../core/rules.ts';
import type { Floater, MoveAnim } from './Board.tsx';
import { Board, flipDelays } from './Board.tsx';
import type { Mood } from './bits.tsx';
import { BotFace, Icon, PipChip, PipIcon, Stone } from './bits.tsx';

export interface FinishInfo {
	outcome: Outcome;
	winner: Side | 0;
	dark: number;
	light: number;
	earned: Earning[];
	total: number;
	pips: number;
}

interface PlayProps {
	initial: GameState;
	settings: Settings;
	stoneLook: string;
	calm: boolean;
	pips: number;
	onSave: (g: GameState) => void;
	/** Pays for help. False when the player can't pay. */
	onSpend: (price: number) => boolean;
	onFinish: (g: GameState) => FinishInfo;
	onQuit: () => void;
	onAgain: () => void;
	onNewGame: () => void;
	onSettings: () => void;
	covered: boolean;
}

/** How long each bot seems to think, at least, in ms. */
const THINK: Record<BotId, number> = { sleepy: 900, steady: 750, sharp: 550 };

/** Asks the bot worker for a move. Falls back to the main thread if workers are blocked. */
function useBotWorker() {
	const worker = useRef<Worker | null>(null);
	const waiting = useRef(new Map<number, (m: number) => void>());
	const nextId = useRef(0);
	useEffect(() => {
		try {
			const w = new Worker(new URL('../core/bot.worker.ts', import.meta.url), { type: 'module' });
			w.onmessage = (e: MessageEvent<BotAnswer>) => {
				waiting.current.get(e.data.id)?.(e.data.move);
				waiting.current.delete(e.data.id);
			};
			worker.current = w;
		} catch {
			worker.current = null;
		}
		return () => {
			worker.current?.terminate();
			worker.current = null;
		};
	}, []);
	return (cells: number[], n: number, side: Side, bot: BotId) =>
		new Promise<number>((resolve) => {
			const w = worker.current;
			if (!w) {
				window.setTimeout(() => resolve(pickMove(cells, n, side, bot)), 30);
				return;
			}
			const id = ++nextId.current;
			waiting.current.set(id, resolve);
			const ask: BotAsk = { id, cells, n, side, bot };
			w.postMessage(ask);
		});
}

export function Play(p: PlayProps) {
	const [game, setGame] = useState(p.initial);
	const gameRef = useRef(game);
	gameRef.current = game;
	const [anim, setAnim] = useState<MoveAnim | null>(null);
	const [floaters, setFloaters] = useState<Floater[]>([]);
	const [hint, setHint] = useState(-1);
	const [hinting, setHinting] = useState(false);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [shake, setShake] = useState<{ at: number; id: number } | null>(null);
	const [toolShake, setToolShake] = useState<'undo' | 'hint' | null>(null);
	const [end, setEnd] = useState<FinishInfo | null>(null);
	const ask = useBotWorker();
	const req = useRef(0);
	const animEnd = useRef(0);
	const ids = useRef(0);
	const timers = useRef<number[]>([]);
	const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
	useEffect(() => () => timers.current.forEach(clearTimeout), []);

	const { n, opponent } = game;
	const bot = opponent === 'pair' ? null : opponent;
	const side = game.toMove;
	const botTurn = isBotTurn(game);
	const legal = useMemo(() => new Set(side && !botTurn ? legalMoves(game.cells, n, side) : []), [game.cells, n, side, botTurn]);
	const score = count(game.cells);
	const earnedSum = game.earned.reduce((s, e) => s + e.pips, 0);

	const nameOf = (s: Side) => (bot ? (s === game.human ? 'You' : BOT_NAME[bot]) : s === DARK ? 'Dark' : 'Light');

	const finishSoon = (g: GameState, wait: number) => {
		later(() => {
			const info = p.onFinish(g);
			setEnd(info);
			audio.play(info.outcome === 'win' || (!bot && info.winner) ? 'win' : info.outcome === 'loss' ? 'lose' : 'draw');
			if (info.total) later(() => audio.play('coin'), 1400);
		}, wait);
	};

	const doMove = (i: number) => {
		const g = gameRef.current;
		const r = applyMove(g, i);
		const delays = flipDelays(n, i, r.flips);
		const id = ++ids.current;
		setAnim({ id, placed: i, flips: delays });
		setHint(-1);
		setNote(null);
		audio.play('place');
		const steps = [...new Set(delays.values())].sort((a, b) => a - b);
		steps.forEach((d, k) => audio.flip(k + r.lines - 1, d / 1000 + 0.05));
		audio.buzz(r.flips.length >= 5 ? 18 : 8);
		const longest = steps.length ? steps[steps.length - 1] + 460 : 320;
		animEnd.current = performance.now() + (p.calm ? 0 : longest);
		if (r.earnedNow.length) {
			const sum = r.earnedNow.reduce((s, e) => s + e.pips, 0);
			const fid = ++ids.current;
			setFloaters((f) => [...f, { id: fid, at: i, text: `+${sum}` }]);
			later(() => setFloaters((f) => f.filter((x) => x.id !== fid)), 1300);
			later(() => audio.play('coin'), Math.min(longest, 500));
		}
		gameRef.current = r.game;
		setGame(r.game);
		p.onSave(r.game);
		if (r.game.toMove === null) finishSoon(r.game, (p.calm ? 0 : longest) + 600);
		else if (r.game.passed) {
			const passer = r.game.passed;
			later(() => {
				setNote(`${nameOf(passer)} ${bot && passer === g.human ? 'have' : 'has'} no move. ${nameOf(r.game.toMove!)} ${bot && r.game.toMove === g.human ? 'go' : 'goes'} again.`);
				audio.play('pass');
			}, p.calm ? 0 : longest);
		}
	};

	// A game that was saved after its last move ends at once.
	useEffect(() => {
		if (game.toMove === null && !end) finishSoon(game, 300);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// The bot's turn.
	useEffect(() => {
		if (!bot || !botTurn || end) return;
		const mine = ++req.current;
		const g = game;
		setBusy(true);
		const started = performance.now();
		void ask(g.cells, g.n, g.toMove!, bot).then((move) => {
			if (req.current !== mine) return;
			const wait = Math.max(animEnd.current - performance.now() + 120, THINK[bot] - (performance.now() - started), 0);
			later(() => {
				if (req.current !== mine) return;
				setBusy(false);
				doMove(move);
			}, wait);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [game, botTurn, bot, end]);

	const pay = (used: number, free: number, price: number, tool: 'undo' | 'hint') => {
		if (used < free) return true;
		if (p.onSpend(price)) return true;
		audio.play('blocked');
		setToolShake(tool);
		later(() => setToolShake(null), 450);
		return false;
	};

	const undo = () => {
		const g = gameRef.current;
		if (end || !canUndo(g)) return;
		if (!pay(g.undos, HELP.freeUndos, HELP.undoPrice, 'undo')) return;
		const back = undoMove(g);
		if (!back) return;
		req.current++;
		setBusy(false);
		const next = { ...back, undos: g.undos + 1 };
		gameRef.current = next;
		setGame(next);
		setAnim(null);
		setHint(-1);
		setNote(null);
		animEnd.current = 0;
		audio.play('undo');
		p.onSave(next);
	};

	const askHint = () => {
		const g = gameRef.current;
		if (end || busy || hinting || isBotTurn(g) || !g.toMove || hint >= 0) return;
		if (!pay(g.hints, HELP.freeHints, HELP.hintPrice, 'hint')) return;
		const next = { ...g, hints: g.hints + 1 };
		gameRef.current = next;
		setGame(next);
		p.onSave(next);
		setHinting(true);
		const mine = req.current;
		void ask(g.cells, g.n, g.toMove, 'sharp').then((m) => {
			setHinting(false);
			if (req.current !== mine || gameRef.current.cells !== g.cells) return;
			setHint(m);
			audio.play('hint');
		});
	};

	const tap = (i: number) => {
		const g = gameRef.current;
		if (end || busy || isBotTurn(g) || !g.toMove || p.covered) return;
		if (!legal.has(i)) {
			audio.play('blocked');
			setShake({ at: i, id: ++ids.current });
			later(() => setShake(null), 420);
			return;
		}
		doMove(i);
	};

	useKeys((e) => {
		if (p.covered || e.metaKey || e.ctrlKey) return;
		const k = e.key.toLowerCase();
		if (k === 'z') undo();
		else if (k === 'h') askHint();
	});

	const mood: Mood = end ? (end.outcome === 'loss' ? 'happy' : end.outcome === 'win' ? 'sad' : 'idle') : busy ? 'think' : 'idle';

	const status = end
		? 'Game over'
		: note
			? note
			: botTurn && bot
				? `${BOT_NAME[bot]} is thinking…`
				: bot
					? 'Your turn'
					: `${side === DARK ? 'Dark' : 'Light'}’s turn`;

	const freeLeft = (used: number, free: number) => Math.max(0, free - used);

	const player = (s: Side) => {
		const isBot = bot && s !== game.human;
		const on = !end && side === s;
		return (
			<div className={`player${on ? ' turn' : ''}${s === LIGHT ? ' right' : ''}`}>
				<span className="player-face">{isBot ? <BotFace bot={bot} mood={mood} size={46} /> : <Stone side={s} className={`big stones-${p.stoneLook}`} />}</span>
				<span className="player-text">
					<b>{nameOf(s)}</b>
					<span className="player-side">
						<Stone side={s} className={`mini stones-${p.stoneLook}`} /> {s === DARK ? 'Dark' : 'Light'}
					</span>
				</span>
				<span className="player-count" aria-label={`${s === DARK ? score.dark : score.light} pebbles`}>
					{s === DARK ? score.dark : score.light}
				</span>
			</div>
		);
	};

	const undoFree = freeLeft(game.undos, HELP.freeUndos);
	const hintFree = freeLeft(game.hints, HELP.freeHints);

	return (
		<main className="play" data-layer={end ? undefined : ''}>
			<header className="bar">
				<button type="button" className="icon-btn" onClick={p.onQuit} aria-label="Back to the menu">
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>{bot ? `Vs ${BOT_NAME[bot]}` : 'Pass and play'}</b>
					<span>
						{n}×{n} board
					</span>
				</div>
				{bot && <PipChip pips={p.pips} extra={earnedSum} />}
				<button type="button" className="icon-btn" onClick={p.onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</header>

			<section className="players" aria-label="Score">
				{player(DARK)}
				{player(LIGHT)}
			</section>

			<p className={`status${note ? ' note' : ''}`} aria-live="polite">
				{status}
			</p>

			<div className="board-wrap">
				<Board
					n={n}
					cells={game.cells}
					last={game.last}
					legal={legal}
					dots={p.settings.moveDots}
					hint={hint}
					anim={anim}
					floaters={floaters}
					shake={shake}
					calm={p.calm}
					locked={busy || botTurn || !!end}
					stoneLook={p.stoneLook}
					onTap={tap}
					label={`Board, ${n} by ${n}`}
				/>
			</div>

			<div className="tools">
				<button type="button" className={`btn tool${toolShake === 'undo' ? ' shake' : ''}`} onClick={undo} disabled={!!end || !canUndo(game)}>
					<Icon name="undo" size={20} /> Undo
					<span className="cost">{undoFree ? 'Free' : <><PipIcon size={14} /> {HELP.undoPrice}</>}</span>
				</button>
				<button type="button" className={`btn tool${toolShake === 'hint' ? ' shake' : ''}`} onClick={askHint} disabled={!!end || busy || botTurn || hint >= 0 || hinting}>
					<Icon name="bulb" size={20} /> Hint
					<span className="cost">{hintFree ? 'Free' : <><PipIcon size={14} /> {HELP.hintPrice}</>}</span>
				</button>
			</div>

			{end && <EndSheet info={end} bot={bot} stoneLook={p.stoneLook} onAgain={p.onAgain} onNewGame={p.onNewGame} onMenu={p.onQuit} />}
		</main>
	);
}

function EndSheet({ info, bot, stoneLook, onAgain, onNewGame, onMenu }: { info: FinishInfo; bot: BotId | null; stoneLook: string; onAgain: () => void; onNewGame: () => void; onMenu: () => void }) {
	const title = bot
		? info.outcome === 'win'
			? 'You win!'
			: info.outcome === 'loss'
				? `${BOT_NAME[bot]} wins`
				: 'A draw'
		: info.winner === 0
			? 'A draw'
			: `${info.winner === DARK ? 'Dark' : 'Light'} wins!`;
	const sub = bot ? (info.outcome === 'win' ? 'Nicely flipped.' : info.outcome === 'loss' ? 'So close. Try again?' : 'Even all the way.') : 'Good game, both of you.';
	const mood: Mood = info.outcome === 'loss' ? 'happy' : info.outcome === 'win' ? 'sad' : 'idle';
	const groups = groupEarnings(info.earned);
	return (
		<div className="sheet-back" data-layer>
			<div className="sheet end-sheet" role="dialog" aria-modal="true" aria-label={title}>
				<div className="end-face">{bot ? <BotFace bot={bot} mood={mood} size={72} /> : <Stone side={info.winner || DARK} className={`big stones-${stoneLook}`} />}</div>
				<h2>{title}</h2>
				<p className="muted">{sub}</p>
				<div className={`end-score stones-${stoneLook}`}>
					<span className={info.winner === DARK ? 'won' : ''}>
						<Stone side={DARK} className="mini" /> {info.dark}
					</span>
					<span className="dash">–</span>
					<span className={info.winner === LIGHT ? 'won' : ''}>
						<Stone side={LIGHT} className="mini" /> {info.light}
					</span>
				</div>
				{bot && (
					<>
						<ul className="earn-list">
							{groups.map((e) => (
								<li key={e.label}>
									<span>
										{e.label}
										{e.times > 1 && <small> ×{e.times}</small>}
									</span>
									<b>+{e.pips}</b>
								</li>
							))}
							{!groups.length && <li className="muted">No Pips this time. Corners and big flips pay.</li>}
						</ul>
						<p className="earn-total">
							<PipIcon /> +{info.total} <span className="muted">· {info.pips} in all</span>
						</p>
					</>
				)}
				{!bot && <p className="muted small">Pass and play earns no Pips.</p>}
				<button type="button" className="btn primary wide" onClick={onAgain} autoFocus>
					<Icon name="reset" size={18} /> Play again
				</button>
				<div className="row">
					<button type="button" className="btn" onClick={onNewGame}>
						New game
					</button>
					<button type="button" className="btn" onClick={onMenu}>
						Menu
					</button>
				</div>
			</div>
		</div>
	);
}
