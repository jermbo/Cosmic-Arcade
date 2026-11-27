/**
 * Gloop, the workshop's glue bottle. It squeezes when you glue a pane, winces at
 * a clash, and hops when the window is mended.
 */
const INK = '#3a3340';
const CREAM = '#fffaf2';

export type Mood = 'idle' | 'squeeze' | 'worry' | 'wink' | 'cheer' | 'think';

export function Gloop({ mood, size = 64 }: { mood: Mood; size?: number }) {
	const eyes =
		mood === 'worry' ? (
			<>
				<path d="M 23 39 L 28 41 M 41 41 L 46 39" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
				<circle cx="26" cy="45" r="2.4" fill={INK} />
				<circle cx="43" cy="45" r="2.4" fill={INK} />
			</>
		) : mood === 'wink' || mood === 'cheer' ? (
			<>
				<path d="M 22.5 45 Q 26 41 29.5 45" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
				{mood === 'cheer' ? (
					<path d="M 39.5 45 Q 43 41 46.5 45" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
				) : (
					<circle cx="43" cy="44.5" r="2.8" fill={INK} />
				)}
			</>
		) : mood === 'think' ? (
			<>
				<circle cx="27" cy="43" r="2.8" fill={INK} />
				<circle cx="44" cy="43" r="2.8" fill={INK} />
			</>
		) : (
			<>
				<circle cx="26" cy="44.5" r="2.8" fill={INK} />
				<circle cx="43" cy="44.5" r="2.8" fill={INK} />
				<circle cx="27" cy="43.5" r="0.9" fill="#fff" />
				<circle cx="44" cy="43.5" r="0.9" fill="#fff" />
			</>
		);
	const mouth =
		mood === 'worry' ? (
			<path d="M 30 55 Q 34.5 51.5 39 55" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
		) : mood === 'cheer' ? (
			<path d="M 28.5 51 Q 34.5 60 40.5 51 Z" fill={INK} />
		) : mood === 'think' ? (
			<path d="M 31 54 L 38 53" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
		) : (
			<path d="M 30 52 Q 34.5 56.5 39 52" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
		);
	return (
		<svg className={`gloop mood-${mood}`} viewBox="0 0 70 80" width={size} height={(size * 80) / 70} aria-hidden="true">
			<ellipse cx="35" cy="77" rx="20" ry="3" fill={INK} opacity="0.18" />
			<g className="gloop-body">
				{/* Cap and nozzle. */}
				<path d="M 31 4 L 39 4 L 41 17 L 29 17 Z" fill="#ff8a5c" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
				<rect x="24" y="16" width="22" height="9" rx="2.5" fill="#ff8a5c" stroke={INK} strokeWidth="2.6" />
				{/* Bottle. */}
				<path d="M 18 30 C 18 25 24 24 35 24 C 46 24 52 25 52 30 L 54 68 C 54 74 48 76 35 76 C 22 76 16 74 16 68 Z" fill={CREAM} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
				{/* Label. */}
				<path d="M 17.4 36 C 28 33.5 42 33.5 52.6 36 L 53.6 61 C 42 63.5 28 63.5 16.4 61 Z" fill="#7cc8ff" stroke={INK} strokeWidth="2.2" />
				<path d="M 21 37.5 C 25 37 27 37 29 37.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
				<g>
					{eyes}
					{mouth}
				</g>
				<circle cx="21" cy="51" r="2.6" fill="#ff9aa8" opacity="0.8" />
				<circle cx="48" cy="51" r="2.6" fill="#ff9aa8" opacity="0.8" />
				{/* A drip of glue on the nozzle. */}
				<path className="gloop-drip" d="M 35 3.5 C 33.5 1 36.5 -0.5 36.3 2 C 36.2 3 35.8 3.5 35 3.5 Z" fill="#fffdf2" stroke={INK} strokeWidth="1.4" />
			</g>
		</svg>
	);
}
