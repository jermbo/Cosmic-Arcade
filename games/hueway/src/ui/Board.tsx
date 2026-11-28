/**
 * The board: an SVG of soft squares, lines and dots. One cell is 10 units.
 * Line and dot styles are shop items: each has a case below.
 */
import type { PointerEvent as RPointerEvent, ReactNode } from 'react';
import { useRef } from 'react';
import type { Paths } from '../app/game.ts';
import type { Puzzle } from '../core/types.ts';
import { MARKS } from './bits.tsx';

const S = 10;
const PAD = 1.6;
/** The soft clay shadow under the board. */
const DROP = 1.2;
const cx = (w: number, cell: number) => (cell % w) * S + S / 2;
const cy = (w: number, cell: number) => Math.floor(cell / w) * S + S / 2;

const col = (k: number) => `var(--c${k})`;

function pathD(w: number, path: number[]) {
	return path.map((c, i) => `${i ? 'L' : 'M'} ${cx(w, c)} ${cy(w, c)}`).join(' ');
}

type LineLook = (d: string, k: number, ends: [number, number][]) => ReactNode;

/** Every line style. Add a shop line by adding a case here. */
export const LINE_LOOKS: Record<string, LineLook> = {
	ribbon: (d, k) => (
		<>
			<path d={d} className="ln-shadow" />
			<path d={d} stroke={col(k)} strokeWidth={3.8} />
			<path d={d} className="ln-sheen" strokeWidth={1.1} transform="translate(-0.55 -0.65)" />
		</>
	),
	yarn: (d, k) => (
		<>
			<path d={d} className="ln-shadow" />
			<path d={d} stroke={col(k)} strokeWidth={3.6} />
			<path d={d} className="ln-twist" strokeWidth={3.6} strokeDasharray="0.7 1.1" />
			<path d={d} className="ln-sheen" strokeWidth={0.8} strokeDasharray="0.7 1.1" transform="translate(-0.4 -0.5)" />
		</>
	),
	brush: (d, k, ends) => (
		<>
			<path d={d} stroke={col(k)} strokeWidth={5} opacity={0.32} />
			<path d={d} stroke={col(k)} strokeWidth={3} />
			{ends.map(([x, y], i) => (
				<circle key={i} cx={x} cy={y} r={2.9} fill={col(k)} opacity={0.45} />
			))}
		</>
	),
	glass: (d, k) => (
		<>
			<path d={d} className="ln-shadow" />
			<path d={d} stroke={col(k)} strokeWidth={4.2} opacity={0.38} />
			<path d={d} stroke={col(k)} strokeWidth={1.9} />
			<path d={d} className="ln-glint" strokeWidth={0.7} transform="translate(-0.9 -0.9)" />
		</>
	),
};

type DotLook = (x: number, y: number, k: number) => ReactNode;

const petals = Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2 - Math.PI / 2);

/** Every dot style. Add a shop dot by adding a case here. */
export const DOT_LOOKS: Record<string, DotLook> = {
	pebble: (x, y, k) => (
		<>
			<ellipse cx={x} cy={y + 0.9} rx={3.5} ry={3.2} className="dt-shadow" />
			<circle cx={x} cy={y} r={3.5} fill={col(k)} className="dt-body" />
			<ellipse cx={x - 1.1} cy={y - 1.3} rx={1.4} ry={0.9} className="dt-shine" />
		</>
	),
	button: (x, y, k) => (
		<>
			<ellipse cx={x} cy={y + 0.9} rx={3.6} ry={3.3} className="dt-shadow" />
			<circle cx={x} cy={y} r={3.6} fill={col(k)} className="dt-body" />
			<circle cx={x} cy={y} r={2.6} className="dt-rim" />
			{[
				[-0.8, -0.8],
				[0.8, -0.8],
				[-0.8, 0.8],
				[0.8, 0.8],
			].map(([dx, dy], i) => (
				<circle key={i} cx={x + dx} cy={y + dy} r={0.42} className="dt-hole" />
			))}
		</>
	),
	gem: (x, y, k) => {
		const r = 3.8;
		const pts = Array.from({ length: 6 }, (_, i) => {
			const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
			return [x + Math.cos(a) * r, y + Math.sin(a) * r];
		});
		const p = (list: number[][]) => list.map((q) => q.join(',')).join(' ');
		return (
			<>
				<ellipse cx={x} cy={y + 1} rx={3.4} ry={3} className="dt-shadow" />
				<polygon points={p(pts)} fill={col(k)} strokeLinejoin="round" stroke={col(k)} strokeWidth={0.6} className="dt-body" />
				<polygon points={p([pts[5], pts[0], pts[1], [x, y]])} className="dt-facet" />
				<polygon points={p([pts[2], pts[3], pts[4], [x, y]])} className="dt-dark" />
			</>
		);
	},
	bloom: (x, y, k) => (
		<>
			<ellipse cx={x} cy={y + 1} rx={3.6} ry={3.2} className="dt-shadow" />
			{petals.map((a, i) => (
				<circle key={i} cx={x + Math.cos(a) * 2} cy={y + Math.sin(a) * 2} r={1.9} fill={col(k)} className="dt-body" />
			))}
			<circle cx={x} cy={y} r={1.5} className="dt-heart" />
		</>
	),
};

export interface BoardProps {
	puzzle: Puzzle;
	paths: Paths;
	lineLook: string;
	dotLook: string;
	marks: boolean;
	tint: boolean;
	/** The color being drawn, for the glow under the finger. */
	drawing: number;
	/** Colors whose line is linked. */
	linked: boolean[];
	/** The keyboard cursor, or -1. */
	cursor?: number;
	/** A color that just linked: its dots pulse once. */
	pulse?: number;
	solved?: boolean;
	onDown?: (cell: number) => void;
	onMove?: (cell: number) => void;
	onUp?: () => void;
	className?: string;
	label?: string;
}

export function Board(props: BoardProps) {
	const { puzzle: p, paths, lineLook, dotLook, marks, tint, drawing, linked, cursor = -1, pulse = -1, solved } = props;
	const { w, h } = p;
	const ref = useRef<SVGSVGElement>(null);
	const active = useRef(false);

	const cellAt = (e: RPointerEvent) => {
		const r = ref.current!.getBoundingClientRect();
		const unit = r.width / (w * S + PAD * 2);
		const x = (e.clientX - r.left) / unit - PAD;
		const y = (e.clientY - r.top) / unit - PAD;
		const c = Math.max(0, Math.min(w - 1, Math.floor(x / S)));
		const rr = Math.max(0, Math.min(h - 1, Math.floor(y / S)));
		return rr * w + c;
	};

	const owner = new Int8Array(w * h).fill(-1);
	paths.forEach((path, k) => path.forEach((c) => (owner[c] = k)));
	const look = LINE_LOOKS[lineLook] ?? LINE_LOOKS.ribbon;
	const dot = DOT_LOOKS[dotLook] ?? DOT_LOOKS.pebble;
	const head = drawing >= 0 ? paths[drawing][paths[drawing].length - 1] : -1;

	return (
		<svg
			ref={ref}
			className={`board${solved ? ' solved' : ''} ${props.className ?? ''}`}
			viewBox={`${-PAD} ${-PAD} ${w * S + PAD * 2} ${h * S + PAD * 2 + DROP}`}
			role={props.onDown ? 'application' : 'img'}
			aria-label={props.label ?? 'Puzzle board'}
			onPointerDown={
				props.onDown &&
				((e) => {
					if (e.button > 0) return;
					e.preventDefault();
					try {
						ref.current?.setPointerCapture(e.pointerId);
					} catch {
						// Some pointers can't be captured. Moves still arrive while over the board.
					}
					active.current = true;
					props.onDown!(cellAt(e));
				})
			}
			onPointerMove={props.onMove && ((e) => active.current && props.onMove!(cellAt(e)))}
			onPointerUp={
				props.onUp &&
				(() => {
					if (!active.current) return;
					active.current = false;
					props.onUp!();
				})
			}
			onPointerCancel={
				props.onUp &&
				(() => {
					if (!active.current) return;
					active.current = false;
					props.onUp!();
				})
			}
		>
			<rect x={-PAD} y={-PAD + DROP} width={w * S + PAD * 2} height={h * S + PAD * 2} rx={4.5} className="bd-drop" />
			<rect x={-PAD} y={-PAD} width={w * S + PAD * 2} height={h * S + PAD * 2} rx={4.5} className="bd-back" />
			<g className="bd-cells">
				{Array.from({ length: w * h }, (_, i) => (
					<rect
						key={i}
						x={(i % w) * S + 0.55}
						y={Math.floor(i / w) * S + 0.55}
						width={S - 1.1}
						height={S - 1.1}
						rx={2.4}
						className="bd-cell"
						style={tint && owner[i] >= 0 ? { fill: `color-mix(in oklab, ${col(owner[i])} var(--tint-mix), var(--well))` } : undefined}
					/>
				))}
			</g>
			{head >= 0 && <circle cx={cx(w, head)} cy={cy(w, head)} r={7.5} fill={col(drawing)} className="bd-halo" />}
			<g className="bd-lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
				{paths.map((path, k) =>
					path.length > 1 ? (
						<g key={k} className={linked[k] ? 'ln linked' : 'ln'}>
							{look(pathD(w, path), k, [
								[cx(w, path[0]), cy(w, path[0])],
								[cx(w, path[path.length - 1]), cy(w, path[path.length - 1])],
							])}
						</g>
					) : null,
				)}
			</g>
			<g className="bd-dots">
				{p.pairs.map((pair, k) =>
					[pair.a, pair.b].map((c) => (
						<g key={`${k}-${c}`} className={`dt${linked[k] ? ' linked' : ''}${pulse === k ? ' pulse' : ''}`} style={{ ['--ox' as string]: `${cx(w, c)}px`, ['--oy' as string]: `${cy(w, c)}px` }}>
							{dot(cx(w, c), cy(w, c), k)}
							{marks && <path d={MARKS[k]} className="dt-mark" transform={`translate(${cx(w, c) - 1.8} ${cy(w, c) - 1.8}) scale(0.3)`} />}
						</g>
					)),
				)}
			</g>
			{cursor >= 0 && <rect x={(cursor % w) * S + 0.3} y={Math.floor(cursor / w) * S + 0.3} width={S - 0.6} height={S - 0.6} rx={2.6} className="bd-cursor" />}
		</svg>
	);
}

/** A small solved board for the tips. */
export const DEMO: Puzzle = {
	id: 'demo',
	seed: 0,
	level: 'easy',
	w: 3,
	h: 3,
	pairs: [
		{ a: 0, b: 8 },
		{ a: 3, b: 6 },
	],
	solution: [
		[0, 1, 2, 5, 8],
		[3, 4, 7, 6],
	],
};
