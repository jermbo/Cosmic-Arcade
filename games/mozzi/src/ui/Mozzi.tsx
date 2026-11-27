/**
 * Mozzi: four tiles, one of each color, with a face across them. It follows the
 * theme and the tile style, so it always matches the board.
 *
 * Mozzi watches the picked tile, wiggles when a tile is set, hops the tile of the
 * color you just used, winces at a clash, talks while it gives a hint, dozes when
 * you leave it alone, and bursts apart and back when the window is mended.
 */
export type MozziMood = 'idle' | 'happy' | 'squish' | 'wince' | 'no' | 'think' | 'talk' | 'cheer' | 'sleep';

interface Props {
	mood: MozziMood;
	/** Where the eyes look, each -1..1 (left/up to right/down). */
	look?: { x: number; y: number };
	size?: number;
	/** A tile color that hops, and a counter so the same color can hop again. */
	hop?: { color: number; n: number } | null;
	onClick?: () => void;
	label?: string;
}

export function Mozzi({ mood, look = { x: 0, y: 0 }, size = 48, hop, onClick, label }: Props) {
	const style = { ['--mz' as string]: `${size}px`, ['--lx' as string]: look.x, ['--ly' as string]: look.y };
	const body = (
		<>
			<span className="mz-body">
				{[0, 1, 2, 3].map((k) => (
					<span key={hop && hop.color === k ? `t${k}-${hop.n}` : `t${k}`} className={`mz-t k${k} t${k}${hop && hop.color === k ? ' hop' : ''}`} />
				))}
			</span>
			<span className="mz-face">
				<span className="mz-eye l">
					<i />
				</span>
				<span className="mz-eye r">
					<i />
				</span>
				<span className="mz-cheek l" />
				<span className="mz-cheek r" />
				<span className="mz-mouth" />
			</span>
		</>
	);
	if (onClick)
		return (
			<button className={`mozzi mood-${mood}`} style={style} onClick={onClick} aria-label={label ?? 'Mozzi'}>
				{body}
			</button>
		);
	return (
		<span className={`mozzi mood-${mood}`} style={style} aria-hidden="true">
			{body}
		</span>
	);
}

/** Eye direction toward a tile, seen from below the board. */
export const lookAt = (cell: number) => ({ x: ((cell % 4) - 1.5) / 1.5, y: -0.6 + (Math.floor(cell / 4) - 1.5) / 4 });
