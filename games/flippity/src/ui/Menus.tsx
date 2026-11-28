/** Title, new game, how to play, and settings. */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { audio } from '../app/audio.ts';
import type { Opponent } from '../app/game.ts';
import type { SaveData, Settings, Setup } from '../app/save.ts';
import { BOT_NAME } from '../app/save.ts';
import { EARN, HELP } from '../app/shop.ts';
import type { BotId } from '../core/bot.ts';
import { BOT_IDS } from '../core/bot.ts';
import type { Side, Size } from '../core/rules.ts';
import { SIZES, count } from '../core/rules.ts';
import { BotFace, Icon, PairFace, PipChip, Stone } from './bits.tsx';

export const BOT_BLURB: Record<BotId, string> = {
	sleepy: 'Half awake. Plays almost any move.',
	steady: 'Thinks one move ahead. Loves corners.',
	sharp: 'Looks far ahead. Plays the end exactly.',
};

const SIZE_BLURB: Record<Size, string> = { 6: 'Quick', 8: 'Classic', 10: 'Long' };

/** The logo: the word, with a pebble for the dot of each i. The two dots take turns to flip. */
function Logo({ calm }: { calm: boolean }) {
	const [flip, setFlip] = useState(false);
	useEffect(() => {
		if (calm) return;
		const id = window.setInterval(() => setFlip((f) => !f), 2600);
		return () => clearInterval(id);
	}, [calm]);
	const dot = (side: Side) => (
		<span className="logo-i">
			ı<Stone side={side} className="logo-dot" />
		</span>
	);
	return (
		<h1 className="logo" aria-label="Flippity">
			<span aria-hidden="true">
				Fl{dot(flip ? 2 : 1)}pp{dot(flip ? 1 : 2)}ty
			</span>
		</h1>
	);
}

/** The hero: a row of pebbles on a clay tray. A wave of flips rolls along it; tap one to flip it. */
function Hero({ calm }: { calm: boolean }) {
	const [sides, setSides] = useState<Side[]>([1, 2, 1, 2, 1]);
	const [rip, setRip] = useState<{ i: number; id: number } | null>(null);
	useEffect(() => {
		if (calm) return;
		let k = 0;
		const id = window.setInterval(() => {
			const i = k % 5;
			k++;
			setSides((s) => s.map((v, j) => (j === i ? (v === 1 ? 2 : 1) : v)) as Side[]);
			setRip({ i, id: k });
		}, 900);
		return () => clearInterval(id);
	}, [calm]);
	return (
		<div className="hero-tray stones-river" aria-hidden="true">
			{sides.map((s, i) => (
				<button
					key={i}
					type="button"
					tabIndex={-1}
					className="hero-cell"
					onClick={() => {
						setSides((all) => all.map((v, j) => (j === i ? (v === 1 ? 2 : 1) : v)) as Side[]);
						setRip({ i, id: Date.now() });
						audio.flip(i, 0);
					}}
				>
					<span className="dip" />
					<span className="stone-wrap">
						<Stone side={s} />
					</span>
					{rip?.i === i && !calm && <span className="ripple" key={rip.id} />}
				</button>
			))}
		</div>
	);
}

interface TitleProps {
	data: SaveData;
	calm: boolean;
	onContinue: () => void;
	onNew: () => void;
	onRules: () => void;
	onShop: () => void;
	onSettings: () => void;
	onInstall?: () => void;
}

export function Title(props: TitleProps) {
	const { data } = props;
	const g = data.game;
	const c = g ? count(g.cells) : null;
	return (
		<main className="menu title">
			<div className="top-row">
				<PipChip pips={data.pips} />
				<button type="button" className="icon-btn" onClick={props.onSettings} aria-label="Settings">
					<Icon name="gear" />
				</button>
			</div>
			<div className="hero">
				<Logo calm={props.calm} />
				<p className="tagline">Trap a line. Flip it over.</p>
				<Hero calm={props.calm} />
			</div>

			{g && c && (
				<button type="button" className="big-card continue" onClick={props.onContinue}>
					<span className="big-face">{g.opponent === 'pair' ? <PairFace size={52} /> : <BotFace bot={g.opponent} size={56} />}</span>
					<span className="big-text">
						<span className="eyebrow">Continue</span>
						<b>{g.opponent === 'pair' ? 'Pass and play' : `Vs ${BOT_NAME[g.opponent]}`}</b>
						<span className="muted">
							{g.n}×{g.n} · Dark {c.dark} – Light {c.light}
						</span>
					</span>
					<Icon name="play" />
				</button>
			)}

			<button type="button" className={`big-card new${g ? ' quiet' : ''}`} onClick={props.onNew}>
				<span className="big-face">
					<Stone side={1} className="big stones-river" />
				</span>
				<span className="big-text">
					<b>New game</b>
					<span className="muted">Three bots, or a friend on this phone</span>
				</span>
				<Icon name="play" />
			</button>

			<nav className="menu-grid">
				<button type="button" className="tile-btn" onClick={props.onShop}>
					<Icon name="shop" />
					<b>Shop</b>
					<span>Looks and sounds</span>
				</button>
				<button type="button" className="tile-btn" onClick={props.onRules}>
					<Icon name="book" />
					<b>How to play</b>
					<span>Rules and Pips</span>
				</button>
			</nav>

			<div className="foot-row">
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

interface SetupProps {
	data: SaveData;
	onChange: (s: Setup) => void;
	onStart: () => void;
	onBack: () => void;
}

export function NewGame({ data, onChange, onStart, onBack }: SetupProps) {
	const s = data.setup;
	const set = <K extends keyof Setup>(k: K, v: Setup[K]) => {
		audio.play('ui');
		onChange({ ...s, [k]: v });
	};
	const opponents: Opponent[] = [...BOT_IDS, 'pair'];
	return (
		<Screen title="New game" onBack={onBack} right={<PipChip pips={data.pips} />}>
			{data.game && <p className="lead warn">Starting a new game ends the one in progress. Its Pips are lost.</p>}
			<section className="pick">
				<h2 className="pick-title">Who do you play?</h2>
				<ul className="list" role="radiogroup" aria-label="Opponent">
					{opponents.map((o) => {
						const st = o === 'pair' ? null : data.stats[o];
						return (
							<li key={o}>
								<button type="button" role="radio" aria-checked={s.opponent === o} className={`row-btn opp${s.opponent === o ? ' on' : ''}`} onClick={() => set('opponent', o)}>
									<span className="opp-face">{o === 'pair' ? <PairFace size={44} /> : <BotFace bot={o} size={48} />}</span>
									<span className="row-mid">
										<b>{o === 'pair' ? 'Pass and play' : BOT_NAME[o]}</b>
										<span>{o === 'pair' ? 'Two people, one phone. No Pips.' : BOT_BLURB[o]}</span>
									</span>
									<span className="row-end">
										{st ? (
											<>
												<span>{st.wins} won</span>
												<small>Win +{EARN.win[o as BotId]}</small>
											</>
										) : (
											<Icon name="people" />
										)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</section>

			<section className="pick">
				<h2 className="pick-title">Board</h2>
				<div className="size-pick" role="radiogroup" aria-label="Board size">
					{SIZES.map((n) => (
						<button key={n} type="button" role="radio" aria-checked={s.size === n} className={`size-btn${s.size === n ? ' on' : ''}`} onClick={() => set('size', n)}>
							<span className="size-grid" style={{ ['--n' as string]: n }} aria-hidden="true" />
							<b>
								{n}×{n}
							</b>
							<span>{SIZE_BLURB[n]}</span>
						</button>
					))}
				</div>
			</section>

			{s.opponent !== 'pair' && (
				<section className="pick">
					<h2 className="pick-title">You play</h2>
					<div className="seg wide" role="group" aria-label="Who goes first">
						<button type="button" aria-pressed={s.first} onClick={() => set('first', true)}>
							<Stone side={1} className="mini stones-river" /> Dark, first
						</button>
						<button type="button" aria-pressed={!s.first} onClick={() => set('first', false)}>
							<Stone side={2} className="mini stones-river" /> Light, second
						</button>
					</div>
				</section>
			)}

			<button type="button" className="btn primary wide start-btn" onClick={onStart}>
				<Icon name="play" size={18} /> Start
			</button>
		</Screen>
	);
}

export function Rules({ onBack }: { onBack: () => void }) {
	return (
		<Screen title="How to play" onBack={onBack}>
			<section className="prose">
				<h2>The rules</h2>
				<ul>
					<li>Dark goes first. Then you take turns.</li>
					<li>Put a pebble where it traps a line of the other color between it and one of yours. The line can go across, up and down, or on a slant.</li>
					<li>Every trapped line flips to your color, in all directions at once.</li>
					<li>If you can't trap anything, you pass. The other player goes again.</li>
					<li>When nobody can move, the player with more pebbles wins.</li>
				</ul>
				<h2>Tips</h2>
				<ul>
					<li>Corners can never be flipped. Try to take them.</li>
					<li>The squares next to an empty corner often give that corner away.</li>
					<li>Many pebbles early on is not always good. Fewer moves for the other player is.</li>
				</ul>
				<h2>Pips</h2>
				<p>Against a bot, good moves earn Pips: flip 5 or more at once, flip two or more lines at once, or take a corner. A win pays more against a stronger bot, and a 10×10 win pays extra. The Pips go to you at the end of the game. Spend them in the shop.</p>
				<h2>Help</h2>
				<p>
					Each game has one free undo and one free hint. After that, an undo costs {HELP.undoPrice} Pips and a hint costs {HELP.hintPrice}. Against a bot, undo takes back the bot's move and yours. Move dots, which show every legal move, are in Settings under
					Accessibility.
				</p>
				<h2>Keys</h2>
				<p>Arrows move. Enter or Space plays. Z undoes, H gives a hint, Esc goes back.</p>
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
	onWipe: () => void;
}

export function SettingsModal({ settings: s, onChange, onClose, onShop, onWipe }: SettingsProps) {
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
				<div className="setting">
					<span>
						Style
						<small>Soft clay or bold ink</small>
					</span>
					<span className="seg" role="group" aria-label="Style">
						{(['soft', 'bold'] as const).map((st) => (
							<button key={st} type="button" aria-pressed={s.style === st} onClick={() => set('style', st)}>
								{st === 'soft' ? 'Soft' : 'Bold'}
							</button>
						))}
					</span>
				</div>
				<Toggle label="Vibration" on={s.haptics} onChange={(v) => set('haptics', v)} />

				<h3 className="setting-group">Accessibility</h3>
				<Toggle label="Move dots" hint="A soft dot on every square you can play" on={s.moveDots} onChange={(v) => set('moveDots', v)} />
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
				</div>
				{wipeAsk ? (
					<div className="danger">
						<p>Delete all progress, Pips and shop items? This can't be undone.</p>
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
