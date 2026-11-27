/** The stained-glass window: the 4×4 board, drawn as one SVG. */
import { memo, useMemo } from 'react';
import { CELLS, LINES, cellName, colOf, rowOf } from '../core/grid.ts';
import type { Board } from '../core/types.ts';
import { COLOR_NAMES } from '../core/words.ts';
import { ARCH_INNER, ARCH_OUTER, CORAL, CREAM, GLASS, GOLD, INK, LIGHT, ROSE, WIN, cellBox, crackPath, paneShape } from './art.ts';
import { NumeralPath } from './bits.tsx';

export interface Marks {
	target: number;
	focus: number[];
	blockers: number[];
	ruled: number[];
	/** Tiles to flash (a reason the player is pointing at). */
	flash: number[];
}

interface Props {
	board: Board;
	givens: Board;
	noteNum: number[];
	noteColor: number[];
	sel: number;
	showSel: boolean;
	clashes: Set<number>;
	helpers: boolean;
	marks: Marks | null;
	/** Per-tile counters; a change replays the "glued in" squish. */
	bumps: number[];
	/** Lines catching the light right now: [id, line index]. */
	sweeps: [number, number][];
	shake: number[];
	solved: boolean;
	motion: boolean;
	litLines: number[];
	onTap: (cell: number) => void;
	onFocusCell: (cell: number) => void;
}

const SHAPES = Array.from({ length: CELLS }, (_, i) => paneShape(i));
const NOTE_X = [-22, -7.5, 7.5, 22];

function Pane({ i, props }: { i: number; props: Props }) {
	const { board, givens, noteNum, noteColor, clashes } = props;
	const n = board.num[i];
	const c = board.color[i];
	const lockedNum = givens.num[i] >= 0;
	const lockedColor = givens.color[i] >= 0;
	const { d, corners } = SHAPES[i];
	const { cx, cy } = cellBox(i);
	const empty = n < 0 && c < 0;
	const clash = props.clashes.has(i) && clashes.size > 0;
	return (
		<g className={`pane${props.shake.includes(i) ? ' shake' : ''}`} style={{ transformOrigin: `${cx}px ${cy}px` }}>
			<g key={props.bumps[i]} className={props.bumps[i] && props.motion ? 'squish' : ''} style={{ transformOrigin: `${cx}px ${cy}px` }}>
				{empty ? (
					<>
						<path d={d} fill={LIGHT} />
						<path d={d} fill="none" stroke={INK} strokeOpacity="0.28" strokeWidth="2" strokeDasharray="5 6" />
						{/* A few old shards still stuck in the corners. */}
						<path
							d={`M ${corners[0][0]} ${corners[0][1]} l 16 1 l -14 13 Z M ${corners[2][0]} ${corners[2][1]} l -15 -1 l 12 -12 Z`}
							fill="#dbe7e3"
							stroke={INK}
							strokeWidth="1.6"
							strokeLinejoin="round"
							opacity="0.85"
						/>
					</>
				) : (
					<>
						<path d={d} fill={c >= 0 ? GLASS[c].base : 'url(#clear-glass)'} />
						{c >= 0 && <path d={d} fill={`url(#pat-${c})`} />}
						<path d={d} fill="url(#sheen)" />
						<path d={d} fill="none" stroke={c >= 0 ? GLASS[c].deep : '#b9c9c4'} strokeWidth="2.5" opacity="0.7" />
						{/* Glass you set yourself is held with glue: a glossy bead and one drip. */}
						{c >= 0 && !lockedColor && (
							<>
								<path d={d} fill="none" stroke="#fffdf4" strokeWidth="3.2" strokeOpacity="0.65" strokeDasharray="22 5 9 4" />
								<path
									d={`M ${(corners[3][0] + corners[2][0]) / 2 + 6} ${(corners[3][1] + corners[2][1]) / 2 - 1} c 0 4 -1 7 0 8 c 1.5 1.5 3 0 2.8 -2 c -0.2 -2 -1 -4 -0.8 -6 Z`}
									fill="#fffdf4"
									opacity="0.85"
									stroke={INK}
									strokeWidth="1"
								/>
							</>
						)}
						{/* Original glass is set in lead: rivets in the corners. */}
						{lockedColor &&
							corners.map(([x, y], k) => (
								<circle key={k} cx={x + (k === 0 || k === 3 ? 6 : -6)} cy={y + (k < 2 ? 6 : -6)} r="2.8" fill={INK} stroke={CREAM} strokeWidth="1" />
							))}
					</>
				)}
				{/* A crack shows a tile that breaks a rule. It sits under the number, so the number stays readable. */}
				{clash && (
					<g className="crack">
						<path d={crackPath(i)} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
						<path d={crackPath(i)} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
					</g>
				)}
				{n >= 0 && (
					<g className="medal">
						<circle cx={cx} cy={cy} r="19.5" fill={lockedNum ? INK : CREAM} stroke={INK} strokeWidth="3" />
						<NumeralPath v={n} x={cx} y={cy} scale={0.78} color={lockedNum ? CREAM : INK} width={4.4} />
					</g>
				)}
				{/* Pencil notes: numbers along the top, colors along the bottom. */}
				{n < 0 &&
					[0, 1, 2, 3].map((v) =>
						noteNum[i] & (1 << v) ? <NumeralPath key={`n${v}`} v={v} x={cx + NOTE_X[v]} y={cy - 21} scale={0.36} width={2.7} /> : null,
					)}
				{c < 0 &&
					[0, 1, 2, 3].map((v) =>
						noteColor[i] & (1 << v) ? (
							<g key={`c${v}`}>
								<rect x={cx + NOTE_X[v] - 6.5} y={cy + 14} width="13" height="13" rx="3" fill={GLASS[v].base} stroke={INK} strokeWidth="1.8" />
								<rect x={cx + NOTE_X[v] - 6.5} y={cy + 14} width="13" height="13" rx="3" fill={`url(#pat-${v})`} />
							</g>
						) : null,
					)}
			</g>
		</g>
	);
}

function describe(board: Board, givens: Board, i: number): string {
	const n = board.num[i];
	const c = board.color[i];
	const parts = [cellName(i)];
	parts.push(n >= 0 ? `number ${n + 1}${givens.num[i] >= 0 ? ' (set)' : ''}` : 'no number');
	parts.push(c >= 0 ? `${COLOR_NAMES[c]}${givens.color[i] >= 0 ? ' (set)' : ''}` : 'no color');
	return parts.join(', ');
}

export const Window = memo(function Window(props: Props) {
	const { board, sel, marks, helpers, solved } = props;
	const selN = board.num[sel];
	const selC = board.color[sel];

	// Rose window petals light up when every pane of that color is in and clean.
	const petals = useMemo(
		() => [0, 1, 2, 3].map((k) => board.color.filter((v) => v === k).length === 4 && !board.color.some((v, i) => v === k && props.clashes.has(i))),
		[board, props.clashes],
	);

	return (
		<svg
			className={`window${solved ? ' solved' : ''}`}
			viewBox={`0 0 ${WIN.w} ${WIN.h}`}
			role="grid"
			aria-label="The window: 4 rows of 4 panes"
		>
			<defs>
				{props.sweeps.map(([id, li]) => (
					<clipPath id={`line-${id}`} key={id}>
						{LINES[li].cells.map((c) => (
							<path key={c} d={SHAPES[c].d} />
						))}
					</clipPath>
				))}
				<clipPath id="all-glass">
					{SHAPES.map((s, i) => (
						<path key={i} d={s.d} />
					))}
				</clipPath>
				<linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor={GLASS[0].light} />
					<stop offset="0.33" stopColor={GLASS[2].light} />
					<stop offset="0.66" stopColor={GLASS[3].light} />
					<stop offset="1" stopColor={GLASS[1].light} />
					{props.motion && <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="6s" repeatCount="indefinite" />}
				</linearGradient>
			</defs>

			{/* Frame: wood outside, lead inside. */}
			<path d={ARCH_OUTER} fill="#9b6a45" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
			<path d="M 14 100 C 14 54 114 18 200 14" fill="none" stroke="#c48d5f" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
			<path d={ARCH_INNER} fill={INK} />

			{/* The arch head: a fan of pale glass and the rose window. */}
			{[0, 1, 2, 3, 4, 5].map((k) => {
				const a0 = Math.PI + (k / 6) * Math.PI;
				const a1 = Math.PI + ((k + 1) / 6) * Math.PI;
				const R = 150;
				const r0 = ROSE.r + 8;
				const p = (a: number, r: number) => `${(ROSE.x + Math.cos(a) * r).toFixed(1)} ${(ROSE.y + 26 + Math.sin(a) * r * 0.42).toFixed(1)}`;
				return (
					<path
						key={k}
						d={`M ${p(a0 + 0.03, r0)} L ${p(a0 + 0.03, R)} L ${p(a1 - 0.03, R)} L ${p(a1 - 0.03, r0)} Z`}
						fill={k % 2 ? '#f7ecd2' : '#efe2c2'}
						clipPath="url(#arch-head)"
						opacity="0.9"
					/>
				);
			})}
			<clipPath id="arch-head">
				<path d="M 34 86 L 34 100 C 34 64 124 36 200 32 C 276 36 366 64 366 100 L 366 86 Z" />
			</clipPath>
			<g className={`rose${solved ? ' lit' : ''}`}>
				<circle cx={ROSE.x} cy={ROSE.y} r={ROSE.r + 4} fill={INK} />
				{[0, 1, 2, 3].map((k) => {
					const a = -Math.PI / 2 + (k * Math.PI) / 2;
					const px = ROSE.x + Math.cos(a) * 11;
					const py = ROSE.y + Math.sin(a) * 11;
					return (
						<g key={k}>
							<ellipse
								cx={px}
								cy={py}
								rx="9.5"
								ry="12"
								transform={`rotate(${(k * 90).toFixed(0)} ${px} ${py})`}
								fill={petals[k] ? GLASS[k].base : '#4a3d55'}
								className={petals[k] ? 'petal on' : 'petal'}
							/>
							{petals[k] && (
								<ellipse cx={px} cy={py} rx="9.5" ry="12" transform={`rotate(${(k * 90).toFixed(0)} ${px} ${py})`} fill={`url(#pat-${k})`} />
							)}
						</g>
					);
				})}
				<circle cx={ROSE.x} cy={ROSE.y} r="5" fill={GOLD} stroke={INK} strokeWidth="2" />
			</g>

			{/* Labels: columns A–D on the sill band, rows 1–4 on the left. */}
			{[0, 1, 2, 3].map((k) => (
				<text key={`c${k}`} className="label" x={cellBox(k).cx} y={WIN.h - 16} textAnchor="middle">
					{'ABCD'[k]}
				</text>
			))}
			{[0, 1, 2, 3].map((k) => (
				<text key={`r${k}`} className="label" x={17} y={cellBox(k * 4).cy + 6} textAnchor="middle">
					{k + 1}
				</text>
			))}

			{/* The panes. */}
			{Array.from({ length: CELLS }, (_, i) => (
				<g
					key={i}
					role="gridcell"
					aria-label={describe(board, props.givens, i)}
					aria-selected={i === sel}
					tabIndex={i === sel ? 0 : -1}
					data-cell={i}
					onPointerDown={(e) => {
						e.preventDefault();
						props.onTap(i);
					}}
					onFocus={() => i !== sel && props.onFocusCell(i)}
					className="hit"
				>
					<Pane i={i} props={props} />
					<rect x={cellBox(i).x} y={cellBox(i).y} width={WIN.cell} height={WIN.cell} fill="transparent" />
				</g>
			))}

			{/* Row and column glow for helpers, and matching values. */}
			{helpers && props.showSel && !solved && (
				<g pointerEvents="none">
					{[rowOf(sel), 4 + colOf(sel)].map((li) => {
						const cells = LINES[li].cells;
						const a = cellBox(cells[0]);
						const b = cellBox(cells[3]);
						return (
							<rect
								key={li}
								x={a.x + 2}
								y={a.y + 2}
								width={b.x - a.x + WIN.cell - 4}
								height={b.y - a.y + WIN.cell - 4}
								rx="10"
								fill="none"
								stroke={GOLD}
								strokeOpacity="0.55"
								strokeWidth="3"
								strokeDasharray="2 7"
								strokeLinecap="round"
							/>
						);
					})}
					{Array.from({ length: CELLS }, (_, i) => i)
						.filter((i) => i !== sel && ((selN >= 0 && board.num[i] === selN) || (selC >= 0 && board.color[i] === selC)))
						.map((i) => {
							const { x, y } = cellBox(i);
							const same = selN >= 0 && board.num[i] === selN;
							return same ? (
								<circle key={i} cx={x + WIN.cell / 2} cy={y + WIN.cell / 2} r="24" fill="none" stroke={GOLD} strokeWidth="3.5" />
							) : (
								<circle key={i} cx={x + WIN.cell - 13} cy={y + 13} r="5" fill={GOLD} stroke={INK} strokeWidth="2" />
							);
						})}
				</g>
			)}

			{/* Light sweeping across finished rows and columns. */}
			{props.sweeps.map(([id]) => (
				<g key={id} clipPath={`url(#line-${id})`} pointerEvents="none">
					<g transform="skewX(-20)">
						<rect className="sweep" x={-160} y={0} width={150} height={WIN.h} fill="url(#sweep)" />
					</g>
				</g>
			))}

			{/* Finished lines keep a soft glint along their lead. */}
			{props.litLines.map((li) => {
				const cells = LINES[li].cells;
				const a = cellBox(cells[0]);
				const b = cellBox(cells[3]);
				return LINES[li].kind === 'row' ? (
					<path key={li} d={`M ${a.x + 10} ${a.y + 3} L ${b.x + WIN.cell - 10} ${b.y + 3}`} stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" pointerEvents="none" />
				) : (
					<path key={li} d={`M ${a.x + 3} ${a.y + 10} L ${b.x + 3} ${b.y + WIN.cell - 10}`} stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" pointerEvents="none" />
				);
			})}

			{/* Hint marks. */}
			{marks && (
				<g pointerEvents="none" className="marks">
					{marks.focus
						.filter((c) => c !== marks.target)
						.map((c) => (
							<path key={`f${c}`} d={SHAPES[c].d} fill="none" stroke={GOLD} strokeWidth="4" strokeDasharray="7 6" strokeLinecap="round" />
						))}
					{/* Ruled-out tiles: dimmed, with a small ✕ badge that leaves the pane readable. */}
					{marks.ruled.map((c) => {
						const { x, y } = cellBox(c);
						const bx = x + WIN.cell - 15;
						const by = y + 15;
						return (
							<g key={`x${c}`} opacity={marks.flash.length && !marks.flash.includes(c) ? 0.4 : 1}>
								<path d={SHAPES[c].d} fill={INK} opacity="0.22" />
								<circle cx={bx} cy={by} r="11" fill={INK} stroke={CREAM} strokeWidth="2" />
								<path d={`M ${bx - 4.5} ${by - 4.5} L ${bx + 4.5} ${by + 4.5} M ${bx + 4.5} ${by - 4.5} L ${bx - 4.5} ${by + 4.5}`} stroke={CREAM} strokeWidth="3" strokeLinecap="round" />
							</g>
						);
					})}
					{marks.blockers.map((c) => {
						const { x, y } = cellBox(c);
						const on = marks.flash.includes(c);
						return (
							<g key={`b${c}`} className={on ? 'flash' : ''}>
								<rect x={x + 3} y={y + 3} width={WIN.cell - 6} height={WIN.cell - 6} rx="12" fill="none" stroke={CORAL} strokeWidth={on ? 7 : 5} />
								<circle cx={x + 14} cy={y + 14} r="10" fill={CORAL} stroke={INK} strokeWidth="2.5" />
								<path d={`M ${x + 14} ${y + 8.5} L ${x + 14} ${y + 15} M ${x + 14} ${y + 19} L ${x + 14} ${y + 19.2}`} stroke={INK} strokeWidth="3" strokeLinecap="round" />
							</g>
						);
					})}
					{marks.target >= 0 &&
						(() => {
							const { x, y } = cellBox(marks.target);
							return (
								<g className="target">
									<rect x={x - 2} y={y - 2} width={WIN.cell + 4} height={WIN.cell + 4} rx="14" fill="none" stroke={INK} strokeWidth="9" />
									<rect x={x - 2} y={y - 2} width={WIN.cell + 4} height={WIN.cell + 4} rx="14" fill="none" stroke={GOLD} strokeWidth="5" />
								</g>
							);
						})()}
				</g>
			)}

			{/* The picked tile. */}
			{props.showSel && !solved && !(marks && marks.target === sel) && (
				<g pointerEvents="none" className="selection">
					<rect x={cellBox(sel).x - 1} y={cellBox(sel).y - 1} width={WIN.cell + 2} height={WIN.cell + 2} rx="13" fill="none" stroke={INK} strokeWidth="8" />
					<rect x={cellBox(sel).x - 1} y={cellBox(sel).y - 1} width={WIN.cell + 2} height={WIN.cell + 2} rx="13" fill="none" stroke={CREAM} strokeWidth="3.5" strokeDasharray="10 7" className="ants" />
				</g>
			)}

			{/* Solved: moving colored light over all the glass. */}
			{solved && (
				<g clipPath="url(#all-glass)" pointerEvents="none">
					<rect x="0" y="0" width={WIN.w} height={WIN.h} fill="url(#rainbow)" className="glow-light" />
				</g>
			)}
		</svg>
	);
});
