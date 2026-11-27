/** Small drawing parts used everywhere: patterns, numerals, swatches, icons, word chips. */
import type { ReactNode } from 'react';
import { cellName } from '../core/grid.ts';
import type { Sentence, Token } from '../core/words.ts';
import { CREAM, GLASS, INK, NUMERALS } from './art.ts';

/** Shared SVG patterns, one per glass color. Mounted once; any SVG on the page can use them. */
export function GlassDefs() {
	return (
		<svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
			<defs>
				<pattern id="pat-0" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
					<rect width="4" height="11" fill={GLASS[0].deep} opacity="0.42" />
				</pattern>
				<pattern id="pat-1" width="16" height="10" patternUnits="userSpaceOnUse">
					<path d="M 0 5 Q 4 0.5 8 5 T 16 5" fill="none" stroke={GLASS[1].light} strokeWidth="2.2" opacity="0.75" />
				</pattern>
				<pattern id="pat-2" width="10" height="10" patternUnits="userSpaceOnUse">
					<circle cx="2.5" cy="2.5" r="2.1" fill={GLASS[2].deep} opacity="0.5" />
					<circle cx="7.5" cy="7.5" r="2.1" fill={GLASS[2].deep} opacity="0.5" />
				</pattern>
				<pattern id="pat-3" width="12" height="12" patternUnits="userSpaceOnUse">
					<rect width="6" height="6" fill={GLASS[3].deep} opacity="0.42" />
					<rect x="6" y="6" width="6" height="6" fill={GLASS[3].deep} opacity="0.42" />
				</pattern>
				<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#fff" stopOpacity="0.55" />
					<stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
					<stop offset="0.6" stopColor="#fff" stopOpacity="0" />
					<stop offset="1" stopColor="#000" stopOpacity="0.12" />
				</linearGradient>
				<radialGradient id="clear-glass" cx="0.35" cy="0.3" r="0.9">
					<stop offset="0" stopColor="#ffffff" />
					<stop offset="1" stopColor="#dfe9e6" />
				</radialGradient>
				<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="#fff" stopOpacity="0" />
					<stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
					<stop offset="0.55" stopColor="#fffbe0" stopOpacity="0.85" />
					<stop offset="1" stopColor="#fff" stopOpacity="0" />
				</linearGradient>
			</defs>
		</svg>
	);
}

/** A hand-drawn numeral 1..4 (value 0..3), centered on (x, y). */
export function NumeralPath({ v, x = 0, y = 0, scale = 1, color = INK, width = 4.6 }: { v: number; x?: number; y?: number; scale?: number; color?: string; width?: number }) {
	return (
		<path
			d={NUMERALS[v]}
			transform={`translate(${x} ${y}) scale(${scale})`}
			fill="none"
			stroke={color}
			strokeWidth={width / scale}
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	);
}

export function NumeralIcon({ v, size = 28, color = INK }: { v: number; size?: number; color?: string }) {
	return (
		<svg viewBox="-22 -22 44 44" width={size} height={size} aria-hidden="true">
			<NumeralPath v={v} color={color} width={5} />
		</svg>
	);
}

/** A little piece of glass in a color, with its pattern. */
export function Swatch({ c, size = 26, round = 6 }: { c: number; size?: number; round?: number }) {
	return (
		<svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
			<rect x="2" y="2" width="26" height="26" rx={round} fill={GLASS[c].base} />
			<rect x="2" y="2" width="26" height="26" rx={round} fill={`url(#pat-${c})`} />
			<rect x="2" y="2" width="26" height="26" rx={round} fill="url(#sheen)" />
			<rect x="2" y="2" width="26" height="26" rx={round} fill="none" stroke={INK} strokeWidth="2.6" />
		</svg>
	);
}

/** A tiny finished pane: color, pattern and number. */
export function MiniPane({ n, c, size = 30 }: { n: number; c: number; size?: number }) {
	return (
		<svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
			<rect x="2" y="2" width="26" height="26" rx="5" fill={c >= 0 ? GLASS[c].base : '#eef4f1'} />
			{c >= 0 && <rect x="2" y="2" width="26" height="26" rx="5" fill={`url(#pat-${c})`} />}
			<rect x="2" y="2" width="26" height="26" rx="5" fill="none" stroke={INK} strokeWidth="2.4" />
			{n >= 0 && (
				<>
					<circle cx="15" cy="15" r="8.6" fill={CREAM} stroke={INK} strokeWidth="1.6" />
					<NumeralPath v={n} x={15} y={15} scale={0.34} width={2.2} />
				</>
			)}
		</svg>
	);
}

/** Draws hint text: tile names, numbers and colors become chips, so color is never the only cue. */
export function Words({ s, onCell }: { s: Sentence; onCell?: (cell: number) => void }) {
	return (
		<>
			{s.map((t, i) => (
				<Chip key={i} t={t} onCell={onCell} />
			))}
		</>
	);
}

function Chip({ t, onCell }: { t: Token; onCell?: (cell: number) => void }): ReactNode {
	if (typeof t === 'string') return t;
	switch (t.t) {
		case 'cell':
			return (
				<b className="chip chip-cell" onPointerEnter={() => onCell?.(t.cell)}>
					{cellName(t.cell)}
				</b>
			);
		case 'num':
			return (
				<b className="chip chip-num" aria-label={String(t.v + 1)}>
					<NumeralIcon v={t.v} size={17} />
				</b>
			);
		case 'color':
			return (
				<b className="chip chip-color">
					<Swatch c={t.v} size={15} round={4} />
					{GLASS[t.v].name.toLowerCase()}
				</b>
			);
		case 'pair':
			return (
				<b className="chip chip-pair">
					<MiniPane n={t.n} c={t.c} size={18} />
					{GLASS[t.c].name.toLowerCase()} {t.n + 1}
				</b>
			);
	}
}

/** Hand-drawn icons for the tools. Stroke-only, ink color. */
const ICONS: Record<string, string> = {
	undo: 'M 9 8 L 4 13 L 9 18 M 4.5 13 C 10 12.5 15 12 18 14 C 21.5 16.5 20.5 21 16 21',
	redo: 'M 15 8 L 20 13 L 15 18 M 19.5 13 C 14 12.5 9 12 6 14 C 2.5 16.5 3.5 21 8 21',
	pencil: 'M 5 19 L 6 15 L 16 5 C 17 4 18.5 4 19.5 5 C 20.5 6 20.5 7.5 19.5 8.5 L 9.5 18.5 L 5 19 M 14.5 6.5 L 18 10',
	erase: 'M 9 20 L 4.5 15.5 C 3.6 14.6 3.6 13.4 4.5 12.5 L 12.5 4.5 C 13.4 3.6 14.6 3.6 15.5 4.5 L 19.5 8.5 C 20.4 9.4 20.4 10.6 19.5 11.5 L 11 20 M 8 9 L 15 16 M 9 20 L 20 20',
	bulb: 'M 9 17 C 9 14.5 6 12.5 6 9.5 C 6 6 8.8 3.5 12 3.5 C 15.2 3.5 18 6 18 9.5 C 18 12.5 15 14.5 15 17 Z M 9.5 20 L 14.5 20 M 12 7 C 10.5 7 9.3 8 9.2 9.5',
	pause: 'M 9 5 L 9 19 M 15 5 L 15 19',
	gear: 'M 12 8.5 C 14 8.5 15.5 10 15.5 12 C 15.5 14 14 15.5 12 15.5 C 10 15.5 8.5 14 8.5 12 C 8.5 10 10 8.5 12 8.5 M 12 3 L 12 5.5 M 12 18.5 L 12 21 M 3 12 L 5.5 12 M 18.5 12 L 21 12 M 5.6 5.6 L 7.4 7.4 M 16.6 16.6 L 18.4 18.4 M 5.6 18.4 L 7.4 16.6 M 16.6 7.4 L 18.4 5.6',
	back: 'M 14 5 L 7 12 L 14 19',
	close: 'M 6 6 L 18 18 M 18 6 L 6 18',
	play: 'M 8 5 L 18 12 L 8 19 Z',
	reset: 'M 18.5 9 C 17 6 14.5 4.5 11.5 4.5 C 7.5 4.5 4.5 7.8 4.5 12 C 4.5 16.2 7.8 19.5 12 19.5 C 15.5 19.5 18.4 17.2 19.2 14 M 19 4 L 18.8 9.2 L 13.8 8.8',
	book: 'M 4 5.5 C 7 4.5 10 5 12 6.5 C 14 5 17 4.5 20 5.5 L 20 19 C 17 18 14 18.5 12 20 C 10 18.5 7 18 4 19 Z M 12 6.5 L 12 20',
	trophy: 'M 8 4 L 16 4 L 16 9 C 16 12 14 14 12 14 C 10 14 8 12 8 9 Z M 8 6 L 4.5 6 C 4.5 9 6 10.5 8 10.5 M 16 6 L 19.5 6 C 19.5 9 18 10.5 16 10.5 M 12 14 L 12 17.5 M 8.5 20 L 15.5 20 L 14.5 17.5 L 9.5 17.5 Z',
	calendar: 'M 4.5 7 L 19.5 7 L 19.5 19.5 L 4.5 19.5 Z M 4.5 11 L 19.5 11 M 8.5 4.5 L 8.5 8.5 M 15.5 4.5 L 15.5 8.5',
	shuffle: 'M 4 7 L 8 7 C 12 7 12 17 16 17 L 20 17 M 4 17 L 8 17 C 9.5 17 10.5 15.5 11.2 14 M 12.8 10 C 13.5 8.5 14.5 7 16 7 L 20 7 M 17.5 4.5 L 20 7 L 17.5 9.5 M 17.5 14.5 L 20 17 L 17.5 19.5',
	home: 'M 4 11 L 12 4.5 L 20 11 M 6.5 9.5 L 6.5 19.5 L 17.5 19.5 L 17.5 9.5 M 10 19.5 L 10 14 L 14 14 L 14 19.5',
	sun: 'M 12 8 C 14.2 8 16 9.8 16 12 C 16 14.2 14.2 16 12 16 C 9.8 16 8 14.2 8 12 C 8 9.8 9.8 8 12 8 M 12 2.5 L 12 5 M 12 19 L 12 21.5 M 2.5 12 L 5 12 M 19 12 L 21.5 12 M 5.3 5.3 L 7 7 M 17 17 L 18.7 18.7 M 5.3 18.7 L 7 17 M 17 7 L 18.7 5.3',
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="icon">
			<path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}
