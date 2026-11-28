/** Title, week, practice, how to play, and settings. */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { SaveData, Settings } from '../app/save.ts';
import { formatTime, liveStreak } from '../app/save.ts';
import { LEVEL_NAME } from '../app/shop.ts';
import { levelOfDay, parseKey, weekOf } from '../core/daily.ts';
import type { Level } from '../core/types.ts';
import { LEVEL_SHAPE, LEVELS } from '../core/types.ts';
import { CoinChip, Icon } from './bits.tsx';
import type { TintMood } from './Tint.tsx';
import { Tint } from './Tint.tsx';

export const LEVEL_BLURB: Record<Level, string> = {
	easy: 'Small and friendly. A good warm-up.',
	medium: 'A little roomier, a few more colors.',
	hard: 'Longer lines that wind around each other.',
	expert: 'Big board. Plan before you draw.',
	master: 'The biggest board. Take your time.',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayLabel(key: string) {
	const d = parseKey(key);
	return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

const sizeText = (l: Level) => `${LEVEL_SHAPE[l].size}×${LEVEL_SHAPE[l].size}`;

/** The logo: the word, with a ribbon joining two dots under it. */
function Logo() {
	return (
		<div className="logo">
			<h1>Hueway</h1>
			<svg viewBox="0 0 200 26" aria-hidden="true" className="logo-line">
				<defs>
					<linearGradient id="logo-hue" x1="0" x2="1" y1="0" y2="0">
						<stop offset="0" stopColor="var(--c0)" />
						<stop offset="0.3" stopColor="var(--c4)" />
						<stop offset="0.5" stopColor="var(--c2)" />
						<stop offset="0.72" stopColor="var(--c3)" />
						<stop offset="1" stopColor="var(--c1)" />
					</linearGradient>
				</defs>
				<path d="M 12 13 C 40 2 60 24 90 13 C 120 2 140 24 188 13" className="logo-ribbon" />
				<path d="M 12 13 C 40 2 60 24 90 13 C 120 2 140 24 188 13" className="logo-sheen" transform="translate(-1 -1.5)" />
				<circle cx="12" cy="13" r="8" className="logo-dot a" />
				<circle cx="188" cy="13" r="8" className="logo-dot b" />
			</svg>
		</div>
	);
}

/** The big Tint on the title: eyes follow your pointer, and Tint changes color on a tap. */
function TitleTint({ cheer }: { cheer: boolean }) {
	const ref = useRef<HTMLButtonElement>(null);
	const [look, setLook] = useState({ x: 0, y: 0 });
	const [color, setColor] = useState(-1);
	const [mood, setMood] = useState<TintMood>(cheer ? 'happy' : 'idle');
	useEffect(() => {
		const move = (e: PointerEvent) => {
			const r = ref.current?.getBoundingClientRect();
			if (!r) return;
			const dx = e.clientX - (r.left + r.width / 2);
			const dy = e.clientY - (r.top + r.height / 2);
			const len = Math.hypot(dx, dy) || 1;
			const k = Math.min(1, len / 160);
			setLook({ x: (dx / len) * k, y: (dy / len) * k });
		};
		window.addEventListener('pointermove', move);
		return () => window.removeEventListener('pointermove', move);
	}, []);
	return (
		<button
			ref={ref}
			type="button"
			className="title-tint"
			aria-label="Tint, the paint drop. Tap to change color."
			onClick={() => {
				setColor((c) => (c + 1) % 8);
				setMood('wow');
				audio.step(color + 1, 4);
				window.setTimeout(() => setMood('idle'), 600);
			}}
		>
			<Tint color={color} mood={mood} size={92} look={look} />
		</button>
	);
}

interface TitleProps {
	data: SaveData;
	today: string;
	onToday: () => void;
	onWeek: () => void;
	onPractice: () => void;
	onRules: () => void;
	onShop: () => void;
	onSettings: () => void;
	onInstall?: () => void;
	onEndless: () => void;
}

export function Title(props: TitleProps) {
	const { data, today } = props;
	const level = levelOfDay(today);
	const id = `daily-${today}`;
	const done = data.finished[id];
	const going = data.games[id];
	const streak = liveStreak(data, today);
	return (
		<main className="menu title">
			<div className="top-row">
				<CoinChip coins={data.coins} />
				<button type="button" className="icon-btn" onClick={props.onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</div>
			<div className="hero">
				<TitleTint cheer={!!done} />
				<Logo />
				<p className="tagline">Join every color. Fill every square.</p>
			</div>

			<button type="button" className={`today-card${done ? ' done' : ''}`} onClick={props.onToday}>
				<span className="today-top">
					<span className="eyebrow">Today · {dayLabel(today)}</span>
					{streak > 0 && <span className="streak">{streak}-day streak</span>}
				</span>
				<span className="today-main">
					<b>{LEVEL_NAME[level]}</b>
					<span className="size">{sizeText(level)}</span>
				</span>
				<span className="today-cta">{done ? `Solved in ${formatTime(done.time)} · Play again` : going ? 'Continue' : 'Play'}</span>
			</button>

			<nav className="menu-grid">
				<button type="button" className="tile-btn" onClick={props.onWeek}>
					<Icon name="calendar" />
					<b>This week</b>
					<span>Catch up</span>
				</button>
				<button type="button" className="tile-btn" onClick={props.onPractice}>
					<Icon name="grid" />
					<b>Practice</b>
					<span>Any size</span>
				</button>
				<button type="button" className="tile-btn" onClick={props.onEndless}>
					<Icon name="infinity" />
					<b>Endless</b>
					<span>Clock or road</span>
				</button>
				<button type="button" className="tile-btn" onClick={props.onShop}>
					<Icon name="shop" />
					<b>Shop</b>
					<span>Looks and sounds</span>
				</button>
			</nav>

			<div className="foot-row">
				<button type="button" className="btn ghost" onClick={props.onRules}>
					<Icon name="book" size={18} /> How to play
				</button>
				{props.onInstall && (
					<button type="button" className="btn ghost" onClick={props.onInstall}>
						<Icon name="download" size={18} /> Install
					</button>
				)}
				<a className="btn ghost" href="../">
					<Icon name="home" size={18} /> Arcade
				</a>
			</div>
		</main>
	);
}

function Screen({ title, onBack, children, right }: { title: string; onBack: () => void; children: ReactNode; right?: ReactNode }) {
	return (
		<main className="menu page">
			<header className="bar">
				<button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
					<Icon name="back" />
				</button>
				<div className="bar-title">
					<b>{title}</b>
				</div>
				{right}
			</header>
			{children}
		</main>
	);
}

export function Week({ data, today, onPlay, onBack }: { data: SaveData; today: string; onPlay: (day: string) => void; onBack: () => void }) {
	const days = weekOf(today);
	return (
		<Screen title="This week" onBack={onBack}>
			<p className="lead">Monday starts small. Each day grows, up to the big Sunday board. Only today’s puzzle counts for your streak.</p>
			<ol className="list">
				{days.map((day) => {
					const level = levelOfDay(day);
					const done = data.finished[`daily-${day}`];
					const going = data.games[`daily-${day}`];
					const future = day > today;
					return (
						<li key={day}>
							<button type="button" className={`row-btn${done ? ' done' : ''}${day === today ? ' now' : ''}`} disabled={future} onClick={() => onPlay(day)}>
								<span className="row-day">
									<b>{day === today ? 'Today' : dayLabel(day).split(' ')[0]}</b>
									<span>{dayLabel(day).split(' ').slice(1).join(' ')}</span>
								</span>
								<span className="row-mid">
									<b>{LEVEL_NAME[level]}</b>
									<span>{sizeText(level)}</span>
								</span>
								<span className="row-end">{future ? <Icon name="lock" size={18} /> : done ? <><Icon name="check" size={18} /> {formatTime(done.time)}</> : going ? 'Continue' : 'Play'}</span>
							</button>
						</li>
					);
				})}
			</ol>
		</Screen>
	);
}

export function Practice({ data, onPlay, onBack }: { data: SaveData; onPlay: (l: Level) => void; onBack: () => void }) {
	return (
		<Screen title="Practice" onBack={onBack}>
			<p className="lead">As many puzzles as you like. Pick a size.</p>
			<ol className="list">
				{LEVELS.map((l) => {
					const n = data.practice[l];
					const best = data.records[l][0];
					const going = data.games[`practice-${l}-${n}`];
					return (
						<li key={l}>
							<button type="button" className="row-btn level" onClick={() => onPlay(l)}>
								<span className="row-size" aria-hidden="true" style={{ ['--n' as string]: LEVEL_SHAPE[l].size }}>
									{sizeText(l)}
								</span>
								<span className="row-mid">
									<b>{LEVEL_NAME[l]}</b>
									<span>{LEVEL_BLURB[l]}</span>
								</span>
								<span className="row-end">
									<span>{going ? 'Continue' : `#${n + 1}`}</span>
									{best && <small>Best {formatTime(best.time)}</small>}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</Screen>
	);
}

export function Rules({ onBack }: { onBack: () => void }) {
	return (
		<Screen title="How to play" onBack={onBack}>
			<section className="prose">
				<h2>The rules</h2>
				<ul>
					<li>Each color has two dots. Draw a line to join them.</li>
					<li>Lines can't cross or share a square.</li>
					<li>Fill every square on the board to win.</li>
				</ul>
				<h2>Drawing</h2>
				<ul>
					<li>Drag from a dot. Drag back to shorten the line.</li>
					<li>Draw over another line to cut it. If you pull back before you let go, it comes back.</li>
					<li>Drag from the middle of a line to change it from there. Tap a dot to clear its line.</li>
				</ul>
				<h2>Endless</h2>
				<ul>
					<li>Clock run: solve boards before time runs out. Each one adds time, and they grow.</li>
					<li>Road trip: the red line is the road. It leaves on the right, and the next board starts there. No clock.</li>
				</ul>
				<h2>Coins</h2>
				<p>Every solved puzzle earns coins. You get more for bigger boards, no hints, perfect lines (each color drawn in one go), a new best time and your daily streak. Spend them in the shop.</p>
				<h2>Keys</h2>
				<p>Arrows move. Space or Enter picks up a line and drops it. Z undoes, H gives a hint, Esc goes back.</p>
			</section>
		</Screen>
	);
}

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
	return (
		<label className="setting toggle">
			<span>
				{label}
				{hint && <small>{hint}</small>}
			</span>
			<input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
		</label>
	);
}

interface SettingsProps {
	settings: Settings;
	onChange: (s: Settings) => void;
	onClose: () => void;
	onShop: () => void;
	onTutorial: () => void;
	onWipe: () => void;
}

export function SettingsModal({ settings: s, onChange, onClose, onShop, onTutorial, onWipe }: SettingsProps) {
	const [wipeAsk, setWipeAsk] = useState(false);
	const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...s, [k]: v });
	return (
		<div className="sheet-back" data-layer onClick={onClose}>
			<div className="sheet settings" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
				<header className="sheet-head">
					<h2>Settings</h2>
					<button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
						<Icon name="close" />
					</button>
				</header>
				<label className="setting">
					<span>Sounds</span>
					<input type="range" min={0} max={1} step={0.05} value={s.sound} onChange={(e) => set('sound', Number(e.target.value))} />
				</label>
				<label className="setting">
					<span>Music</span>
					<input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => set('music', Number(e.target.value))} />
				</label>
				<Toggle label="Timer" on={s.showTimer} onChange={(v) => set('showTimer', v)} />
				<Toggle label="Dot marks" hint="A symbol on each dot" on={s.dotMarks} onChange={(v) => set('dotMarks', v)} />
				<Toggle label="Tint squares" hint="Color the squares a line fills" on={s.fillTint} onChange={(v) => set('fillTint', v)} />
				<Toggle label="Vibration" on={s.haptics} onChange={(v) => set('haptics', v)} />
				<label className="setting">
					<span>Motion</span>
					<select value={s.motion} onChange={(e) => set('motion', e.target.value as Settings['motion'])}>
						<option value="auto">Follow device</option>
						<option value="full">Full</option>
						<option value="reduced">Calm</option>
					</select>
				</label>
				<div className="row wrap">
					<button type="button" className="btn" onClick={onShop}>
						<Icon name="shop" size={18} /> Shop
					</button>
					<button type="button" className="btn" onClick={onTutorial}>
						Show tips again
					</button>
				</div>
				{wipeAsk ? (
					<div className="danger">
						<p>Delete all progress, coins and shop items? This can't be undone.</p>
						<div className="row">
							<button type="button" className="btn" onClick={() => setWipeAsk(false)}>
								Keep it
							</button>
							<button type="button" className="btn bad" onClick={onWipe}>
								Delete
							</button>
						</div>
					</div>
				) : (
					<button type="button" className="btn ghost small-text" onClick={() => setWipeAsk(true)}>
						Reset all progress
					</button>
				)}
			</div>
		</div>
	);
}
