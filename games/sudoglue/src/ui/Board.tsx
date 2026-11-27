/**
 * The window: a 4×4 grid of tiles. Plain HTML, so the theme and tile style are
 * all CSS. A screen reader reads it as a grid; arrow keys move the picked tile.
 */
import type { ReactNode } from 'react';
import { forwardRef, memo } from 'react';
import { cellName, colOf, rowOf } from '../core/grid.ts';
import type { Board as BoardData } from '../core/types.ts';
import { COLOR_NAMES } from '../core/words.ts';
import { Shape } from './bits.tsx';

export interface Marks {
	target: number;
	focus: number[];
	blockers: number[];
	ruled: number[];
	/** Tiles to flash (a reason the player is pointing at). */
	flash: number[];
}

/** Why a tile's face last changed, so it plays the right little animation. */
export type FaceAnim = '' | 'num' | 'color' | 'full' | 'erase' | 'hint';

export interface Face {
	bump: number;
	anim: FaceAnim;
}

interface Props {
	board: BoardData;
	givens: BoardData;
	noteNum: number[];
	noteColor: number[];
	sel: number;
	showSel: boolean;
	clashes: Set<number>;
	helpers: boolean;
	marks: Marks | null;
	faces: Face[];
	shake: number[];
	solved: boolean;
	onTap: (cell: number) => void;
	onFocusCell: (cell: number) => void;
	children?: ReactNode;
}

function describe(b: BoardData, givens: BoardData, i: number): string {
	const n = b.num[i];
	const c = b.color[i];
	const parts = [cellName(i)];
	if (n < 0 && c < 0) parts.push('empty');
	if (n >= 0) parts.push(`${n + 1}${givens.num[i] >= 0 ? ', clue' : ''}`);
	if (c >= 0) parts.push(`${COLOR_NAMES[c]}${givens.color[i] >= 0 ? ', clue' : ''}`);
	return parts.join(', ');
}

export const Board = memo(
	forwardRef<HTMLDivElement, Props>(function Board(p, ref) {
		const { board, sel, marks } = p;
		const selN = board.num[sel];
		const selC = board.color[sel];

		return (
			<div className={`board${p.solved ? ' solved' : ''}${marks ? ' hinting' : ''}`} ref={ref}>
				<div className="labels cols" aria-hidden="true">
					{'ABCD'.split('').map((l) => (
						<span key={l}>{l}</span>
					))}
				</div>
				<div className="labels rows" aria-hidden="true">
					{[1, 2, 3, 4].map((l) => (
						<span key={l}>{l}</span>
					))}
				</div>
				<div className="tiles" role="grid" aria-label="The window, 4 rows of 4 tiles">
					{[0, 1, 2, 3].map((r) => (
						<div role="row" key={r} className="trow">
							{[0, 1, 2, 3].map((col) => {
								const i = r * 4 + col;
								const n = board.num[i];
								const c = board.color[i];
								const lockN = p.givens.num[i] >= 0;
								const lockC = p.givens.color[i] >= 0;
								const isSel = p.showSel && i === sel && !p.solved;
								const peer = p.helpers && p.showSel && !p.solved && i !== sel && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel));
								const match = p.helpers && p.showSel && !p.solved && i !== sel && selN >= 0 && n === selN;
								const matchC = p.helpers && p.showSel && !p.solved && i !== sel && selC >= 0 && c === selC;
								const face = p.faces[i];
								const cls = [
									'tile',
									c >= 0 ? `k${c}` : 'blank',
									isSel && 'sel',
									peer && 'peer',
									match && 'match',
									matchC && 'match-c',
									p.clashes.has(i) && 'clash',
									p.shake.includes(i) && 'shake',
									lockC && 'lock-c',
									marks && marks.target === i && 'h-target',
									marks && marks.focus.includes(i) && i !== marks.target && 'h-focus',
									marks && marks.blockers.includes(i) && 'h-block',
									marks && marks.ruled.includes(i) && 'h-ruled',
									marks && marks.flash.includes(i) && 'h-flash',
								]
									.filter(Boolean)
									.join(' ');
								return (
									<button
										key={i}
										role="gridcell"
										className={cls}
										data-cell={i}
										tabIndex={i === sel ? 0 : -1}
										aria-selected={i === sel}
										aria-label={describe(board, p.givens, i)}
										style={{ ['--d' as string]: r + col }}
										onPointerDown={(e) => {
											if (e.button !== 0) return;
											e.preventDefault();
											p.onTap(i);
										}}
										onKeyDown={(e) => {
											if (e.key === 'Enter') p.onTap(i);
										}}
										onFocus={() => i !== sel && p.onFocusCell(i)}
									>
										<span key={face.bump} className={`face anim-${face.anim}`}>
											<span className="glass" />
											{n >= 0 && <span className={`num${lockN ? ' given' : ''}`}>{n + 1}</span>}
											{n < 0 && c < 0 && (p.noteNum[i] || p.noteColor[i]) ? (
												<span className="notes" aria-hidden="true">
													<span>
														{[0, 1, 2, 3].map((v) => (
															<i key={v}>{p.noteNum[i] & (1 << v) ? v + 1 : ''}</i>
														))}
													</span>
													<span>
														{[0, 1, 2, 3].map((v) => (
															<b key={v} className={p.noteColor[i] & (1 << v) ? `nd k${v}` : 'nd off'}>
																<Shape c={v} />
															</b>
														))}
													</span>
												</span>
											) : null}
											{lockC && <span className="pin" aria-hidden="true" />}
											{c >= 0 && <Shape c={c} />}
										</span>
										{marks && marks.ruled.includes(i) && (
											<span className="badge ruled" aria-hidden="true">
												✕
											</span>
										)}
										{marks && marks.blockers.includes(i) && (
											<span className="badge block" aria-hidden="true">
												!
											</span>
										)}
									</button>
								);
							})}
						</div>
					))}
					{p.children}
				</div>
			</div>
		);
	}),
);
