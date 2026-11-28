/**
 * Tint: a little drop of paint who keeps you company. Tint takes on the color
 * you are drawing, cheers when a line links, and dozes when you wander off.
 */
export type TintMood = 'idle' | 'draw' | 'happy' | 'sleepy' | 'wow';

export function Tint({ color = -1, mood = 'idle', size = 64, look = { x: 0, y: 0 } }: { color?: number; mood?: TintMood; size?: number; look?: { x: number; y: number } }) {
	const fill = color >= 0 ? `var(--c${color})` : 'var(--tint-body)';
	const ex = look.x * 1.6;
	const ey = look.y * 1.4;
	return (
		<svg className={`tint tint-${mood}`} viewBox="0 0 64 72" width={size} height={size * 1.125} aria-hidden="true">
			<ellipse cx="32" cy="68" rx="17" ry="3.2" className="tint-floor" />
			<g className="tint-body">
				<path d="M32 4 C 40 16 54 28 54 44 C 54 57 44 66 32 66 C 20 66 10 57 10 44 C 10 28 24 16 32 4 Z" fill={fill} className="tint-skin" />
				<path d="M32 4 C 40 16 54 28 54 44 C 54 57 44 66 32 66 C 20 66 10 57 10 44 C 10 28 24 16 32 4 Z" className="tint-edge" />
				<ellipse cx="22" cy="34" rx="4.5" ry="7" className="tint-shine" transform="rotate(24 22 34)" />
				<ellipse cx="18" cy="52" rx="4.2" ry="2.6" className="tint-blush" />
				<ellipse cx="46" cy="52" rx="4.2" ry="2.6" className="tint-blush" />
				{mood === 'happy' || mood === 'sleepy' ? (
					<>
						<path d={mood === 'happy' ? 'M21 46 Q 25 41 29 46' : 'M21 46 Q 25 48 29 46'} className="tint-lid" />
						<path d={mood === 'happy' ? 'M35 46 Q 39 41 43 46' : 'M35 46 Q 39 48 43 46'} className="tint-lid" />
					</>
				) : (
					<g className="tint-eyes">
						<ellipse cx={25 + ex} cy={45 + ey} rx={mood === 'wow' ? 4.4 : 3.8} ry={mood === 'wow' ? 5.2 : 4.6} className="tint-eye" />
						<ellipse cx={39 + ex} cy={45 + ey} rx={mood === 'wow' ? 4.4 : 3.8} ry={mood === 'wow' ? 5.2 : 4.6} className="tint-eye" />
						<circle cx={26.3 + ex} cy={43.4 + ey} r="1.3" className="tint-glint" />
						<circle cx={40.3 + ex} cy={43.4 + ey} r="1.3" className="tint-glint" />
					</g>
				)}
				{mood === 'wow' ? <ellipse cx="32" cy="56" rx="2.6" ry="3" className="tint-mouth-o" /> : <path d={mood === 'happy' ? 'M27 54 Q 32 60 37 54' : mood === 'sleepy' ? 'M29 56 Q 32 57 35 56' : 'M28.5 55 Q 32 58 35.5 55'} className="tint-mouth" />}
			</g>
			{mood === 'sleepy' && (
				<text x="50" y="18" className="tint-z">
					z
				</text>
			)}
		</svg>
	);
}
