/** The board: a clay tray of soft dips, with a pebble in each played square. */
import { useLayoutEffect, useRef, useState } from 'react';
import type { Side } from '../core/rules.ts';
import { squareName } from '../core/rules.ts';
import { Stone } from './bits.tsx';

/** The last move, for the drop, the ripple and the rolling flips. */
export interface MoveAnim {
	id: number;
	placed: number;
	/** Each flipped square and when it turns, in ms. */
	flips: Map<number, number>;
}

export interface Floater {
	id: number;
	at: number;
	text: string;
}

interface BoardProps {
	n: number;
	cells: number[];
	last: number;
	/** The squares the side to move can play. */
	legal: Set<number>;
	/** Show a dot on each legal square (the Move dots setting). */
	dots: boolean;
	hint: number;
	anim: MoveAnim | null;
	floaters: Floater[];
	shake: { at: number; id: number } | null;
	calm: boolean;
	/** Taps do nothing (the bot's turn, or the game is over). */
	locked: boolean;
	stoneLook: string;
	onTap: (i: number) => void;
	label: string;
}

const sideName = (s: number) => (s === 1 ? 'dark pebble' : 'light pebble');

/** The delay for each flip: they roll out from the new pebble, one ring at a time. */
export function flipDelays(n: number, placed: number, flips: number[]): Map<number, number> {
	const r0 = Math.floor(placed / n);
	const c0 = placed % n;
	return new Map(flips.map((j) => [j, 80 + (Math.max(Math.abs(Math.floor(j / n) - r0), Math.abs((j % n) - c0)) - 1) * 75]));
}

export function Board(p: BoardProps) {
	const { n, cells } = p;
	const wraps = useRef<(HTMLSpanElement | null)[]>([]);
	const buttons = useRef<(HTMLButtonElement | null)[]>([]);
	const [focus, setFocus] = useState(() => Math.floor(n / 2 - 1) * n + n / 2 - 1);

	// A small hop as each pebble turns over.
	useLayoutEffect(() => {
		if (!p.anim || p.calm) return;
		// The new pebble drops in.
		wraps.current[p.anim.placed]?.animate(
			[
				{ transform: 'translateY(-30%) scale(1.25)', opacity: 0 },
				{ transform: 'translateY(4%) scale(0.96)', opacity: 1, offset: 0.7 },
				{ transform: 'translateY(0) scale(1)', opacity: 1 },
			],
			{ duration: 320, easing: 'cubic-bezier(.3,.7,.4,1)' },
		);
		for (const [j, delay] of p.anim.flips) {
			wraps.current[j]?.animate(
				[
					{ transform: 'translateY(0) scale(1)' },
					{ transform: 'translateY(-14%) scale(1.12)', offset: 0.45 },
					{ transform: 'translateY(0) scale(1)' },
				],
				{ duration: 460, delay, easing: 'cubic-bezier(.3,.7,.4,1)' },
			);
		}
	}, [p.anim, p.calm]);

	const onKey = (e: React.KeyboardEvent, i: number) => {
		const r = Math.floor(i / n);
		const c = i % n;
		const go: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
		const d = go[e.key];
		if (!d) return;
		e.preventDefault();
		e.stopPropagation();
		const nr = Math.min(n - 1, Math.max(0, r + d[0]));
		const nc = Math.min(n - 1, Math.max(0, c + d[1]));
		const j = nr * n + nc;
		setFocus(j);
		buttons.current[j]?.focus();
	};

	return (
		<div className={`board stones-${p.stoneLook}${p.locked ? ' locked' : ''}`} style={{ ['--n' as string]: n }} role="grid" aria-label={p.label}>
			{Array.from({ length: n }, (_, r) => (
				<div className="board-row" role="row" key={r}>
					{Array.from({ length: n }, (_, c) => {
						const i = r * n + c;
						const v = cells[i];
						const legal = p.legal.has(i);
						const flipDelay = p.anim?.flips.get(i);
						const isNew = p.anim?.placed === i;
						const shaking = p.shake?.at === i;
						const label = `${squareName(n, i)}, ${v ? sideName(v) : legal ? 'empty, you can play here' : 'empty'}${i === p.last ? ', last move' : ''}${i === p.hint ? ', hint' : ''}`;
						return (
							<button
								key={i}
								ref={(el) => {
									buttons.current[i] = el;
								}}
								type="button"
								role="gridcell"
								className={`cell${legal && p.dots && !p.locked ? ' can' : ''}${shaking ? ' shake' : ''}`}
								data-shake={shaking ? p.shake!.id : undefined}
								tabIndex={i === focus ? 0 : -1}
								aria-label={label}
								onFocus={() => setFocus(i)}
								onKeyDown={(e) => onKey(e, i)}
								onClick={() => p.onTap(i)}
							>
								<span className="dip" />
								{v !== 0 && (
									<span
										className="stone-wrap"
										ref={(el) => {
											wraps.current[i] = el;
										}}
									>
										<Stone side={v as Side} delay={flipDelay ?? 0} />
										{i === p.last && <span className="last-mark" />}
									</span>
								)}
								{isNew && !p.calm && <span className="ripple" key={`r-${p.anim!.id}`} />}
								{i === p.hint && <span className="hint-ring" />}
							</button>
						);
					})}
				</div>
			))}
			<div className="floaters" aria-hidden="true">
				{p.floaters.map((f) => (
					<span key={f.id} className="floater" style={{ left: `${(((f.at % n) + 0.5) / n) * 100}%`, top: `${((Math.floor(f.at / n) + 0.5) / n) * 100}%` }}>
						{f.text}
					</span>
				))}
			</div>
		</div>
	);
}
