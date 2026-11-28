/** Small shared parts: icons, the Pip chip, pebbles and the bot faces. Colors come from the theme. */
import type { BotId } from '../core/bot.ts';
import type { Side } from '../core/rules.ts';

/** Rounded line icons. */
const ICONS: Record<string, string> = {
	undo: 'M 9 8 L 4 13 L 9 18 M 4.5 13 C 10 12.5 15 12 18 14 C 21.5 16.5 20.5 21 16 21',
	bulb: 'M 9 17 C 9 14.5 6 12.5 6 9.5 C 6 6 8.8 3.5 12 3.5 C 15.2 3.5 18 6 18 9.5 C 18 12.5 15 14.5 15 17 Z M 9.5 20 L 14.5 20 M 12 7 C 10.5 7 9.3 8 9.2 9.5',
	gear: 'M 12 8.5 C 14 8.5 15.5 10 15.5 12 C 15.5 14 14 15.5 12 15.5 C 10 15.5 8.5 14 8.5 12 C 8.5 10 10 8.5 12 8.5 M 12 3 L 12 5.5 M 12 18.5 L 12 21 M 3 12 L 5.5 12 M 18.5 12 L 21 12 M 5.6 5.6 L 7.4 7.4 M 16.6 16.6 L 18.4 18.4 M 5.6 18.4 L 7.4 16.6 M 16.6 7.4 L 18.4 5.6',
	back: 'M 14 5 L 7 12 L 14 19',
	close: 'M 6 6 L 18 18 M 18 6 L 6 18',
	play: 'M 8 5 L 18 12 L 8 19 Z',
	reset: 'M 18.5 9 C 17 6 14.5 4.5 11.5 4.5 C 7.5 4.5 4.5 7.8 4.5 12 C 4.5 16.2 7.8 19.5 12 19.5 C 15.5 19.5 18.4 17.2 19.2 14 M 19 4 L 18.8 9.2 L 13.8 8.8',
	book: 'M 4 5.5 C 7 4.5 10 5 12 6.5 C 14 5 17 4.5 20 5.5 L 20 19 C 17 18 14 18.5 12 20 C 10 18.5 7 18 4 19 Z M 12 6.5 L 12 20',
	home: 'M 4 11 L 12 4.5 L 20 11 M 6.5 9.5 L 6.5 19.5 L 17.5 19.5 L 17.5 9.5 M 10 19.5 L 10 14 L 14 14 L 14 19.5',
	shop: 'M 4.5 9 L 6 4.5 L 18 4.5 L 19.5 9 C 19.5 10.5 18 11.5 16.5 11.5 C 15 11.5 14 10.5 14 9 C 14 10.5 13 11.5 12 11.5 C 11 11.5 10 10.5 10 9 C 10 10.5 9 11.5 7.5 11.5 C 6 11.5 4.5 10.5 4.5 9 Z M 6 11.5 L 6 19.5 L 18 19.5 L 18 11.5 M 10 19.5 L 10 15 L 14 15 L 14 19.5',
	lock: 'M 6.5 11 L 17.5 11 L 17.5 20 L 6.5 20 Z M 9 11 L 9 8 C 9 6 10.3 4.5 12 4.5 C 13.7 4.5 15 6 15 8 L 15 11',
	grid: 'M 4.5 4.5 L 10.5 4.5 L 10.5 10.5 L 4.5 10.5 Z M 13.5 4.5 L 19.5 4.5 L 19.5 10.5 L 13.5 10.5 Z M 4.5 13.5 L 10.5 13.5 L 10.5 19.5 L 4.5 19.5 Z M 13.5 13.5 L 19.5 13.5 L 19.5 19.5 L 13.5 19.5 Z',
	check: 'M 5 12.5 L 10 17.5 L 19 7',
	download: 'M 12 4 L 12 15 M 7.5 10.5 L 12 15 L 16.5 10.5 M 5 19.5 L 19 19.5',
	speaker: 'M 4.5 9.5 L 8 9.5 L 12.5 5.5 L 12.5 18.5 L 8 14.5 L 4.5 14.5 Z M 15.5 9 C 17 10.5 17 13.5 15.5 15 M 18 6.5 C 21 9.5 21 14.5 18 17.5',
	pip: 'M 12 5 C 16.8 5 19.5 8.6 19.5 12.6 C 19.5 16.6 16.3 19 12 19 C 7.7 19 4.5 16.6 4.5 12.6 C 4.5 8.6 7.2 5 12 5 M 9 9.5 C 9.8 8.6 11 8.2 12.2 8.3',
	people: 'M 8.5 11 C 10.2 11 11.5 9.7 11.5 8 C 11.5 6.3 10.2 5 8.5 5 C 6.8 5 5.5 6.3 5.5 8 C 5.5 9.7 6.8 11 8.5 11 M 3.5 19 C 3.5 15.8 5.7 13.5 8.5 13.5 C 11.3 13.5 13.5 15.8 13.5 19 M 16 11 C 17.4 11 18.5 9.9 18.5 8.5 C 18.5 7.1 17.4 6 16 6 M 15.5 13.6 C 18.3 13.8 20.5 16 20.5 19',
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="icon">
			<path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/** A tiny pebble: the Pip. */
export function PipIcon({ size = 18 }: { size?: number }) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="pip-icon">
			<path d="M 12 4.5 C 17.2 4.5 20.5 8.2 20.5 12.8 C 20.5 17 17 19.8 12 19.8 C 7 19.8 3.5 17 3.5 12.8 C 3.5 8.2 6.8 4.5 12 4.5 Z" className="pip-body" />
			<path d="M 8.2 9.6 C 9.2 8.4 10.6 7.9 12 8" className="pip-shine" />
		</svg>
	);
}

export function PipChip({ pips, extra }: { pips: number; extra?: number }) {
	return (
		<span className="coin-chip pip-chip" aria-label={`${pips} pips${extra ? `, ${extra} more this game` : ''}`}>
			<PipIcon /> {pips}
			{!!extra && <span className="pip-extra">+{extra}</span>}
		</span>
	);
}

/** One pebble, with a dark face and a light face. It turns over to change side. */
export function Stone({ side, delay = 0, className = '' }: { side: Side; delay?: number; className?: string }) {
	return (
		<span className={`stone side-${side} ${className}`} style={{ ['--d' as string]: `${delay}ms` }}>
			<span className="face f1" />
			<span className="face f2" />
		</span>
	);
}

export type Mood = 'idle' | 'think' | 'happy' | 'sad';

/** Each bot is a pebble with a face. */
export function BotFace({ bot, mood = 'idle', size = 44 }: { bot: BotId; mood?: Mood; size?: number }) {
	const eyes =
		bot === 'sleepy' || mood === 'happy' ? (
			<>
				<path d="M 15 25 Q 18.5 28 22 25" className="bf-line" />
				<path d="M 30 25 Q 33.5 28 37 25" className="bf-line" />
			</>
		) : (
			<>
				<ellipse cx="18.5" cy="25" rx="2.6" ry={bot === 'sharp' ? 2.6 : 3.1} className="bf-eye" />
				<ellipse cx="33.5" cy="25" rx="2.6" ry={bot === 'sharp' ? 2.6 : 3.1} className="bf-eye" />
				<circle cx="19.4" cy="24" r="0.9" className="bf-glint" />
				<circle cx="34.4" cy="24" r="0.9" className="bf-glint" />
			</>
		);
	const mouth =
		mood === 'sad' ? <path d="M 22 35.5 Q 26 32.5 30 35.5" className="bf-line" /> : bot === 'sharp' ? <path d="M 22 33 Q 27 36 31 32" className="bf-line" /> : mood === 'think' ? <circle cx="26" cy="34" r="1.8" className="bf-eye" /> : <path d="M 22 32.5 Q 26 36.5 30 32.5" className="bf-line" />;
	return (
		<svg viewBox="0 0 52 48" width={size} height={(size * 48) / 52} aria-hidden="true" className={`bot-face bot-${bot} mood-${mood}`}>
			<ellipse cx="26" cy="44" rx="17" ry="2.6" className="bf-shadow" />
			<path d="M 26 6 C 39 6 47 14 47 25.5 C 47 36 38.5 42 26 42 C 13.5 42 5 36 5 25.5 C 5 14 13 6 26 6 Z" className="bf-body" />
			<path d="M 13 15.5 C 15.5 12 19 10.5 23 10.5" className="bf-shine" />
			<ellipse cx="13.5" cy="31" rx="3.6" ry="2.2" className="bf-cheek" />
			<ellipse cx="38.5" cy="31" rx="3.6" ry="2.2" className="bf-cheek" />
			{eyes}
			{bot === 'sharp' && (
				<>
					<path d="M 14.5 19.5 L 21.5 21" className="bf-line" />
					<path d="M 37.5 19.5 L 30.5 21" className="bf-line" />
				</>
			)}
			{mouth}
			{bot === 'sleepy' && mood !== 'happy' && <text x="41" y="12" className="bf-z">z</text>}
		</svg>
	);
}

/** Two pebbles side by side: pass and play. */
export function PairFace({ size = 44 }: { size?: number }) {
	return (
		<span className="pair-face" style={{ width: size, height: size }} aria-hidden="true">
			<Stone side={1} />
			<Stone side={2} />
		</span>
	);
}
