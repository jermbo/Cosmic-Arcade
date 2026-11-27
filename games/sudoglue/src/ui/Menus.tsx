/** Title, week, practice, records, how to play, and settings. */
import { useState } from 'react';
import type { SaveData, Settings } from '../app/save.ts';
import { formatTime, liveStreak } from '../app/save.ts';
import { levelOfDay, parseKey, weekOf } from '../core/daily.ts';
import { makeRng } from '../core/rng.ts';
import { randomSolution } from '../core/solve.ts';
import type { Level } from '../core/types.ts';
import { LEVELS } from '../core/types.ts';
import { GLASS } from './art.ts';
import { Icon, MiniPane, NumeralIcon, Swatch } from './bits.tsx';
import { Gloop } from './Gloop.tsx';
import { RULES } from './HintPanel.tsx';

export const LEVEL_INFO: Record<Level, { name: string; needs: string; blurb: string }> = {
	easy: { name: 'Easy', needs: 'Lines', blurb: 'Rows and columns are enough. More clues to start.' },
	medium: { name: 'Medium', needs: 'Used pairs', blurb: 'Few clues. You need to track which pairs are taken.' },
	hard: { name: 'Hard', needs: 'Pair hunt', blurb: 'Like Medium, plus one spot where you must ask “where can this pair go?”' },
	expert: { name: 'Expert', needs: 'Trades', blurb: 'Needs the trade rule: two rows swap their values in pairs.' },
};

/** A real finished window (from the generator), so the title art follows the rules. */
const SHOW = randomSolution(makeRng(2026));

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayLabel(key: string) {
	const d = parseKey(key);
	return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

function Logo() {
	const letters = 'Sudoglue'.split('');
	return (
		<h1 className="logo" aria-label="Sudoglue">
			{letters.map((l, i) => (
				<span key={i} className="logo-l" style={{ ['--c' as string]: GLASS[i % 4].base, ['--d' as string]: `${i * 0.08}s` }} aria-hidden="true">
					{l}
					{i === 6 && (
						<svg className="logo-drip" viewBox="0 0 40 50" aria-hidden="true">
							<path d="M 4 4 C 12 2 28 2 36 4 C 36 10 30 10 29 16 C 28 24 30 34 25 38 C 20 42 16 38 17 30 C 18 22 14 14 8 12 C 4 10 4 7 4 4 Z" fill="#fffdf2" stroke="#241a2e" strokeWidth="3" strokeLinejoin="round" />
							<path d="M 20 30 C 20 27 21 25 22 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
						</svg>
					)}
				</span>
			))}
		</h1>
	);
}

/** A small finished window that slowly glows, for the title screen. */
function ShowWindow() {
	const sol = SHOW;
	const sample = sol.num.map((n, i) => [n, sol.color[i]]);
	return (
		<div className="show-window" aria-hidden="true">
			{sample.map(([n, c], i) => (
				<span key={i} style={{ ['--i' as string]: i }}>
					<MiniPane n={n} c={c} size={44} />
				</span>
			))}
		</div>
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
	onSettings: () => void;
}

export function Title(p: TitleProps) {
	const id = `daily-${p.today}`;
	const done = p.data.finished[id];
	const going = p.data.games[id];
	const streak = liveStreak(p.data, p.today);
	return (
		<main className="screen title-screen" data-layer>
			<div className="title-top">
				<Logo />
				<p className="tagline">Glue the old workshop windows back together, one pane at a time.</p>
			</div>
			<div className="title-art">
				<ShowWindow />
				<div className="title-gloop">
					<Gloop mood={done ? 'cheer' : 'idle'} size={76} />
				</div>
			</div>
			<nav className="title-menu">
				<button className="btn btn-main btn-big" autoFocus onClick={p.onToday}>
					<Icon name="sun" />
					<span>
						Today’s window
						<small>
							{LEVEL_INFO[levelOfDay(p.today)].name} · {done ? `mended in ${formatTime(done.time)}` : going ? 'in progress' : 'new'}
						</small>
					</span>
				</button>
				<div className="row">
					<button className="btn" onClick={p.onWeek}>
						<Icon name="calendar" /> This week
					</button>
					<button className="btn" onClick={p.onPractice}>
						<Icon name="shuffle" /> Practice
					</button>
				</div>
				<div className="row">
					<button className="btn" onClick={p.onRecords}>
						<Icon name="trophy" /> Records
					</button>
					<button className="btn" onClick={p.onRules}>
						<Icon name="book" /> How to play
					</button>
				</div>
				<div className="row">
					<button className="btn" onClick={p.onSettings}>
						<Icon name="gear" /> Settings
					</button>
					<a className="btn" href="../">
						<Icon name="back" /> Arcade
					</a>
				</div>
				<p className="streak-line">
					Daily streak: <b>{streak}</b> {streak === 1 ? 'day' : 'days'}
					{p.data.streak.best > 0 && <span className="muted"> · best {p.data.streak.best}</span>}
				</p>
			</nav>
		</main>
	);
}

function Back({ onBack, title }: { onBack: () => void; title: string }) {
	return (
		<header className="screen-head">
			<button className="icon-btn" onClick={onBack} aria-label="Back">
				<Icon name="back" />
			</button>
			<h2>{title}</h2>
		</header>
	);
}

export function Week({ data, today, onPlay, onBack }: { data: SaveData; today: string; onPlay: (day: string) => void; onBack: () => void }) {
	const days = weekOf(today);
	const streak = liveStreak(data, today);
	return (
		<main className="screen" data-layer>
			<Back onBack={onBack} title="This week" />
			<p className="muted center">
				A new window every day. Monday is gentle; the weekend is tough. Streak: <b>{streak}</b>
			</p>
			<div className="week">
				{days.map((day, i) => {
					const id = `daily-${day}`;
					const done = data.finished[id];
					const going = data.games[id];
					const future = day > today;
					const level = levelOfDay(day);
					return (
						<button
							key={day}
							className={`day card${day === today ? ' today' : ''}${done ? ' done' : ''}`}
							disabled={future}
							autoFocus={day === today}
							onClick={() => onPlay(day)}
						>
							<span className="day-pane" aria-hidden="true">
								{done ? <MiniPane n={i % 4} c={(i + 1) % 4} size={40} /> : <span className={`day-empty${going ? ' going' : ''}`} />}
							</span>
							<span className="day-text">
								<b>{dayLabel(day)}</b>
								<small>{LEVEL_INFO[level].name}</small>
							</span>
							<span className="day-state">
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
			<p className="muted center">Endless windows. Levels go by the logic each one needs, not just the number of clues.</p>
			<div className="levels">
				{LEVELS.map((level, i) => {
					const info = LEVEL_INFO[level];
					const best = data.records[level][0];
					return (
						<button key={level} className="level card" onClick={() => onPlay(level)} autoFocus={i === 0}>
							<span className="level-gem" aria-hidden="true">
								<Swatch c={i} size={40} />
							</span>
							<span className="level-text">
								<b>{info.name}</b>
								<small>Needs: {info.needs}</small>
								<span>{info.blurb}</span>
							</span>
							<span className="level-state">
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
			<div className="record-top">
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
					<span>day streak (best {data.streak.best})</span>
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
				<p>
					Each of the 16 tiles needs one number (<NumeralIcon v={0} size={16} /> <NumeralIcon v={1} size={16} /> <NumeralIcon v={2} size={16} />{' '}
					<NumeralIcon v={3} size={16} />) and one glass color. Every color has its own pattern:
				</p>
				<ul className="glass-list">
					{GLASS.map((g, i) => (
						<li key={g.name}>
							<Swatch c={i} size={24} /> {g.name} <span className="muted">({g.pattern})</span>
						</li>
					))}
				</ul>
				<ol className="rules-list">
					<li>Each row and each column has every number once and every color once.</li>
					<li>Each number + color pair (like ruby 2) is used once in the whole window.</li>
					<li>There are no boxes, unlike Sudoku. Just rows, columns and pairs.</li>
				</ol>
				<p>Parts with a dark number badge or corner rivets are set in lead: they are clues and stay put. The parts you add are held with glue.</p>
			</section>
			<section className="card">
				<h3>Controls</h3>
				<table className="controls-table">
					<tbody>
						<tr>
							<th>Touch / mouse</th>
							<td>Tap a tile, then tap a number and a color. Tap the same one again to take it off.</td>
						</tr>
						<tr>
							<th>Keyboard</th>
							<td>
								Arrows move · <kbd>1</kbd>–<kbd>4</kbd> numbers · <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> colors · <kbd>N</kbd> notes · <kbd>⌫</kbd> erase ·{' '}
								<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>H</kbd> hint · <kbd>Esc</kbd> pause
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
		<div className="trade-demo" aria-label="Example: row 1 is 1 2 3 4, row 2 is 3 4 1 2. Where row 1 has 1, row 2 has 3, and where row 1 has 3, row 2 has 1.">
			<div>
				{a.map((n, i) => (
					<span key={i} className={i === 0 || i === 2 ? 'hl' : ''}>
						<NumeralIcon v={n} size={22} />
					</span>
				))}
			</div>
			<div>
				{b.map((n, i) => (
					<span key={i} className={i === 0 || i === 2 ? 'hl' : ''}>
						<NumeralIcon v={n} size={22} />
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
	onWipe: () => void;
}

export function SettingsModal({ settings, onChange, onClose, onTutorial, onWipe }: SettingsProps) {
	const [wipe, setWipe] = useState(false);
	const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
	const toggle = (k: 'showTimer' | 'showClashes' | 'helpers' | 'haptics', label: string, note: string) => (
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
					<button className="icon-btn" onClick={onClose} aria-label="Close settings" autoFocus>
						<Icon name="close" />
					</button>
				</header>
				<label className="slider">
					<span>Sound effects</span>
					<input type="range" min="0" max="1" step="0.05" value={settings.sound} onChange={(e) => set('sound', Number(e.target.value))} />
				</label>
				<label className="slider">
					<span>Music</span>
					<input type="range" min="0" max="1" step="0.05" value={settings.music} onChange={(e) => set('music', Number(e.target.value))} />
				</label>
				<div className="seg" role="radiogroup" aria-label="Motion">
					<span>Motion</span>
					{(['auto', 'reduced', 'full'] as const).map((m) => (
						<button key={m} role="radio" aria-checked={settings.motion === m} className={settings.motion === m ? 'on' : ''} onClick={() => set('motion', m)}>
							{m === 'auto' ? 'Device' : m === 'reduced' ? 'Reduced' : 'Full'}
						</button>
					))}
				</div>
				{toggle('showTimer', 'Show the clock', 'It still counts for records.')}
				{toggle('showClashes', 'Show rule clashes', 'Cracks show tiles that break a rule.')}
				{toggle('helpers', 'Helpers', 'Light up the row, column and matches of the picked tile.')}
				{toggle('haptics', 'Vibration', 'Small taps on phones that support it.')}
				<div className="row">
					<button className="btn" onClick={onTutorial}>
						Replay tutorial
					</button>
					{wipe ? (
						<button className="btn btn-danger" onClick={onWipe}>
							Really erase everything
						</button>
					) : (
						<button className="btn" onClick={() => setWipe(true)}>
							Erase progress
						</button>
					)}
				</div>
				<p className="muted small">Progress lives only in this browser.</p>
			</div>
		</div>
	);
}
