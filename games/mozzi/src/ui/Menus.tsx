/** Title, week, practice, records, how to play, and settings. */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { SaveData, Settings } from '../app/save.ts';
import { formatTime, liveStreak } from '../app/save.ts';
import { levelOfDay, parseKey, weekOf } from '../core/daily.ts';
import type { Level } from '../core/types.ts';
import { LEVELS } from '../core/types.ts';
import { SHAPE_NAMES } from '../core/words.ts';
import { colorName, Icon, Mini, Shape } from './bits.tsx';
import type { MozziMood } from './Mozzi.tsx';
import { Mozzi } from './Mozzi.tsx';
import { RULES } from './HintPanel.tsx';

export const LEVEL_INFO: Record<Level, { name: string; needs: string; blurb: string }> = {
	easy: { name: 'Easy', needs: 'Lines', blurb: 'Rows and columns are enough. More clues to start.' },
	medium: { name: 'Medium', needs: 'Used pairs', blurb: 'Few clues. Keep track of which pairs are taken.' },
	hard: { name: 'Hard', needs: 'Pair hunt', blurb: 'Like Medium, plus one moment where you ask “where can this pair go?”' },
	expert: { name: 'Expert', needs: 'Trades', blurb: 'Needs the trade rule: two rows swap their values in pairs.' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayLabel(key: string) {
	const d = parseKey(key);
	return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

/** The logo: one tile per letter, in Mozzi's four colors. */
const LOGO: [string, number][] = [
	['M', 0],
	['o', 1],
	['z', 2],
	['z', 3],
	['i', 0],
];

function Logo() {
	return (
		<h1 className="logo" aria-label="Mozzi">
			{LOGO.map(([l, c], i) => (
				<span key={i} className={`logo-tile k${c}`} style={{ ['--i' as string]: i }} aria-hidden="true">
					{l}
				</span>
			))}
		</h1>
	);
}

export function CoinChip({ coins }: { coins: number }) {
	return (
		<span className="coin-chip" aria-label={`${coins} coins`}>
			<Icon name="coin" size={18} /> {coins}
		</span>
	);
}

interface TitleProps {
	data: SaveData;
	today: string;
	onToday: () => void;
	onWeek: () => void;
	onPractice: () => void;
	onRecords: () => void;
	onRules: () => void;
	onShop: () => void;
	onSettings: () => void;
}

/** The big Mozzi on the title: its eyes follow your pointer, and it likes a tap. */
function TitleMozzi({ cheer }: { cheer: boolean }) {
	const ref = useRef<HTMLDivElement>(null);
	const [look, setLook] = useState({ x: 0, y: 0 });
	const [mood, setMood] = useState<MozziMood>(cheer ? 'happy' : 'idle');
	const [hop, setHop] = useState<{ color: number; n: number } | null>(null);
	useEffect(() => {
		const move = (e: PointerEvent) => {
			const r = ref.current?.getBoundingClientRect();
			if (!r) return;
			const dx = e.clientX - (r.left + r.width / 2);
			const dy = e.clientY - (r.top + r.height / 2);
			const d = Math.max(1, Math.hypot(dx, dy));
			setLook({ x: (dx / d) * Math.min(1, d / 120), y: (dy / d) * Math.min(1, d / 120) });
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerdown', move);
		return () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerdown', move);
		};
	}, []);
	return (
		<div className="title-mascot" ref={ref}>
			<Mozzi
				mood={mood}
				look={look}
				hop={hop}
				size={104}
				label="Mozzi. Say hello."
				onClick={() => {
					const color = Math.floor(Math.random() * 4);
					setHop((h) => ({ color, n: (h?.n ?? 0) + 1 }));
					setMood('happy');
					audio.play(`color${color}` as 'color0');
					window.setTimeout(() => setMood('idle'), 500);
				}}
			/>
		</div>
	);
}

export function Title(p: TitleProps) {
	const id = `daily-${p.today}`;
	const done = p.data.finished[id];
	const going = p.data.games[id];
	const streak = liveStreak(p.data, p.today);
	return (
		<main className="screen title-screen" data-layer>
			<div className="title-corner">
				<CoinChip coins={p.data.coins} />
				<button className="puff tool" onClick={p.onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</div>
			<div className="title-top">
				<Logo />
				<p className="tagline">A daily tile puzzle. Give every tile a number and a color.</p>
			</div>
			<TitleMozzi cheer={!!done} />
			<nav className="title-menu">
				<button className="btn btn-main btn-big" autoFocus onClick={p.onToday}>
					<Icon name="sun" size={26} />
					<span>
						Today’s window
						<small>
							{LEVEL_INFO[levelOfDay(p.today)].name} · {done ? `mended in ${formatTime(done.time)}` : going ? 'in progress' : 'new'}
						</small>
					</span>
				</button>
				<div className="menu-grid">
					<button className="btn" onClick={p.onWeek}>
						<Icon name="calendar" /> This week
					</button>
					<button className="btn" onClick={p.onPractice}>
						<Icon name="shuffle" /> Practice
					</button>
					<button className="btn" onClick={p.onShop}>
						<Icon name="shop" /> Shop
					</button>
					<button className="btn" onClick={p.onRecords}>
						<Icon name="trophy" /> Records
					</button>
					<button className="btn" onClick={p.onRules}>
						<Icon name="book" /> How to play
					</button>
					<a className="btn" href="../">
						<Icon name="back" /> Arcade
					</a>
				</div>
				<p className="streak-line">
					Daily streak <b>{streak}</b>
					{p.data.streak.best > 0 && <span className="muted"> · best {p.data.streak.best}</span>}
				</p>
			</nav>
		</main>
	);
}

export function Back({ onBack, title, children }: { onBack: () => void; title: string; children?: ReactNode }) {
	return (
		<header className="screen-head">
			<button className="puff tool" onClick={onBack} aria-label="Back">
				<Icon name="back" />
			</button>
			<h2>{title}</h2>
			{children}
		</header>
	);
}

export function Week({ data, today, onPlay, onBack }: { data: SaveData; today: string; onPlay: (day: string) => void; onBack: () => void }) {
	const days = weekOf(today);
	return (
		<main className="screen" data-layer>
			<Back onBack={onBack} title="This week" />
			<p className="muted lead">A new window every day. Monday is gentle; the weekend is tough. Only today’s window counts for the streak.</p>
			<div className="list">
				{days.map((day, i) => {
					const id = `daily-${day}`;
					const done = data.finished[id];
					const going = data.games[id];
					const future = day > today;
					return (
						<button
							key={day}
							className={`puff row-card${day === today ? ' today' : ''}${done ? ' done' : ''}`}
							disabled={future}
							autoFocus={day === today}
							onClick={() => onPlay(day)}
							style={{ ['--i' as string]: i }}
						>
							<span className="row-icon" aria-hidden="true">
								{done ? <Mini c={i % 4} size={34} /> : <span className={`ring${going ? ' going' : ''}`} />}
							</span>
							<span className="row-text">
								<b>{dayLabel(day)}</b>
								<small>{LEVEL_INFO[levelOfDay(day)].name}</small>
							</span>
							<span className="row-state">
								{future ? 'Soon' : done ? `${formatTime(done.time)}${done.hints ? ` · ${done.hints} hint${done.hints > 1 ? 's' : ''}` : ''}` : going ? 'Keep going' : day === today ? 'Today' : 'Open'}
							</span>
						</button>
					);
				})}
			</div>
		</main>
	);
}

export function Practice({ data, onPlay, onBack }: { data: SaveData; onPlay: (level: Level) => void; onBack: () => void }) {
	return (
		<main className="screen" data-layer>
			<Back onBack={onBack} title="Practice" />
			<p className="muted lead">Endless windows. Each level goes by the logic it needs, not just the number of clues.</p>
			<div className="list">
				{LEVELS.map((level, i) => {
					const info = LEVEL_INFO[level];
					const best = data.records[level][0];
					return (
						<button key={level} className="puff row-card level" onClick={() => onPlay(level)} autoFocus={i === 0} style={{ ['--i' as string]: i }}>
							<span className="row-icon" aria-hidden="true">
								<Mini c={i} n={i} size={40} />
							</span>
							<span className="row-text">
								<b>{info.name}</b>
								<small>Needs: {info.needs}</small>
								<span>{info.blurb}</span>
							</span>
							<span className="row-state">
								#{data.practice[level] + 1}
								{best && <small>best {formatTime(best.time)}</small>}
							</span>
						</button>
					);
				})}
			</div>
		</main>
	);
}

export function Records({ data, today, onBack }: { data: SaveData; today: string; onBack: () => void }) {
	const all = Object.values(data.finished);
	return (
		<main className="screen" data-layer>
			<Back onBack={onBack} title="Records" />
			<div className="stat-row">
				<div className="card stat">
					<b>{all.length}</b>
					<span>windows mended</span>
				</div>
				<div className="card stat">
					<b>{all.filter((f) => f.hints === 0).length}</b>
					<span>with no hints</span>
				</div>
				<div className="card stat">
					<b>{liveStreak(data, today)}</b>
					<span>day streak · best {data.streak.best}</span>
				</div>
			</div>
			<div className="record-lists">
				{LEVELS.map((level) => (
					<section key={level} className="card record-list">
						<h3>{LEVEL_INFO[level].name}</h3>
						{data.records[level].length ? (
							<ol>
								{data.records[level].map((r, i) => (
									<li key={i}>
										<b>{formatTime(r.time)}</b>
										<span>{r.hints === 0 ? 'no hints' : `${r.hints} hint${r.hints > 1 ? 's' : ''}${r.shown ? ` (${r.shown} shown)` : ''}`}</span>
										<small>{dayLabel(r.on)}</small>
									</li>
								))}
							</ol>
						) : (
							<p className="muted">No windows yet.</p>
						)}
					</section>
				))}
			</div>
		</main>
	);
}

export function Rules({ onBack }: { onBack: () => void }) {
	return (
		<main className="screen rules" data-layer>
			<Back onBack={onBack} title="How to play" />
			<section className="card">
				<h3>The window</h3>
				<p>Each of the 16 tiles needs one number (1–4) and one color. The colors are chosen to stay easy to tell apart, also with color blindness. Turn on <b>Color shapes</b> in Settings to add a symbol to each:</p>
				<ul className="glass-list">
					{[0, 1, 2, 3].map((c) => (
						<li key={c}>
							<Mini c={c} size={26} /> {colorName(c)}{' '}
							<span className="muted rule-shape">
								<Shape c={c} /> {SHAPE_NAMES[c]}
							</span>
						</li>
					))}
				</ul>
				<ol className="rules-list">
					<li>Each row and each column has every number once and every color once.</li>
					<li>Each number + color pair (like ruby 2) is used once in the whole window.</li>
					<li>There are no boxes, unlike Sudoku. Just rows, columns and pairs.</li>
				</ol>
				<p>Clues are bold, and clue colors have a small bar in the corner. They can’t change.</p>
			</section>
			<section className="card">
				<h3>Controls</h3>
				<table className="controls-table">
					<tbody>
						<tr>
							<th>Touch / mouse</th>
							<td>Tap a tile, then a number and a color at the bottom. Tap the same one again to take it off.</td>
						</tr>
						<tr>
							<th>Keyboard</th>
							<td>
								Arrows move · <kbd>1</kbd>–<kbd>4</kbd> numbers · <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> colors · <kbd>N</kbd> notes · <kbd>⌫</kbd> erase ·{' '}
								<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>H</kbd> hint · <kbd>P</kbd> pairs · <kbd>Esc</kbd> pause
							</td>
						</tr>
						<tr>
							<th>Gamepad</th>
							<td>D-pad moves (off the edge reaches the buttons) · A next number · X next color · Y notes · B erase · LB/RB undo/redo · Select hint · Start pause</td>
						</tr>
					</tbody>
				</table>
			</section>
			<section className="card">
				<h3>The glazier’s notebook</h3>
				<p className="muted">The four kinds of logic the hints use, easiest first. Every window can be solved with them, with no guessing.</p>
				<ol className="notebook">
					<li>
						<b>Lines.</b> {RULES[1]}
					</li>
					<li>
						<b>Used pairs.</b> {RULES[2]}
					</li>
					<li>
						<b>Pair hunt.</b> {RULES[3]}
					</li>
					<li>
						<b>Trades.</b> {RULES[4]} It is true of every finished 4×4 window, so you can lean on it.
						<TradeDemo />
					</li>
				</ol>
			</section>
		</main>
	);
}

/** Two rows that trade in pairs: 1↔3 and 2↔4. */
function TradeDemo() {
	const a = [0, 1, 2, 3];
	const b = [2, 3, 0, 1];
	return (
		<div className="trade-demo" aria-label="Example: row 1 is 1 2 3 4, row 2 is 3 4 1 2. 1 and 3 swap places, and so do 2 and 4.">
			<div>
				{a.map((n, i) => (
					<span key={i} className={i === 0 || i === 2 ? 'hl' : ''}>
						{n + 1}
					</span>
				))}
			</div>
			<div>
				{b.map((n, i) => (
					<span key={i} className={i === 0 || i === 2 ? 'hl' : ''}>
						{n + 1}
					</span>
				))}
			</div>
			<small>1 ↔ 3 swap places, and so do 2 ↔ 4.</small>
		</div>
	);
}

interface SettingsProps {
	settings: Settings;
	onChange: (s: Settings) => void;
	onClose: () => void;
	onTutorial: () => void;
	onShop: () => void;
	onWipe: () => void;
}

export function SettingsModal({ settings, onChange, onClose, onTutorial, onShop, onWipe }: SettingsProps) {
	const [wipe, setWipe] = useState(false);
	const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
	const toggle = (k: 'showTimer' | 'showClashes' | 'helpers' | 'haptics' | 'colorShapes' | 'bigText', label: string, note: string) => (
		<label className="toggle">
			<input type="checkbox" checked={settings[k]} onChange={(e) => set(k, e.target.checked)} />
			<span className="switch" aria-hidden="true" />
			<span>
				{label}
				<small>{note}</small>
			</span>
		</label>
	);
	return (
		<div className="overlay" data-layer>
			<div className="card modal settings" role="dialog" aria-label="Settings">
				<header>
					<h2>Settings</h2>
					<button className="puff tool" onClick={onClose} aria-label="Close settings" autoFocus>
						<Icon name="close" />
					</button>
				</header>
				<h3>Sound</h3>
				<label className="slider">
					<span>Effects</span>
					<input type="range" min="0" max="1" step="0.05" value={settings.sound} onChange={(e) => set('sound', Number(e.target.value))} />
				</label>
				<label className="slider">
					<span>Music</span>
					<input type="range" min="0" max="1" step="0.05" value={settings.music} onChange={(e) => set('music', Number(e.target.value))} />
				</label>
				<h3>Play</h3>
				{toggle('showTimer', 'Show the clock', 'It still counts for records.')}
				{toggle('showClashes', 'Show rule clashes', 'Tiles that break a rule get a red ring.')}
				{toggle('helpers', 'Helpers', 'Light up the row, column and matches of the picked tile.')}
				{toggle('haptics', 'Vibration', 'Small taps on phones that support it.')}
				<h3>Seeing and motion</h3>
				<div className="seg" role="radiogroup" aria-label="Motion">
					<span>Motion</span>
					{(['auto', 'reduced', 'full'] as const).map((m) => (
						<button key={m} role="radio" aria-checked={settings.motion === m} className={settings.motion === m ? 'on' : ''} onClick={() => set('motion', m)}>
							{m === 'auto' ? 'Device' : m === 'reduced' ? 'Less' : 'Full'}
						</button>
					))}
				</div>
				{toggle('colorShapes', 'Color shapes', 'A symbol on each color: ● ruby, ▲ cobalt, ■ amber, ◆ jade.')}
				{toggle('bigText', 'Big numbers', 'Larger numbers and notes on the tiles.')}
				<button className="btn" onClick={onShop}>
					<Icon name="shop" /> Themes, tiles and sounds
				</button>
				<div className="row">
					<button className="btn" onClick={onTutorial}>
						Replay tutorial
					</button>
					{wipe ? (
						<button className="btn btn-danger" onClick={onWipe}>
							Really erase all
						</button>
					) : (
						<button className="btn" onClick={() => setWipe(true)}>
							Erase progress
						</button>
					)}
				</div>
				<p className="muted small">Progress and coins live only in this browser.</p>
			</div>
		</div>
	);
}
